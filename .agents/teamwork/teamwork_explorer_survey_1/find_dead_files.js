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
      result.push(path.normalize(fullPath));
    }
  }
  return result;
}

const allSrcFiles = getAllFiles('frontend/src', ['.js', '.jsx', '.css']);
const visited = new Set();
const queue = [path.normalize(path.resolve('frontend/src/main.jsx'))];

while (queue.length > 0) {
  const current = queue.shift();
  if (visited.has(current)) continue;
  visited.add(current);

  if (!fs.existsSync(current)) continue;
  const content = fs.readFileSync(current, 'utf8');
  const importRegex = /import\s+(?:(?:[\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const importPath = m[1];
    if (importPath.startsWith('.')) {
      const dir = path.dirname(current);
      let target = path.resolve(dir, importPath);
      const extensions = ['', '.js', '.jsx', '.json', '.css'];
      for (const ext of extensions) {
        if (fs.existsSync(target + ext) && !fs.statSync(target + ext).isDirectory()) {
          const norm = path.normalize(target + ext);
          if (!visited.has(norm)) queue.push(norm);
          break;
        }
        if (fs.existsSync(path.join(target, 'index' + ext)) && !fs.statSync(path.join(target, 'index' + ext)).isDirectory()) {
          const norm = path.normalize(path.join(target, 'index' + ext));
          if (!visited.has(norm)) queue.push(norm);
          break;
        }
      }
    }
  }
}

console.log('Total src files:', allSrcFiles.length);
console.log('Reachable src files from main.jsx:', visited.size);
const unvisited = allSrcFiles.filter(f => !visited.has(path.normalize(path.resolve(f))));
console.log('Unreachable files:', unvisited);
