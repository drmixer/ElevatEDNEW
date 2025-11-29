import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
const DEFAULT_PREMIUM_PLAN = process.env.DEFAULT_PREMIUM_PLAN_SLUG || 'family-premium';

const priceToPlanSlug: Record<string, string> = Object.fromEntries(
  Object.entries({
    [process.env.STRIPE_PRICE_FAMILY_FREE ?? '']: 'family-free',
    [process.env.STRIPE_PRICE_FAMILY_PLUS ?? '']: 'family-plus',
    [process.env.STRIPE_PRICE_FAMILY_PREMIUM ?? '']: 'family-premium',
  }).filter(([priceId]) => priceId && priceId.trim().length > 0),
);

const planLimits: Record<string, { aiAccess: boolean; lessonLimit?: number | 'unlimited'; tutorDailyLimit?: number | 'unlimited' }> = {
  'family-free': { aiAccess: true, lessonLimit: 10, tutorDailyLimit: 3 },
  'family-plus': { aiAccess: true, lessonLimit: 100, tutorDailyLimit: 'unlimited' },
  'family-premium': { aiAccess: true, lessonLimit: 'unlimited', tutorDailyLimit: 'unlimited' },
};

type StripeSubscription = Stripe.Subscription;
type StripeInvoice = Stripe.Invoice;
type StripeEvent = Stripe.Event;

export const getStripeClient = (): Stripe | null => {
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret, {
    apiVersion: '2024-06-20',
  });
};

export const getStripeWebhookSecret = (): string | null => stripeWebhookSecret ?? null;

export const isBillingSandboxMode = (): boolean => process.env.BILLING_SANDBOX_MODE === 'true';

const parseBypassList = (): Set<string> => {
  const raw = process.env.BILLING_BYPASS_PARENTS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0),
  );
};

const bypassList = parseBypassList();

export const isBillingBypassed = async (
  supabase: SupabaseClient,
  parentId: string,
): Promise<boolean> => {
  if (isBillingSandboxMode()) return true;
  if (bypassList.has(parentId.toLowerCase())) return true;

  const { data, error } = await supabase.from('profiles').select('email').eq('id', parentId).maybeSingle();
  if (error) {
    console.warn('[billing] failed to check bypass email', error);
    return false;
  }
  const email = (data?.email as string | undefined)?.toLowerCase();
  if (email && bypassList.has(email)) {
    return true;
  }
  return false;
};

const normalizeStatus = (status: StripeSubscription.Status | null | undefined): string => {
  if (!status) return 'canceled';
  if (status === 'trialing') return 'trialing';
  if (status === 'active') return 'active';
  if (status === 'past_due' || status === 'incomplete') return 'past_due';
  if (status === 'canceled' || status === 'incomplete_expired' || status === 'unpaid') return 'canceled';
  return 'canceled';
};

const getPlanBySlug = async (serviceSupabase: SupabaseClient, slug: string) => {
  const { data, error } = await serviceSupabase
    .from('plans')
    .select('id, slug, name, price_cents, metadata')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Plan ${slug} not found: ${error?.message ?? 'missing'}`);
  }

  return data as { id: number; slug: string; name: string; price_cents: number; metadata: Record<string, unknown> };
};

const recordHistory = async (
  serviceSupabase: SupabaseClient,
  subscriptionId: number,
  eventType: string,
  previousStatus: string | null,
  newStatus: string | null,
  payload: Record<string, unknown>,
) => {
  await serviceSupabase.from('subscription_history').insert({
    subscription_id: subscriptionId,
    event_type: eventType,
    previous_status: previousStatus,
    new_status: newStatus,
    payload,
  });
};

const recordBillingEvent = async (
  serviceSupabase: SupabaseClient,
  subscriptionId: number | null,
  eventType: string,
  payload: Record<string, unknown>,
) => {
  await serviceSupabase.from('billing_events').insert({
    subscription_id: subscriptionId,
    event_type: eventType,
    payload,
  });
};

const mapPriceToPlan = async (
  serviceSupabase: SupabaseClient,
  priceId: string | null | undefined,
): Promise<{ id: number; slug: string; name: string; price_cents: number; metadata: Record<string, unknown> } | null> => {
  if (!priceId) return null;
  const planSlug = priceToPlanSlug[priceId];
  if (!planSlug) return null;
  return getPlanBySlug(serviceSupabase, planSlug);
};

const findSubscriptionByStripeId = async (
  serviceSupabase: SupabaseClient,
  stripeSubscriptionId: string | null | undefined,
  stripeCustomerId: string | null | undefined,
) => {
  if (!stripeSubscriptionId && !stripeCustomerId) return null;

  const query = stripeSubscriptionId
    ? serviceSupabase
        .from('subscriptions')
        .select('id, parent_id, plan_id, status, metadata')
        .eq('metadata->>stripe_subscription_id', stripeSubscriptionId)
        .limit(1)
    : serviceSupabase
        .from('subscriptions')
        .select('id, parent_id, plan_id, status, metadata')
        .eq('metadata->>stripe_customer_id', stripeCustomerId ?? '')
        .limit(1);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn('[billing] Failed to find subscription by Stripe ids', error);
    return null;
  }
  return data as { id: number; parent_id: string; plan_id: number; status: string; metadata: Record<string, unknown> } | null;
};

const ensureSubscriptionRecord = async (
  serviceSupabase: SupabaseClient,
  parentId: string,
  planId: number,
  status: string,
  billing: {
    anchor?: Date | null;
    trialEnds?: Date | null;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAt?: Date | null;
    canceledAt?: Date | null;
    metadata?: Record<string, unknown>;
  },
) => {
  const { data: existing } = await serviceSupabase
    .from('subscriptions')
    .select('metadata')
    .eq('parent_id', parentId)
    .maybeSingle();

  const payload = {
    parent_id: parentId,
    plan_id: planId,
    status,
    billing_anchor: billing.anchor ?? null,
    trial_ends_at: billing.trialEnds ?? null,
    current_period_start: billing.currentPeriodStart ?? null,
    current_period_end: billing.currentPeriodEnd ?? null,
    cancel_at: billing.cancelAt ?? null,
    canceled_at: billing.canceledAt ?? null,
    metadata: {
      ...(existing?.metadata as Record<string, unknown> | undefined),
      ...(billing.metadata ?? {}),
    },
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await serviceSupabase
    .from('subscriptions')
    .upsert(payload, { onConflict: 'parent_id' })
    .select('id, status')
    .single();

  if (error || !data) {
    throw new Error(`Failed to upsert subscription: ${error?.message ?? 'unknown error'}`);
  }

  await serviceSupabase
    .from('parent_profiles')
    .update({
      subscription_plan_id: planId,
      subscription_status: status,
    })
    .eq('id', parentId);

  return data as { id: number; status: string };
};

export const syncStripeSubscription = async (
  serviceSupabase: SupabaseClient,
  subscription: StripeSubscription,
  defaultParentId?: string | null,
) => {
  const customerId = subscription.customer as string | null;
  const parentId = (subscription.metadata?.parent_id as string | undefined) ?? defaultParentId ?? null;

  if (!parentId) {
    throw new Error('Subscription missing parent reference.');
  }

  const plan = await mapPriceToPlan(serviceSupabase, subscription.items.data[0]?.price?.id);
  if (!plan) {
    throw new Error(`Unknown price for subscription ${subscription.id}`);
  }

  const status = normalizeStatus(subscription.status);
  const billing = {
    anchor: subscription.billing_cycle_anchor ? new Date(subscription.billing_cycle_anchor * 1000) : null,
    trialEnds: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
    currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    metadata: {
      ...(subscription.metadata ?? {}),
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
    },
  };

  const record = await ensureSubscriptionRecord(serviceSupabase, parentId ?? '', plan.id, status, billing);
  await recordHistory(serviceSupabase, record.id, 'stripe.sync', null, status, {
    stripe_status: subscription.status,
    stripe_subscription_id: subscription.id,
  });
  await recordBillingEvent(serviceSupabase, record.id, 'subscription.synced', {
    subscription,
  });

  return { subscriptionId: record.id, parentId: parentId ?? '', status, plan };
};

export const grantBypassSubscription = async (
  serviceSupabase: SupabaseClient,
  parentId: string,
  planSlug = DEFAULT_PREMIUM_PLAN,
  reason: 'sandbox' | 'bypass' = 'bypass',
) => {
  const plan = await getPlanBySlug(serviceSupabase, planSlug);
  const record = await ensureSubscriptionRecord(serviceSupabase, parentId, plan.id, 'active', {
    metadata: { bypass: true, reason, plan_slug: planSlug },
  });
  await recordHistory(serviceSupabase, record.id, `billing.${reason}`, record.status, 'active', {
    plan_slug: planSlug,
  });
  return record;
};

export const recordInvoicePayment = async (
  serviceSupabase: SupabaseClient,
  invoice: StripeInvoice,
  defaultParentId?: string | null,
) => {
  const customerId = invoice.customer as string | null;
  const subscriptionId = (invoice.subscription as string | null) ?? null;
  const parentId =
    (invoice.metadata?.parent_id as string | undefined) ??
    (invoice.customer_email as string | undefined) ??
    defaultParentId ??
    null;

  const subscriptionRow = await findSubscriptionByStripeId(serviceSupabase, subscriptionId, customerId);
  const targetParent = subscriptionRow?.parent_id ?? parentId;
  if (!targetParent) {
    throw new Error('Unable to resolve parent for invoice');
  }

  const status: string =
    invoice.paid && invoice.status === 'paid'
      ? 'succeeded'
      : invoice.status === 'open' || invoice.status === 'draft'
        ? 'pending'
        : 'failed';

  const { error } = await serviceSupabase.from('payments').insert({
    subscription_id: subscriptionRow?.id ?? null,
    parent_id: targetParent,
    amount_cents: invoice.amount_paid ?? invoice.amount_due ?? 0,
    currency: invoice.currency ?? 'usd',
    status,
    description: invoice.lines?.data?.[0]?.description ?? invoice.description ?? 'Subscription payment',
    external_id: invoice.payment_intent ?? invoice.id,
    paid_at: invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
      : null,
    metadata: {
      invoice_id: invoice.id,
      stripe_subscription_id: subscriptionId,
    },
  });

  if (error) {
    throw new Error(`Failed to record payment: ${error.message}`);
  }

  if (subscriptionRow?.id) {
    await recordBillingEvent(serviceSupabase, subscriptionRow.id, 'payment.recorded', {
      invoice_id: invoice.id,
      status,
    });
  }
};

export const handleStripeEvent = async (
  serviceSupabase: SupabaseClient,
  stripe: Stripe,
  event: StripeEvent,
) => {
  if (isBillingSandboxMode()) {
    return;
  }
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.subscription) break;
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      await syncStripeSubscription(
        serviceSupabase,
        subscription,
        (session.metadata?.parent_id as string | undefined) ?? null,
      );
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as StripeSubscription;
      await syncStripeSubscription(serviceSupabase, subscription);
      break;
    }
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as StripeInvoice;
      await recordInvoicePayment(serviceSupabase, invoice);
      break;
    }
    default: {
      // Store other events for observability
      const subscriptionId = (event.data.object as { subscription?: string }).subscription ?? null;
      const subscriptionRow = await findSubscriptionByStripeId(
        serviceSupabase,
        subscriptionId as string | null,
        (event.data.object as { customer?: string }).customer as string | null,
      );
      await recordBillingEvent(serviceSupabase, subscriptionRow?.id ?? null, event.type, event.data.object as Record<string, unknown>);
    }
  }
};

export const createCheckoutSessionForPlan = async (
  serviceSupabase: SupabaseClient,
  stripe: Stripe,
  parentId: string,
  planSlug: string,
  options?: { successUrl?: string; cancelUrl?: string },
) => {
  if (isBillingSandboxMode() || bypassList.has(parentId.toLowerCase())) {
    await grantBypassSubscription(serviceSupabase, parentId, planSlug, isBillingSandboxMode() ? 'sandbox' : 'bypass');
    return `${options?.successUrl ?? appBaseUrl}/billing/sandbox`;
  }

  const plan = await getPlanBySlug(serviceSupabase, planSlug);
  const priceId = Object.entries(priceToPlanSlug).find(([, slug]) => slug === planSlug)?.[0];
  if (!priceId) {
    throw new Error(`No Stripe price configured for ${planSlug}`);
  }

  const { data: currentSub } = await serviceSupabase
    .from('subscriptions')
    .select('metadata')
    .eq('parent_id', parentId)
    .maybeSingle();

  const existingCustomerId =
    (currentSub?.metadata as Record<string, unknown> | null | undefined)?.stripe_customer_id as string | undefined;

  const customerId =
    existingCustomerId ??
    (
      await stripe.customers.create({
        metadata: { parent_id: parentId },
      })
    ).id;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    allow_promotion_codes: true,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: { parent_id: parentId, plan_slug: planSlug },
    success_url: options?.successUrl ?? `${appBaseUrl}/parent`,
    cancel_url: options?.cancelUrl ?? `${appBaseUrl}/parent`,
    customer: customerId,
    subscription_data: {
      metadata: { parent_id: parentId, plan_slug: planSlug },
    },
  });

  await ensureSubscriptionRecord(serviceSupabase, parentId, plan.id, 'trialing', {
    metadata: {
      stripe_customer_id: customerId,
      stripe_checkout_session: session.id,
    },
  });

  return session.url;
};

export const createPortalSession = async (
  stripe: Stripe,
  customerId: string,
  returnUrl?: string,
) => {
  if (isBillingSandboxMode()) {
    return returnUrl ?? `${appBaseUrl}/billing/portal`;
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl ?? `${appBaseUrl}/parent`,
  });
  return session.url;
};

export const fetchBillingSummary = async (
  supabase: SupabaseClient,
  parentId: string,
  serviceSupabase?: SupabaseClient,
) => {
  if (await isBillingBypassed(supabase, parentId)) {
    // Make sure we have an active record for display when bypassed.
    try {
      await grantBypassSubscription(
        serviceSupabase ?? supabase,
        parentId,
        DEFAULT_PREMIUM_PLAN,
        isBillingSandboxMode() ? 'sandbox' : 'bypass',
      );
    } catch (error) {
      console.warn('[billing] failed to grant bypass subscription', error);
    }
  }

  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('id, status, plan_id, trial_ends_at, current_period_end, cancel_at, metadata, plans ( slug, name, price_cents, metadata )')
    .eq('parent_id', parentId)
    .maybeSingle();

  if (subError) {
    throw new Error(`Failed to load subscription: ${subError.message}`);
  }

  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('id, amount_cents, currency, status, description, paid_at, created_at')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (payError) {
    throw new Error(`Failed to load payments: ${payError.message}`);
  }

  const { data: plansData } = await supabase
    .from('plans')
    .select('id, slug, name, price_cents, metadata, status')
    .eq('status', 'active');

  return {
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          plan: subscription.plans
            ? {
                slug: (subscription.plans as { slug: string }).slug,
                name: (subscription.plans as { name: string }).name,
                priceCents: (subscription.plans as { price_cents: number }).price_cents,
                metadata: (subscription.plans as { metadata: Record<string, unknown> }).metadata ?? {},
              }
            : null,
          trialEndsAt: subscription.trial_ends_at,
          currentPeriodEnd: subscription.current_period_end,
          cancelAt: subscription.cancel_at,
          metadata: subscription.metadata ?? {},
        }
      : null,
    payments: payments ?? [],
    plans: (plansData ?? []).map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      priceCents: plan.price_cents,
      metadata: plan.metadata ?? {},
      status: plan.status,
    })),
  };
};

export const getPlanLimits = (planSlug: string) => planLimits[planSlug] ?? planLimits['family-free'];
