import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'co-1' }),
  useNavigate: () => mockNavigate,
}));

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError, showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../../src/services/admin.service', () => ({
  AdminService: {
    getCompany: vi.fn(), companyUsers: vi.fn(), companyBilling: vi.fn(),
    companyInterviews: vi.fn(), companyWebhooks: vi.fn(), companySecurity: vi.fn(),
    adjustQuota: vi.fn(), suspendCompany: vi.fn(),
  },
}));

import { AdminService } from '../../../src/services/admin.service';
import CompanyDetailPage from '../../../src/components/Admin/CompanyDetailPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.getCompany).mockResolvedValue({
    data: {
      company: { id: 'co-1', name: 'Acme Inc', slug: 'acme', status: 'active', created_at: '2026-01-01', website: 'acme.com', location: 'NYC', billing_contact_email: 'bill@acme.com' },
      counts: { users: 5, interview_sessions: 12, interview_processes: 3 },
      is_self_hosted: false, subscription: null, plan: null,
    },
  } as any);
  vi.mocked(AdminService.companyUsers).mockResolvedValue({ data: { users: [] } } as any);
  vi.mocked(AdminService.companyBilling).mockResolvedValue({ data: { subscription: null, payments: [], invoices: [], billing_history: [] } } as any);
  vi.mocked(AdminService.companyInterviews).mockResolvedValue({ data: { self_hosted: false, items: [] } } as any);
  vi.mocked(AdminService.companyWebhooks).mockResolvedValue({ data: { endpoints: [], deliveries: [] } } as any);
  vi.mocked(AdminService.companySecurity).mockResolvedValue({ data: { active_sessions: 1, pending_resets: 0, pending_verifications: 0 } } as any);
  vi.mocked(AdminService.adjustQuota).mockResolvedValue({ data: {} } as any);
  vi.mocked(AdminService.suspendCompany).mockResolvedValue({ data: {} } as any);
});

describe('CompanyDetailPage', () => {
  test('loads and renders the company overview', async () => {
    render(<CompanyDetailPage />);
    expect(await screen.findByText('Acme Inc')).toBeInTheDocument();
    expect(screen.getByText('Cloud')).toBeInTheDocument();
    // The overview tab shows the counts.
    expect(screen.getByText('Interview sessions')).toBeInTheDocument();
  });

  test('back link navigates to the companies list', async () => {
    render(<CompanyDetailPage />);
    await screen.findByText('Acme Inc');
    await userEvent.click(screen.getByText('Back to companies'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/companies');
  });

  test('Suspend opens a confirm dialog and calls suspendCompany', async () => {
    render(<CompanyDetailPage />);
    await screen.findByText('Acme Inc');
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Suspend company')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));

    expect(AdminService.suspendCompany).toHaveBeenCalledWith('co-1');
    await vi.waitFor(() => expect(showSuccess).toHaveBeenCalledWith('Company suspended.'));
  });

  test('Adjust quota accepts a number and calls adjustQuota', async () => {
    render(<CompanyDetailPage />);
    await screen.findByText('Acme Inc');
    await userEvent.click(screen.getByRole('button', { name: /adjust quota/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/interviews to add/i), '25');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adjust' }));

    expect(AdminService.adjustQuota).toHaveBeenCalledWith('co-1', 25);
    await vi.waitFor(() => expect(showSuccess).toHaveBeenCalledWith('Quota adjusted.'));
  });
});
