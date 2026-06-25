import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GENERATED_SCHEMA_CONTEXT_FILE_NAME,
  SAVE_CONTEXT_DIR,
  SAVE_USER_CONTEXT_FILE,
  syncGeneratedWorldSchemaContext,
  USER_CONTEXT_FILE_NAME,
} from './saveManager.js';

export const CONTEXT_DIR = SAVE_CONTEXT_DIR;
export const USER_CONTEXT_FILE = SAVE_USER_CONTEXT_FILE;
export const GENERATED_SCHEMA_CONTEXT_FILE = resolve(CONTEXT_DIR, GENERATED_SCHEMA_CONTEXT_FILE_NAME);

const CONTEXT_FILE_PATTERN = /^(\d+).*\.md$/i;

export function readFixedContextBundle() {
  syncGeneratedWorldSchemaContext(CONTEXT_DIR);
  const files = readContextFiles();
  const editableFile = files.find((file) => file.name === USER_CONTEXT_FILE_NAME);
  const updatedAt = files.reduce((latest, file) => Math.max(latest, file.updatedAt || 0), 0);

  return {
    content: combineContextFiles(files),
    editableContent: editableFile?.content || '',
    updatedAt: updatedAt || null,
    files,
  };
}

export function writeUserFixedContext(content) {
  mkdirSync(CONTEXT_DIR, { recursive: true });
  writeFileSync(USER_CONTEXT_FILE, content, 'utf8');
}

function readContextFiles() {
  if (!existsSync(CONTEXT_DIR)) return [];

  return readdirSync(CONTEXT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(CONTEXT_FILE_PATTERN);
      if (!match) return null;

      const path = resolve(CONTEXT_DIR, entry.name);
      const stat = statSync(path);
      return {
        name: entry.name,
        order: Number(match[1]),
        content: readFileSync(path, 'utf8'),
        updatedAt: Math.round(stat.mtimeMs),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

function combineContextFiles(files) {
  return files
    .filter((file) => file.content.trim())
    .map((file) => [`## 固定上下文文档：${file.name}`, file.content.trim()].join('\n\n'))
    .join('\n\n');
}
