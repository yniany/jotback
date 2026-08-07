import { Plugin, WorkspaceLeaf } from 'obsidian';
import { MemosView, VIEW_TYPE_MEMOS } from './view';

export default class MemosPlugin extends Plugin {
    async onload() {
        console.log('loading obsidian-memos plugin');

        this.registerView(
            VIEW_TYPE_MEMOS,
            (leaf: WorkspaceLeaf) => new MemosView(leaf)
        );

        this.addRibbonIcon('edit', 'Open Memos', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-memos-view',
            name: 'Open Memos',
            callback: () => {
                this.activateView();
            }
        });
        
        // Command to insert a random memo
        this.addCommand({
            id: 'open-random-memo',
            name: 'Open Random Memo',
            callback: () => {
                this.openRandomMemo();
            }
        });
    }

    async onunload() {
        console.log('unloading obsidian-memos plugin');
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_MEMOS);
    }

    async activateView() {
        const { workspace } = this.app;

        // If a Memos tab already exists, just reveal it (preserves search/edit state)
        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_MEMOS);
        if (existingLeaves.length > 0) {
            workspace.revealLeaf(existingLeaves[0]);
            return;
        }
        
        // Otherwise, open in a new tab in the main workspace
        const leaf = workspace.getLeaf('tab');
        await leaf.setViewState({ type: VIEW_TYPE_MEMOS, active: true });
        workspace.revealLeaf(leaf);
    }
    
    async openRandomMemo() {
        const folderPath = 'memos';
        const files = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(folderPath + '/'));
        if (files.length === 0) return;
        
        const randomFile = files[Math.floor(Math.random() * files.length)];
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(randomFile);
    }
}
