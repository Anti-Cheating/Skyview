import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError }),
}));

const updateCompany = vi.fn();
const refreshCompany = vi.fn().mockResolvedValue(undefined);
vi.mock('../../contexts/CompanyContext', () => ({
  useCompany: () => ({ updateCompany, refreshCompany }),
}));

const getById = vi.fn();
const update = vi.fn();
vi.mock('../../services/companies.service', () => ({
  CompaniesService: {
    getById: (...a: unknown[]) => getById(...a),
    update: (...a: unknown[]) => update(...a),
    uploadLogo: vi.fn(),
    deleteLogo: vi.fn(),
  },
}));

import CompanyTab from './CompanyTab';

const company = {
  id: 'co-1',
  name: 'Acme',
  website: 'https://acme.com',
  description: 'We build',
  location: 'Bangalore',
  logo_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getById.mockResolvedValue({ success: true, data: company });
});

describe('CompanyTab', () => {
  test('loads and hydrates the company form', async () => {
    render(<CompanyTab companyId="co-1" />);
    expect(await screen.findByLabelText(/company name/i)).toHaveValue('Acme');
    expect(getById).toHaveBeenCalledWith('co-1');
    // The loaded row is pushed into the CompanyContext.
    expect(updateCompany).toHaveBeenCalledWith(company);
  });

  test('Save is disabled until a field changes', async () => {
    render(<CompanyTab companyId="co-1" />);
    const save = await screen.findByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/company name/i), '!');
    expect(save).toBeEnabled();
  });

  test('saving edits calls update with trimmed fields', async () => {
    update.mockResolvedValue({ success: true, data: { ...company, name: 'Acme Inc' } });
    render(<CompanyTab companyId="co-1" />);

    const name = await screen.findByLabelText(/company name/i);
    await userEvent.clear(name);
    await userEvent.type(name, 'Acme Inc');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('co-1', {
        name: 'Acme Inc',
        website: 'https://acme.com',
        description: 'We build',
        location: 'Bangalore',
      }),
    );
    expect(showSuccess).toHaveBeenCalledWith('Company details updated');
  });

  test('shows an error when the company fails to load', async () => {
    getById.mockResolvedValue({ success: false, message: 'not found' });
    render(<CompanyTab companyId="co-1" />);
    expect(await screen.findByText('not found')).toBeInTheDocument();
  });
});
