import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User, Role, RoleAssignment, Student, PermissionScope } from '../types';
import { UserService } from '../services';
import { BASE_ROLES } from '../permissions';
import { ApiError, getPendingToken, getToken, setPendingToken, setToken } from '../api/client';
import * as authApi from '../api/auth';
import type { AuthContextPayload, RoleOption } from '../api/client';
import { ApiFamilyService } from '../api/data';

/**
 * Auth is backed by the real backend: SMS OTP login → pending token →
 * switch-role → role-scoped token → GET /auth/context.
 *
 * The context keeps the SAME interface the pages already use (currentUser,
 * activeRole, hasAccess, ...) so unwired pages keep working; permission
 * codes come from the backend's single-source matrix (dot→colon mapped).
 */

// backend role key → BASE_ROLES id (visual identity of the role)
const ROLE_KEY_TO_FRONTEND_ID: Record<string, string> = {
  school_admin: 'school_principal',
  academic_deputy: 'educational_deputy',
  discipline_deputy: 'disciplinary_deputy',
  teacher: 'teacher',
  corrector: 'essay_grader',
  proctor: 'exam_proctor',
  guardian: 'guardian',
  student: 'active_student',
  office_manager: 'school_registrar',
  support: 'school_support_desk',
  platform_admin: 'platform_super_admin',
};

const GUEST_USER: User = {
  id: 'guest',
  nationalId: '',
  fullName: 'مهمان',
  email: '',
  phoneNumber: '',
  isActive: true,
  createdAt: '',
};

const GUEST_ROLE: Role = {
  id: 'external_guest',
  name: 'Guest',
  persianTitle: 'بازدیدکننده',
  group: 'external',
  description: 'وارد نشده به سامانه',
  defaultScope: 'platform',
  allowedPermissions: [],
};

interface AuthContextType {
  currentUser: User;
  activeRole: Role;
  activeAssignment: RoleAssignment;
  userAssignments: RoleAssignment[];
  allUsers: User[];
  allRoles: Role[];
  allStudents: Student[];
  activeStudent: Student | null;
  switchContext: (assignmentId: string) => Promise<void>;
  switchStudent: (studentId: string) => void;
  hasAccess: (permissionCode: string) => boolean;
  // Real backend session API
  /** Real school name from the live session (null for guests). */
  activeSchoolName: string | null;
  isAuthenticated: boolean;
  /** Logged in but the school has not assigned any role yet (guest panel). */
  needsRole: boolean;
  isSessionLoading: boolean;
  pendingRoles: RoleOption[];
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  switchRole: (backendUserRoleId: number) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapScope = (scopeType: string): PermissionScope => {
  if (scopeType === 'classroom') return 'classroom';
  if (scopeType === 'student') return 'student';
  if (scopeType === 'guardian_link') return 'guardian_link';
  return 'school';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contextPayload, setContextPayload] = useState<AuthContextPayload | null>(null);
  const [pendingPayload, setPendingPayload] = useState<AuthContextPayload | null>(null);
  const [sessionLoading, setSessionLoading] = useState<boolean>(
    () => getToken() !== null || getPendingToken() !== null,
  );
  const [pendingRoles, setPendingRoles] = useState<RoleOption[]>([]);
  const [myChildren, setMyChildren] = useState<Student[]>([]);

  // Bootstrap: restore an existing role token; a logged-in user without a
  // chosen role lands in the guest panel (needsRole), never in the dashboard.
  useEffect(() => {
    if (!getToken() && !getPendingToken()) return;

    (async () => {
      try {
        const payload = getToken()
          ? await authApi.fetchAuthContext()
          : await authApi.fetchPendingAuthContext();

        if (payload.active_role === null) {
          setPendingPayload(payload);
        } else {
          setContextPayload(payload);
        }
      } catch (error) {
        // Expired/revoked role (404), stale token or server down.
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          setToken(null);
          setPendingToken(null);
        }
      } finally {
        setSessionLoading(false);
      }
    })();
  }, []);

  const applyContext = useCallback(async (payload: AuthContextPayload) => {
    setContextPayload(payload);

    // Guardian dashboard needs the real children list (sh3: active links only).
    if (payload.active_role?.key === 'guardian') {
      try {
        setMyChildren(await ApiFamilyService.listMyChildren());
      } catch {
        setMyChildren([]);
      }
    } else {
      setMyChildren([]);
    }
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    await authApi.requestOtp(phone);
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    const roles = await authApi.verifyOtp(phone, code);
    setPendingRoles(roles);
  }, []);

  const switchRole = useCallback(async (backendUserRoleId: number) => {
    await authApi.switchRole(backendUserRoleId);
    setPendingRoles([]);
    await applyContext(await authApi.fetchAuthContext());
  }, [applyContext]);

  const logout = useCallback(async () => {
    await authApi.logout();
    setContextPayload(null);
    setPendingPayload(null);
    setPendingRoles([]);
    setMyChildren([]);
  }, []);

  // ─── Mapped legacy shapes (keep the page contract stable) ───────────────
  const currentUser: User = useMemo(() => {
    if (!contextPayload) return GUEST_USER;
    const u = contextPayload.user;
    return {
      id: u.ulid,
      nationalId: '—',
      fullName: `${u.first_name} ${u.last_name}`.trim(),
      email: '—',
      phoneNumber: u.phone,
      isActive: true,
      createdAt: '',
    };
  }, [contextPayload]);

  const activeRole: Role = useMemo(() => {
    if (!contextPayload?.active_role) return GUEST_ROLE;

    const frontendId = ROLE_KEY_TO_FRONTEND_ID[contextPayload.active_role.key];
    const base = BASE_ROLES.find((r) => r.id === frontendId);
    // Permission codes come from the live matrix grant list (dot → colon).
    const permissions = contextPayload.permissions.map((p) => p.key.replace('.', ':'));

    if (base) {
      return { ...base, allowedPermissions: permissions };
    }

    return {
      id: contextPayload.active_role.key,
      name: contextPayload.active_role.key,
      persianTitle: contextPayload.active_role.title,
      group: 'school_admin',
      description: 'نقش سامانه',
      defaultScope: 'school',
      allowedPermissions: permissions,
    };
  }, [contextPayload]);

  const userAssignments: RoleAssignment[] = useMemo(() => {
    if (!contextPayload?.active_role) return [];
    return [
      {
        id: 'ra_active',
        userId: currentUser.id,
        roleId: activeRole.id,
        schoolId: contextPayload.school?.ulid ?? 'sch_active',
        scopeType: mapScope(contextPayload.active_role.scope_type),
        validFrom: '—',
      },
    ];
  }, [contextPayload, currentUser, activeRole]);

  const activeAssignment: RoleAssignment = useMemo(
    () => userAssignments[0] ?? {
      id: 'ra_guest',
      userId: GUEST_USER.id,
      roleId: GUEST_ROLE.id,
      schoolId: 'sch_1',
      scopeType: 'school',
      validFrom: '—',
    },
    [userAssignments],
  );

  const allUsers: User[] = useMemo(() => UserService.getUsers(), []);
  const allRoles: Role[] = useMemo(() => UserService.getRoles(), []);
  const allStudents: Student[] = useMemo(() => {
    // Guardian sees his real children; others keep the demo roster.
    return myChildren.length > 0 ? myChildren : UserService.getStudents();
  }, [myChildren]);

  const activeStudent: Student | null = useMemo(() => allStudents[0] ?? null, [allStudents]);

  const switchContext = useCallback(async (assignmentId: string) => {
    // Mapped assignments may carry the numeric backend id after the "ra_" prefix.
    const numeric = Number(assignmentId.replace('ra_', ''));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    await switchRole(numeric);
  }, [switchRole]);

  const switchStudent = useCallback((_studentId: string) => {
    // Child selection is served by /my/children ordering for now.
  }, []);

  const hasAccess = useCallback((permissionCode: string): boolean => {
    return activeRole.allowedPermissions.includes(permissionCode);
  }, [activeRole]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole,
        activeAssignment,
        userAssignments,
        allUsers,
        allRoles,
        allStudents,
        activeStudent,
        switchContext,
        switchStudent,
        hasAccess,
        activeSchoolName: contextPayload?.school?.name ?? null,
        isAuthenticated: contextPayload !== null || pendingPayload !== null,
        needsRole: pendingPayload !== null,
        isSessionLoading: sessionLoading,
        pendingRoles,
        requestOtp,
        verifyOtp,
        switchRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
