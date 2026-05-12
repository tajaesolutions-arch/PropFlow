import { getServerEnv, requireServerEnv } from './_utils/env.js';
import { json, readJsonBody, requireJsonContentType, requireMethod } from './_utils/http.js';
import { getSupabaseAdminClient } from './_utils/supabaseAdmin.js';
import { buildSameOriginUrl, getAppUrl, getStripeSecretKey, stripeRequest } from './_utils/stripe.js';
import { sendTransactionalEmail } from './_utils/transactionalEmail.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MAX_STAY_NIGHTS = 90;

function cleanString(value, max = 1000) {
  return String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function dateOnly(value) {
  const raw = cleanString(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? '' : raw;
}

function nightsBetween(checkIn, checkOut) {
  return Math.round((new Date(`${checkOut}T00:00:00Z`) - new Date(`${checkIn}T00:00:00Z`)) / 86400000);
}

function overlap(aStart, aEnd, bStart, bEnd) {
  return Boolean(aStart && aEnd && bStart && bEnd && aStart < bEnd && aEnd > bStart);
}

function safeBody(body = {}) {
  return {
    slug: cleanString(body.slug || body.page_slug || body.pageSlug, 120).toLowerCase(),
    directBookingPageId: cleanString(body.direct_booking_page_id || body.directBookingPageId, 80),
    guestName: cleanString(body.guest_name || body.guestName, 160),
    guestEmail: cleanString(body.guest_email || body.email || body.guestEmail, 255).toLowerCase(),
    guestPhone: cleanString(body.guest_phone || body.phone || body.guestPhone, 80),
    checkIn: dateOnly(body.check_in || body.checkIn),
    checkOut: dateOnly(body.check_out || body.checkOut),
    adults: Number(body.adults || 1),
    children: Number(body.children || 0),
    message: cleanString(body.message, 2000),
    successUrl: body.success_url || body.successUrl,
    cancelUrl: body.cancel_url || body.cancelUrl,
  };
}

async function findPage(supabaseAdmin, body) {
  let query = supabaseAdmin
    .from('direct_booking_pages')
    .select('*, properties!inner(id, workspace_id, name, status, archived_at, currency, city, country)')
    .eq('status', 'published')
    .is('archived_at', null)
    .eq('allow_booking_requests', true)
    .limit(1);

  query = body.directBookingPageId ? query.eq('id', body.directBookingPageId) : query.eq('slug', body.slug);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function hasConflict(supabaseAdmin, { workspaceId, propertyId, checkIn, checkOut }) {
  const [{ data: bookings, error: bookingError }, { data: imported, error: importError }, { data: requests, error: requestError }] = await Promise.all([
    supabaseAdmin.from('bookings').select('id, check_in, check_out, status').eq('workspace_id', workspaceId).eq('property_id', propertyId).is('archived_at', null),
    supabaseAdmin.from('calendar_import_events').select('id, starts_at, ends_at, status, event_type, archived_at').eq('workspace_id', workspaceId).eq('property_id', propertyId).is('archived_at', null),
    supabaseAdmin.from('direct_booking_requests').select('id, check_in, check_out, status, payment_status, archived_at').eq('workspace_id', workspaceId).eq('property_id', propertyId).is('archived_at', null),
  ]);
  if (bookingError) throw bookingError;
  if (importError && importError.code !== '42P01') throw importError;
  if (requestError) throw requestError;

  const bookingConflict = (bookings || []).some((booking) => !['cancelled', 'canceled'].includes(String(booking.status || '').toLowerCase()) && overlap(checkIn, checkOut, booking.check_in, booking.check_out));
  if (bookingConflict) return true;

  const importedConflict = (imported || []).some((event) => {
    const status = String(event.status || '').toLowerCase();
    const type = String(event.event_type || '').toLowerCase();
    const blocks = ['imported', 'changed', 'conflict', 'booked', 'blocked', 'unavailable'].includes(status) || ['booking_block', 'blocked', 'unavailable', 'maintenance_hold'].includes(type);
    return blocks && overlap(checkIn, checkOut, String(event.starts_at || '').slice(0, 10), String(event.ends_at || '').slice(0, 10));
  });
  if (importedConflict) return true;

  return (requests || []).some((request) => {
    const blocks = ['approved', 'converted_to_booking'].includes(String(request.status || '').toLowerCase()) || String(request.payment_status || '').toLowerCase() === 'paid';
    return blocks && overlap(checkIn, checkOut, request.check_in, request.check_out);
  });
}

async function logActivity(supabaseAdmin, workspaceId, action, metadata = {}) {
  await supabaseAdmin.from('activity_logs').insert({ workspace_id: workspaceId, actor_user_id: null, action, metadata });
}


async function workspaceManagers(supabaseAdmin, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, roles, status, profiles:profiles!workspace_members_user_id_fkey(full_name, email)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  if (error) return [];
  return (data || []).filter((member) => {
    const memberRoles = Array.isArray(member.roles) ? member.roles : [];
    return memberRoles.some((role) => ['workspace_owner', 'property_manager', 'host'].includes(role)) && EMAIL_RE.test(String(member.profiles?.email || '').toLowerCase());
  });
}

async function sendDirectBookingSubmittedEmails(request, supabaseAdmin, page, property, directRequest) {
  const appUrl = getAppUrl(request);
  const commonContext = {
    appUrl,
    publicPath: `/book/${page.slug}`,
    guestName: directRequest.guest_name,
    propertyName: property?.name,
    checkIn: directRequest.check_in,
    checkOut: directRequest.check_out,
    guestCount: directRequest.guest_count,
    quotedTotal: directRequest.quoted_total,
    currency: directRequest.currency,
  };

  await sendTransactionalEmail({
    supabaseAdmin,
    workspaceId: directRequest.workspace_id,
    recipientEmail: directRequest.guest_email,
    templateKey: 'direct_booking_request_confirmation',
    context: commonContext,
    metadata: { entity_type: 'direct_booking_request', entity_id: directRequest.id, property_id: directRequest.property_id },
    idempotencyKey: `direct_booking_request_confirmation:${directRequest.id}`,
    replyTo: page.contact_email || null,
  }).catch(() => null);

  const managers = await workspaceManagers(supabaseAdmin, directRequest.workspace_id);
  await Promise.allSettled(managers.slice(0, 10).map((manager) => sendTransactionalEmail({
    supabaseAdmin,
    workspaceId: directRequest.workspace_id,
    recipientUserId: manager.user_id,
    recipientEmail: manager.profiles?.email,
    templateKey: 'direct_booking_request_received',
    context: commonContext,
    metadata: { entity_type: 'direct_booking_request', entity_id: directRequest.id, property_id: directRequest.property_id },
    idempotencyKey: `direct_booking_request_received:${directRequest.id}:${manager.user_id}`,
  })));
}

async function startCheckout(request, supabaseAdmin, page, directRequest, amountCents) {
  if (!getStripeSecretKey()) {
    const error = new Error('Stripe direct booking checkout is not configured yet.');
    error.code = 'provider_not_configured';
    throw error;
  }

  const appUrl = getAppUrl(request);
  const successUrl = buildSameOriginUrl(appUrl, directRequest.metadata?.success_url, `/book/${page.slug}?request=${directRequest.id}&payment=success`);
  const cancelUrl = buildSameOriginUrl(appUrl, directRequest.metadata?.cancel_url, `/book/${page.slug}?request=${directRequest.id}&payment=canceled`);
  const currency = String(directRequest.currency || page.currency || 'USD').toLowerCase();

  const session = await stripeRequest('/checkout/sessions', {
    method: 'POST',
    body: {
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][product_data][name]': `Direct booking request - ${page.properties?.name || 'Property stay'}`,
      'line_items[0][price_data][unit_amount]': String(amountCents),
      'line_items[0][quantity]': '1',
      'customer_email': directRequest.guest_email,
      'metadata[workspace_id]': page.workspace_id,
      'metadata[property_id]': page.property_id,
      'metadata[direct_booking_request_id]': directRequest.id,
      'metadata[booking_type]': 'direct_booking',
      'payment_intent_data[metadata][workspace_id]': page.workspace_id,
      'payment_intent_data[metadata][property_id]': page.property_id,
      'payment_intent_data[metadata][direct_booking_request_id]': directRequest.id,
      'payment_intent_data[metadata][booking_type]': 'direct_booking',
      client_reference_id: directRequest.id,
    },
  });

  const { error } = await supabaseAdmin
    .from('direct_booking_requests')
    .update({ stripe_checkout_session_id: session.id, payment_status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', directRequest.id);
  if (error) throw error;

  return { id: session.id, url: session.url };
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'POST')) return;
  if (!requireJsonContentType(request, response)) return;
  if (!requireServerEnv(request, response, [{ name: 'SUPABASE_URL', fallbacks: ['VITE_SUPABASE_URL'] }, { name: 'SUPABASE_SERVICE_ROLE_KEY' }])) return;

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const body = safeBody(await readJsonBody(request));

    if (!body.slug && !body.directBookingPageId) return json(request, response, 400, { code: 'invalid_page', message: 'This booking page is not currently accepting requests.' });
    if (!body.guestName) return json(request, response, 400, { code: 'invalid_guest_name', message: 'Guest name is required.' });
    if (!EMAIL_RE.test(body.guestEmail)) return json(request, response, 400, { code: 'invalid_email', message: 'A valid email address is required.' });
    if (!body.checkIn || !body.checkOut) return json(request, response, 400, { code: 'invalid_dates', message: 'Check-in and check-out dates are required.' });
    const nights = nightsBetween(body.checkIn, body.checkOut);
    if (nights < 1) return json(request, response, 400, { code: 'invalid_dates', message: 'Check-out must be after check-in.' });
    if (nights > MAX_STAY_NIGHTS) return json(request, response, 400, { code: 'stay_too_long', message: 'Please contact the host for longer stays.' });
    if (!Number.isInteger(body.adults) || body.adults < 1) return json(request, response, 400, { code: 'invalid_adults', message: 'At least one adult is required.' });
    if (!Number.isInteger(body.children) || body.children < 0) return json(request, response, 400, { code: 'invalid_children', message: 'Children must be zero or more.' });

    const page = await findPage(supabaseAdmin, body);
    const property = page?.properties;
    if (!page || !property || property.archived_at || property.workspace_id !== page.workspace_id || String(property.status || 'active').toLowerCase() === 'archived') {
      return json(request, response, 404, { code: 'page_not_available', message: 'This booking page is not currently accepting requests.' });
    }
    if (nights < (page.min_nights || 1) || (page.max_nights && nights > page.max_nights)) {
      return json(request, response, 400, { code: 'invalid_stay_length', message: 'Those dates do not meet this property’s stay rules.' });
    }
    if (page.require_guest_phone && !body.guestPhone) return json(request, response, 400, { code: 'phone_required', message: 'Phone number is required for this property.' });
    if (page.require_guest_message && !body.message) return json(request, response, 400, { code: 'message_required', message: 'Message is required for this property.' });

    if (await hasConflict(supabaseAdmin, { workspaceId: page.workspace_id, propertyId: page.property_id, checkIn: body.checkIn, checkOut: body.checkOut })) {
      return json(request, response, 409, { code: 'dates_unavailable', message: 'Those dates are not available for this property.' });
    }

    const rate = page.base_rate ? Number(page.base_rate) * nights : null;
    const cleaning = page.cleaning_fee ? Number(page.cleaning_fee) : null;
    const quotedTotal = rate !== null ? rate + (cleaning || 0) : null;
    const requiresCheckout = page.booking_mode === 'instant_booking' && page.payment_mode === 'full_payment' && quotedTotal && quotedTotal > 0;

    const { data: created, error: insertError } = await supabaseAdmin.from('direct_booking_requests').insert({
      workspace_id: page.workspace_id,
      property_id: page.property_id,
      direct_booking_page_id: page.id,
      inquiry_type: 'booking_request',
      status: requiresCheckout ? 'approved' : 'new',
      payment_status: requiresCheckout ? 'pending' : 'not_required',
      guest_name: body.guestName,
      guest_email: body.guestEmail,
      guest_phone: body.guestPhone || null,
      check_in: body.checkIn,
      check_out: body.checkOut,
      guest_count: body.adults + body.children,
      adults: body.adults,
      children: body.children,
      message: body.message || null,
      quoted_rate: rate,
      quoted_cleaning_fee: cleaning,
      quoted_total: quotedTotal,
      currency: page.currency || property.currency || 'USD',
      source: 'direct_booking_page',
      metadata: { public_endpoint: true, instant_checkout_requested: Boolean(requiresCheckout), success_url: body.successUrl || null, cancel_url: body.cancelUrl || null },
    }).select('*').single();
    if (insertError) throw insertError;

    await logActivity(supabaseAdmin, page.workspace_id, 'direct_booking_request_submitted', { direct_booking_request_id: created.id, property_id: page.property_id });
    await sendDirectBookingSubmittedEmails(request, supabaseAdmin, page, property, created).catch(() => null);

    let checkout = null;
    if (requiresCheckout) {
      try {
        checkout = await startCheckout(request, supabaseAdmin, page, created, Math.round(quotedTotal * 100));
      } catch {
        await supabaseAdmin.from('direct_booking_requests').update({ payment_status: 'failed', updated_at: new Date().toISOString() }).eq('id', created.id);
        return json(request, response, 202, { requestId: created.id, status: created.status, paymentStatus: 'failed', message: 'Your request was submitted successfully. Payment could not be started. Please contact the host.' });
      }
    }

    return json(request, response, 200, {
      requestId: created.id,
      status: created.status,
      paymentStatus: checkout ? 'pending' : created.payment_status,
      checkoutUrl: checkout?.url || null,
      message: checkout ? 'Your booking request was submitted. Continue to secure payment.' : 'Your request was submitted successfully.',
    });
  } catch {
    return json(request, response, 500, { code: 'request_failed', message: 'Request could not be submitted. Please try again.' });
  }
}
