import { App, Component, MarkdownRenderer } from 'obsidian';
import { t } from './i18n';
import type { MemoData } from './types';

export class RandomReviewDialog {
    private cleanup: (() => void) | null = null;

    constructor(private app: App, private owner: Component) {}

    open(memos: MemoData[]): void {
        if (memos.length === 0) return;
        this.close();

        const dialogDocument = activeDocument;
        const dialogWindow = activeWindow;
        const previouslyFocused = dialogDocument.activeElement?.instanceOf(HTMLElement)
            ? dialogDocument.activeElement
            : null;
        const backdrop = dialogDocument.body.createDiv({ cls: 'memo-modal-backdrop' });
        let currentMemo = memos[Math.floor(Math.random() * memos.length)];

        const card = backdrop.createDiv({ cls: 'memo-modal-card' });
        const titleId = 'jotback-random-dialog-title';
        const bodyId = 'jotback-random-dialog-body';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-labelledby', titleId);
        card.setAttribute('aria-describedby', bodyId);
        card.setAttribute('tabindex', '-1');

        const header = card.createDiv({ cls: 'modal-header' });
        const titleEl = header.createDiv({ cls: 'modal-title' });
        titleEl.id = titleId;

        const bodyEl = card.createDiv({ cls: 'modal-body card-content' });
        bodyEl.id = bodyId;
        bodyEl.setAttribute('aria-live', 'polite');

        const modalFooter = card.createDiv({ cls: 'modal-footer' });
        modalFooter.createDiv({ cls: 'modal-footer-left' }).createSpan({
            cls: 'modal-shortcuts',
            text: t('reviewShortcuts'),
        });
        const footerRight = modalFooter.createDiv({ cls: 'modal-footer-right' });
        const nextBtn = footerRight.createEl('button', {
            cls: 'modal-next-btn',
            text: t('reviewNext'),
            attr: { type: 'button' },
        });
        const openBtn = footerRight.createEl('button', {
            cls: 'modal-action-btn primary-outline',
            text: t('reviewOpen'),
            attr: { type: 'button' },
        });

        const renderMemo = (memo: MemoData) => {
            currentMemo = memo;
            titleEl.textContent = t('reviewHeading', { date: memo.createdAt.substring(0, 10) });
            bodyEl.empty();
            void MarkdownRenderer.render(this.app, memo.content, bodyEl, memo.file.path, this.owner);
        };

        const pickNext = () => {
            if (memos.length <= 1) return;
            let nextMemo: MemoData;
            do {
                nextMemo = memos[Math.floor(Math.random() * memos.length)];
            } while (nextMemo === currentMemo);
            renderMemo(nextMemo);
        };

        const close = () => {
            dialogWindow.removeEventListener('keydown', handleKeydown);
            backdrop.remove();
            this.cleanup = null;
            if (previouslyFocused?.isConnected) previouslyFocused.focus();
        };

        const openCurrentFile = () => {
            close();
            void this.app.workspace.getLeaf(false).openFile(currentMemo.file);
        };

        nextBtn.onclick = event => {
            event.stopPropagation();
            pickNext();
        };
        openBtn.onclick = event => {
            event.stopPropagation();
            openCurrentFile();
        };
        backdrop.onclick = event => {
            if (event.target === backdrop) close();
        };

        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
            }

            if (event.key === 'Tab') {
                this.trapFocus(event, card);
                return;
            }

            const targetNode = event.targetNode;
            const target = targetNode?.instanceOf(HTMLElement) ? targetNode : null;
            const isInteractive = target?.closest(
                'input, textarea, select, button, a[href], [contenteditable="true"]'
            );
            if (isInteractive || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;

            if (event.key === ' ' || event.code === 'Space') {
                event.preventDefault();
                pickNext();
            } else if (event.key === 'Enter') {
                event.preventDefault();
                openCurrentFile();
            }
        };

        renderMemo(currentMemo);
        dialogWindow.addEventListener('keydown', handleKeydown);
        card.focus();
        this.cleanup = close;
    }

    close(): void {
        this.cleanup?.();
    }

    private trapFocus(event: KeyboardEvent, card: HTMLElement): void {
        const focusable = Array.from(card.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
            + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(element => element.offsetParent !== null);

        if (focusable.length === 0) {
            event.preventDefault();
            card.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeElement = card.doc.activeElement;
        const focusIsOutsideControls = !focusable.includes(activeElement as HTMLElement);
        if (event.shiftKey && (activeElement === first || focusIsOutsideControls)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (activeElement === last || focusIsOutsideControls)) {
            event.preventDefault();
            first.focus();
        }
    }
}
