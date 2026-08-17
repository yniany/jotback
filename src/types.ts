import type { TFile } from 'obsidian';

export interface MemoData {
    file: TFile;
    content: string;
    createdAt: string;
    tags: string[];
    pinned: boolean;
}

export interface MemoCollection {
    memos: MemoData[];
    tags: string[];
}
