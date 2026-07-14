import type { Ref } from 'react';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

export type StageMarkdownMark =
  | 'strong'
  | 'emphasis'
  | 'delete'
  | 'code'
  | 'heading'
  | 'quote'
  | 'link'
  | 'image';

export interface StageMarkdownSegment {
  text: string;
  marks: StageMarkdownMark[];
}

interface StageMarkdownContentProps {
  segments: StageMarkdownSegment[];
  containerRef?: Ref<HTMLDivElement>;
}

interface MarkdownAstNode {
  type: string;
  value?: string;
  alt?: string;
  url?: string;
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  children?: MarkdownAstNode[];
}

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks);

export function StageMarkdownContent({ segments, containerRef }: StageMarkdownContentProps) {
  const renderedSegments = countStageMarkdownCharacters(segments) > 0
    ? segments
    : [{ text: '……', marks: [] as StageMarkdownMark[] }];

  return (
    <div className="stage-dialogue-text" ref={containerRef} aria-live="polite">
      {renderedSegments.map((segment, index) => (
        <span
          className={segment.marks.map((mark) => `stage-markdown-${mark}`).join(' ') || undefined}
          key={`${index}:${segment.marks.join(':')}`}
        >
          {segment.text}
        </span>
      ))}
    </div>
  );
}

export function parseStageMarkdown(content: string): StageMarkdownSegment[] {
  try {
    const parsed = markdownProcessor.parse(content);
    const tree = markdownProcessor.runSync(parsed) as unknown as MarkdownAstNode;
    const segments: StageMarkdownSegment[] = [];
    renderBlockChildren(tree.children || [], [], segments);
    trimTrailingBreaks(segments);
    return segments.length ? segments : [{ text: '', marks: [] }];
  } catch {
    return [{ text: content, marks: [] }];
  }
}

export function countStageMarkdownCharacters(segments: StageMarkdownSegment[]) {
  return segments.reduce((total, segment) => total + Array.from(segment.text).length, 0);
}

export function sliceStageMarkdownSegments(segments: StageMarkdownSegment[], length: number) {
  let remaining = Math.max(0, length);
  const visible: StageMarkdownSegment[] = [];

  for (const segment of segments) {
    if (remaining <= 0) break;
    const characters = Array.from(segment.text);
    const visibleText = characters.slice(0, remaining).join('');
    if (visibleText) visible.push({ ...segment, text: visibleText });
    remaining -= characters.length;
  }

  return visible;
}

function renderBlockChildren(
  children: MarkdownAstNode[],
  marks: StageMarkdownMark[],
  segments: StageMarkdownSegment[],
) {
  children.forEach((child, index) => {
    renderNode(child, marks, segments);
    if (index < children.length - 1) appendBreak(segments);
  });
}

function renderNode(
  node: MarkdownAstNode,
  marks: StageMarkdownMark[],
  segments: StageMarkdownSegment[],
) {
  switch (node.type) {
    case 'root':
      renderBlockChildren(node.children || [], marks, segments);
      return;
    case 'text':
      appendText(segments, node.value || '', marks);
      return;
    case 'paragraph':
      renderInlineChildren(node.children || [], marks, segments);
      return;
    case 'strong':
      renderInlineChildren(node.children || [], addMark(marks, 'strong'), segments);
      return;
    case 'emphasis':
      renderInlineChildren(node.children || [], addMark(marks, 'emphasis'), segments);
      return;
    case 'delete':
      renderInlineChildren(node.children || [], addMark(marks, 'delete'), segments);
      return;
    case 'inlineCode':
      appendText(segments, node.value || '', addMark(marks, 'code'));
      return;
    case 'code':
      appendText(segments, node.value || '', addMark(marks, 'code'));
      return;
    case 'heading':
      renderInlineChildren(node.children || [], addMark(addMark(marks, 'heading'), 'strong'), segments);
      return;
    case 'link': {
      const linkMarks = addMark(marks, 'link');
      if (node.children?.length) renderInlineChildren(node.children, linkMarks, segments);
      else appendText(segments, node.url || '', linkMarks);
      return;
    }
    case 'image':
      appendText(segments, node.alt || '图片', addMark(marks, 'image'));
      return;
    case 'break':
      appendBreak(segments, true);
      return;
    case 'blockquote':
      renderQuote(node.children || [], marks, segments);
      return;
    case 'list':
      renderList(node, marks, segments);
      return;
    case 'listItem':
      renderBlockChildren(node.children || [], marks, segments);
      return;
    case 'thematicBreak':
      appendText(segments, '——', marks);
      return;
    case 'table':
      renderTable(node.children || [], marks, segments);
      return;
    case 'tableRow':
      renderTableRow(node.children || [], marks, segments);
      return;
    case 'tableCell':
      renderInlineChildren(node.children || [], marks, segments);
      return;
    case 'html':
    case 'definition':
      return;
    default:
      if (node.value) appendText(segments, node.value, marks);
      else renderInlineChildren(node.children || [], marks, segments);
  }
}

function renderInlineChildren(
  children: MarkdownAstNode[],
  marks: StageMarkdownMark[],
  segments: StageMarkdownSegment[],
) {
  children.forEach((child) => renderNode(child, marks, segments));
}

function renderQuote(
  children: MarkdownAstNode[],
  marks: StageMarkdownMark[],
  segments: StageMarkdownSegment[],
) {
  const quoteMarks = addMark(marks, 'quote');
  children.forEach((child, index) => {
    appendText(segments, '› ', quoteMarks);
    renderNode(child, quoteMarks, segments);
    if (index < children.length - 1) appendBreak(segments);
  });
}

function renderList(
  node: MarkdownAstNode,
  marks: StageMarkdownMark[],
  segments: StageMarkdownSegment[],
) {
  const start = node.start || 1;
  (node.children || []).forEach((item, index) => {
    const prefix = node.ordered ? `${start + index}. ` : '• ';
    appendText(segments, prefix, marks);
    if (typeof item.checked === 'boolean') {
      appendText(segments, item.checked ? '[✓] ' : '[ ] ', marks);
    }
    renderBlockChildren(item.children || [], marks, segments);
    if (index < (node.children?.length || 0) - 1) appendBreak(segments);
  });
}

function renderTable(
  rows: MarkdownAstNode[],
  marks: StageMarkdownMark[],
  segments: StageMarkdownSegment[],
) {
  rows.forEach((row, index) => {
    renderTableRow(row.children || [], marks, segments);
    if (index < rows.length - 1) appendBreak(segments);
  });
}

function renderTableRow(
  cells: MarkdownAstNode[],
  marks: StageMarkdownMark[],
  segments: StageMarkdownSegment[],
) {
  cells.forEach((cell, index) => {
    renderInlineChildren(cell.children || [], marks, segments);
    if (index < cells.length - 1) appendText(segments, ' | ', marks);
  });
}

function appendText(
  segments: StageMarkdownSegment[],
  text: string,
  marks: StageMarkdownMark[],
) {
  if (!text) return;
  const previous = segments[segments.length - 1];
  if (previous && sameMarks(previous.marks, marks)) {
    previous.text += text;
    return;
  }
  segments.push({ text, marks: [...marks] });
}

function appendBreak(segments: StageMarkdownSegment[], force = false) {
  const previous = segments[segments.length - 1];
  if (!force && previous?.text.endsWith('\n')) return;
  appendText(segments, '\n', []);
}

function trimTrailingBreaks(segments: StageMarkdownSegment[]) {
  while (segments.length) {
    const last = segments[segments.length - 1];
    last.text = last.text.replace(/\n+$/u, '');
    if (last.text) return;
    segments.pop();
  }
}

function addMark(marks: StageMarkdownMark[], mark: StageMarkdownMark) {
  return marks.includes(mark) ? marks : [...marks, mark];
}

function sameMarks(left: StageMarkdownMark[], right: StageMarkdownMark[]) {
  return left.length === right.length && left.every((mark, index) => mark === right[index]);
}
