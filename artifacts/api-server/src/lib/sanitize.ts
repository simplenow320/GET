import xss from "xss";

/**
 * Strip all HTML tags and dangerous characters from user-supplied content.
 * Used before storing any editor-submitted field values.
 */
export function sanitizeContent(input: string | undefined | null): string {
  if (!input) return "";
  return xss(input, {
    whiteList: {},        // no tags allowed
    stripIgnoreTag: true, // strip tags instead of escaping
    stripIgnoreTagBody: ["script", "style"],
  });
}
