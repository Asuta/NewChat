import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAVE_RULES_DIR } from './saveManager.js';

const SECTION_HEADING_PATTERN = /^##\s+\[([^\]]+)\]\s+(.+)$/;

export function getRuleToc() {
  const index = loadRulesIndex();
  const categories = [...new Set(index.sections.map((section) => section.category).filter(Boolean))].sort();
  return {
    ok: true,
    categories,
    documents: index.documents.map((document) => ({
      path: document.path,
      title: document.title,
      category: document.category,
      tags: document.tags,
      sections: index.sections
        .filter((section) => section.documentPath === document.path)
        .map((section) => ({
          id: section.id,
          title: section.title,
          category: section.category,
          tags: section.tags,
        })),
    })),
    summary: `已读取规则目录，共 ${index.sections.length} 条规则段落。`,
  };
}

export function searchRules({ query = '', category = '', tags = [], limit = 8 } = {}) {
  const index = loadRulesIndex();
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const normalizedCategory = String(category || '').trim().toLowerCase();
  const normalizedTags = Array.isArray(tags) ? tags.map((tag) => String(tag).toLowerCase()).filter(Boolean) : [];
  const max = Math.max(1, Math.min(Number(limit) || 8, 20));

  const results = index.sections
    .filter((section) => {
      if (normalizedCategory && section.category.toLowerCase() !== normalizedCategory) return false;
      if (normalizedTags.length && !normalizedTags.every((tag) => section.tags.map((value) => value.toLowerCase()).includes(tag))) {
        return false;
      }
      return true;
    })
    .map((section) => ({
      section,
      score: scoreRuleSection(section, normalizedQuery, queryTokens),
    }))
    .filter((entry) => !normalizedQuery || entry.score > 0)
    .sort((left, right) => right.score - left.score || left.section.id.localeCompare(right.section.id))
    .slice(0, max)
    .map(({ section }) => ({
      id: section.id,
      title: section.title,
      category: section.category,
      tags: section.tags,
      documentPath: section.documentPath,
      snippet: createSnippet(section.content),
    }));

  return {
    ok: true,
    query,
    results,
    summary: results.length ? `找到 ${results.length} 条规则。` : '没有找到匹配规则。',
  };
}

export function getRuleSection(id) {
  const normalizedId = String(id || '').trim();
  const section = loadRulesIndex().sections.find((item) => item.id === normalizedId);
  if (!section) {
    return {
      ok: false,
      error: `规则段落 ${normalizedId || '(empty)'} 不存在。`,
    };
  }

  return {
    ok: true,
    rule: {
      id: section.id,
      title: section.title,
      category: section.category,
      tags: section.tags,
      documentPath: section.documentPath,
      content: section.content,
    },
    summary: `已读取规则：${section.title}。`,
  };
}

function loadRulesIndex() {
  const manifest = readManifest();
  const documents = resolveDocuments(manifest);
  const sections = documents.flatMap(parseDocumentSections);
  return { documents, sections };
}

function readManifest() {
  const manifestPath = join(SAVE_RULES_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) {
    return { documents: [] };
  }

  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return { documents: [] };
  }
}

function resolveDocuments(manifest) {
  const fromManifest = Array.isArray(manifest?.documents) ? manifest.documents : [];
  const manifestDocuments = fromManifest
    .map((document) => normalizeDocumentMeta(document))
    .filter((document) => document && existsSync(join(SAVE_RULES_DIR, ...document.path.split('/'))));

  if (manifestDocuments.length) {
    return manifestDocuments;
  }

  return listMarkdownFiles(SAVE_RULES_DIR).map((path) => ({
    path,
    title: path,
    category: '',
    tags: [],
  }));
}

function normalizeDocumentMeta(document) {
  const path = typeof document?.path === 'string' ? document.path.replace(/\\/g, '/') : '';
  if (!isSafeRulePath(path) || !path.endsWith('.md')) {
    return null;
  }

  return {
    path,
    title: typeof document.title === 'string' ? document.title : path,
    category: typeof document.category === 'string' ? document.category : '',
    tags: Array.isArray(document.tags) ? document.tags.map(String) : [],
  };
}

function listMarkdownFiles(rootDir, currentDir = rootDir) {
  if (!existsSync(currentDir)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(rootDir, fullPath));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }
    files.push(fullPath.slice(rootDir.length + 1).replace(/\\/g, '/'));
  }
  return files.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function parseDocumentSections(document) {
  const filePath = join(SAVE_RULES_DIR, ...document.path.split('/'));
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(SECTION_HEADING_PATTERN);
    if (match) {
      if (current) sections.push(finalizeSection(current));
      current = {
        id: match[1].trim(),
        title: match[2].trim(),
        documentPath: document.path,
        category: document.category,
        tags: document.tags,
        contentLines: [],
      };
      continue;
    }

    if (current) {
      current.contentLines.push(line);
    }
  }

  if (current) sections.push(finalizeSection(current));
  return sections;
}

function finalizeSection(section) {
  return {
    id: section.id,
    title: section.title,
    documentPath: section.documentPath,
    category: section.category,
    tags: section.tags,
    content: section.contentLines.join('\n').trim(),
  };
}

function scoreRuleSection(section, query, tokens) {
  const haystack = [section.id, section.title, section.category, section.tags.join(' '), section.content].join('\n').toLowerCase();
  let score = 0;
  if (query && haystack.includes(query)) score += 8;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 2;
    if (section.id.toLowerCase().includes(token) || section.title.toLowerCase().includes(token)) score += 3;
  }
  return score;
}

function createSnippet(content) {
  const compact = String(content || '').replace(/\s+/g, ' ').trim();
  return compact.length > 220 ? `${compact.slice(0, 220)}...` : compact;
}

function isSafeRulePath(path) {
  if (!path || path.startsWith('/') || path.includes(':')) return false;
  const parts = path.split('/');
  return parts.every(Boolean) && !parts.includes('..');
}
