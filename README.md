# Obsidian Memos

Quick capture and memo management plugin for Obsidian.

> 开发中 / Work in progress — core features implemented, not yet released to the community plugin registry.

A lightweight plugin for capturing and reviewing short memos inside Obsidian. Memos are stored as timestamped Markdown files in the `memos/` folder — plain text, searchable, and fully portable.

## Features

- **Quick capture**: ribbon icon and command palette entry to open the Memos view
- **Live search + tag filter**: filter memos by keyword or tag (Chinese tags supported)
- **Year-month filter**: browse memos by month
- **Random memo review**: revisit past memos with one command — built for lightweight spaced review
- **Timestamped filenames**: `YYYY-MM-DD-HHMMSS-mmm` format with LF normalization for cross-platform consistency

## Build

```bash
npm install
npm run build   # type-check (tsc) + bundle (esbuild) → main.js
```

## Install (dev)

Copy `main.js`, `manifest.json`, `styles.css` into `<your-vault>/.obsidian/plugins/obsidian-memos/` and enable the plugin in Obsidian settings.

## Tech Stack

TypeScript · Obsidian API · esbuild

## Status

- [x] Custom view (search / tag filter / year-month filter)
- [x] Random memo review
- [x] Tag extraction (incl. Chinese)
- [ ] UI polish
- [ ] Release packaging & community registry submission

## License

MIT © 2026 Yniany
