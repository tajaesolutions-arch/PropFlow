const DEFAULT_MAX_JSON_BYTES = 32 * 1024;

function getAllowedOrigin(request) {
  const origin = request.headers.origin || request.headers.Origin || '';
  if (!origin) return '';

  const allowed = new Set(
    [
      process.env.APP_URL,
      process.env.VITE_APP_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    ]
      .filter(Boolean)
      .map((value) => String(value).replace(/\/$/, '')),
  );

  return allowed.has(String(origin).replace(/\/$/, '')) ? origin : '';
}

export function setJsonHeaders(request, response, { methods = ['POST'] } = {}) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Vary', 'Origin');

  const allowedOrigin = getAllowedOrigin(request);
  if (allowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    response.setHeader('Access-Control-Allow-Credentials', 'false');
    response.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    response.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  }
}

export function json(request, response, statusCode, body, options = {}) {
  setJsonHeaders(request, response, options);
  response.statusCode = statusCode;
  response.end(JSON.stringify(body));
}

export function requireMethod(request, response, method = 'POST') {
  if (request.method === method) return true;

  response.setHeader('Allow', method);
  json(request, response, 405, {
    code: 'method_not_allowed',
    message: `Use ${method} for this endpoint.`,
  }, { methods: [method] });
  return false;
}

export function requireJsonContentType(request, response) {
  const contentType = String(request.headers['content-type'] || request.headers['Content-Type'] || '').toLowerCase();
  if (!contentType || contentType.includes('application/json')) return true;

  json(request, response, 415, {
    code: 'unsupported_media_type',
    message: 'Request content type must be application/json.',
  });
  return false;
}

export async function readJsonBody(request, { maxBytes = DEFAULT_MAX_JSON_BYTES } = {}) {
  if (request.body && typeof request.body === 'object') return request.body;

  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) {
      const error = new Error('request_body_too_large');
      error.code = 'request_body_too_large';
      throw error;
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

export function safeErrorMessage(error, fallback = 'Request failed.') {
  const message = String(error?.message || '').trim();
  if (!message) return fallback;
  if (process.env.NODE_ENV === 'production') return fallback;
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 240);
}
