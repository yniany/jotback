import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import esbuild from 'esbuild';

const result = await esbuild.build({
    entryPoints: ['src/repository.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [{
        name: 'stub-obsidian-path',
        setup(build) {
            build.onResolve({ filter: /^obsidian$/ }, () => ({
                path: 'obsidian',
                namespace: 'test-stub',
            }));
            build.onLoad({ filter: /.*/, namespace: 'test-stub' }, () => ({
                contents: `export const normalizePath = value => value
                    .replace(/\\\\/g, '/')
                    .replace(/\\/{2,}/g, '/')
                    .replace(/^\\/+|\\/+$/g, '');`,
                loader: 'js',
            }));
        },
    }],
});
const source = result.outputFiles[0].text;
const { listMarkdownFilesInFolder, MemoRepository } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

function createFile(path, mtime, ctime = mtime) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
    return { path, name, extension, stat: { mtime, ctime, size: 100 } };
}

function createVault(files, contents) {
    let reads = 0;
    return {
        vault: {
            getFolderByPath: folder => ({
                path: folder,
                name: folder.slice(folder.lastIndexOf('/') + 1),
                children: files.filter(file => file.path.startsWith(`${folder}/`)),
            }),
            getMarkdownFiles: () => { throw new Error('must not enumerate the vault'); },
            cachedRead: async file => {
                reads++;
                return contents.get(file.path);
            },
        },
        get reads() { return reads; },
    };
}

describe('MemoRepository', () => {
    it('enumerates Markdown files only inside the configured folder', () => {
        const direct = createFile('memos/direct.md', 1);
        const nested = createFile('memos/archive/nested.md', 2);
        const textFile = createFile('memos/readme.txt', 3);
        const root = {
            path: 'memos',
            name: 'memos',
            children: [
                direct,
                { path: 'memos/archive', name: 'archive', children: [nested] },
                textFile,
            ],
        };
        const vault = {
            getFolderByPath: path => path === 'memos' ? root : null,
            getMarkdownFiles: () => { throw new Error('must not enumerate the vault'); },
        };

        assert.deepEqual(
            listMarkdownFilesInFolder(vault, 'memos').map(file => file.path),
            [direct.path, nested.path],
        );
        assert.deepEqual(listMarkdownFilesInFolder(vault, 'missing'), []);
    });

    it('loads, parses, sorts, and aggregates tags', async () => {
        const older = createFile('memos/2026-01-01-100000-000.md', 1);
        const newerPinned = createFile('memos/2026-02-01-100000-000.md', 2);
        const outside = createFile('notes/2026-03-01-100000-000.md', 3);
        const contents = new Map([
            [older.path, '---\ncreated: 2026-01-01 10:00:00\ntags: [alpha]\n---\nOld #body'],
            [newerPinned.path, '---\ncreated: 2026-02-01 10:00:00\npinned: true\ntags:\n  - Beta\n---\nNew #ALPHA'],
            [outside.path, 'Must not be read'],
        ]);
        const app = createVault([older, newerPinned, outside], contents);
        const repository = new MemoRepository(app);

        const collection = await repository.load('memos');

        assert.deepEqual(collection.memos.map(memo => memo.file.path), [newerPinned.path, older.path]);
        assert.deepEqual(collection.tags, ['alpha', 'Beta']);
        assert.deepEqual(collection.memos[1].tags, ['alpha']);
        assert.equal(app.reads, 2);
    });

    it('reuses cached memos until file metadata changes or is invalidated', async () => {
        const file = createFile('memos/2026-01-01-100000-000.md', 1);
        const contents = new Map([[file.path, '---\ntags: [first]\n---\nBody']]);
        const app = createVault([file], contents);
        const repository = new MemoRepository(app);

        await repository.load('memos');
        await repository.load('memos');
        assert.equal(app.reads, 1, 'unchanged files should come from the parsed cache');

        file.stat.mtime = 2;
        await repository.load('memos');
        assert.equal(app.reads, 2, 'mtime changes should invalidate the cached entry');

        repository.invalidate(file.path);
        await repository.load('memos');
        assert.equal(app.reads, 3, 'explicit invalidation should force a read');
    });

    it('removes deleted files from the live collection and cache', async () => {
        const file = createFile('memos/2026-01-01-100000-000.md', 1);
        const files = [file];
        const app = createVault(files, new Map([[file.path, 'Body']]));
        const repository = new MemoRepository(app);

        assert.equal((await repository.load('memos')).memos.length, 1);
        files.length = 0;
        assert.equal((await repository.load('memos')).memos.length, 0);
    });

    it('reads files concurrently in bounded batches', async () => {
        const files = Array.from({ length: 40 }, (_, index) =>
            createFile(`memos/2026-01-01-1000${String(index).padStart(2, '0')}-000.md`, index)
        );
        let activeReads = 0;
        let maximumActiveReads = 0;
        const app = {
            vault: {
                getFolderByPath: folder => ({
                    path: folder,
                    name: folder,
                    children: files,
                }),
                getMarkdownFiles: () => { throw new Error('must not enumerate the vault'); },
                cachedRead: async () => {
                    activeReads++;
                    maximumActiveReads = Math.max(maximumActiveReads, activeReads);
                    await new Promise(resolve => setTimeout(resolve, 1));
                    activeReads--;
                    return 'Body';
                },
            },
        };

        await new MemoRepository(app).load('memos');

        assert.ok(maximumActiveReads > 1, 'reads should not remain serial');
        assert.ok(maximumActiveReads <= 16, 'read concurrency should stay within the batch limit');
    });
});
