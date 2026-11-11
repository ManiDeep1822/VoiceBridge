import test from 'node:test';
import assert from 'node:assert/strict';

import { determineBackendUrl } from '../src/utils/backendUrl.js';

test('Backend URL Determination & Multi-Network Binding', async (t) => {
  await t.test('resolves to localhost:8000 when running under Vite dev on localhost', () => {
    const mockWin = {
      location: {
        hostname: 'localhost',
        port: '3000',
        protocol: 'http:',
        origin: 'http://localhost:3000'
      }
    };
    const url = determineBackendUrl(mockWin, {});
    assert.equal(url, 'http://localhost:8000');
  });

  await t.test('resolves to 127.0.0.1:8000 when running under Vite dev on 127.0.0.1', () => {
    const mockWin = {
      location: {
        hostname: '127.0.0.1',
        port: '3000',
        protocol: 'http:',
        origin: 'http://127.0.0.1:3000'
      }
    };
    const url = determineBackendUrl(mockWin, {});
    assert.equal(url, 'http://127.0.0.1:8000');
  });

  await t.test('resolves to LAN IP:8000 for 192.168.* under Vite dev', () => {
    const mockWin = {
      location: {
        hostname: '192.168.1.15',
        port: '5173',
        protocol: 'http:',
        origin: 'http://192.168.1.15:5173'
      }
    };
    const url = determineBackendUrl(mockWin, {});
    assert.equal(url, 'http://192.168.1.15:8000');
  });

  await t.test('resolves to LAN IP:8000 for 10.* under Vite dev', () => {
    const mockWin = {
      location: {
        hostname: '10.0.0.42',
        port: '3000',
        protocol: 'http:',
        origin: 'http://10.0.0.42:3000'
      }
    };
    const url = determineBackendUrl(mockWin, {});
    assert.equal(url, 'http://10.0.0.42:8000');
  });

  await t.test('resolves to window.location.origin when served directly via FastAPI on port 8000', () => {
    const mockWin = {
      location: {
        hostname: '127.0.0.1',
        port: '8000',
        protocol: 'http:',
        origin: 'http://127.0.0.1:8000'
      }
    };
    const url = determineBackendUrl(mockWin, {});
    assert.equal(url, 'http://127.0.0.1:8000');
  });

  await t.test('resolves to same-origin on LAN IP when served directly via FastAPI', () => {
    const mockWin = {
      location: {
        hostname: '192.168.1.15',
        port: '8080',
        protocol: 'http:',
        origin: 'http://192.168.1.15:8080'
      }
    };
    const url = determineBackendUrl(mockWin, {});
    assert.equal(url, 'http://192.168.1.15:8080');
  });

  await t.test('respects explicit VITE_BACKEND_URL override regardless of hostname', () => {
    const mockWin = {
      location: {
        hostname: 'localhost',
        port: '3000',
        protocol: 'http:',
        origin: 'http://localhost:3000'
      }
    };
    const url = determineBackendUrl(mockWin, { VITE_BACKEND_URL: 'https://my-custom-proxy.internal:9000' });
    assert.equal(url, 'https://my-custom-proxy.internal:9000');
  });

  await t.test('falls back to Render backend when deployed on external static host (e.g. vercel.app)', () => {
    const mockWin = {
      location: {
        hostname: 'voicebridge.vercel.app',
        port: '',
        protocol: 'https:',
        origin: 'https://voicebridge.vercel.app'
      }
    };
    const url = determineBackendUrl(mockWin, {});
    assert.equal(url, 'https://voicebridge-backend.onrender.com');
  });

  await t.test('uses origin when served from standalone production container on standard port 80/443', () => {
    const mockWin = {
      location: {
        hostname: 'voicebridge.company.com',
        port: '',
        protocol: 'https:',
        origin: 'https://voicebridge.company.com'
      }
    };
    const url = determineBackendUrl(mockWin, {});
    assert.equal(url, 'https://voicebridge.company.com');
  });
});
