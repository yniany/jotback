export function extractTags(content: string): string[] {
    const regex = /#([\w\u4e00-\u9fff/·]+)/g;
    const matches = content.match(regex);
    if (!matches) return [];
    
    const tags = matches
        .map(t => t.substring(1)) // remove '#'
        .filter(t => t.length > 0 && t.length < 25);
    
    return [...new Set(tags)];
}

export function generateDateString(): string {
    const date = new Date();
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
 * Normalize line endings to LF (\n) for cross-platform compatibility.
 */
export function normalizeLineEndings(text: string): string {
    return text.replace(/\r\n/g, '\n');
}

/**
 * Parse frontmatter from a normalized markdown string.
 * Returns { frontmatter: string (raw YAML block), body: string, pinned: boolean, createdAt: string | null }
 */
export function parseFrontmatter(content: string): {
    frontmatterRaw: string;
    body: string;
    pinned: boolean;
    createdAt: string | null;
} {
    const normalized = normalizeLineEndings(content);
    
    if (!normalized.startsWith('---')) {
        return { frontmatterRaw: '', body: normalized, pinned: false, createdAt: null };
    }
    
    const endIdx = normalized.indexOf('\n---', 3);
    if (endIdx === -1) {
        return { frontmatterRaw: '', body: normalized, pinned: false, createdAt: null };
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
    
    // frontmatterRaw includes the delimiters
    const frontmatterRaw = normalized.substring(0, endIdx + 4);
    
    return { frontmatterRaw, body, pinned, createdAt };
}
