import { ItemView, MarkdownRenderer, Notice, setIcon, WorkspaceLeaf } from 'obsidian';
import { MemoHeatmap } from './heatmap';
import { t } from './i18n';
import type JotbackPlugin from './main';
import { RandomReviewDialog } from './random-review';
import { MemoRepository } from './repository';
import type { MemoData } from './types';
import { buildTagsYaml, generateDateString, generateFilename, normalizeMemoFolder } from './utils';

export const VIEW_TYPE_JOTBACK = 'jotback-view';
export const MEMOS_FOLDER = 'memos';

const PAGE_SIZE = 50;
const REFRESH_DEBOUNCE_MS = 100;

export class JotbackView extends ItemView {
    private listContainer!: HTMLElement;
    private countEl!: HTMLElement;
    private tagSelect!: HTMLSelectElement;
    private searchInput!: HTMLInputElement;
    private heatmapEl!: HTMLElement;
    private heatmap!: MemoHeatmap;
    private allMemos: MemoData[] = [];
    private repository = new MemoRepository(this.app);
    private randomReview = new RandomReviewDialog(this.app, this);
    private isRefreshing = false;
    private pendingRefresh = false;
    private heatmapVisible = false;
    private searchDebounceTimer: number | null = null;
    private refreshDebounceTimer: number | null = null;
    private displayCount = PAGE_SIZE;

    constructor(leaf: WorkspaceLeaf, public plugin?: JotbackPlugin) {
        super(leaf);
    }

    get memoFolder(): string {
        return normalizeMemoFolder(this.plugin?.settings.memoFolder || MEMOS_FOLDER);
    }

    getViewType(): string { return VIEW_TYPE_JOTBACK; }
    getDisplayText(): string { return t('viewName'); }
    getIcon(): string { return 'edit'; }

    async refresh(): Promise<void> {
        if (this.isRefreshing) {
            this.pendingRefresh = true;
            return;
        }

        this.isRefreshing = true;
        this.pendingRefresh = false;
        try {
            const collection = await this.repository.load(this.memoFolder);
            this.allMemos = collection.memos;
            this.updateTagOptions(collection.tags);
            this.renderList();
            if (this.heatmapVisible) this.heatmap.render(this.allMemos);
        } finally {
            this.isRefreshing = false;
            if (this.pendingRefresh) void this.refresh();
        }
    }

    async onOpen(): Promise<void> {
        await this.render();
        const isMemoFile = (path: string) => path.startsWith(`${this.memoFolder}/`);
        const queueRefresh = (path: string) => {
            this.repository.invalidate(path);
            if (this.refreshDebounceTimer) this.contentEl.win.clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = this.contentEl.win.setTimeout(
                () => void this.refresh(),
                REFRESH_DEBOUNCE_MS,
            );
        };

        this.registerEvent(this.app.vault.on('create', file => {
            if (isMemoFile(file.path)) queueRefresh(file.path);
        }));
        this.registerEvent(this.app.vault.on('modify', file => {
            if (isMemoFile(file.path)) queueRefresh(file.path);
        }));
        this.registerEvent(this.app.vault.on('delete', file => {
            if (isMemoFile(file.path)) queueRefresh(file.path);
        }));
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            if (isMemoFile(file.path) || isMemoFile(oldPath)) {
                this.repository.invalidate(oldPath);
                queueRefresh(file.path);
            }
        }));
    }

    async onClose(): Promise<void> {
        this.randomReview.close();
        if (this.searchDebounceTimer) this.contentEl.win.clearTimeout(this.searchDebounceTimer);
        if (this.refreshDebounceTimer) this.contentEl.win.clearTimeout(this.refreshDebounceTimer);
        this.repository.clear();
        this.contentEl.empty();
    }

    private async render(): Promise<void> {
        const container = this.contentEl;
        container.empty();
        container.addClass('jotback-container');

        const composeContainer = container.createDiv({ cls: 'compose' });
        const textarea = composeContainer.createEl('textarea', {
            attr: {
                placeholder: t('composePlaceholder'),
                'aria-label': t('composePlaceholder'),
            },
        });
        const footer = composeContainer.createDiv({ cls: 'compose-footer' });
        const saveBtn = footer.createEl('button', {
            cls: 'btn-save',
            text: t('save'),
            attr: { type: 'button' },
        });
        textarea.addEventListener('input', () => {
            composeContainer.toggleClass('has-content', textarea.value.trim().length > 0);
        });
        saveBtn.onclick = async () => {
            const content = textarea.value.trim();
            if (!content) return;
            saveBtn.disabled = true;
            saveBtn.setAttribute('aria-busy', 'true');
            saveBtn.textContent = t('saving');
            try {
                await this.createMemo(content);
                textarea.value = '';
                composeContainer.removeClass('has-content');
            } catch (error) {
                console.error('Failed to save memo:', error);
                const message = error instanceof Error ? error.message : String(error);
                new Notice(t('saveFailed', { message }), 6000);
            } finally {
                saveBtn.disabled = false;
                saveBtn.removeAttribute('aria-busy');
                saveBtn.textContent = t('save');
            }
        };

        const heatmapToggleRow = container.createDiv({ cls: 'hm-toggle-row' });
        const heatmapToggleBtn = heatmapToggleRow.createEl('button', {
            cls: 'hm-toggle-btn',
            attr: { type: 'button', 'aria-expanded': 'false' },
        });
        const chevron = heatmapToggleBtn.createSpan({ cls: 'hm-chevron' });
        chevron.setAttribute('aria-hidden', 'true');
        setIcon(chevron, 'chevron-down');
        heatmapToggleBtn.createSpan({ text: t('heatmapTitle') });
        this.heatmapEl = container.createDiv({ cls: 'hm-container' });
        this.heatmapEl.hide();
        this.heatmap = new MemoHeatmap(this.heatmapEl, () => {
            this.displayCount = PAGE_SIZE;
            this.renderList();
        });
        heatmapToggleBtn.onclick = () => {
            this.heatmapVisible = !this.heatmapVisible;
            heatmapToggleBtn.toggleClass('active', this.heatmapVisible);
            heatmapToggleBtn.setAttribute('aria-expanded', String(this.heatmapVisible));
            if (this.heatmapVisible) {
                this.heatmapEl.show();
                this.heatmap.render(this.allMemos);
            } else {
                this.heatmapEl.hide();
            }
        };

        const filterBar = container.createDiv({ cls: 'filter-bar' });
        const searchWrap = filterBar.createDiv({ cls: 'search-wrap' });
        const searchIcon = searchWrap.createSpan({ cls: 'search-icon' });
        searchIcon.setAttribute('aria-hidden', 'true');
        setIcon(searchIcon, 'search');
        this.searchInput = searchWrap.createEl('input', {
            cls: 'search-input',
            attr: {
                type: 'text',
                placeholder: t('searchPlaceholder'),
                'aria-label': t('searchPlaceholder'),
            },
        });
        this.tagSelect = filterBar.createEl('select', {
            cls: 'tag-select',
            attr: { 'aria-label': t('tagFilter') },
        });
        this.tagSelect.createEl('option', { value: '', text: t('allTags') });
        const randomBtn = filterBar.createEl('button', {
            cls: 'random-btn',
            attr: {
                type: 'button',
                title: t('randomReviewTitle'),
                'aria-label': t('randomReviewTitle'),
            },
        });
        setIcon(randomBtn, 'sparkles');
        randomBtn.onclick = () => this.randomReview.open(this.allMemos);

        this.searchInput.addEventListener('input', () => {
            if (this.searchDebounceTimer) this.contentEl.win.clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = this.contentEl.win.setTimeout(() => {
                this.displayCount = PAGE_SIZE;
                this.renderList();
            }, 300);
        });
        this.tagSelect.addEventListener('change', () => {
            this.displayCount = PAGE_SIZE;
            this.renderList();
        });

        this.countEl = container.createDiv({
            cls: 'note-count',
            attr: { 'aria-live': 'polite' },
        });
        this.listContainer = container.createDiv({ cls: 'note-list' });
        await this.refresh();
    }

    private async createMemo(content: string): Promise<void> {
        const folderPath = this.memoFolder;
        if (!this.app.vault.getAbstractFileByPath(folderPath)) {
            try {
                await this.app.vault.createFolder(folderPath);
            } catch (error) {
                if (!this.app.vault.getAbstractFileByPath(folderPath)) throw error;
            }
        }

        const tagsYaml = buildTagsYaml([]);
        await this.app.vault.create(
            `${folderPath}/${generateFilename()}.md`,
            `---\ncreated: ${generateDateString()}\npinned: false\n${tagsYaml}---\n${content}`,
        );
    }

    private updateTagOptions(tags: string[]): void {
        const selectedTag = this.tagSelect.value;
        this.tagSelect.empty();
        this.tagSelect.createEl('option', { value: '', text: t('allTags') });
        for (const tag of tags) {
            const option = this.tagSelect.createEl('option', { value: tag, text: `#${tag}` });
            if (tag === selectedTag) option.selected = true;
        }
    }

    private renderList(): void {
        this.listContainer.empty();
        const query = this.searchInput.value.trim().toLocaleLowerCase();
        const selectedTag = this.tagSelect.value;
        const dateFilter = this.heatmap.dateFilter;
        const filtered = this.allMemos.filter(memo => {
            if (dateFilter && !memo.createdAt.startsWith(dateFilter)) return false;
            if (selectedTag && !memo.tags.includes(selectedTag)) return false;
            return !query || memo.content.toLocaleLowerCase().includes(query);
        });

        this.countEl.textContent = dateFilter
            ? t('datedMemoCount', { date: dateFilter, count: filtered.length })
            : t('memoCount', { count: filtered.length });

        for (const memo of filtered.slice(0, this.displayCount)) {
            const memoDate = memo.createdAt.substring(0, 10);
            const card = this.listContainer.createDiv({
                cls: 'note-card',
                attr: {
                    role: 'link',
                    tabindex: '0',
                    'aria-label': t('openMemo', { date: memoDate }),
                },
            });
            if (memo.pinned) card.addClass('pinned');
            const content = card.createDiv({ cls: 'card-content' });
            void MarkdownRenderer.render(this.app, memo.content, content, memo.file.path, this);
            const cardFooter = card.createDiv({ cls: 'card-footer' });
            cardFooter.createDiv({ cls: 'card-date', text: memoDate });
            const tagsContainer = cardFooter.createDiv({ cls: 'card-tags' });
            for (const tag of memo.tags) {
                const tagEl = tagsContainer.createEl('button', {
                    cls: 'tag-chip',
                    text: `#${tag}`,
                    attr: {
                        type: 'button',
                        'aria-label': t('filterByTag', { tag }),
                    },
                });
                tagEl.onclick = event => {
                    event.stopPropagation();
                    this.tagSelect.value = tag;
                    this.renderList();
                };
            }
            const openMemo = () => {
                void this.app.workspace.getLeaf(false).openFile(memo.file);
            };
            card.onclick = event => {
                if ((event.target as HTMLElement).closest('a, button, input, select, textarea')) return;
                openMemo();
            };
            card.onkeydown = event => {
                if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                openMemo();
            };
        }

        if (filtered.length > this.displayCount) {
            const remaining = filtered.length - this.displayCount;
            const loadMoreBtn = this.listContainer.createEl('button', {
                cls: 'load-more-btn',
                text: t('loadMore', { count: remaining }),
                attr: { type: 'button' },
            });
            loadMoreBtn.onclick = () => {
                this.displayCount += PAGE_SIZE;
                this.renderList();
            };
        }
    }
}
