import { describe, expect, test } from 'vitest';

import { extractBearerToken } from '../auth.js';
import { normalizePermissionList } from '../admins.js';

describe('auth helpers', () => {
  test('extractBearerToken returns the bearer token when present', () => {
    const token = extractBearerToken({
      headers: { authorization: 'Bearer test-token-123' },
    } as never);

    expect(token).toBe('test-token-123');
  });

  test('extractBearerToken handles missing or malformed headers', () => {
    expect(extractBearerToken({ headers: {} } as never)).toBeNull();
    expect(extractBearerToken({ headers: { authorization: 'Token abc' } } as never)).toBeNull();
  });

  test('normalizePermissionList trims, deduplicates, and limits entries', () => {
    const permissions = normalizePermissionList([' dashboard:view ', 'content:manage', 'content:manage']);

    expect(permissions).toEqual(['dashboard:view', 'content:manage']);
  });
});
