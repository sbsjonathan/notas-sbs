const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.join(projectRoot, 'richtext', 'offline-manifest.json');

const INCLUDED_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.txt',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf'
]);

const EXCLUDED_DIRS = new Set([
  '.git',
  'scripts'
]);

function isHiddenFile(fileName) {
  return fileName.startsWith('.') && fileName !== '.well-known';
}

function collectFiles(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryName = entry.name;
    if (EXCLUDED_DIRS.has(entryName)) {
      continue;
    }

    const fullPath = path.join(dir, entryName);
    const relativePath = path.relative(projectRoot, fullPath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      if (isHiddenFile(entryName)) {
        continue;
      }
      collectFiles(fullPath, results);
    } else if (entry.isFile()) {
      if (isHiddenFile(entryName)) {
        continue;
      }
      const ext = path.extname(entryName).toLowerCase();
      if (INCLUDED_EXTENSIONS.has(ext)) {
        results.add(relativePath);
      }
    }
  }
}

function generateManifest() {
  const files = new Set();
  collectFiles(projectRoot, files);
  const sorted = Array.from(files).sort((a, b) => a.localeCompare(b));
  const json = JSON.stringify(sorted, null, 2);
  fs.writeFileSync(outputPath, json + '\n');
  console.log(`Manifesto salvo em ${outputPath} com ${sorted.length} arquivos.`);
}

generateManifest();
