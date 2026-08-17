import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import esbuild from 'esbuild';

const result = await esbuild.build({
    entryPoints: ['src/utils.ts'],
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
const utils = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

describe('parseFrontmatter', () => {
    it('parses LF frontmatter, metadata, body, and block tags', () => {
        const content = [
            '---',
            'created: 2026-08-13 09:30:00',
            'pinned: true',
            'tags:',
            '  - tag-one',
            '  - "tag-two"',
            '---',
            'Body content',
        ].join('\n');

        assert.deepEqual(utils.parseFrontmatter(content), {
            frontmatterRaw: content.slice(0, content.lastIndexOf('\n---') + 4),
            body: 'Body content',
            pinned: true,
            createdAt: '2026-08-13 09:30:00',
            yamlTags: ['tag-one', 'tag-two'],
        });
    });

    it('normalises CRLF and parses inline tags with quoted values', () => {
        const parsed = utils.parseFrontmatter(
            '---\r\ncreated: "2026-08-13 09:30:00"\r\npinned: false\r\ntags: [alpha, "beta tag", gamma]\r\n---\r\nBody',
        );

        assert.equal(parsed.body, 'Body');
        assert.equal(parsed.pinned, false);
        assert.equal(parsed.createdAt, '2026-08-13 09:30:00');
        assert.deepEqual(parsed.yamlTags, ['alpha', 'beta tag', 'gamma']);
        assert.equal(parsed.frontmatterRaw.includes('\r'), false);
    });

    it('stops block tags before the next frontmatter field', () => {
        const parsed = utils.parseFrontmatter(
            '---\ntags:\n  - tag-one\n  - tag-two\naliases:\n  - example\n---\nBody',
        );

        assert.deepEqual(parsed.yamlTags, ['tag-one', 'tag-two']);
    });

    it('treats content without frontmatter as body text', () => {
        assert.deepEqual(utils.parseFrontmatter('Plain body #tag'), {
            frontmatterRaw: '',
            body: 'Plain body #tag',
            pinned: false,
            createdAt: null,
            yamlTags: [],
        });
    });

    it('does not consume an unterminated frontmatter block', () => {
        const content = '---\ncreated: 2026-08-13 09:30:00\nBody';
        assert.deepEqual(utils.parseFrontmatter(content), {
            frontmatterRaw: '',
            body: content,
            pinned: false,
            createdAt: null,
            yamlTags: [],
        });
    });

    it('round-trips a generated YAML tag block', () => {
        const tags = ['tag-one', 'tag-two'];
        const parsed = utils.parseFrontmatter(`---\n${utils.buildTagsYaml(tags)}---\nBody`);
        assert.deepEqual(parsed.yamlTags, tags);
        assert.equal(utils.buildTagsYaml([]), 'tags: []\n');
    });
});

describe('tag utilities', () => {
    it('deduplicates YAML tags case-insensitively in first-seen order', () => {
        assert.deepEqual(
            utils.mergeTags(['YAML', 'shared', 'SHARED', 'yaml']),
            ['YAML', 'shared'],
        );
    });

    it('keeps YAML tags separate from hashtags in the memo body', () => {
        const parsed = utils.parseFrontmatter(
            '---\ntags:\n  - yaml-tag\n  - shared-tag\n---\nBody #body-tag #shared-tag',
        );

        assert.deepEqual(parsed.yamlTags, ['yaml-tag', 'shared-tag']);
        assert.deepEqual(utils.mergeTags(parsed.yamlTags), ['yaml-tag', 'shared-tag']);
    });
});

describe('memo folder normalization', () => {
    it('normalizes vault-relative nested folder paths', () => {
        assert.equal(utils.normalizeMemoFolder(' /Notes\\Jotback// '), 'Notes/Jotback');
    });

    it('uses the existing default when the setting is empty', () => {
        assert.equal(utils.normalizeMemoFolder('  '), 'memos');
    });
});

describe('memo date resolution', () => {
    it('parses a valid timestamped memo filename', () => {
        assert.equal(
            utils.parseMemoFilenameDate('2025-01-02-030405-006.md'),
            '2025-01-02 03:04:05',
        );
    });

    it('rejects invalid filenames, calendar dates, and times', () => {
        for (const filename of [
            'memo.md',
            '2025-02-30-030405-006.md',
            '2025-01-02-240405-006.md',
            '2025-01-02-036005-006.md',
        ]) {
            assert.equal(utils.parseMemoFilenameDate(filename), null, filename);
        }
    });

    it('prefers a valid frontmatter date over filename and ctime', () => {
        assert.equal(
            utils.resolveCreatedAt('2026-08-13 09:30:00', '2025-01-02-030405-006.md', 0),
            '2026-08-13 09:30:00',
        );
    });

    it('accepts supported frontmatter date variants', () => {
        for (const value of ['2026-08-13', '2026-08-13 09:30', '2026-08-13T09:30:00']) {
            assert.equal(utils.resolveCreatedAt(value, 'invalid.md', 0), value);
        }
    });

    it('falls back to the filename when frontmatter is missing or malformed', () => {
        for (const value of [null, 'not-a-date', '2026-02-30', '2026-08-13 24:00:00']) {
            assert.equal(
                utils.resolveCreatedAt(value, '2025-01-02-030405-006.md', 0),
                '2025-01-02 03:04:05',
            );
        }
    });

    it('falls back to file ctime when no valid metadata or filename exists', () => {
        const ctime = new Date(2024, 4, 6, 7, 8, 9).getTime();
        assert.equal(
            utils.resolveCreatedAt(null, 'legacy-memo.md', ctime),
            '2024-05-06 07:08:09',
        );
    });
});
