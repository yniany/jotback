import { normalizePath } from 'obsidian';

export function generateDateString(date: Date = new Date()): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function generateFilename(): string {
    const date = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const timeStr = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${dateStr}-${timeStr}-${ms}`;
}

/**
 * Normalize a user-configured memo folder to a vault-relative path.
 */
export function normalizeMemoFolder(value: string, fallback = 'memos'): string {
    return normalizePath(value.trim() || fallback);
}

function isValidDateParts(year: number, month: number, day: number): boolean {
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day;
}

function isValidCreatedAt(value: string): boolean {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!match) return false;

    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    return isValidDateParts(Number(year), Number(month), Number(day))
        && Number(hour) <= 23
        && Number(minute) <= 59
        && Number(second) <= 59;
}

/**
 * Recover a memo creation timestamp from its standard timestamped filename.
 */
export function parseMemoFilenameDate(filename: string): string | null {
    const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})-\d{3}(?:\.md)?$/i);
    if (!match) return null;

    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);

    if (!isValidDateParts(year, month, day)
        || hour > 23
        || minute > 59
        || second > 59) {
        return null;
    }

    return `${yearText}-${monthText}-${dayText} ${hourText}:${minuteText}:${secondText}`;
}

/**
 * Resolve a stable creation date without treating an old memo as newly created
 * every time the view refreshes.
 */
export function resolveCreatedAt(
    frontmatterCreated: string | null,
    filename: string,
    fileCreatedTime: number
): string {
    const frontmatterDate = frontmatterCreated?.trim();
    if (frontmatterDate && isValidCreatedAt(frontmatterDate)) return frontmatterDate;

    const filenameDate = parseMemoFilenameDate(filename);
    if (filenameDate) return filenameDate;

    return generateDateString(new Date(fileCreatedTime));
}

/** Merge tag sources case-insensitively while preserving first-seen spelling and order. */
export function mergeTags(...tagGroups: string[][]): string[] {
    const merged: string[] = [];
    const seen = new Set<string>();

    for (const tag of tagGroups.flat()) {
        const key = tag.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(tag);
    }

    return merged;
}

/**
 * Normalize line endings to LF (\n) for cross-platform compatibility.
 */
export function normalizeLineEndings(text: string): string {
    // Replace \r\n (Windows) first, then any remaining \r (old Mac)
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Parse the YAML tags field from frontmatter text.
 * Supports both block sequence and inline array forms:
 *   tags:\n  - foo\n  - bar
 *   tags: [foo, bar]
 */
function parseFrontmatterTags(fmText: string): string[] {
    // Inline array: tags: [foo, bar, baz]
    const inlineMatch = fmText.match(/^tags:\s*\[([^\]]*)\]/im);
    if (inlineMatch) {
        return inlineMatch[1]
            .split(',')
            .map(t => t.trim().replace(/^["']|["']$/g, ''))
            .filter(t => t.length > 0);
    }

    // Block sequence: read only consecutive indented list items after tags:.
    // Using \s here would also consume line breaks and could cross into the
    // next frontmatter field or closing delimiter.
    const lines = fmText.split('\n');
    const tagsLineIndex = lines.findIndex(line => /^tags:[ \t]*$/i.test(line));
    if (tagsLineIndex !== -1) {
        const tags: string[] = [];
        for (let index = tagsLineIndex + 1; index < lines.length; index++) {
            const itemMatch = lines[index].match(/^[ \t]+-[ \t]+(.+?)[ \t]*$/);
            if (!itemMatch) break;
            const tag = itemMatch[1].trim().replace(/^["']|["']$/g, '');
            if (tag) tags.push(tag);
        }
        return tags;
    }

    return [];
}

/**
 * Build a YAML tags block string for frontmatter.
 * Keeps an explicit empty tags property when no tags have been assigned yet.
 */
export function buildTagsYaml(tags: string[]): string {
    if (tags.length === 0) return 'tags: []\n';
    return `tags:\n${tags.map(t => `  - ${t}`).join('\n')}\n`;
}

/**
 * Parse frontmatter from a markdown string.
 * Returns frontmatterRaw, body, pinned, createdAt, and yamlTags (from YAML tags: field).
 */
export function parseFrontmatter(content: string): {
    frontmatterRaw: string;
    body: string;
    pinned: boolean;
    createdAt: string | null;
    yamlTags: string[];
} {
    const normalized = normalizeLineEndings(content);
    
    if (!normalized.startsWith('---')) {
        return { frontmatterRaw: '', body: normalized, pinned: false, createdAt: null, yamlTags: [] };
    }
    
    const endIdx = normalized.indexOf('\n---', 3);
    if (endIdx === -1) {
        return { frontmatterRaw: '', body: normalized, pinned: false, createdAt: null, yamlTags: [] };
    }
    
    const fmText = normalized.substring(3, endIdx);
    const body = normalized.substring(endIdx + 4).trim();
    
    let pinned = false;
    let createdAt: string | null = null;
    
    const pinnedMatch = fmText.match(/pinned:\s*(true|false)/i);
    if (pinnedMatch) {
        pinned = pinnedMatch[1].toLowerCase() === 'true';
    }
    
    const createdMatch = fmText.match(/created:\s*["']?([^"'\r\n]+)["']?/i);
    if (createdMatch) {
        createdAt = createdMatch[1].trim();
    }

    const yamlTags = parseFrontmatterTags(fmText);
    
    // frontmatterRaw includes the delimiters
    const frontmatterRaw = normalized.substring(0, endIdx + 4);
    
    return { frontmatterRaw, body, pinned, createdAt, yamlTags };
}
