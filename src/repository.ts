import type { App, TAbstractFile, TFile, TFolder, Vault } from 'obsidian';
import type { MemoCollection, MemoData } from './types';
import { mergeTags, parseFrontmatter, resolveCreatedAt } from './utils';

interface CacheEntry {
    mtime: number;
    size: number;
    memo: MemoData;
}

const READ_BATCH_SIZE = 16;

function isFolder(entry: TAbstractFile): entry is TFolder {
    return 'children' in entry && Array.isArray(entry.children);
}

function isMarkdownFile(entry: TAbstractFile): entry is TFile {
    return 'extension' in entry
        && typeof entry.extension === 'string'
        && entry.extension.toLocaleLowerCase() === 'md';
}

export function listMarkdownFilesInFolder(vault: Vault, folderPath: string): TFile[] {
    const root = vault.getFolderByPath(folderPath);
    if (!root) return [];

    const files: TFile[] = [];
    const visit = (folder: TFolder): void => {
        for (const child of folder.children) {
            if (isFolder(child)) visit(child);
            else if (isMarkdownFile(child)) files.push(child);
        }
    };
    visit(root);
    return files;
}

export class MemoRepository {
    private cache = new Map<string, CacheEntry>();

    constructor(private app: App) {}

    invalidate(path: string): void {
        this.cache.delete(path);
    }

    clear(): void {
        this.cache.clear();
    }

    async load(folder: string): Promise<MemoCollection> {
        const files = listMarkdownFilesInFolder(this.app.vault, folder);
        const livePaths = new Set(files.map(file => file.path));

        for (const path of this.cache.keys()) {
            if (!livePaths.has(path)) this.cache.delete(path);
        }

        const memos: MemoData[] = [];
        for (let start = 0; start < files.length; start += READ_BATCH_SIZE) {
            const batch = files.slice(start, start + READ_BATCH_SIZE);
            memos.push(...await Promise.all(batch.map(file => this.loadFile(file))));
        }

        const tags = mergeTags(...memos.map(memo => memo.tags))
            .sort((a, b) => a.localeCompare(b));

        memos.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return b.createdAt.localeCompare(a.createdAt);
        });

        return { memos, tags };
    }

    private async loadFile(file: TFile): Promise<MemoData> {
        const cached = this.cache.get(file.path);
        if (cached && cached.mtime === file.stat.mtime && cached.size === file.stat.size) {
            // Keep the latest TFile reference after vault rename/index updates.
            cached.memo.file = file;
            return cached.memo;
        }

        const raw = await this.app.vault.cachedRead(file);
        const parsed = parseFrontmatter(raw);
        const memo: MemoData = {
            file,
            content: parsed.body,
            createdAt: resolveCreatedAt(parsed.createdAt, file.name, file.stat.ctime),
            tags: mergeTags(parsed.yamlTags),
            pinned: parsed.pinned,
        };
        this.cache.set(file.path, { mtime: file.stat.mtime, size: file.stat.size, memo });
        return memo;
    }
}
