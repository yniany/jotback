import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const readme = await readFile('README.md', 'utf8');
const mainSource = await readFile('src/main.ts', 'utf8');
const viewSource = await readFile('src/view.ts', 'utf8');
const heatmapSource = await readFile('src/heatmap.ts', 'utf8');

describe('Jotback product identity', () => {
    it('uses the final display name and technical identifiers', () => {
        assert.equal(manifest.id, 'jotback');
        assert.equal(manifest.name, 'Jotback');
        assert.equal(packageJson.name, 'obsidian-jotback');
        assert.match(viewSource, /VIEW_TYPE_JOTBACK = 'jotback-view'/);
    });

    it('uses the approved positioning in public documentation', () => {
        assert.match(readme, /^# Jotback for Obsidian/m);
        assert.match(readme, /Jot down\. Look back\./);
        assert.match(readme, /\.obsidian\/plugins\/jotback\//);
    });

    it('retains the existing memo storage default for data compatibility', () => {
        assert.match(mainSource, /memoFolder: 'memos'/);
        assert.match(readme, /default is `memos\/`/);
    });

    it('uses Obsidian-compatible settings and accessible interactive controls', () => {
        assert.doesNotMatch(mainSource, /console\.log|createEl\('h2'/);
        assert.match(viewSource, /'aria-label': t\('randomReviewTitle'\)/);
        assert.match(viewSource, /card\.onkeydown/);
        assert.match(heatmapSource, /createEl\('button'/);
        assert.match(heatmapSource, /'aria-pressed'/);
    });
});
