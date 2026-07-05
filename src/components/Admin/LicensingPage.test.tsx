import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError, showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../services/admin.service', () => ({
  AdminService: {
    licenses: vi.fn(), listCompanies: vi.fn(), suspendLicense: vi.fn(),
    topupLicense: vi.fn(), licenseToken: vi.fn(), onboardEnterprise: vi.fn(), issueLicense: vi.fn(),
  },
}));

import { AdminService } from '../../services/admin.service';
import LicensingPage from './LicensingPage';

const license = {
  company_id: 'co-1', name: 'Acme Inc', remaining: 90, used: 10, minutes: 400,
  status: 'active', license_id: 'lic-1', expires_at: '2027-01-01', last_seen: '2026-06-01',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.licenses).mockResolvedValue({ data: { items: [license] } } as any);
  vi.mocked(AdminService.listCompanies).mockResolvedValue({ data: { items: [{ id: 'co-2', name: 'Other Co' }] } } as any);
  vi.mocked(AdminService.suspendLicense).mockResolvedValue({ data: {} } as any);
  vi.mocked(AdminService.topupLicense).mockResolvedValue({ data: {} } as any);
  vi.mocked(AdminService.licenseToken).mockResolvedValue({ data: { token: 'tok-123', expires_at: '2027-01-01' } } as any);
});

describe('LicensingPage', () => {
  test('renders the heading and a license row', async () => {
    render(<LicensingPage />);
    expect(screen.getByText('Licensing')).toBeInTheDocument();
    expect(await screen.findByText('Acme Inc')).toBeInTheDocument();
  });

  test('Issue license opens the issue dialog', async () => {
    render(<LicensingPage />);
    await screen.findByText('Acme Inc');
    await userEvent.click(screen.getByRole('button', { name: /issue license/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Company name')).toBeInTheDocument();
    expect(AdminService.listCompanies).toHaveBeenCalled();
  });

  test('Suspend on a row opens a confirm dialog and calls suspendLicense', async () => {
    render(<LicensingPage />);
    await screen.findByText('Acme Inc');
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Suspend license — Acme Inc/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));

    expect(AdminService.suspendLicense).toHaveBeenCalledWith('co-1');
    await vi.waitFor(() => expect(showSuccess).toHaveBeenCalledWith('License suspended.'));
  });

  test('View key fetches and shows the license token dialog', async () => {
    render(<LicensingPage />);
    await screen.findByText('Acme Inc');
    await userEvent.click(screen.getByRole('button', { name: /view key/i }));
    expect(AdminService.licenseToken).toHaveBeenCalledWith('co-1');
    expect(await screen.findByDisplayValue('tok-123')).toBeInTheDocument();
  });
});
