import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { DatabaseSync } from 'node:sqlite';
import { listWorldSchemas } from './worldSchemas.js';

export const DATA_DIR = resolve(process.cwd(), 'data');
export const FACTORY_CONTEXT_DIR = resolve(process.cwd(), 'context');
export const TEMPLATE_DIR = join(DATA_DIR, 'template');
export const SAVE_DIR = join(DATA_DIR, 'save');
export const TEMPLATE_CONTEXT_DIR = join(TEMPLATE_DIR, 'context');
export const SAVE_CONTEXT_DIR = join(SAVE_DIR, 'context');
export const TEMPLATE_DB_FILE = join(TEMPLATE_DIR, 'newchat.sqlite');
export const SAVE_DB_FILE = join(SAVE_DIR, 'newchat.sqlite');
export const SAVE_IMPORT_DB_FILE = join(SAVE_DIR, 'newchat.import.sqlite');
export const LEGACY_DB_FILE = join(DATA_DIR, 'newchat.sqlite');
export const USER_CONTEXT_FILE_NAME = '001-user-fixed-context.md';
export const SAVE_USER_CONTEXT_FILE = join(SAVE_CONTEXT_DIR, USER_CONTEXT_FILE_NAME);
export const GENERATED_SCHEMA_CONTEXT_FILE_NAME = '025-world-schema.generated.md';

const SQLITE_COMPANION_SUFFIXES = ['', '-wal', '-shm'];

export function ensureDataLayout() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(TEMPLATE_DIR, { recursive: true });
  mkdirSync(SAVE_DIR, { recursive: true });

  if (!existsSync(SAVE_DB_FILE) && existsSync(LEGACY_DB_FILE)) {
    copySqliteFamily(LEGACY_DB_FILE, SAVE_DB_FILE);
  }

  if (!existsSync(TEMPLATE_DB_FILE) && existsSync(LEGACY_DB_FILE)) {
    copySqliteFamily(LEGACY_DB_FILE, TEMPLATE_DB_FILE);
  }

  if (isMissingOrEmptyDirectory(TEMPLATE_CONTEXT_DIR)) {
    copyDirectoryContents(FACTORY_CONTEXT_DIR, TEMPLATE_CONTEXT_DIR, { clear: true });
  }

  syncGeneratedWorldSchemaContext(TEMPLATE_CONTEXT_DIR);

  if (isMissingOrEmptyDirectory(SAVE_CONTEXT_DIR)) {
    copyDirectoryContents(TEMPLATE_CONTEXT_DIR, SAVE_CONTEXT_DIR, { clear: true });
  }

  syncGeneratedWorldSchemaContext(SAVE_CONTEXT_DIR);
}

export function ensureTemplateDbFromSaveIfMissing() {
  if (!hasWorldDbSchema(TEMPLATE_DB_FILE) && existsSync(SAVE_DB_FILE)) {
    copySqliteFamily(SAVE_DB_FILE, TEMPLATE_DB_FILE);
  }
}

export function resetSaveToTemplate() {
  if (!existsSync(TEMPLATE_DB_FILE)) {
    throw new Error('Template database does not exist.');
  }

  copyDirectoryContents(TEMPLATE_CONTEXT_DIR, SAVE_CONTEXT_DIR, { clear: true });
  syncGeneratedWorldSchemaContext(SAVE_CONTEXT_DIR);
}

export function createSaveExportBundle(mode) {
  const exportMode = mode === 'full' ? 'full' : 'template';
  syncGeneratedWorldSchemaContext(TEMPLATE_CONTEXT_DIR);
  syncGeneratedWorldSchemaContext(SAVE_CONTEXT_DIR);

  const bundle = {
    version: 1,
    mode: exportMode,
    createdAt: new Date().toISOString(),
    template: {
      worldDbBase64: readDbBase64(TEMPLATE_DB_FILE),
      contextFiles: readContextFiles(TEMPLATE_CONTEXT_DIR),
    },
  };

  if (exportMode === 'full') {
    bundle.save = {
      worldDbBase64: readDbBase64(SAVE_DB_FILE),
      contextFiles: readContextFiles(SAVE_CONTEXT_DIR),
      conversations: null,
    };
  }

  return bundle;
}

export function importSaveBundle(bundle) {
  if (!bundle || bundle.version !== 1 || !bundle.template) {
    throw new Error('Invalid NewChat save bundle.');
  }

  const savePart = bundle.save ?? bundle.template;

  writeDbBase64(TEMPLATE_DB_FILE, bundle.template.worldDbBase64);
  writeContextFiles(TEMPLATE_CONTEXT_DIR, bundle.template.contextFiles);
  syncGeneratedWorldSchemaContext(TEMPLATE_CONTEXT_DIR);

  writeDbBase64(SAVE_IMPORT_DB_FILE, savePart.worldDbBase64);
  writeContextFiles(SAVE_CONTEXT_DIR, savePart.contextFiles);
  syncGeneratedWorldSchemaContext(SAVE_CONTEXT_DIR);

  return {
    conversations: Array.isArray(savePart.conversations) ? savePart.conversations : null,
    saveDbFile: SAVE_IMPORT_DB_FILE,
  };
}

export function syncGeneratedWorldSchemaContext(contextDir = SAVE_CONTEXT_DIR) {
  mkdirSync(contextDir, { recursive: true });
  const filePath = join(contextDir, GENERATED_SCHEMA_CONTEXT_FILE_NAME);
  const nextContent = `${formatGeneratedWorldSchemaContext()}\n`;

  if (!existsSync(filePath) || readFileSync(filePath, 'utf8') !== nextContent) {
    writeFileSync(filePath, nextContent, 'utf8');
  }
}

function formatGeneratedWorldSchemaContext() {
  const schemas = listWorldSchemas();
  return [
    '# 世界数据库结构说明（自动生成）',
    '',
    '这个文档由后端根据当前代码里的世界数据库 schema 自动生成，用来告诉世界 Agent 可以使用哪些实体、组件和关系类型。',
    '',
    '## Entity Kinds',
    '',
    ...schemas.entityKinds.map((kind) => `- \`${kind}\``),
    '',
    '## Component Types',
    '',
    ...schemas.componentTypes.map((type) => `- \`${type}\``),
    '',
    '## Relationship Types',
    '',
    ...schemas.relationshipTypes.map((type) => `- \`${type}\``),
    '',
    '## 使用规则',
    '',
    '- 查询和修改世界数据时，只能使用以上列出的类型。',
    '- 如果需要新增长期事实，优先复用已有实体、组件和关系类型。',
    '- 不要编造 schema 中不存在的类型；如果现有类型不足以表达，应在回复中说明限制，而不是直接写入未知类型。',
    '',
    '> 注意：这个 Markdown 只是写给模型看的说明；真实数据库校验和工具白名单仍然由后端代码控制。',
  ].join('\n');
}

function isMissingOrEmptyDirectory(dirPath) {
  if (!existsSync(dirPath)) {
    return true;
  }

  return readdirSync(dirPath).length === 0;
}

function hasWorldDbSchema(filePath) {
  if (!existsSync(filePath)) {
    return false;
  }

  let database = null;
  try {
    database = new DatabaseSync(filePath);
    const row = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'entities'").get();
    return Boolean(row);
  } catch {
    return false;
  } finally {
    database?.close();
  }
}

function copyDirectoryContents(sourceDir, targetDir, options = {}) {
  if (options.clear) {
    rmSync(targetDir, { recursive: true, force: true });
  }

  mkdirSync(targetDir, { recursive: true });

  if (!existsSync(sourceDir)) {
    return;
  }

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
    } else if (entry.isFile()) {
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function copySqliteFamily(sourceFile, targetFile) {
  mkdirSync(dirname(targetFile), { recursive: true });
  removeSqliteFamily(targetFile);

  for (const suffix of SQLITE_COMPANION_SUFFIXES) {
    const sourcePath = `${sourceFile}${suffix}`;
    const targetPath = `${targetFile}${suffix}`;
    if (existsSync(sourcePath)) {
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function removeSqliteFamily(filePath) {
  for (const suffix of SQLITE_COMPANION_SUFFIXES) {
    rmSync(`${filePath}${suffix}`, { force: true });
  }
}

function readDbBase64(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Database file does not exist: ${filePath}`);
  }

  return readFileSync(filePath).toString('base64');
}

function writeDbBase64(filePath, base64) {
  if (typeof base64 !== 'string' || base64.length === 0) {
    throw new Error('Save bundle is missing a database payload.');
  }

  mkdirSync(dirname(filePath), { recursive: true });
  removeSqliteFamily(filePath);
  writeFileSync(filePath, Buffer.from(base64, 'base64'));
}

function readContextFiles(contextDir) {
  if (!existsSync(contextDir)) {
    return [];
  }

  return readdirSync(contextDir)
    .filter((name) => isSafeContextFileName(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => {
      const filePath = join(contextDir, name);
      const stats = statSync(filePath);
      return {
        name,
        content: stats.isFile() ? readFileSync(filePath, 'utf8') : '',
      };
    });
}

function writeContextFiles(contextDir, files) {
  if (!Array.isArray(files)) {
    throw new Error('Save bundle is missing context files.');
  }

  rmSync(contextDir, { recursive: true, force: true });
  mkdirSync(contextDir, { recursive: true });

  for (const file of files) {
    if (!file || !isSafeContextFileName(file.name)) {
      continue;
    }

    writeFileSync(join(contextDir, basename(file.name)), String(file.content ?? ''), 'utf8');
  }
}

function isSafeContextFileName(name) {
  return typeof name === 'string' && basename(name) === name && name.endsWith('.md');
}

ensureDataLayout();
