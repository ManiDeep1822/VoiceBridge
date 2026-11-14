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
console.log('Total files found:', files.length);

const importRegex = /import\s+(?:(?:(\*\s+as\s+\w+)|({[\s\S]*?})|([a-zA-Z0-9_$]+))\s+from\s+)?['"]([^'"]+)['"]/g;
const issues = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const rawImport = match[0];
    const importPath = match[4];

    if (importPath.startsWith('.')) {
      // Relative import
      const dir = path.dirname(file);
      let target = path.resolve(dir, importPath);
      let exists = false;
      const extensions = ['', '.js', '.jsx', '.json', '.css'];
      for (const ext of extensions) {
        if (fs.existsSync(target + ext) && !fs.statSync(target + ext).isDirectory()) {
          exists = true;
          break;
        }
        if (fs.existsSync(path.join(target, 'index' + ext)) && !fs.statSync(path.join(target, 'index' + ext)).isDirectory()) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        issues.push({ file, importPath, error: 'File not found' });
      }
    } else {
      // Package import
      const pkgName = importPath.startsWith('@') ? importPath.split('/').slice(0, 2).join('/') : importPath.split('/')[0];
      const pkgPath = path.join('frontend', 'node_modules', pkgName);
      if (!fs.existsSync(pkgPath) && !importPath.startsWith('node:') && !['assert', 'fs', 'path', 'os', 'child_process'].includes(importPath)) {
        issues.push({ file, importPath, error: 'Package not installed: ' + pkgName });
      }
    }
  }
});

console.log('Import check completed. Issues found:', issues.length);
issues.forEach(i => console.log(JSON.stringify(i, null, 2)));
