import { authenticatedFetch, handleApiResponse } from '../lib/apiClient';

export type FamilyLinkPayload = { code: string; linked?: boolean };

export const fetchFamilyLinkCode = async (): Promise<FamilyLinkPayload> => {
  const response = await authenticatedFetch('/api/v1/student/family-code');
  return handleApiResponse<FamilyLinkPayload>(response);
};

export const rotateFamilyLinkCode = async (): Promise<FamilyLinkPayload> => {
  const response = await authenticatedFetch('/api/v1/student/family-code/rotate', {
    method: 'POST',
  });
  return handleApiResponse<FamilyLinkPayload>(response);
};
