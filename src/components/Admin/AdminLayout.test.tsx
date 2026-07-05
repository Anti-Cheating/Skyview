import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  Outlet: () => <div data-testid="outlet">routed page</div>,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/admin/companies' }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'System Admin', first_name: 'Ada', avatar_url: null } }),
}));

// A light Sidebar stand-in that surfaces the logo + items and lets us
// trigger navigation without pulling in the full sidebar tree.
vi.mock('../layout/Sidebar', () => ({
  Sidebar: ({ logo, items, onNavigate }: any) => (
    <nav data-testid="sidebar">
      <span>{logo.label}</span>
      {items.map((it: any) => (
        <button key={it.id} onClick={() => onNavigate(it.route)}>{it.label}</button>
      ))}
    </nav>
  ),
}));

import AdminLayout from './AdminLayout';

beforeEach(() => vi.clearAllMocks());

describe('AdminLayout', () => {
  test('renders the admin sidebar and the routed outlet', () => {
    render(<AdminLayout />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('Trueyy Admin')).toBeInTheDocument();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  test('exposes the primary admin nav destinations', () => {
    render(<AdminLayout />);
    expect(screen.getByRole('button', { name: 'Companies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Licensing' })).toBeInTheDocument();
  });

  test('clicking a nav item navigates to its route', async () => {
    render(<AdminLayout />);
    await userEvent.click(screen.getByRole('button', { name: 'Audit' }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/audit');
  });
});
