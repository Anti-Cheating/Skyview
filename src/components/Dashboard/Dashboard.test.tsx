import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const logout = vi.fn();
const user = { id: 'user-123', created_at: '2024-01-15T00:00:00Z' };
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user, logout }),
}));

const getDesktopCode = vi.fn();
vi.mock('../../services/auth.service', () => ({
  AuthService: { getDesktopCode: (...a: unknown[]) => getDesktopCode(...a) },
}));

import Dashboard from './Dashboard';

// Deep-link assignment writes window.location.href with a custom scheme;
// stub location so jsdom doesn't attempt (and warn about) navigation.
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
});

describe('Dashboard', () => {
  test('renders the signed-in state and user id', () => {
    render(<Dashboard />);
    expect(screen.getByText("You're signed in")).toBeInTheDocument();
    expect(screen.getByText(/User ID: user-123/)).toBeInTheDocument();
  });

  test('opening the desktop app fetches a code and builds the deep link', async () => {
    getDesktopCode.mockResolvedValue({ code: 'abc123', expiresIn: 60 });
    render(<Dashboard />);
    await userEvent.click(screen.getByRole('button', { name: /open desktop app/i }));
    await waitFor(() => expect(getDesktopCode).toHaveBeenCalled());
    expect(window.location.href).toBe('falcon://auth?code=abc123');
    expect(await screen.findByText(/Redirecting you back to the desktop app/)).toBeInTheDocument();
  });

  test('shows an error when the desktop code request fails', async () => {
    getDesktopCode.mockRejectedValue(new Error('Cortex is down'));
    render(<Dashboard />);
    await userEvent.click(screen.getByRole('button', { name: /open desktop app/i }));
    expect(await screen.findByText('Cortex is down')).toBeInTheDocument();
  });

  test('Sign Out logs out and redirects to /login', async () => {
    logout.mockResolvedValue(undefined);
    render(<Dashboard />);
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
