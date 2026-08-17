import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import { t } from './i18n';
import { normalizeMemoFolder } from './utils';
import { JotbackView, VIEW_TYPE_JOTBACK } from './view';

export interface JotbackSettings {
    memoFolder: string;
}

export const DEFAULT_SETTINGS: JotbackSettings = {
    memoFolder: 'memos'
};

export default class JotbackPlugin extends Plugin {
    settings: JotbackSettings = DEFAULT_SETTINGS;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE_JOTBACK,
            (leaf: WorkspaceLeaf) => new JotbackView(leaf, this)
        );

        this.addRibbonIcon('edit', t('ribbonOpen'), () => {
            void this.activateView();
        });

        this.addCommand({
            id: 'open-view',
            name: t('commandOpenView'),
            callback: () => {
                void this.activateView();
            }
        });
        
        this.addCommand({
            id: 'open-random-memo',
            name: t('commandOpenRandom'),
            callback: () => {
                void this.openRandomMemo();
            }
        });

        this.addSettingTab(new JotbackSettingTab(this.app, this));
    }

    async loadSettings(): Promise<void> {
        const storedData: unknown = await this.loadData();
        const storedSettings = typeof storedData === 'object' && storedData !== null
            ? storedData as Partial<JotbackSettings>
            : {};
        this.settings = { ...DEFAULT_SETTINGS, ...storedSettings };
        this.settings.memoFolder = normalizeMemoFolder(this.settings.memoFolder);
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_JOTBACK);
        for (const leaf of leaves) {
            if (leaf.view instanceof JotbackView) {
                void leaf.view.refresh();
            }
        }
    }

    async activateView(): Promise<void> {
        const { workspace } = this.app;

        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_JOTBACK);
        if (existingLeaves.length > 0) {
            await workspace.revealLeaf(existingLeaves[0]);
            return;
        }
        
        const leaf = workspace.getLeaf('tab');
        await leaf.setViewState({ type: VIEW_TYPE_JOTBACK, active: true });
        await workspace.revealLeaf(leaf);
    }
    
    async openRandomMemo(): Promise<void> {
        const folder = normalizeMemoFolder(this.settings.memoFolder);
        const files = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(folder + '/'));
        if (files.length === 0) return;
        
        const randomFile = files[Math.floor(Math.random() * files.length)];
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(randomFile);
    }
}

class JotbackSettingTab extends PluginSettingTab {
    plugin: JotbackPlugin;

    constructor(app: App, plugin: JotbackPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions(): SettingDefinitionItem<keyof JotbackSettings>[] {
        return [{
            name: t('memoFolderName'),
            desc: t('memoFolderDescription'),
            control: {
                type: 'folder',
                key: 'memoFolder',
                defaultValue: DEFAULT_SETTINGS.memoFolder,
                placeholder: DEFAULT_SETTINGS.memoFolder,
            },
        }];
    }

    async setControlValue(key: string, value: unknown): Promise<void> {
        if (key !== 'memoFolder' || typeof value !== 'string') return;
        this.plugin.settings.memoFolder = normalizeMemoFolder(value);
        await this.plugin.saveSettings();
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName(t('memoFolderName'))
            .setDesc(t('memoFolderDescription'))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.memoFolder)
                .setValue(this.plugin.settings.memoFolder)
                .onChange(async (value) => {
                    this.plugin.settings.memoFolder = normalizeMemoFolder(value);
                    await this.plugin.saveSettings();
                }));
    }
}
