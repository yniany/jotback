import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import esbuild from 'esbuild';

const result = await esbuild.build({
    entryPoints: ['src/i18n.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [{
        name: 'stub-obsidian-language',
        setup(build) {
            build.onResolve({ filter: /^obsidian$/ }, () => ({
                path: 'obsidian',
                namespace: 'test-stub',
            }));
            build.onLoad({ filter: /.*/, namespace: 'test-stub' }, () => ({
                contents: 'export const getLanguage = () => globalThis.__obsidianLanguage;',
                loader: 'js',
            }));
        },
    }],
});
const source = result.outputFiles[0].text;
const { t } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

describe('interface translations', () => {
    it('uses English for English and unsupported languages', () => {
        for (const language of ['en', 'en-GB', 'fr', 'ja']) {
            globalThis.__obsidianLanguage = language;
            assert.equal(t('save'), 'Save');
            assert.equal(t('viewName'), 'Jotback');
            assert.equal(t('heatmapTitle'), 'Heatmap');
        }
    });

    it('uses Chinese for Chinese language variants', () => {
        for (const language of ['zh', 'zh-CN', 'zh-TW']) {
            globalThis.__obsidianLanguage = language;
            assert.equal(t('save'), '\u4fdd\u5b58');
            assert.equal(t('viewName'), 'Jotback');
            assert.equal(t('heatmapTitle'), '\u70ed\u529b\u56fe');
        }
    });

    it('interpolates all variables in translated messages', () => {
        globalThis.__obsidianLanguage = 'en';
        assert.equal(t('datedMemoCount', { date: '2026-08-13', count: 3 }), '2026-08-13: 3 memos');

        globalThis.__obsidianLanguage = 'zh-CN';
        assert.equal(
            t('datedMemoCount', { date: '2026-08-13', count: 3 }),
            '2026-08-13\uff1a3 \u6761\u7b14\u8bb0',
        );
    });
});
