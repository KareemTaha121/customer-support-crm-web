/**
 * Minimal, safe Markdown → HTML for knowledge base articles (the API stores Markdown,
 * Domain/KnowledgeBase/KnowledgeArticle.cs `Body`).
 *
 * Safety: every character of the source is HTML-escaped **before** any Markdown syntax is
 * turned into tags, so raw HTML in an article is shown as text. Link and image URLs are limited
 * to http(s), mailto and relative paths. The output is bound with `[innerHTML]`, where Angular's
 * sanitizer runs as a second layer.
 *
 * Supported: `#`–`######` headings, paragraphs, line breaks, `**bold**`, `*italic*`/`_italic_`,
 * `` `code` ``, fenced code blocks, `-`/`*`/`+` and `1.` lists, `>` quotes, `---` rules,
 * `[text](url)` links and `![alt](url)` images.
 */
export function renderMarkdown(source: string | null | undefined): string {
  const lines = (source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      html.push(`<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fence = /^\s*```/.exec(line);
    if (fence) {
      flushAll();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushAll();
      continue;
    }

    const quoteLine = /^\s*>\s?(.*)$/.exec(line);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1]);
      continue;
    }
    flushQuote();

    const heading = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushAll();
      // Article titles are the page h1; content headings start at h2.
      const level = Math.min(heading[1].length + 1, 6);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushAll();
      html.push('<hr>');
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = !!numbered;
      const text = (numbered ?? bullet)?.[1] ?? '';
      if (list && list.ordered !== ordered) {
        flushList();
      }
      list ??= { ordered, items: [] };
      list.items.push(text);
      continue;
    }

    if (list && /^\s{2,}\S/.test(line)) {
      // Continuation of the previous list item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }
  flushAll();
  return html.join('\n');
}

/** Plain-text excerpt of Markdown (for previews). */
export function markdownToText(source: string | null | undefined, max = 200): string {
  const text = (source ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function inline(text: string): string {
  const codes: string[] = [];
  // Protect inline code first so its content is not formatted.
  let out = text.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = escapeHtml(out);
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, url: string) => {
    const safe = safeUrl(url);
    return safe ? `<img src="${safe}" alt="${alt}" loading="lazy">` : alt;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
    const safe = safeUrl(url);
    if (!safe) {
      return label;
    }
    const external = /^(https?:)?\/\//i.test(safe);
    return external ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>` : `<a href="${safe}">${label}</a>`;
  });
  out = out
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\s][^_]*?)_(?=$|[\s).,!?:;])/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>');
  // eslint-disable-next-line no-control-regex
  return out.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codes[Number(index)] ?? '');
}

/** The URL (already HTML-escaped) when it is http(s), mailto, an anchor or a relative path. */
function safeUrl(url: string): string | null {
  const decoded = url.replace(/&amp;/g, '&');
  if (/^(https?:|mailto:)/i.test(decoded) || /^(\/|#|\.\.?\/)/.test(decoded)) {
    return url.replace(/"/g, '&quot;');
  }
  return null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
