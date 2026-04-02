/**
 * lib/env.ts
 * ───────────
 * Validates required environment variables at app startup.
 * Throws a clear error if any required var is missing so you
 * catch configuration problems immediately instead of getting
 * confusing 404s or silent API failures.
 *
 * Usage: import '@/lib/env' (already imported in main.tsx via bootstrap)
 */

interface Env {
  VITE_API_BASE_URL: string;
}

function validateEnv(): Env {
  const required = ['VITE_API_BASE_URL'] as const;
  const missing: string[] = [];

  for (const key of required) {
    if (!import.meta.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const msg = [
      '❌ Missing required environment variables:',
      ...missing.map((k) => `   ${k}`),
      '',
      'Create a .env file in the project root:',
      '   VITE_API_BASE_URL=http://localhost:8000/api',
    ].join('\n');

    // In development: throw to surface the error in the console
    if (import.meta.env.DEV) {
      throw new Error(msg);
    }
    // In production: log but don't crash (fallback values will be used)
    console.error(msg);
  }

  return {
    VITE_API_BASE_URL:
      import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  };
}

export const env = validateEnv();
