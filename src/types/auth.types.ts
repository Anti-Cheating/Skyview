export interface User {
  id: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  /**
   * Profile picture. Either Google's URL (auto-filled at first
   * Google sign-in) or an R2 URL from a manual upload. Null = UI
   * falls back to initials.
   */
  avatar_url?: string | null;
  /**
   * Null for candidates (global identity). Populated for staff users
   * (Owner / Admin / Member / System Admin) — points at the company
   * they belong to. Used by the Team page to know which company's
   * invites to manage.
   */
  company_id?: string | null;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  middleName?: string;
  role?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

