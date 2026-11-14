import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Enterprise Authentication & RBAC Policy Enforcement', () => {
  const authPath = path.resolve(__dirname, '../src/components/Auth/EnterpriseAuth.jsx');
  const navbarPath = path.resolve(__dirname, '../src/components/Navigation/Navbar.jsx');
  const appPath = path.resolve(__dirname, '../src/App.jsx');

  const authCode = fs.readFileSync(authPath, 'utf8');
  const navbarCode = fs.readFileSync(navbarPath, 'utf8');
  const appCode = fs.readFileSync(appPath, 'utf8');

  test('EnterpriseAuth contains strictly ZERO public references to "Admin Fleet" or "Administrator Console"', () => {
    // The public login screen must never advertise an admin console or admin fleet
    assert.ok(
      !authCode.includes('Admin Fleet'),
      'EnterpriseAuth.jsx must not reference "Admin Fleet"'
    );
    assert.ok(
      !authCode.includes('Administrator Console'),
      'EnterpriseAuth.jsx must not reference "Administrator Console"'
    );
  });

  test('EnterpriseAuth includes enterprise SSO providers (Okta, Google Workspace, SAML 2.0)', () => {
    assert.ok(authCode.includes('Okta'), 'Must support Okta SSO');
    assert.ok(authCode.includes('Google'), 'Must support Google Workspace SSO');
    assert.ok(authCode.includes('SAML'), 'Must support SAML 2.0 SSO');
  });

  test('EnterpriseAuth provides quick demo credentials for Operator and Admin', () => {
    assert.ok(authCode.includes('operator@voicebridge.com'), 'Must support Operator demo');
    assert.ok(authCode.includes('admin@voicebridge.com'), 'Must support Admin demo');
    assert.ok(authCode.includes('Demo Operator'), 'Must provide Demo Operator button');
    assert.ok(authCode.includes('Demo Admin'), 'Must provide Demo Admin button');
  });

  test('EnterpriseAuth supports guest join with room code', () => {
    assert.ok(authCode.includes('onGuestJoin'), 'Must support onGuestJoin callback');
    assert.ok(authCode.includes('Guest Meeting') || authCode.includes('Guest Caller'), 'Must have guest meeting mode');
  });

  test('Navbar strictly removes "Admin Fleet" from public desktop and mobile tabs', () => {
    // Look at navigation tabs in Navbar
    const desktopNavMatch = navbarCode.match(/<nav[\s\S]*?<\/nav>/);
    assert.ok(desktopNavMatch, 'Must find desktop nav element');
    assert.ok(
      !desktopNavMatch[0].includes('Admin Fleet'),
      'Desktop navigation tabs must not contain "Admin Fleet"'
    );

    // Look at mobile tab switcher
    const mobileNavMatch = navbarCode.match(/Mobile Tab Switcher[\s\S]*?<\/div>\s*<\/div>/);
    if (mobileNavMatch) {
      assert.ok(
        !mobileNavMatch[0].includes('Admin Fleet'),
        'Mobile tab switcher must not contain "Admin Fleet"'
      );
    }
  });

  test('Navbar conditionally shows "Admin Fleet Console" ONLY inside user profile dropdown when role is Administrator', () => {
    // Must check isAdmin or role === 'Administrator' before rendering Admin Fleet Console
    assert.ok(
      navbarCode.includes("currentUser?.role === 'Administrator'") || navbarCode.includes('isAdmin'),
      'Must check for Administrator role'
    );
    assert.ok(
      navbarCode.includes('Admin Fleet Console'),
      'Must contain Admin Fleet Console inside profile dropdown'
    );
  });

  test('App.jsx enforces RBAC: blocks non-admin users from accessing admin-dashboard', () => {
    // Verify RBAC condition in App.jsx
    assert.ok(
      appCode.includes("currentUser?.role === 'Administrator'"),
      'App.jsx must check currentUser.role === "Administrator"'
    );
    assert.ok(
      appCode.includes('activeTab === \'admin-dashboard\' && currentUser?.role === \'Administrator\''),
      'admin-dashboard tab must be guarded by role check'
    );
  });

  test('App.jsx enforces Enterprise Gate: unauthenticated non-guest visitors see EnterpriseAuth', () => {
    assert.ok(
      appCode.includes('!currentUser && !isGuestJoin ?') || appCode.includes('!currentUser && !isGuestJoin'),
      'Must render EnterpriseAuth when !currentUser and !isGuestJoin'
    );
  });
});
