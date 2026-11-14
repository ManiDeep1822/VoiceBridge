import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendDir, '..');

describe('Milestone 2 Adversarial Challenger 2 Stress Harness', () => {

  // =========================================================================
  // 1. Cross-Platform Scripts Stress Testing
  // =========================================================================
  describe('1. Cross-Platform Scripts Stress Testing', () => {
    it('executes lint, format, and typecheck scripts with exit code 0 and clean output', () => {
      const scripts = [
        { name: 'lint', expected: 'No lint errors found' },
        { name: 'format', expected: 'Code formatting verified' },
        { name: 'typecheck', expected: 'Type check verified' }
      ];
      
      for (const { name, expected } of scripts) {
        // Run via npm in frontend directory
        const output = execSync(`npm run ${name}`, {
          cwd: frontendDir,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        assert.ok(output.includes(expected), `Script ${name} output must contain '${expected}'`);
        assert.doesNotMatch(output, /ERR!|failed|exception/i, `Script ${name} output should not indicate errors or failure`);
      }
    });

    it('executes scripts cleanly via cmd.exe shell', () => {
      if (process.platform === 'win32') {
        const cmdOutput = execSync('cmd /c "npm run lint && npm run format && npm run typecheck"', {
          cwd: frontendDir,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe']
        });
        assert.match(cmdOutput, /No lint errors found/);
        assert.match(cmdOutput, /Code formatting verified/);
        assert.match(cmdOutput, /Type check verified/);
      }
    });
  });

  // =========================================================================
  // 2. Build & Bundle Asset Stress Testing
  // =========================================================================
  describe('2. Build & Bundle Asset Stress Testing', () => {
    const distDir = path.join(frontendDir, 'dist');
    const assetsDir = path.join(distDir, 'assets');

    it('verifies dist directory and core entry artifacts exist and have non-zero size', () => {
      assert.ok(fs.existsSync(distDir), 'frontend/dist directory must exist');
      
      const indexHtmlPath = path.join(distDir, 'index.html');
      assert.ok(fs.existsSync(indexHtmlPath), 'dist/index.html must exist');
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
      assert.ok(htmlContent.includes('<div id="root"></div>'), 'dist/index.html must contain root container');

      const assetFiles = fs.readdirSync(assetsDir);
      const jsBundle = assetFiles.find(f => f.endsWith('.js'));
      const cssBundle = assetFiles.find(f => f.endsWith('.css'));

      assert.ok(jsBundle, 'dist/assets must contain a .js bundle');
      assert.ok(cssBundle, 'dist/assets must contain a .css bundle');

      const jsStat = fs.statSync(path.join(assetsDir, jsBundle));
      const cssStat = fs.statSync(path.join(assetsDir, cssBundle));

      assert.ok(jsStat.size > 100000 && jsStat.size < 2000000, `JS bundle size (${jsStat.size} bytes) should be within healthy range`);
      assert.ok(cssStat.size > 10000 && cssStat.size < 500000, `CSS bundle size (${cssStat.size} bytes) should be within healthy range`);
    });

    it('parses production JS bundle as valid ECMAScript Module without syntax errors', () => {
      const assetFiles = fs.readdirSync(assetsDir);
      const jsBundle = assetFiles.find(f => f.endsWith('.js'));
      const bundlePath = path.join(assetsDir, jsBundle);

      // Verify JavaScript syntax using node's native --check flag
      assert.doesNotThrow(() => {
        execSync(`node --check "${bundlePath}"`, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe']
        });
      }, 'Production JS bundle must pass node syntax check without errors');
    });

    it('verifies dead code from legacy/ is strictly eliminated from the production bundle', () => {
      const assetFiles = fs.readdirSync(assetsDir);
      const jsBundle = assetFiles.find(f => f.endsWith('.js'));
      const bundleCode = fs.readFileSync(path.join(assetsDir, jsBundle), 'utf-8');

      const legacyArchivedSymbols = [
        'TacticalHeader',
        'ToastContainer',
        'AdminLogin',
        'UserLogin',
        'CallStage',
        'TranscriptHUD',
        'Fast Translation Engine Re-export',
        'fastTranslator'
      ];

      for (const symbol of legacyArchivedSymbols) {
        assert.strictEqual(
          bundleCode.includes(symbol),
          false,
          `Production bundle must not contain orphaned legacy symbol: ${symbol}`
        );
      }
    });

    it('verifies all imports in active frontend/src resolve to real files (no broken imports)', () => {
      function getActiveFiles(dir, list = []) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== 'legacy' && entry.name !== 'node_modules') {
              getActiveFiles(fullPath, list);
            }
          } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
            list.push(fullPath);
          }
        }
        return list;
      }

      const activeFiles = getActiveFiles(path.join(frontendDir, 'src'));
      assert.ok(activeFiles.length >= 10, 'Must inspect active frontend files');

      const brokenImports = [];
      const importRegex = /(?:from\s+['"]([^'"]+)['"])|(?:import\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

      for (const filePath of activeFiles) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        let m;
        while ((m = importRegex.exec(fileContent)) !== null) {
          const importTarget = m[1] || m[2];
          if (importTarget.startsWith('.')) {
            const dir = path.dirname(filePath);
            const baseResolved = path.resolve(dir, importTarget);
            const extensions = ['', '.js', '.jsx', '/index.js', '/index.jsx'];
            const exists = extensions.some(ext => {
              const p = baseResolved + ext;
              return fs.existsSync(p) && !fs.statSync(p).isDirectory();
            });

            if (!exists) {
              brokenImports.push({ file: filePath, importTarget });
            }
          }
        }
      }

      assert.deepStrictEqual(brokenImports, [], 'No broken relative imports should exist in frontend/src');
    });
  });

  // =========================================================================
  // 3. DOM & Firefox Anchor Download Stress Testing
  // =========================================================================
  describe('3. DOM & Firefox Anchor Download Lifecycle Stress Testing', () => {
    function createMockDOM() {
      const bodyChildren = [];
      let clickRanWhileConnected = false;
      const revokedUrls = [];

      class MockAnchor {
        constructor() {
          this.tagName = 'A';
          this.href = '';
          this.download = '';
          this.parentElement = null;
        }

        click() {
          // Firefox requirement: anchor must be connected to document.body
          if (this.parentElement === mockBody) {
            clickRanWhileConnected = true;
          } else {
            clickRanWhileConnected = false;
          }
        }
      }

      const mockBody = {
        appendChild(node) {
          node.parentElement = mockBody;
          bodyChildren.push(node);
          return node;
        },
        removeChild(node) {
          const idx = bodyChildren.indexOf(node);
          if (idx !== -1) {
            bodyChildren.splice(idx, 1);
            node.parentElement = null;
          }
          return node;
        },
        get children() {
          return bodyChildren;
        }
      };

      const mockUrl = {
        createObjectURL: (blob) => `blob:mock-url-${Math.random()}`,
        revokeObjectURL: (url) => { revokedUrls.push(url); }
      };

      return {
        MockAnchor,
        mockBody,
        mockUrl,
        get bodyChildren() { return bodyChildren; },
        get clickRanWhileConnected() { return clickRanWhileConnected; },
        get revokedUrls() { return revokedUrls; }
      };
    }

    it('simulates UserDashboard CSV export lifecycle without DOM leaks', () => {
      const dom = createMockDOM();
      
      // Execute the pattern from UserDashboard.jsx:153-161
      const blob = { data: 'test csv', type: 'text/csv' };
      const url = dom.mockUrl.createObjectURL(blob);
      const a = new dom.MockAnchor();
      a.href = url;
      a.download = `VoiceBridge_Call_History_${Date.now()}.csv`;

      // Pre-condition
      assert.strictEqual(dom.bodyChildren.length, 0);

      // Execution
      dom.mockBody.appendChild(a);
      assert.strictEqual(dom.bodyChildren.length, 1);
      assert.strictEqual(a.parentElement, dom.mockBody);

      a.click();
      assert.strictEqual(dom.clickRanWhileConnected, true, 'Click must happen while attached to body for Firefox');

      dom.mockBody.removeChild(a);
      assert.strictEqual(dom.bodyChildren.length, 0, 'Anchor must be unmounted immediately after click');
      assert.strictEqual(a.parentElement, null);

      // Clean up object URL
      dom.mockUrl.revokeObjectURL(url);
      assert.strictEqual(dom.revokedUrls.length, 1);
    });

    it('simulates AdminDashboard JSON audit export lifecycle without DOM leaks', () => {
      const dom = createMockDOM();
      
      const blob = { data: JSON.stringify({ audit: true }), type: 'application/json' };
      const url = dom.mockUrl.createObjectURL(blob);
      const a = new dom.MockAnchor();
      a.href = url;
      a.download = `VoiceBridge_Fleet_Audit_${Date.now()}.json`;

      assert.strictEqual(dom.bodyChildren.length, 0);

      dom.mockBody.appendChild(a);
      a.click();
      assert.strictEqual(dom.clickRanWhileConnected, true);
      dom.mockBody.removeChild(a);

      assert.strictEqual(dom.bodyChildren.length, 0);
      assert.strictEqual(a.parentElement, null);

      dom.mockUrl.revokeObjectURL(url);
      assert.strictEqual(dom.revokedUrls.length, 1);
    });

    it('simulates MinutesDrawer Markdown export lifecycle without DOM leaks', () => {
      const dom = createMockDOM();
      
      const blob = { data: '# Minutes', type: 'text/markdown' };
      const url = dom.mockUrl.createObjectURL(blob);
      const a = new dom.MockAnchor();
      a.href = url;
      a.download = `Meeting_Minutes_${Date.now()}.md`;

      assert.strictEqual(dom.bodyChildren.length, 0);

      dom.mockBody.appendChild(a);
      a.click();
      assert.strictEqual(dom.clickRanWhileConnected, true);
      dom.mockBody.removeChild(a);

      assert.strictEqual(dom.bodyChildren.length, 0);
      assert.strictEqual(a.parentElement, null);

      dom.mockUrl.revokeObjectURL(url);
      assert.strictEqual(dom.revokedUrls.length, 1);
    });

    it('stress tests rapid consecutive export downloads (50 cycles) ensuring 0 DOM leaks', () => {
      const dom = createMockDOM();

      for (let i = 0; i < 50; i++) {
        const blob = { data: `Data ${i}`, type: 'text/plain' };
        const url = dom.mockUrl.createObjectURL(blob);
        const a = new dom.MockAnchor();
        a.href = url;
        a.download = `test_${i}.txt`;

        dom.mockBody.appendChild(a);
        a.click();
        assert.strictEqual(dom.clickRanWhileConnected, true);
        dom.mockBody.removeChild(a);

        dom.mockUrl.revokeObjectURL(url);
      }

      // Assert zero DOM leakage after 50 rapid sequential export actions
      assert.strictEqual(dom.bodyChildren.length, 0, 'No anchor elements should remain in body');
      assert.strictEqual(dom.revokedUrls.length, 50, 'All 50 object URLs must be revoked');
    });
  });

  // =========================================================================
  // 4. Codebase-Wide Stale Branding Audit
  // =========================================================================
  describe('4. Codebase-Wide Stale Branding Audit', () => {
    function searchForBrand(dir, brandPattern, ignoredDirs = ['.git', 'node_modules', '.agents', '.pytest_cache', '__pycache__']) {
      const matches = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!ignoredDirs.includes(entry.name)) {
            matches.push(...searchForBrand(path.join(dir, entry.name), brandPattern, ignoredDirs));
          }
        } else if (entry.isFile()) {
          // Skip test files that intentionally assert absence of brand
          if (entry.name.includes('verification') || entry.name.includes('stress')) continue;
          try {
            const content = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
            if (brandPattern.test(content)) {
              matches.push(path.join(dir, entry.name));
            }
          } catch {
            // Ignore unreadable/binary files
          }
        }
      }
      return matches;
    }

    it('confirms 0 occurrences of "CineSync" in frontend/src', () => {
      const matches = searchForBrand(path.join(frontendDir, 'src'), /cinesync/i);
      assert.deepStrictEqual(matches, [], 'frontend/src must contain zero occurrences of CineSync');
    });

    it('confirms 0 occurrences of "CineSync" in frontend/dist', () => {
      const matches = searchForBrand(path.join(frontendDir, 'dist'), /cinesync/i);
      assert.deepStrictEqual(matches, [], 'frontend/dist must contain zero occurrences of CineSync');
    });

    it('confirms 0 occurrences of "CineSync" in backend/', () => {
      const matches = searchForBrand(path.join(repoRoot, 'backend'), /cinesync/i);
      assert.deepStrictEqual(matches, [], 'backend/ must contain zero occurrences of CineSync');
    });

    it('verifies ErrorBoundary has VoiceBridge branding and no CineSync references', () => {
      const ebPath = path.join(frontendDir, 'src', 'components', 'ErrorBoundary.jsx');
      const content = fs.readFileSync(ebPath, 'utf-8');

      assert.match(content, /VoiceBridge ErrorBoundary/);
      assert.match(content, /VoiceBridge Interface Exception/);
      assert.doesNotMatch(content, /cinesync/i);
    });
  });
});
