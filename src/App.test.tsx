import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

// Keep the smoke test hermetic: stub the OAuth provider + the three app
// context providers to simple pass-throughs, and force the auth gate into
// its loading state so no heavy page component actually mounts.
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isAuthenticated: false, isLoading: true, user: null }),
}));
vi.mock('./contexts/CompanyContext', () => ({
  CompanyProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('./contexts/SnackbarContext', () => ({
  SnackbarProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('./components/common', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
  LoadingSpinner: ({ message }: { message?: string }) => <div>{message ?? 'loading'}</div>,
}));

import App from './App';

describe('App', () => {
  test('the default export is a component', () => {
    expect(typeof App).toBe('function');
  });

  test('mounts the provider tree + router without crashing', () => {
    render(<App />);
    // isLoading=true routes every guard to the LoadingSpinner stub.
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
