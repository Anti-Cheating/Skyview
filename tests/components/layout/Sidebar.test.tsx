import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, onClick, ...rest }: any) => (
    <a href={to} onClick={onClick} {...rest}>{children}</a>
  ),
}));

const logout = vi.fn();
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ logout }),
}));

let companyState: any = null;
vi.mock('../../../src/contexts/CompanyContext', () => ({
  useCompany: () => ({ company: companyState }),
}));

import { Sidebar } from '../../../src/components/layout/Sidebar';
import type { SidebarProps } from '../../../src/components/layout/sidebar.types';

const baseProps = (over: Partial<SidebarProps> = {}): SidebarProps => ({
  logo: { label: 'Trueyy', route: '/', iconName: 'Dashboard' },
  items: [
    { id: 'dash', label: 'Dashboard', iconName: 'Dashboard', route: '/' },
    { id: 'ints', label: 'Interviews', iconName: 'Interviews', route: '/interviews', badge: 3 },
  ],
  secondary: [{ id: 'settings', label: 'Settings', iconName: 'Settings', route: '/settings' }],
  profile: { id: 'u1', label: 'Jane Doe', route: '/profile' },
  collapsed: false,
  onToggle: vi.fn(),
  onNavigate: vi.fn(),
  activeId: 'dash',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  companyState = null;
});

describe('Sidebar', () => {
  test('renders the primary + secondary nav items and profile', () => {
    render(<Sidebar {...baseProps()} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Interviews')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  test('clicking a nav item calls onNavigate with its route', async () => {
    const onNavigate = vi.fn();
    render(<Sidebar {...baseProps({ onNavigate })} />);
    await userEvent.click(screen.getByText('Interviews'));
    expect(onNavigate).toHaveBeenCalledWith('/interviews');
  });

  test('logout is confirmed via a dialog before firing', async () => {
    render(<Sidebar {...baseProps()} />);
    await userEvent.click(screen.getByRole('button', { name: /logout/i }));
    expect(await screen.findByText('Sign out of Trueyy?')).toBeInTheDocument();
    // Not logged out until confirmed.
    expect(logout).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /^sign out$/i }));
    expect(logout).toHaveBeenCalledOnce();
  });

  test('renders the workspace chip when a company is present', () => {
    companyState = { name: 'Acme Corp', logo_url: null };
    render(<Sidebar {...baseProps()} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });
});
