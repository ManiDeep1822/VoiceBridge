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
let brokenImports = [];

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), importPath);
      const exists = fs.existsSync(resolved) || 
                     fs.existsSync(resolved + '.js') || 
                     fs.existsSync(resolved + '.jsx') ||
                     fs.existsSync(path.join(resolved, 'index.js')) ||
                     fs.existsSync(path.join(resolved, 'index.jsx'));
      if (!exists) {
        brokenImports.push({ file, importPath, resolved });
      }
    }
  }
}
console.log('Broken imports count:', brokenImports.length);
if (brokenImports.length > 0) {
  console.log(JSON.stringify(brokenImports, null, 2));
}
