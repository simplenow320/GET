import xss from "xss";

/**
 * Strip all HTML tags and dangerous characters from user-supplied content.
 * Used before storing plain-text field values (text, url, number, boolean, image).
 */
export function sanitizeContent(input: string | undefined | null): string {
  if (!input) return "";
  return xss(input, {
    whiteList: {},        // no tags allowed
    stripIgnoreTag: true, // strip tags instead of escaping
    stripIgnoreTagBody: ["script", "style"],
  });
}

/**
 * Sanitize rich-text HTML: keep a safe allowlist of formatting tags and strip
 * everything else. Used for `richtext`-type fields so clients can use bold,
 * italic, lists, and hyperlinks without opening XSS vectors.
 *
 * Allowed tags: b, strong, i, em, ul, ol, li, a (href only, safe protocols), br, p
 */
export function sanitizeRichContent(input: string | undefined | null): string {
  if (!input) return "";
  return xss(input, {
    whiteList: {
      b: [],
      strong: [],
      i: [],
      em: [],
      ul: [],
      ol: [],
      li: [],
      a: ["href"],
      br: [],
      p: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style"],
    onTagAttr(tag, name, value) {
      if (tag === "a" && name === "href") {
        const trimmed = (value || "").trim().toLowerCase();
        if (trimmed.startsWith("javascript:") || trimmed.startsWith("vbscript:") || trimmed.startsWith("data:")) {
          return "";
        }
      }
      return undefined;
    },
  });
}
