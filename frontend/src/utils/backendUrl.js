/**
 * Robust Backend URL resolver for VOXSYNAPSE PRIME:
 * Resolves backend endpoints for localhost, 127.0.0.1, LAN IPs (192.168.*, 10.*, 172.16-31.*),
 * Vite dev port forwarding, same-origin FastAPI hosting, and production cloud fallback.
 */
export function determineBackendUrl(mockWindow = null, env = null) {
  const currentEnv = env || (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {});

  // 1. Explicit environment variable takes precedence
  if (currentEnv.VITE_BACKEND_URL) {
    return currentEnv.VITE_BACKEND_URL;
  }

  const win = mockWindow || (typeof window !== 'undefined' ? window : null);
  if (!win) {
    return currentEnv.VITE_BACKEND_URL || 'https://voicebridge-backend.onrender.com';
  }

  const { hostname, port, protocol, origin } = win.location;

  // 2. Local or LAN network detection (127.0.0.1, localhost, 192.168.*, 10.*, 172.16-31.*)
  const isLocalOrLan =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith('.local');

  // Common Vite dev server ports
  const isViteDev = port === '3000' || port === '5173' || port === '5174';

  if (isLocalOrLan) {
    // If not running under Vite dev server, the app is served directly from FastAPI (same origin)
    if (!isViteDev) {
      return origin;
    }
    // Running under Vite dev server on local machine or LAN -> connect to backend on port 8000
    const backendPort = currentEnv.VITE_BACKEND_PORT || '8000';
    return `${protocol}//${hostname}:${backendPort}`;
  }

  // 3. Remote / Production serving:
  // If served directly by FastAPI (same-origin production or Docker deploy, not on external static host)
  const isExternalStaticHost =
    hostname.includes('vercel.app') ||
    hostname.includes('github.io') ||
    hostname.includes('netlify.app');

  if (!isExternalStaticHost && origin && !isViteDev) {
    return origin;
  }

  // Fallback to production Render backend
  return 'https://voicebridge-backend.onrender.com';
}
