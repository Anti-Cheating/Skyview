import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const showSuccess = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError: vi.fn(), showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

import LicenseKeyDialog from '../../../src/components/Admin/LicenseKeyDialog';

const writeText = vi.fn().mockResolvedValue(undefined);

const baseProps = {
  open: true,
  companyName: 'Demo Corp',
  token: 'eyJ-fake-license-token',
  expiresAt: '2027-01-01T00:00:00Z',
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });
});

describe('LicenseKeyDialog', () => {
  test('shows the company name in the title and the token value', () => {
    render(<LicenseKeyDialog {...baseProps} />);
    expect(screen.getByText(/License key — Demo Corp/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('eyJ-fake-license-token')).toBeInTheDocument();
  });

  test('renders the .env setup block including the token', () => {
    render(<LicenseKeyDialog {...baseProps} />);
    expect(screen.getByDisplayValue(/TRUEYY_LICENSE=eyJ-fake-license-token/)).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    render(<LicenseKeyDialog {...baseProps} open={false} />);
    expect(screen.queryByText(/License key/)).not.toBeInTheDocument();
  });

  test('"Copy setup" copies the env block and toasts success', async () => {
    render(<LicenseKeyDialog {...baseProps} />);
    await userEvent.click(screen.getByRole('button', { name: /copy setup/i }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('TRUEYY_LICENSE=eyJ-fake-license-token'));
    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith('Setup copied'));
  });

  test('Close fires onClose', async () => {
    const onClose = vi.fn();
    render(<LicenseKeyDialog {...baseProps} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
