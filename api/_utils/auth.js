import { json } from './http.js';

export function getBearerToken(request) {
  const header = request.headers.authorization || request.headers.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

export function requireBearerToken(request, response, message = 'Authenticated session required.') {
  const token = getBearerToken(request);
  if (token) return token;

  json(request, response, 401, {
    code: 'missing_session',
    message,
  });
  return '';
}
