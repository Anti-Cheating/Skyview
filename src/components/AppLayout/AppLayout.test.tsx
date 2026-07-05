import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/' }),
  Navigate: ({ to }: { to: string }) => <div>REDIRECT:{to}</div>,
  Outlet: () => <div>OUTLET</div>,
}));

let authUser: Record<string, unknown> | null = { id: 'u1', role: 'Owner' };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));

// Render the sidebar's nav items as plain text so we can assert role-based nav
// without pulling in the full drawer implementation.
vi.mock('../layout/Sidebar', () => ({
  Sidebar: ({ items }: { items: { id: string; label: string }[] }) => (
    <nav>{items.map((i) => <span key={i.id}>{i.label}</span>)}</nav>
  ),
}));
vi.mock('../layout/TruoyyLogo', () => ({ TruoyyLogo: () => null }));

import AppLayout from './AppLayout';

beforeEach(() => {
  vi.clearAllMocks();
  authUser = { id: 'u1', role: 'Owner' };
});

describe('AppLayout', () => {
  test('managers see the full nav (Users / Billing) and the routed Outlet', () => {
    render(<AppLayout />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Interviews')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('OUTLET')).toBeInTheDocument();
  });

  test('candidates get a minimal nav (no Users tab)', () => {
    authUser = { id: 'c1', role: 'Candidate' };
    render(<AppLayout />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Interviews')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing')).not.toBeInTheDocument();
  });

  test('system admins are redirected to the admin console', () => {
    authUser = { id: 'a1', role: 'System Admin' };
    render(<AppLayout />);
    expect(screen.getByText('REDIRECT:/admin')).toBeInTheDocument();
    // The customer shell (sidebar/outlet) must not render for sys admins.
    expect(screen.queryByText('OUTLET')).not.toBeInTheDocument();
  });
});
