const MARK_CLASS = 'atlas-search-hl';

function normalizeLoose(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function clearSearchHighlights(root: ParentNode = document): void {
  root.querySelectorAll(`mark.${MARK_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

function wrapRange(range: Range): HTMLElement {
  const mark = document.createElement('mark');
  mark.className = MARK_CLASS;
  mark.style.backgroundColor = '#fde68a';
  mark.style.color = 'inherit';
  mark.style.padding = '0 1px';
  mark.style.borderRadius = '2px';
  range.surroundContents(mark);
  return mark;
}

function collectTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK') {
        return NodeFilter.FILTER_REJECT;
      }
      if (!node.textContent || !node.textContent.trim()) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n = walker.nextNode();
  while (n) {
    nodes.push(n as Text);
    n = walker.nextNode();
  }
  return nodes;
}

function findPhraseInMappedText(
  nodes: Text[],
  query: string
): { startNode: Text; startOffset: number; endNode: Text; endOffset: number } | null {
  const needle = normalizeLoose(query);
  if (needle.length < 2) return null;

  let haystack = '';
  const map: Array<{ node: Text; start: number; end: number }> = [];

  for (const node of nodes) {
    const raw = node.textContent || '';
    const start = haystack.length;
    haystack += raw;
    map.push({ node, start, end: haystack.length });
  }

  const hayNorm = haystack.toLowerCase().replace(/ё/g, 'е');
  const compactHay: string[] = [];
  const compactToOrig: number[] = [];
  for (let i = 0; i < hayNorm.length; i += 1) {
    const ch = hayNorm[i];
    if (/\s/.test(ch)) {
      if (compactHay.length && compactHay[compactHay.length - 1] !== ' ') {
        compactHay.push(' ');
        compactToOrig.push(i);
      }
    } else {
      compactHay.push(ch);
      compactToOrig.push(i);
    }
  }
  const compact = compactHay.join('').trim();
  const needleCompact = needle.replace(/\s+/g, ' ').trim();
  const idx = compact.indexOf(needleCompact);
  if (idx < 0) return null;

  const origStart = compactToOrig[idx];
  const origEnd = compactToOrig[idx + needleCompact.length - 1] + 1;

  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (const entry of map) {
    if (startNode == null && origStart >= entry.start && origStart < entry.end) {
      startNode = entry.node;
      startOffset = origStart - entry.start;
    }
    if (origEnd > entry.start && origEnd <= entry.end) {
      endNode = entry.node;
      endOffset = origEnd - entry.start;
      break;
    }
  }

  if (!startNode || !endNode) return null;
  return { startNode, startOffset, endNode, endOffset };
}

function highlightTokens(root: HTMLElement, query: string): HTMLElement[] {
  const tokens = normalizeLoose(query)
    .split(' ')
    .filter((t) => t.length >= 3);
  if (!tokens.length) return [];

  const marks: HTMLElement[] = [];
  const nodes = collectTextNodes(root);

  for (const node of nodes) {
    const text = node.textContent || '';
    const lower = text.toLowerCase().replace(/ё/g, 'е');
    const ranges: Array<{ start: number; end: number }> = [];

    for (const token of tokens) {
      let from = 0;
      while (from < lower.length) {
        const at = lower.indexOf(token, from);
        if (at < 0) break;
        ranges.push({ start: at, end: at + token.length });
        from = at + token.length;
      }
    }

    ranges.sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
      else merged.push({ ...r });
    }

    for (let i = merged.length - 1; i >= 0; i -= 1) {
      const { start, end } = merged[i];
      try {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        marks.push(wrapRange(range));
      } catch {
        // ignore invalid ranges across styled nodes
      }
    }
  }
  return marks;
}

export function highlightSearchInElement(
  root: HTMLElement,
  query: string
): HTMLElement | null {
  clearSearchHighlights(root);
  const q = query.trim();
  if (q.length < 2) return null;

  const nodes = collectTextNodes(root);
  const phrase = findPhraseInMappedText(nodes, q);
  const marks: HTMLElement[] = [];

  if (phrase) {
    try {
      const range = document.createRange();
      range.setStart(phrase.startNode, phrase.startOffset);
      range.setEnd(phrase.endNode, phrase.endOffset);
      marks.push(wrapRange(range));
    } catch {
      marks.push(...highlightTokens(root, q));
    }
  } else {
    marks.push(...highlightTokens(root, q));
  }

  if (!marks.length) return null;
  const first = marks[0];
  first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return first;
}

export function attachHighlightClearOnce(
  root: HTMLElement,
  onClear?: () => void
): () => void {
  const handler = () => {
    clearSearchHighlights(root);
    onClear?.();
    document.removeEventListener('pointerdown', handler, true);
  };
  document.addEventListener('pointerdown', handler, true);
  return () => document.removeEventListener('pointerdown', handler, true);
}

export function splitHighlightParts(
  text: string,
  query: string
): Array<{ text: string; hit: boolean }> {
  const q = query.trim();
  if (!q || !text) return [{ text, hit: false }];

  const needle = normalizeLoose(q);
  const source = text;
  const lower = source.toLowerCase().replace(/ё/g, 'е');

  const idx = lower.indexOf(needle);
  if (idx >= 0) {
    return [
      { text: source.slice(0, idx), hit: false },
      { text: source.slice(idx, idx + needle.length), hit: true },
      { text: source.slice(idx + needle.length), hit: false },
    ].filter((p) => p.text);
  }

  const tokens = needle.split(' ').filter((t) => t.length >= 3);
  if (!tokens.length) return [{ text, hit: false }];

  const pattern = new RegExp(
    `(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  const parts: Array<{ text: string; hit: boolean }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(source)) != null) {
    if (m.index > last) parts.push({ text: source.slice(last, m.index), hit: false });
    parts.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last), hit: false });
  return parts.length ? parts : [{ text, hit: false }];
}
