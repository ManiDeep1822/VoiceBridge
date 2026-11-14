import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAndPunctuateIntent, EXCLAMATION_PATTERNS } from '../src/utils/prosodyEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

describe('Milestone 2 Verification & Regression Test Suite', () => {
  it('M2.1: Prosody Hindi Exclamation regex correctly classifies urgent terms without stray space', () => {
    // Verify regex definition in prosodyEngine directly
    const hiPatterns = EXCLAMATION_PATTERNS.hi;
    assert.ok(Array.isArray(hiPatterns) && hiPatterns.length > 0);
    const regexSource = hiPatterns[0].source;
    assert.ok(!regexSource.endsWith(' '), 'Hindi regex source must not have trailing whitespace');

    const testWords = ['जल्दी', 'तुरंत', 'रुको', 'मदद', 'बचाओ', 'सावधान'];
    for (const w of testWords) {
      const result = classifyAndPunctuateIntent(w, 'hi');
      assert.strictEqual(result.intent, 'exclamation', `Word ${w} should have exclamation intent`);
      assert.strictEqual(result.punctuatedText, `${w}!`, `Word ${w} should end with exclamation mark`);
    }

    const multiWord = classifyAndPunctuateIntent('जल्दी चलो', 'hi');
    assert.strictEqual(multiWord.intent, 'exclamation');
    assert.strictEqual(multiWord.punctuatedText, 'जल्दी चलो!');
  });

  it('M2.2: WebRTC hook includes domain parameter in emitSpeechSegment contract', () => {
    const hookPath = path.join(frontendDir, 'src', 'hooks', 'useWebRTC.js');
    const content = fs.readFileSync(hookPath, 'utf-8');

    // Verify emitSpeechSegment signature contains domain parameter defaulting to 'general'
    assert.ok(
      content.includes("emitSpeechSegment = useCallback((originalText, sourceLang, targetLang, domain = 'general') =>"),
      'emitSpeechSegment signature must include domain parameter'
    );
    // Verify payload includes domain property
    assert.ok(
      /socketRef\.current\.emit\(\s*['"]speech_segment['"]\s*,\s*\{[^}]*domain[^}]*\}\s*\)/s.test(content),
      'speech_segment emit payload must include domain property'
    );
  });

  it('M2.3: App.jsx dispatches activeDomain in speech_segment and routes targetLang to fallback TTS', () => {
    const appPath = path.join(frontendDir, 'src', 'App.jsx');
    const content = fs.readFileSync(appPath, 'utf-8');

    // 1. Verify activeDomain passed to emitSpeechSegment
    assert.ok(
      content.includes('emitSpeechSegment(cleanText, localLanguage, targetLang, activeDomain)'),
      'App.jsx must pass activeDomain as 4th argument to emitSpeechSegment'
    );

    // 2. Verify targetLang fallback in handleRemoteAudioReceived
    assert.ok(
      content.includes('const targetLang = data?.targetLang || localLanguage;'),
      'handleRemoteAudioReceived must resolve targetLang from data.targetLang or localLanguage'
    );
    assert.ok(
      content.includes('speak(data.translatedText, targetLang, data.audioBase64);'),
      'speak must receive targetLang when neural audio base64 is present'
    );
    assert.ok(
      content.includes('speak(data.translatedText, targetLang);'),
      'speak must receive targetLang for Web Speech fallback'
    );
  });

  it('M2.4: Firefox file download anchor attachment and removal in all dashboard components', () => {
    const filesToCheck = [
      path.join(frontendDir, 'src', 'components', 'UserDashboard', 'UserDashboard.jsx'),
      path.join(frontendDir, 'src', 'components', 'AdminDashboard', 'AdminDashboard.jsx'),
      path.join(frontendDir, 'src', 'components', 'MinutesDrawer.jsx')
    ];

    for (const filePath of filesToCheck) {
      assert.ok(fs.existsSync(filePath), `Component file ${filePath} must exist`);
      const code = fs.readFileSync(filePath, 'utf-8');
      assert.ok(
        code.includes('document.body.appendChild(a)'),
        `Component ${path.basename(filePath)} must call document.body.appendChild(a) before click`
      );
      assert.ok(
        code.includes('document.body.removeChild(a)'),
        `Component ${path.basename(filePath)} must call document.body.removeChild(a)`
      );
      assert.ok(
        code.indexOf('document.body.appendChild(a)') < code.indexOf('a.click()'),
        `document.body.appendChild(a) must precede a.click() in ${path.basename(filePath)}`
      );
    }
  });

  it('M2.5: ErrorBoundary branding references VoiceBridge and eradicates CineSync', () => {
    const errPath = path.join(frontendDir, 'src', 'components', 'ErrorBoundary.jsx');
    const content = fs.readFileSync(errPath, 'utf-8');

    assert.ok(content.includes('[VoiceBridge ErrorBoundary]'), 'Must log VoiceBridge ErrorBoundary');
    assert.ok(content.includes('VoiceBridge Interface Exception'), 'Must display VoiceBridge Interface Exception');
    assert.ok(!content.includes('CineSync'), 'Must contain zero CineSync references');
  });

  it('M2.6: package.json declares lint, format, and typecheck scripts', () => {
    const pkgPath = path.join(frontendDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    assert.ok(pkg.scripts.lint, 'package.json must contain lint script');
    assert.ok(pkg.scripts.format, 'package.json must contain format script');
    assert.ok(pkg.scripts.typecheck, 'package.json must contain typecheck script');
  });

  it('M2.7: Orphaned legacy files are archived into frontend/src/legacy/', () => {
    const legacyDir = path.join(frontendDir, 'src', 'legacy');
    assert.ok(fs.existsSync(legacyDir), 'frontend/src/legacy directory must exist');

    const expectedArchived = [
      'CallStage.jsx',
      'TacticalHeader.jsx',
      'ToastContainer.jsx',
      'TranscriptHUD.jsx',
      'AdminLogin.jsx',
      'UserLogin.jsx',
      'fastTranslator.js'
    ];

    for (const filename of expectedArchived) {
      const archivedPath = path.join(legacyDir, filename);
      assert.ok(fs.existsSync(archivedPath), `Legacy file ${filename} must exist in frontend/src/legacy/`);
    }

    // Verify they are no longer in their old locations
    assert.ok(!fs.existsSync(path.join(frontendDir, 'src', 'components', 'CallStage.jsx')));
    assert.ok(!fs.existsSync(path.join(frontendDir, 'src', 'components', 'TacticalHeader.jsx')));
    assert.ok(!fs.existsSync(path.join(frontendDir, 'src', 'components', 'ToastContainer.jsx')));
    assert.ok(!fs.existsSync(path.join(frontendDir, 'src', 'components', 'TranscriptHUD.jsx')));
    assert.ok(!fs.existsSync(path.join(frontendDir, 'src', 'components', 'Auth', 'AdminLogin.jsx')));
    assert.ok(!fs.existsSync(path.join(frontendDir, 'src', 'components', 'Auth', 'UserLogin.jsx')));
    assert.ok(!fs.existsSync(path.join(frontendDir, 'src', 'utils', 'fastTranslator.js')));
  });
});
