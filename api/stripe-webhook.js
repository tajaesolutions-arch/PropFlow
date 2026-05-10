const json = (response, statusCode, body) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { code: 'method_not_allowed', message: 'Use POST for Stripe webhooks.' });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return json(response, 501, {
      code: 'provider_not_configured',
      message: 'Stripe webhook processing is not configured yet. Webhook signature verification must be implemented server-side before processing billing updates.',
      requiredServerEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    });
  }

  return json(response, 501, {
    code: 'webhook_not_implemented',
    message: 'Stripe webhook signature verification and idempotent subscription persistence must be completed before this endpoint can process events.',
  });
}
