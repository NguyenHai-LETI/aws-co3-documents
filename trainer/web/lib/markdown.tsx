import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: false });

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Rewrites relative links to Markdown files (e.g. ../../../03-database-services.md#rds) into in-app note links. */
function rewriteLinks(html: string, base: string): string {
  return html.replace(/href="([^"]+)"/g, (m, raw: string) => {
    const hrefValue = raw.replace(/&amp;/g, '&');
    if (/^([a-z]+:|#|\/)/i.test(hrefValue)) return /^https?:/i.test(hrefValue) ? `${m} target="_blank" rel="noreferrer"` : m;
    const [p, anchor] = hrefValue.split('#');
    if (!/\.(md|txt)$/i.test(p)) return m;
    const resolved = new URL(p, `http://x/${base}`).pathname.replace(/^\//, '');
    const target = `#/notes?f=${encodeURIComponent(decodeURIComponent(resolved))}${anchor ? `&a=${encodeURIComponent(anchor)}` : ''}`;
    return `href="${target}"`;
  });
}

export function renderMarkdown(src: string, opts: { anchors?: boolean; base?: string } = {}): string {
  let html = marked.parse(src, { async: false }) as string;
  if (opts.anchors) {
    html = html.replace(/<h([1-4])>(.*?)<\/h\1>/g, (_m, level: string, inner: string) => `<h${level} id="${slug(inner)}">${inner}</h${level}>`);
  }
  html = rewriteLinks(html, opts.base ?? '');
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'id'] });
}

/** `base` = directory (relative to the repo root, with trailing slash) used to resolve relative links. */
export function Markdown({ text, className = '', anchors = false, base = '' }: { text: string; className?: string; anchors?: boolean; base?: string }) {
  const html = useMemo(() => renderMarkdown(text ?? '', { anchors, base }), [text, anchors, base]);
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Inline Markdown (no wrapping <p>) for option texts and short labels. */
export function InlineMarkdown({ text }: { text: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parseInline(text ?? '', { async: false }) as string), [text]);
  return <span className="md-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
