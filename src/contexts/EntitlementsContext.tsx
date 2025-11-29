import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BillingPlan, BillingSummary } from '../services/billingService';
import {
  fetchBillingContext,
  fetchBillingPlans,
  fetchBillingSummary,
} from '../services/billingService';
import { buildEntitlements, type Entitlements } from '../lib/entitlements';
import { useAuth } from './AuthContext';
import type { Parent, User } from '../types';

type EntitlementsContextValue = {
  entitlements: Entitlements;
  billingSummary: BillingSummary | null;
  availablePlans: BillingPlan[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const fallbackEntitlements = buildEntitlements({ source: 'fallback' });

const EntitlementsContext = createContext<EntitlementsContextValue>({
  entitlements: fallbackEntitlements,
  billingSummary: null,
  availablePlans: [],
  loading: false,
  error: null,
  refresh: () => {},
});

const countRealChildren = (user: User | null): number => {
  if (!user || user.role !== 'parent') return 0;
  return (user as Parent).children?.filter((child) => !child.id.startsWith('fallback-')).length ?? 0;
};

export const EntitlementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';

  const billingSummaryQuery = useQuery({
    queryKey: ['billing-summary', user?.id],
    queryFn: fetchBillingSummary,
    enabled: Boolean(user) && isParent,
    staleTime: 1000 * 60 * 2,
  });

  const billingContextQuery = useQuery({
    queryKey: ['billing-context', user?.id],
    queryFn: fetchBillingContext,
    enabled: Boolean(user) && !isParent,
    staleTime: 1000 * 60 * 5,
  });

  const billingPlansQuery = useQuery({
    queryKey: ['billing-plans'],
    queryFn: fetchBillingPlans,
    enabled: Boolean(user) && isParent,
    staleTime: 1000 * 60 * 10,
  });

  const entitlements = useMemo(
    () =>
      buildEntitlements({
        plan:
          billingSummaryQuery.data?.subscription?.plan ??
          billingContextQuery.data?.plan ??
          null,
        subscription: billingSummaryQuery.data?.subscription ?? billingContextQuery.data?.subscription ?? null,
        limits: billingContextQuery.data?.limits,
        childCount: isParent ? countRealChildren(user) : undefined,
        source: billingSummaryQuery.data ? 'billing' : billingContextQuery.data ? 'context' : 'fallback',
      }),
    [billingContextQuery.data, billingSummaryQuery.data, isParent, user],
  );

  const availablePlans = useMemo(() => {
    const plans = billingPlansQuery.data ?? [];
    return plans.slice().sort((a, b) => a.priceCents - b.priceCents);
  }, [billingPlansQuery.data]);

  const loading = billingSummaryQuery.isLoading || billingContextQuery.isLoading;
  const summaryError = billingSummaryQuery.error;
  const contextError = billingContextQuery.error;
  const error =
    summaryError instanceof Error
      ? summaryError.message
      : contextError instanceof Error
        ? contextError.message
        : null;

  const refresh = () => {
    if (isParent) {
      void billingSummaryQuery.refetch();
      void billingPlansQuery.refetch();
    } else {
      void billingContextQuery.refetch();
    }
  };

  return (
    <EntitlementsContext.Provider
      value={{
        entitlements,
        billingSummary: billingSummaryQuery.data ?? null,
        availablePlans,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </EntitlementsContext.Provider>
  );
};

export const useEntitlements = () => {
  const context = useContext(EntitlementsContext);
  if (!context) {
    throw new Error('useEntitlements must be used within an EntitlementsProvider');
  }
  return context;
};
