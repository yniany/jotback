import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer } from 'obsidian';
import { extractTags, generateDateString, generateFilename, parseFrontmatter } from './utils';

export const VIEW_TYPE_MEMOS = 'memos-view';

interface MemoData {
    file: TFile;
    content: string;
    createdAt: string;
    tags: string[];
    pinned: boolean;
}

export class MemosView extends ItemView {
    private listContainer!: HTMLElement;
    private countEl!: HTMLElement;
    private tagSelect!: HTMLSelectElement;
    private searchInput!: HTMLInputElement;
    private allTags: Set<string> = new Set();
    private allMemos: MemoData[] = [];
    private isRefreshing = false;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_MEMOS;
    }

    getDisplayText(): string {
        return 'Memos';
    }

    getIcon(): string {
        return 'edit';
    }

    async refresh() {
        if (this.isRefreshing) return;
        this.isRefreshing = true;
        try {
            await this.loadData();
            this.renderList();
        } finally {
            this.isRefreshing = false;
        }
    }

    async onOpen() {
        this.render();

        // Register vault event listeners for real-time updates
        const isMemoFile = (path: string) => path.startsWith('memos/');

        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (isMemoFile(file.path)) this.refresh();
            })
        );

        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (isMemoFile(file.path)) this.refresh();
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (isMemoFile(file.path)) this.refresh();
            })
        );

        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                if (isMemoFile(file.path) || isMemoFile(oldPath)) this.refresh();
            })
        );
    }

    async onClose() {
        this.contentEl.empty();
    }

    async render() {
        const container = this.contentEl;
        container.empty();
        container.addClass('memos-container');

        // ── Compose area ──
        const composeContainer = container.createDiv({ cls: 'compose' });
        
        const textarea = composeContainer.createEl('textarea', { 
            attr: { placeholder: '记录一闪而过的灵感...' } 
        });

        const footer = composeContainer.createDiv({ cls: 'compose-footer' });
        
        const saveBtn = footer.createEl('button', { cls: 'btn-save', text: '保存' });
        
        // #7: save button hidden until textarea has content
        const saveMemo = async () => {
            const content = textarea.value.trim();
            if (!content) return;
            try {
                await this.createMemo(content);
                textarea.value = '';
                composeContainer.removeClass('has-content');
                // vault.on('create') event listener will automatically trigger refresh()
            } catch (err) {
                console.error("Failed to save memo:", err);
            }
        };

        textarea.addEventListener('input', () => {
            if (textarea.value.trim().length > 0) {
                composeContainer.addClass('has-content');
            } else {
                composeContainer.removeClass('has-content');
            }
        });

        saveBtn.onclick = saveMemo;

        // ── Filter bar ──
        const filterBar = container.createDiv({ cls: 'filter-bar' });
        
        const searchWrap = filterBar.createDiv({ cls: 'search-wrap' });
        // Use insertAdjacentHTML to avoid wiping children (#12)
        searchWrap.insertAdjacentHTML('beforeend', `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`);
        
        this.searchInput = searchWrap.createEl('input', {
            cls: 'search-input',
            attr: { type: 'text', placeholder: '搜索内容...' }
        });

        this.tagSelect = filterBar.createEl('select', { cls: 'tag-select' });
        this.tagSelect.createEl('option', { value: '', text: '所有标签' });

        this.searchInput.addEventListener('input', () => this.renderList());
        this.tagSelect.addEventListener('change', () => this.renderList());

        // ── Note list ──
        this.countEl = container.createDiv({ cls: 'note-count' });
        this.listContainer = container.createDiv({ cls: 'note-list' });
        
        await this.refresh();
    }

    async createMemo(content: string) {
        const folderPath = 'memos';
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            try {
                await this.app.vault.createFolder(folderPath);
            } catch (e) {
                console.warn("Folder already exists or error creating folder:", e);
            }
        }

        const filename = generateFilename() + '.md';
        const filepath = `${folderPath}/${filename}`;
        
        const createdAt = generateDateString();
        // Fix #2: No extra blank line between frontmatter and content
        const fileContent = `---\ncreated: ${createdAt}\npinned: false\n---\n${content}`;

        await this.app.vault.create(filepath, fileContent);
    }

    async loadData() {
        const folderPath = 'memos';
        const files = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(folderPath + '/'));
        
        const newMemos: MemoData[] = [];
        const newTags: Set<string> = new Set();

        for (const file of files) {
            const content = await this.app.vault.read(file);
            
            // Fix #1: Use centralized parser that normalizes line endings
            const parsed = parseFrontmatter(content);
            const body = parsed.body;
            const pinned = parsed.pinned;
            const createdAt = parsed.createdAt || generateDateString();
            
            const tags = extractTags(body);
            tags.forEach(t => newTags.add(t));

            newMemos.push({
                file,
                content: body,
                createdAt,
                tags,
                pinned
            });
        }

        // Sort: Pinned first, then by createdAt desc
        newMemos.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return b.createdAt.localeCompare(a.createdAt);
        });

        this.allMemos = newMemos;
        this.allTags = newTags;

        // Update tag select options
        const currentSelectedTag = this.tagSelect.value;
        this.tagSelect.innerHTML = '<option value="">所有标签</option>';
        Array.from(this.allTags).sort().forEach(tag => {
            const option = this.tagSelect.createEl('option', { value: tag, text: `#${tag}` });
            if (tag === currentSelectedTag) option.selected = true;
        });
    }

    renderList() {
        this.listContainer.empty();

        const query = this.searchInput.value.toLowerCase();
        const selectedTag = this.tagSelect.value;

        const filtered = this.allMemos.filter(memo => {
            if (selectedTag && !memo.tags.includes(selectedTag)) return false;
            if (query && !memo.content.toLowerCase().includes(query)) return false;
            return true;
        });

        this.countEl.textContent = `共 ${filtered.length} 条笔记`;

        for (const [index, memo] of filtered.entries()) {
            const card = this.listContainer.createDiv({ cls: 'note-card' });
            if (memo.pinned) card.addClass('pinned');

            // #4: staggered entrance animation (capped at 200ms so late cards don't drag)
            const delay = Math.min(index * 35, 200);
            card.style.animationDelay = `${delay}ms`;

            const contentDiv = card.createDiv({ cls: 'card-content' });
            MarkdownRenderer.renderMarkdown(memo.content, contentDiv, memo.file.path, this);

            const footer = card.createDiv({ cls: 'card-footer' });
            footer.createDiv({ cls: 'card-date', text: memo.createdAt.substring(0, 10) });

            memo.tags.forEach(tag => {
                const tagEl = footer.createSpan({ cls: 'tag-chip', text: `#${tag}` });
                tagEl.onclick = (e) => {
                    e.stopPropagation();
                    this.tagSelect.value = tag;
                    this.renderList();
                };
            });

            // Clicking the card opens it
            card.onclick = (e) => {
                if ((e.target as HTMLElement).tagName === 'A') return;
                const leaf = this.app.workspace.getLeaf(false);
                leaf.openFile(memo.file);
            };
        }
    }
}
