import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const AuthServiceMock = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  getCurrentUserDetails: vi.fn(),
  getCurrentUser: vi.fn(),
  clearAuthData: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  googleLogin: vi.fn(),
  completeOnboarding: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('../services/auth.service', () => ({ AuthService: AuthServiceMock }));
vi.mock('../services/api.service', () => ({
  startTokenAutoRefresh: vi.fn(),
  stopTokenAutoRefresh: vi.fn(),
}));

import { AuthProvider, useAuth } from './AuthContext';

function Consumer() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <button onClick={() => login({ email: 'a@b.com', password: 'p' } as never)}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthContext', () => {
  test('unauthenticated on mount: no user, finishes loading, auth data cleared', async () => {
    AuthServiceMock.isAuthenticated.mockReturnValue(false);
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    expect(screen.getByTestId('email')).toHaveTextContent('none');
    expect(AuthServiceMock.clearAuthData).toHaveBeenCalled();
  });

  test('rehydrates the user on mount when a valid session exists', async () => {
    AuthServiceMock.isAuthenticated.mockReturnValue(true);
    AuthServiceMock.getCurrentUserDetails.mockResolvedValue({ id: 'u1', email: 'me@x.com' });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('me@x.com'));
    expect(screen.getByTestId('authed')).toHaveTextContent('true');
  });

  test('login() fetches details and sets the user', async () => {
    AuthServiceMock.isAuthenticated.mockReturnValue(false);
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    AuthServiceMock.login.mockResolvedValue({ user: { id: 'u1', email: 'a@b.com' } });
    // Now authenticated so isAuthenticated (used in the context value) is true.
    AuthServiceMock.isAuthenticated.mockReturnValue(true);
    AuthServiceMock.getCurrentUserDetails.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('a@b.com'));
    expect(AuthServiceMock.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'p' });
  });

  test('login() falls back to the login payload user if details fetch fails', async () => {
    AuthServiceMock.isAuthenticated.mockReturnValue(false);
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    AuthServiceMock.login.mockResolvedValue({ user: { id: 'u1', email: 'fallback@x.com' } });
    AuthServiceMock.getCurrentUserDetails.mockRejectedValue(new Error('500'));
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('fallback@x.com'));
  });

  test('logout() clears the user', async () => {
    AuthServiceMock.isAuthenticated.mockReturnValue(true);
    AuthServiceMock.getCurrentUserDetails.mockResolvedValue({ id: 'u1', email: 'me@x.com' });
    AuthServiceMock.logout.mockResolvedValue(undefined);
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('me@x.com'));

    await userEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('none'));
    expect(AuthServiceMock.logout).toHaveBeenCalled();
  });

  test('useAuth throws outside an AuthProvider', () => {
    function Lone() {
      useAuth();
      return null;
    }
    expect(() => render(<Lone />)).toThrow(/must be used within an AuthProvider/);
  });
});
