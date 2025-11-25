import { authenticatedFetch, handleApiResponse } from '../lib/apiClient';

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
