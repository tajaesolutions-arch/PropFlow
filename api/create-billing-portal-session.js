const json = (response, statusCode, body) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { code: 'method_not_allowed', message: 'Use POST for billing portal requests.' });
  }

  return json(response, 501, {
    code: 'provider_not_configured',
    message: 'Stripe billing portal is not configured yet. Configure a server-side Stripe implementation before enabling portal redirects.',
    requiredServerEnv: ['STRIPE_SECRET_KEY'],
  });
}
