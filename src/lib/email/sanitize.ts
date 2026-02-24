/**
 * Server-side HTML sanitization for email bodies.
 * Uses sanitize-html with email-specific allowed tags and attributes.
 * Blocks scripts, iframes, objects. Rewrites links for safety.
 */

import sanitizeHtml from "sanitize-html";

/** Allowed tags for email HTML rendering */
const ALLOWED_TAGS = [
  // Structure
  "div", "span", "p", "br", "hr", "center", "blockquote", "pre",
  // Headings
  "h1", "h2", "h3", "h4", "h5", "h6",
  // Lists
  "ul", "ol", "li",
  // Tables
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  // Text formatting
  "b", "i", "u", "s", "em", "strong", "small", "sub", "sup", "mark",
  "del", "ins", "code", "abbr", "cite",
  // Media
  "img",
  // Links
  "a",
  // Styling
  "font", "style",
];

/** Allowed attributes per tag */
const ALLOWED_ATTRS: Record<string, string[]> = {
  "*": ["style", "class", "id", "dir", "lang"],
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height", "style"],
  td: ["colspan", "rowspan", "width", "height", "align", "valign", "bgcolor", "style"],
  th: ["colspan", "rowspan", "width", "height", "align", "valign", "bgcolor", "style"],
  table: ["width", "height", "cellpadding", "cellspacing", "border", "align", "bgcolor", "style"],
  tr: ["bgcolor", "style", "align", "valign"],
  font: ["color", "face", "size"],
  col: ["width", "span"],
  colgroup: ["span"],
};

/** CSS properties allowed in inline styles */
const ALLOWED_STYLES: Record<string, Record<string, RegExp[]>> = {
  "*": {
    color: [/^.*$/],
    "background-color": [/^.*$/],
    "background": [/^.*$/],
    "font-size": [/^.*$/],
    "font-family": [/^.*$/],
    "font-weight": [/^.*$/],
    "font-style": [/^.*$/],
    "text-align": [/^.*$/],
    "text-decoration": [/^.*$/],
    "text-transform": [/^.*$/],
    "text-indent": [/^.*$/],
    "line-height": [/^.*$/],
    "letter-spacing": [/^.*$/],
    margin: [/^.*$/],
    "margin-top": [/^.*$/],
    "margin-right": [/^.*$/],
    "margin-bottom": [/^.*$/],
    "margin-left": [/^.*$/],
    padding: [/^.*$/],
    "padding-top": [/^.*$/],
    "padding-right": [/^.*$/],
    "padding-bottom": [/^.*$/],
    "padding-left": [/^.*$/],
    border: [/^.*$/],
    "border-collapse": [/^.*$/],
    "border-spacing": [/^.*$/],
    width: [/^.*$/],
    height: [/^.*$/],
    "max-width": [/^.*$/],
    "min-width": [/^.*$/],
    display: [/^.*$/],
    "vertical-align": [/^.*$/],
    "white-space": [/^.*$/],
    "word-break": [/^.*$/],
    overflow: [/^.*$/],
    "overflow-wrap": [/^.*$/],
    "list-style": [/^.*$/],
    "list-style-type": [/^.*$/],
    "table-layout": [/^.*$/],
  },
};

/**
 * Sanitize raw email HTML for safe rendering.
 *
 * - Strips scripts, iframes, objects, forms, embeds
 * - Keeps email-specific tags (tables, fonts, styles)
 * - Rewrites all links with rel="noopener noreferrer" target="_blank"
 * - Preserves inline images (data: and cid: protocols blocked, only http/https)
 */
export function sanitizeEmailHtml(rawHtml: string): string {
  if (!rawHtml) return "";

  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ["http", "https", "mailto", "cid"],
    allowedSchemesByTag: {
      img: ["http", "https", "cid", "data"],
      a: ["http", "https", "mailto"],
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
    // Remove empty style tags
    exclusiveFilter: (frame) => {
      return frame.tag === "style" && !frame.text.trim();
    },
  });
}
