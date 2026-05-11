import { json } from './http.js';

export function getServerEnv(name, fallbacks = []) {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = process.env[key]?.trim?.();
    if (value) return value;
  }
  return '';
}

export function requireServerEnv(request, response, envNames) {
  const missing = envNames.filter(({ name, fallbacks = [] }) => !getServerEnv(name, fallbacks));
  if (!missing.length) return true;

  json(request, response, 501, {
    code: 'provider_not_configured',
    message: 'Required server configuration is missing. Configure this endpoint in Vercel before enabling it.',
    requiredServerEnv: missing.map(({ name }) => name),
  });
  return false;
}
