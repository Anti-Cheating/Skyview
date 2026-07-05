import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Render <Navigate> as a marker so we can assert the redirect target.
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useLocation: () => ({ pathname: '/admin/companies' }),
}));

let authState: Record<string, unknown>;
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authState }));

import AdminRoute from './AdminRoute';

function setAuth(over: Record<string, unknown> = {}) {
  authState = { isAuthenticated: true, isLoading: false, user: { role: 'System Admin' }, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth();
});

const child = <div data-testid="protected">admin console</div>;

describe('AdminRoute', () => {
  test('renders children for a System Admin', () => {
    render(<AdminRoute>{child}</AdminRoute>);
    expect(screen.getByTestId('protected')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  test('shows a loading spinner while auth is resolving', () => {
    setAuth({ isLoading: true });
    render(<AdminRoute>{child}</AdminRoute>);
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  test('redirects unauthenticated users to /login with a returnTo', () => {
    setAuth({ isAuthenticated: false, user: null });
    render(<AdminRoute>{child}</AdminRoute>);
    const nav = screen.getByTestId('navigate');
    expect(nav).toHaveAttribute('data-to', expect.stringContaining('/login?returnTo='));
    expect(nav.getAttribute('data-to')).toContain(encodeURIComponent('/admin/companies'));
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  test('redirects a non-admin authenticated user to /', () => {
    setAuth({ user: { role: 'Owner' } });
    render(<AdminRoute>{child}</AdminRoute>);
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });
});
