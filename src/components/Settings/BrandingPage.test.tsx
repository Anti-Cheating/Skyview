import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const h = vi.hoisted(() => ({
  company: { id: 'c1', name: 'Acme', logo_url: null as string | null },
  updateCompany: vi.fn(),
  refreshCompany: vi.fn().mockResolvedValue(undefined),
  uploadLogo: vi.fn(),
  deleteLogo: vi.fn(),
}));

vi.mock('../../contexts/CompanyContext', () => ({
  useCompany: () => ({
    company: h.company,
    updateCompany: h.updateCompany,
    refreshCompany: h.refreshCompany,
  }),
}));

vi.mock('../../services/companies.service', () => ({
  CompaniesService: {
    uploadLogo: (...a: unknown[]) => h.uploadLogo(...a),
    deleteLogo: (...a: unknown[]) => h.deleteLogo(...a),
  },
}));

import BrandingPage from './BrandingPage';

function fileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

beforeEach(() => {
  h.company = { id: 'c1', name: 'Acme', logo_url: null };
  h.updateCompany.mockClear();
  h.refreshCompany.mockClear().mockResolvedValue(undefined);
  h.uploadLogo.mockReset();
  h.deleteLogo.mockReset();
  // jsdom lacks object-URL helpers.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

describe('BrandingPage', () => {
  test('renders the logo + brand color cards', () => {
    render(<BrandingPage />);
    expect(screen.getByText('Branding')).toBeInTheDocument();
    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('Brand color')).toBeInTheDocument();
    expect(screen.getByText('No logo')).toBeInTheDocument();
  });

  test('shows a persisted logo thumbnail + Remove when the company has a logo', () => {
    h.company = { id: 'c1', name: 'Acme', logo_url: 'https://cdn/logo.png' };
    render(<BrandingPage />);
    expect(screen.getByAltText('Brand logo preview')).toHaveAttribute('src', 'https://cdn/logo.png');
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  test('saving a valid brand color surfaces a success message', async () => {
    render(<BrandingPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Brand color saved.')).toBeInTheDocument();
  });

  test('an invalid hex is rejected before saving', async () => {
    render(<BrandingPage />);
    const input = screen.getByLabelText('Color (hex)');
    await userEvent.clear(input);
    await userEvent.type(input, 'zzz');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a valid hex color (e.g. #3B82F6).')).toBeInTheDocument();
  });

  test('rejects a non-image file', async () => {
    const { container } = render(<BrandingPage />);
    const file = new File(['hi'], 'notes.txt', { type: 'text/plain' });
    await userEvent.upload(fileInput(container), file, { applyAccept: false });
    expect(await screen.findByText(/Logo must be an image file/)).toBeInTheDocument();
    // Only the always-present colour Save exists — the logo Save appears only
    // once a valid file is staged, which a rejected non-image never does.
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1);
  });

  test('rejects an image larger than 2MB', async () => {
    const { container } = render(<BrandingPage />);
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    await userEvent.upload(fileInput(container), big, { applyAccept: false });
    expect(await screen.findByText(/Logo must be 2MB or smaller/)).toBeInTheDocument();
  });

  test('uploading a valid logo → Save persists it', async () => {
    h.uploadLogo.mockResolvedValue({ success: true, data: { id: 'c1', name: 'Acme', logo_url: 'https://cdn/new.png' } });
    const { container } = render(<BrandingPage />);
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    await userEvent.upload(fileInput(container), file);

    const save = (await screen.findAllByRole('button', { name: 'Save' }))[0];
    await userEvent.click(save);

    expect(await screen.findByText('Logo updated.')).toBeInTheDocument();
    expect(h.uploadLogo).toHaveBeenCalledWith('c1', file);
    expect(h.updateCompany).toHaveBeenCalledWith({ id: 'c1', name: 'Acme', logo_url: 'https://cdn/new.png' });
  });

  test('upload responding without success shows the returned message', async () => {
    h.uploadLogo.mockResolvedValue({ success: false, message: 'unsupported format' });
    const { container } = render(<BrandingPage />);
    await userEvent.upload(fileInput(container), new File(['x'], 'logo.png', { type: 'image/png' }));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Save' }))[0]);
    expect(await screen.findByText('unsupported format')).toBeInTheDocument();
  });

  test('upload responding false without a message falls back', async () => {
    h.uploadLogo.mockResolvedValue({ success: false });
    const { container } = render(<BrandingPage />);
    await userEvent.upload(fileInput(container), new File(['x'], 'logo.png', { type: 'image/png' }));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Save' }))[0]);
    expect(await screen.findByText('Logo upload failed.')).toBeInTheDocument();
  });

  test('upload throwing surfaces the server error detail', async () => {
    h.uploadLogo.mockRejectedValue({ data: { error: 'R2 down' } });
    const { container } = render(<BrandingPage />);
    await userEvent.upload(fileInput(container), new File(['x'], 'logo.png', { type: 'image/png' }));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Save' }))[0]);
    expect(await screen.findByText('R2 down')).toBeInTheDocument();
  });

  test('removing a persisted logo calls deleteLogo', async () => {
    h.company = { id: 'c1', name: 'Acme', logo_url: 'https://cdn/logo.png' };
    h.deleteLogo.mockResolvedValue({ success: true, data: { id: 'c1', name: 'Acme', logo_url: null } });
    render(<BrandingPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Logo removed.')).toBeInTheDocument();
    expect(h.updateCompany).toHaveBeenCalled();
  });

  test('remove failure shows an error', async () => {
    h.company = { id: 'c1', name: 'Acme', logo_url: 'https://cdn/logo.png' };
    h.deleteLogo.mockResolvedValue({ success: false, message: 'nope' });
    render(<BrandingPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('nope')).toBeInTheDocument();
  });

  test('remove throwing falls back to the default error', async () => {
    h.company = { id: 'c1', name: 'Acme', logo_url: 'https://cdn/logo.png' };
    h.deleteLogo.mockRejectedValue({});
    render(<BrandingPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Failed to remove logo.')).toBeInTheDocument();
  });
});
