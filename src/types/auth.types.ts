export interface User {
  id: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
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

export interface DecodedToken {
  sub: string;
  email: string;
  'https://hasura.io/jwt/claims'?: {
    'x-hasura-role': string;
    'x-hasura-user-id': string;
    'x-hasura-default-role': string;
    'x-hasura-allowed-roles': string[];
  };
  iat: number;
  exp: number;
}
