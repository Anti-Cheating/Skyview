// User Roles — mirrors Cortex `src/rbac/roles.ts`. Since the Hasura-era
// refactor there is no `Interviewer` role anymore; staff are split into
// Owner / Admin / Member, candidates stay global. Most UI gates care about
// "is this user staff or candidate", so use `isStaffRole()` below rather
// than comparing to a specific role string.
export const USER_ROLES = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  CANDIDATE: 'Candidate',
  SYSTEM_ADMIN: 'System Admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/** Everyone except the Candidate — can create/manage interviews, etc. */
export const STAFF_ROLES: readonly string[] = [
  USER_ROLES.OWNER,
  USER_ROLES.ADMIN,
  USER_ROLES.MEMBER,
  USER_ROLES.SYSTEM_ADMIN,
];

/**
 * Staff who can manage other staff or destructive ops — Owners + Admins
 * (+ Trueyy System Admin). Members are staff but cannot invite people,
 * change roles, delete the company, or delete interviews. Mirrors
 * Cortex's `ROLE_GROUPS.CompanyManager`.
 */
export const COMPANY_MANAGER_ROLES: readonly string[] = [
  USER_ROLES.OWNER,
  USER_ROLES.ADMIN,
  USER_ROLES.SYSTEM_ADMIN,
];

/** True for Owner/Admin/Member/System Admin. */
export function isStaffRole(role?: string | null): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/** True only for Owner / Admin / System Admin — used to gate destructive
 *  actions (delete interview, invite team, change roles). */
export function isCompanyManagerRole(role?: string | null): boolean {
  return !!role && COMPANY_MANAGER_ROLES.includes(role);
}

// Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER_DATA: 'auth_user',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/me',
    DESKTOP_CODE: '/auth/desktop-code',
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect to server. Please check if the server is running.',
  UNAUTHORIZED: 'Session expired. Please login again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
} as const;
