import { getLanguage } from 'obsidian';

const en = {
    viewName: 'Jotback',
    ribbonOpen: 'Open Jotback',
    commandOpenView: 'Open view',
    commandOpenRandom: 'Open random memo',
    memoFolderName: 'Memo storage folder',
    memoFolderDescription: 'A vault-relative folder such as Notes/Jotback. Existing memos are not moved automatically.',
    composePlaceholder: 'Capture a passing thought...',
    save: 'Save',
    saving: 'Saving…',
    saveFailed: 'Failed to save: {message}',
    heatmapTitle: 'Heatmap',
    searchPlaceholder: 'Search memos...',
    tagFilter: 'Filter by tag',
    allTags: 'All tags',
    randomReviewTitle: 'Review a random memo',
    memoCount: '{count} memos',
    datedMemoCount: '{date}: {count} memos',
    loadMore: 'Load more ({count} remaining)',
    heatmapSummary: '{year} · {count} memos',
    heatmapDaySummary: '{date} · {count} memos',
    heatmapPreviousYear: 'Show previous year',
    heatmapNextYear: 'Show next year',
    heatmapClearFilter: 'Clear date filter {date}',
    openMemo: 'Open memo from {date}',
    filterByTag: 'Filter by tag {tag}',
    reviewShortcuts: 'Space Next · Enter Open · Esc Close',
    reviewNext: 'Next',
    reviewOpen: 'Open',
    reviewHeading: 'Memo walk · {date}',
} as const;

type TranslationKey = keyof typeof en;
type Dictionary = Record<TranslationKey, string>;

const zh: Dictionary = {
    viewName: 'Jotback',
    ribbonOpen: '打开 Jotback',
    commandOpenView: '打开视图',
    commandOpenRandom: '打开随机备忘录',
    memoFolderName: '备忘录存储文件夹',
    memoFolderDescription: '仓库内的相对路径，例如 Notes/Jotback。更改后不会自动移动已有备忘录。',
    composePlaceholder: '记录一闪而过的灵感...',
    save: '保存',
    saving: '保存中…',
    saveFailed: '保存失败：{message}',
    heatmapTitle: '热力图',
    searchPlaceholder: '搜索内容...',
    tagFilter: '按标签筛选',
    allTags: '所有标签',
    randomReviewTitle: '随机回顾灵感',
    memoCount: '共 {count} 条笔记',
    datedMemoCount: '{date}：{count} 条笔记',
    loadMore: '加载更多（还有 {count} 条）',
    heatmapSummary: '{year} 年 · 共记录 {count} 条笔记',
    heatmapDaySummary: '{date} · {count} 条笔记',
    heatmapPreviousYear: '显示上一年',
    heatmapNextYear: '显示下一年',
    heatmapClearFilter: '清除日期筛选 {date}',
    openMemo: '打开 {date} 的笔记',
    filterByTag: '按标签 {tag} 筛选',
    reviewShortcuts: 'Space 换一条 · Enter 打开 · Esc 退出',
    reviewNext: '换一条',
    reviewOpen: '打开',
    reviewHeading: '灵感漫步 · {date}',
};

function dictionary(): Dictionary {
    return getLanguage().toLowerCase().startsWith('zh') ? zh : en;
}

export function t(key: TranslationKey, variables: Record<string, string | number> = {}): string {
    return Object.entries(variables).reduce(
        (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
        dictionary()[key],
    );
}
