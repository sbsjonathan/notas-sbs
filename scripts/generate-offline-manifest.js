#!/usr/bin/env node

/**
 * Generate offline-manifest.json listing static assets that should be cached for
 * offline usage. The manifest combines files from the root of the project and
 * specific feature folders (Bible, rich text editor, Sentinela, etc.).
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const INCLUDE_SOURCES = [
  { path: '.', recursive: false },
  { path: 'biblia', recursive: true },
  { path: 'navbar', recursive: true },
  { path: 'richtext', recursive: true },
  { path: 'save', recursive: true },
  { path: 'sentinela', recursive: true }
];

const OUTPUT_FILE = path.join(ROOT_DIR, 'offline-manifest.json');

const IGNORE_PATTERNS = [
  /^\.git\//,
  /^scripts\//,
  /^node_modules\//,
  /\.DS_Store$/i,
  /Thumbs\.db$/i,
  /\.map$/i
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function shouldIgnore(relativePath) {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function readDirectory(relativeDir, recursive = true, files = new Set()) {
  const absoluteDir = path.join(ROOT_DIR, relativeDir);
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryRelativePath = relativeDir === '.'
      ? entry.name
      : path.join(relativeDir, entry.name);
    const normalizedPath = toPosix(entryRelativePath);

    if (shouldIgnore(`${normalizedPath}${entry.isDirectory() ? '/' : ''}`)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (recursive) {
        readDirectory(entryRelativePath, true, files);
      }
      continue;
    }

    if (entry.isFile()) {
      files.add(normalizedPath);
    }
  }

  return files;
}

function generateManifest() {
  const files = new Set();

  for (const source of INCLUDE_SOURCES) {
    const { path: relativePath, recursive } = source;
    readDirectory(relativePath, recursive !== false, files);
  }

  const fileList = Array.from(files).sort((a, b) => a.localeCompare(b));
  const json = `${JSON.stringify(fileList, null, 2)}\n`;
  fs.writeFileSync(OUTPUT_FILE, json);

  return fileList;
}

function main() {
  try {
    const files = generateManifest();
    console.log(`offline-manifest.json atualizado com ${files.length} arquivos.`);
  } catch (error) {
    console.error('Erro ao gerar manifesto offline:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
