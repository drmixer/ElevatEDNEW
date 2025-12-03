import { authenticatedFetch } from '../lib/apiClient';

export type BillingPlan = {
  slug: string;
  name: string;
  priceCents: number;
  metadata: Record<string, unknown>;
  status: string;
};

export type BillingSummary = {
  subscription: {
    id: number;
    status: string;
    plan: BillingPlan | null;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAt: string | null;
    metadata: Record<string, unknown>;
  } | null;
  billingRequired?: boolean;
  payments: Array<{
    id: number;
    amount_cents: number;
    currency: string;
    status: string;
    description: string | null;
    paid_at: string | null;
    created_at: string | null;
  }>;
  plans: BillingPlan[];
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
};

export const fetchBillingPlans = async (): Promise<BillingPlan[]> => {
  const response = await fetch('/api/v1/billing/plans');
  const data = await handleResponse<{ plans: BillingPlan[] }>(response);
  return data.plans ?? [];
};

export const fetchBillingSummary = async (): Promise<BillingSummary> => {
  const response = await authenticatedFetch('/api/v1/billing/summary');
  return handleResponse<BillingSummary>(response);
};

export type BillingContext = {
  plan: BillingPlan | null;
  limits?: {
    aiAccess?: boolean;
    lessonLimit?: number | 'unlimited' | null;
    tutorDailyLimit?: number | 'unlimited' | null;
    seatLimit?: number | null;
  };
  subscription: BillingSummary['subscription'] | null;
  billingRequired?: boolean;
};

export const fetchBillingContext = async (): Promise<BillingContext> => {
  const response = await authenticatedFetch('/api/v1/billing/context');
  return handleResponse<BillingContext>(response);
};

export const startCheckoutSession = async (planSlug: string): Promise<string> => {
  const response = await authenticatedFetch('/api/v1/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planSlug,
      successUrl: `${window.location.origin}/parent`,
      cancelUrl: window.location.href,
    }),
  });
  const data = await handleResponse<{ checkoutUrl: string }>(response);
  if (!data.checkoutUrl) {
    throw new Error('Unable to start checkout.');
  }
  return data.checkoutUrl;
};

export const openBillingPortal = async (): Promise<string> => {
  const response = await authenticatedFetch('/api/v1/billing/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnUrl: `${window.location.origin}/parent` }),
  });
  const data = await handleResponse<{ portalUrl: string }>(response);
  if (!data.portalUrl) {
    throw new Error('Unable to open billing portal.');
  }
  return data.portalUrl;
};
