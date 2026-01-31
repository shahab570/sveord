/**
 * Strips markdown syntax from a string to provide a clean plain-text preview.
 */
export function stripMarkdown(text: string | undefined | null): string {
    if (!text) return "";

    return text
        // Remove bold/italics
        .replace(/(\*\*|__)(.*?)\1/g, "$2")
        .replace(/(\*|_)(.*?)\1/g, "$2")
        // Remove headers
        .replace(/^#{1,6}\s+/gm, "")
        // Remove links [text](url) -> text
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        // Remove blockquotes >
        .replace(/^>\s+/gm, "")
        // Remove horizontal rules
        .replace(/^-{3,}$/gm, "")
        // Remove line breaks and normalize spaces
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
