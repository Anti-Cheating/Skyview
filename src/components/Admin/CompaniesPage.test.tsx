import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../services/admin.service', () => ({
  AdminService: { listCompanies: vi.fn() },
}));

import { AdminService } from '../../services/admin.service';
import CompaniesPage from './CompaniesPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.listCompanies).mockResolvedValue({
    data: {
      items: [
        { id: 'co-1', name: 'Acme Inc', slug: 'acme', status: 'active', plan: 'pro', is_self_hosted: false, users: 5, used: 10, remaining: 90, created_at: '2026-01-01' },
      ],
      total: 1,
    },
  } as any);
});

describe('CompaniesPage', () => {
  test('renders the heading and a company row after fetch', async () => {
    render(<CompaniesPage />);
    expect(screen.getByText('Companies')).toBeInTheDocument();
    expect(await screen.findByText('Acme Inc')).toBeInTheDocument();
    expect(screen.getByText('Cloud')).toBeInTheDocument();
  });

  test('clicking a company name navigates to its detail page', async () => {
    render(<CompaniesPage />);
    await userEvent.click(await screen.findByText('Acme Inc'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/companies/co-1');
  });

  test('typing in the search box drives a filtered fetch', async () => {
    render(<CompaniesPage />);
    await screen.findByText('Acme Inc');
    await userEvent.type(screen.getByPlaceholderText('Search companies'), 'acme');
    // Debounced (300ms) — the query eventually fires with the search term.
    await vi.waitFor(() =>
      expect(AdminService.listCompanies).toHaveBeenCalledWith(expect.objectContaining({ search: 'acme' }))
    );
  });
});
