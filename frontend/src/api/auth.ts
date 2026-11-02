import { api, setPendingToken, setToken } from './client';
import type { AuthContextPayload, RoleOption } from './client';

/**
 * Real authentication flow — SMS OTP only (the system has no passwords).
 * verify issues a pending-role token; switchRole exchanges it (and any
 * active token) for a role-scoped token.
 */

export async function requestOtp(phone: string): Promise<void> {
  await api('/v1/auth/otp/request', {
    method: 'POST',
    body: { phone },
    tokenKind: 'none',
  });
}

export async function verifyOtp(phone: string, code: string): Promise<RoleOption[]> {
  const result = await api<{ token: string; token_kind: string; roles: RoleOption[] }>(
    '/v1/auth/otp/verify',
    {
      method: 'POST',
      body: { phone, code },
      tokenKind: 'none',
    },
  );

  setPendingToken(result.token);
  setToken(null); // any previous session ends on a new login

  return result.roles ?? [];
}

/** Activate one of the user's active role assignments. */
export async function switchRole(userRoleId: number): Promise<void> {
  const result = await api<{ token: string; active_role: RoleOption }>(
    '/v1/auth/switch-role',
    {
      method: 'POST',
      body: { user_role_id: userRoleId },
      tokenKind: 'pending',
    },
  );

  setToken(result.token);
  setPendingToken(null);
}

export async function fetchAuthContext(): Promise<AuthContextPayload> {
  return api<AuthContextPayload>('/v1/auth/context');
}

/** Context call with the pending token (logged in, role not chosen yet). */
export async function fetchPendingAuthContext(): Promise<AuthContextPayload> {
  return api<AuthContextPayload>('/v1/auth/context', { tokenKind: 'pending' });
}

export async function logout(): Promise<void> {
  try {
    await api('/v1/auth/logout', { method: 'POST' });
  } finally {
    setToken(null);
    setPendingToken(null);
  }
}

/** Guardian portal: children of the active guardian with effective flags. */
export async function fetchMyChildren(): Promise<
  {
    student_ulid: string;
    student_name: string;
    link_type?: string;
    link_label?: string;
    effective_flags: Record<string, boolean>;
  }[]
> {
  const result = await api<{
    data: {
      student_ulid: string;
      student_name: string;
      link_type?: string;
      link_label?: string;
      effective_flags: Record<string, boolean>;
    }[];
  }>('/v1/my/children');
  return result.data ?? [];
}
