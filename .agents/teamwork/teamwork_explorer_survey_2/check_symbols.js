const fs = require('fs');
const path = require('path');

function getFiles(dir, exts = ['.js', '.jsx']) {
  let files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== 'dist') {
        files = files.concat(getFiles(full, exts));
      }
    } else if (exts.some(ext => item.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

const frontendDir = path.resolve(__dirname, '../../../frontend');
const files = getFiles(path.join(frontendDir, 'src'));

function resolveModule(fromFile, importPath) {
  const dir = path.dirname(fromFile);
  const target = path.resolve(dir, importPath);
  const candidates = [
    target,
    target + '.js',
    target + '.jsx',
    path.join(target, 'index.js'),
    path.join(target, 'index.jsx')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

let symbolIssues = [];

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  // Match named imports: import { A, B as C } from './...'
  const importNamedRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importNamedRegex.exec(code)) !== null) {
    const rawSymbols = match[1];
    const importPath = match[2];
    if (!importPath.startsWith('.')) continue;

    const targetFile = resolveModule(file, importPath);
    if (!targetFile) continue;

    const targetCode = fs.readFileSync(targetFile, 'utf8');
    const symbols = rawSymbols.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);

    for (const sym of symbols) {
      // Check if targetCode exports sym:
      // export const/let/var/function/class sym
      // export { ... sym ... }
      const exportDeclRegex = new RegExp(`export\\s+(?:async\\s+)?(?:const|let|var|function|class)\\s+${sym}\\b`);
      const exportListRegex = new RegExp(`export\\s+\\{[^}]*\\b${sym}\\b[^}]*\\}`);
      const exportDefaultRegex = new RegExp(`export\\s+default\\s+${sym}\\b`);

      const hasExport = exportDeclRegex.test(targetCode) || 
                        exportListRegex.test(targetCode) ||
                        (sym === 'default' && (targetCode.includes('export default') || exportDefaultRegex.test(targetCode)));
      
      if (!hasExport) {
        symbolIssues.push({
          file: path.relative(frontendDir, file),
          importedSymbol: sym,
          from: path.relative(frontendDir, targetFile)
        });
      }
    }
  }
}

console.log('Symbol export issues count:', symbolIssues.length);
if (symbolIssues.length > 0) {
  console.log(JSON.stringify(symbolIssues, null, 2));
}
