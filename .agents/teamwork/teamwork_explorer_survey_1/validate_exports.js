const fs = require('fs');
const path = require('path');

function getAllFiles(dir, exts, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        getAllFiles(fullPath, exts, result);
      }
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      result.push(fullPath);
    }
  }
  return result;
}

const files = getAllFiles('frontend', ['.js', '.jsx']);
const exportMap = new Map();

// Step 1: Collect exports from all local files
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const hasDefault = /export\s+default\s+/.test(content);
  const named = new Set();
  
  // export function/const/class/let/var name
  const declRegex = /export\s+(?:async\s+)?(?:function|const|class|let|var)\s+([a-zA-Z0-9_$]+)/g;
  let m;
  while ((m = declRegex.exec(content)) !== null) {
    named.add(m[1]);
  }
  
  // export { a, b as c }
  const blockRegex = /export\s+{([^}]+)}/g;
  while ((m = blockRegex.exec(content)) !== null) {
    const parts = m[1].split(',');
    parts.forEach(p => {
      const match = p.trim().match(/([a-zA-Z0-9_$]+)(?:\s+as\s+([a-zA-Z0-9_$]+))?/);
      if (match) {
        named.add(match[2] || match[1]);
      }
    });
  }

  exportMap.set(path.normalize(file), { hasDefault, named });
});

// Step 2: Validate all relative imports
const issues = [];
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Match standard imports
  // e.g. import Foo, { Bar, Baz as Qux } from './target'
  const importRegex = /import\s+(?:([a-zA-Z0-9_$]+)\s*,?\s*)?(?:{([^}]+)})?\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const defaultName = m[1];
    const namedBlock = m[2];
    const importPath = m[3];

    if (importPath.startsWith('.')) {
      const dir = path.dirname(file);
      let target = path.resolve(dir, importPath);
      let resolved = null;
      const extensions = ['', '.js', '.jsx', '.json', '.css'];
      for (const ext of extensions) {
        if (fs.existsSync(target + ext) && !fs.statSync(target + ext).isDirectory()) {
          resolved = target + ext;
          break;
        }
        if (fs.existsSync(path.join(target, 'index' + ext)) && !fs.statSync(path.join(target, 'index' + ext)).isDirectory()) {
          resolved = path.join(target, 'index' + ext);
          break;
        }
      }

      if (!resolved) {
        issues.push({ file, importPath, error: 'Module not found' });
        continue;
      }

      if (resolved.endsWith('.css') || resolved.endsWith('.json')) {
        continue;
      }

      const targetExports = exportMap.get(path.normalize(resolved));
      if (!targetExports) continue;

      if (defaultName && !targetExports.hasDefault) {
        issues.push({ file, importPath, target: resolved, error: `Default import "${defaultName}" but target has no default export` });
      }

      if (namedBlock) {
        const names = namedBlock.split(',').map(s => s.trim()).filter(Boolean);
        names.forEach(n => {
          const nameMatch = n.match(/([a-zA-Z0-9_$]+)(?:\s+as\s+[a-zA-Z0-9_$]+)?/);
          if (nameMatch) {
            const originalName = nameMatch[1];
            if (originalName !== 'type' && !targetExports.named.has(originalName)) {
              issues.push({ file, importPath, target: resolved, error: `Named import "${originalName}" not exported by target` });
            }
          }
        });
      }
    }
  }
});

console.log('Export validation completed. Issues found:', issues.length);
issues.forEach(i => console.log(JSON.stringify(i, null, 2)));
