import { authenticatedFetch, handleApiResponse } from '../lib/apiClient';
import supabase from '../lib/supabaseClient';

export type AdminSummary = {
  id: string;
  email: string;
  name: string;
  title: string;
  permissions: string[];
  createdAt: string | null;
};

type AdminListResponse = {
  admins: AdminSummary[];
};

type PromoteAdminPayload = {
  email?: string;
  userId?: string;
  title?: string;
  permissions?: string[];
};

export const fetchAdmins = async (): Promise<AdminSummary[]> => {
  const response = await authenticatedFetch('/api/v1/admins');
  const payload = await handleApiResponse<AdminListResponse>(response);
  return payload.admins ?? [];
};

export const promoteAdmin = async (payload: PromoteAdminPayload): Promise<AdminSummary> => {
  const response = await authenticatedFetch('/api/v1/admins/promote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: payload.email,
      userId: payload.userId,
      title: payload.title,
      permissions: payload.permissions,
    }),
  });

  const data = await handleApiResponse<{ admin: AdminSummary }>(response);
  return data.admin;
};

export const demoteAdmin = async (
  userId: string,
): Promise<{ demoted: string; role: string; remainingAdmins: number | null | undefined }> => {
  const response = await authenticatedFetch('/api/v1/admins/demote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });

  return handleApiResponse<{
    demoted: string;
    role: string;
    remainingAdmins?: number | null;
  }>(response);
};

export const logAdminAuditEvent = async (
  adminId: string,
  eventType: string,
  metadata?: Record<string, unknown>,
): Promise<void> => {
  if (!adminId) return;
  const { error } = await supabase.from('admin_audit_logs').insert({
    admin_id: adminId,
    event_type: eventType,
    metadata: metadata ?? {},
  });

  if (error) {
    // Avoid blocking the UI if audit logging fails; surface in console only.
    console.warn('[Admin] Failed to record audit event', error);
  }
};

export type OpsMetricsSnapshot = {
  windowMs: number;
  totals: Record<'tutor_success' | 'tutor_error' | 'tutor_safety_block' | 'tutor_plan_limit' | 'api_failure' | 'api_slow', number>;
  topSafetyReasons: Array<{ label: string; count: number }>;
  topPlanLimitReasons: Array<{ label: string; count: number }>;
  apiFailuresByRoute: Array<{ label: string; count: number }>;
  recent: Array<{
    type: string;
    reason?: string | null;
    route?: string | null;
    status?: number | null;
    durationMs?: number | null;
    plan?: string | null;
    timestamp: number;
  }>;
};

export const fetchOpsMetrics = async (): Promise<OpsMetricsSnapshot> => {
  const response = await authenticatedFetch('/api/v1/admins/ops-metrics');
  return handleApiResponse<OpsMetricsSnapshot>(response);
};
