import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { listWorldSchemas } from './worldSchemas.js';

export const CONTEXT_DIR = resolve(process.cwd(), 'context');
export const USER_CONTEXT_FILE_NAME = '001-user-fixed-context.md';
export const USER_CONTEXT_FILE = resolve(CONTEXT_DIR, USER_CONTEXT_FILE_NAME);
export const GENERATED_SCHEMA_CONTEXT_FILE_NAME = '025-world-schema.generated.md';
export const GENERATED_SCHEMA_CONTEXT_FILE = resolve(CONTEXT_DIR, GENERATED_SCHEMA_CONTEXT_FILE_NAME);

const CONTEXT_FILE_PATTERN = /^(\d+).*\.md$/i;

export function readFixedContextBundle() {
  syncGeneratedWorldSchemaContext();
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

function syncGeneratedWorldSchemaContext() {
  mkdirSync(CONTEXT_DIR, { recursive: true });
  const content = formatWorldSchemaContext(listWorldSchemas());
  const current = existsSync(GENERATED_SCHEMA_CONTEXT_FILE) ? readFileSync(GENERATED_SCHEMA_CONTEXT_FILE, 'utf8') : null;
  if (current !== content) {
    writeFileSync(GENERATED_SCHEMA_CONTEXT_FILE, content, 'utf8');
  }
}

function formatWorldSchemaContext(schemas) {
  return [
    '# 世界数据结构',
    '',
    '这个文件由后端 worldSchemas.js 自动生成，用于让模型了解当前世界数据库支持的实体、组件和关系类型。请不要手动编辑本文件；如需调整 schema，请修改代码里的真实 schema 定义。',
    '',
    '## Entity Kinds',
    '',
    ...schemas.entityKinds.map((kind) => `- ${kind}`),
    '',
    '## Component Types',
    '',
    ...schemas.componentTypes.map((type) => `- ${type}`),
    '',
    '## Relationship Types',
    '',
    ...schemas.relationshipTypes.map((type) => `- ${type}`),
    '',
  ].join('\n');
}
