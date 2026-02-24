"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

interface EmailHtmlBodyProps {
  html?: string | null;
  text?: string | null;
}

/**
 * Renders sanitized HTML email body with XSS protection.
 * Falls back to plain text display if no HTML is available.
 * Uses DOMPurify for client-side sanitization.
 */
export function EmailHtmlBody({ html, text }: EmailHtmlBodyProps) {
  const sanitizedHtml = useMemo(() => {
    if (!html) return null;

    // DOMPurify sanitization with email-safe config
    const clean = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ALLOWED_TAGS: [
        "a", "abbr", "b", "blockquote", "br", "caption", "code", "col",
        "colgroup", "dd", "del", "details", "div", "dl", "dt", "em",
        "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins",
        "li", "mark", "ol", "p", "pre", "q", "s", "small", "span",
        "strong", "sub", "summary", "sup", "table", "tbody", "td",
        "tfoot", "th", "thead", "tr", "u", "ul", "font", "center",
      ],
      ALLOWED_ATTR: [
        "href", "target", "rel", "src", "alt", "title", "class", "id",
        "style", "width", "height", "align", "valign", "bgcolor",
        "border", "cellpadding", "cellspacing", "colspan", "rowspan",
        "color", "face", "size",
      ],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ["target"],
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    });

    // Force all links to open in new tab
    return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
  }, [html]);

  // Plain text fallback
  if (!sanitizedHtml) {
    if (!text) {
      return (
        <p className="text-sm text-muted-foreground italic">
          Kein Inhalt verfuegbar.
        </p>
      );
    }

    return (
      <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">
        {text}
      </pre>
    );
  }

  return (
    <div className="email-html-body">
      {/* CSS containment prevents email styles from bleeding out */}
      <div
        className="prose prose-sm dark:prose-invert max-w-none overflow-hidden [&_img]:max-w-full [&_table]:max-w-full [&_table]:overflow-x-auto [&_a]:text-brand-600 [&_a:hover]:text-brand-700 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground"
        style={{ contain: "layout style" }}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  );
}
