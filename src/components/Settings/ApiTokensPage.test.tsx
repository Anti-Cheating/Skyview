import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const list = vi.fn();
const create = vi.fn();
const revoke = vi.fn();
vi.mock('../../services/apiTokens.service', () => ({
  ApiTokensService: {
    list: (...a: unknown[]) => list(...a),
    create: (...a: unknown[]) => create(...a),
    revoke: (...a: unknown[]) => revoke(...a),
  },
}));

import ApiTokensPage from './ApiTokensPage';

const token = {
  id: 't1', prefix: 'sk_live_abc', label: 'Prod backend', environment: 'live' as const,
  last_used_at: null, created_at: '2026-07-01T00:00:00Z', expires_at: null,
};

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  list.mockResolvedValue([token]);
  create.mockResolvedValue({
    id: 't2', prefix: 'sk_live_xyz', label: 'CI', environment: 'live',
    last_used_at: null, created_at: '2026-07-02T00:00:00Z', expires_at: null,
    plaintext: 'sk_live_secret_value',
  });
  revoke.mockResolvedValue(undefined);
  writeText.mockClear().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiTokensPage', () => {
  test('renders the token rows after fetch', async () => {
    render(<ApiTokensPage />);
    expect(await screen.findByText('Prod backend')).toBeInTheDocument();
  });

  test('generate-token dialog: open → fill → submit → reveals plaintext once', async () => {
    render(<ApiTokensPage />);
    await screen.findByText('Prod backend');

    await userEvent.click(screen.getByRole('button', { name: /generate token/i }));
    expect(await screen.findByText('Generate API token')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Label/), 'CI');
    await userEvent.click(screen.getByRole('button', { name: /^Generate$/ }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ label: 'CI', environment: 'live' }),
    );
    expect(await screen.findByText('Token created — copy it now')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sk_live_secret_value')).toBeInTheDocument();
  });

  test('list rejection surfaces an error alert', async () => {
    list.mockRejectedValueOnce({ message: 'boom' });
    render(<ApiTokensPage />);
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  test('list rejection without a message falls back to default', async () => {
    list.mockRejectedValueOnce({});
    render(<ApiTokensPage />);
    expect(await screen.findByText('Failed to load tokens')).toBeInTheDocument();
  });

  test('renders empty state when no tokens', async () => {
    list.mockResolvedValueOnce([]);
    render(<ApiTokensPage />);
    expect(await screen.findByText('No tokens yet. Generate your first one.')).toBeInTheDocument();
  });

  test('create failure shows an error inside the dialog', async () => {
    create.mockRejectedValueOnce({ message: 'quota exceeded' });
    render(<ApiTokensPage />);
    await screen.findByText('Prod backend');

    await userEvent.click(screen.getByRole('button', { name: /generate token/i }));
    fireEvent.change(await screen.findByLabelText(/Label/), { target: { value: 'CI' } });
    // switch environment to exercise the select onChange
    fireEvent.change(screen.getByLabelText(/Environment/), { target: { value: 'test' } });
    await userEvent.click(screen.getByRole('button', { name: /^Generate$/ }));

    expect(await screen.findByText('quota exceeded')).toBeInTheDocument();
    await waitFor(() => expect(create).toHaveBeenCalledWith({ label: 'CI', environment: 'test' }));
  });

  test('create failure without message falls back to default text', async () => {
    create.mockRejectedValueOnce({});
    render(<ApiTokensPage />);
    await screen.findByText('Prod backend');
    await userEvent.click(screen.getByRole('button', { name: /generate token/i }));
    fireEvent.change(await screen.findByLabelText(/Label/), { target: { value: 'CI' } });
    await userEvent.click(screen.getByRole('button', { name: /^Generate$/ }));
    expect(await screen.findByText('Failed to generate token')).toBeInTheDocument();
  });

  test('generate dialog can be cancelled', async () => {
    render(<ApiTokensPage />);
    await screen.findByText('Prod backend');
    await userEvent.click(screen.getByRole('button', { name: /generate token/i }));
    await screen.findByText('Generate API token');
    await userEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    await waitFor(() =>
      expect(screen.queryByText('Generate API token')).not.toBeInTheDocument(),
    );
  });

  test('revoke: confirm true removes the row', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ApiTokensPage />);
    await screen.findByText('Prod backend');
    await userEvent.click(screen.getByLabelText('Revoke Prod backend'));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('t1'));
    await waitFor(() =>
      expect(screen.queryByText('Prod backend')).not.toBeInTheDocument(),
    );
  });

  test('revoke: confirm false does nothing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ApiTokensPage />);
    await screen.findByText('Prod backend');
    await userEvent.click(screen.getByLabelText('Revoke Prod backend'));
    expect(revoke).not.toHaveBeenCalled();
    expect(screen.getByText('Prod backend')).toBeInTheDocument();
  });

  test('revoke failure surfaces an error alert', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    revoke.mockRejectedValueOnce({ message: 'still in use' });
    render(<ApiTokensPage />);
    await screen.findByText('Prod backend');
    await userEvent.click(screen.getByLabelText('Revoke Prod backend'));
    expect(await screen.findByText('still in use')).toBeInTheDocument();
  });

  test('copy button writes plaintext to clipboard and confirms', async () => {
    render(<ApiTokensPage />);
    await screen.findByText('Prod backend');
    await userEvent.click(screen.getByRole('button', { name: /generate token/i }));
    fireEvent.change(await screen.findByLabelText(/Label/), { target: { value: 'CI' } });
    await userEvent.click(screen.getByRole('button', { name: /^Generate$/ }));
    await screen.findByText('Token created — copy it now');

    await userEvent.click(screen.getByRole('button', { name: /^Copy$/ }));
    expect(writeText).toHaveBeenCalledWith('sk_live_secret_value');
    expect(await screen.findByText('Copied to clipboard.')).toBeInTheDocument();
  });

  test('copy tolerates a rejecting clipboard without confirming', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    render(<ApiTokensPage />);
    await screen.findByText('Prod backend');
    await userEvent.click(screen.getByRole('button', { name: /generate token/i }));
    fireEvent.change(await screen.findByLabelText(/Label/), { target: { value: 'CI' } });
    await userEvent.click(screen.getByRole('button', { name: /^Generate$/ }));
    await screen.findByText('Token created — copy it now');

    await userEvent.click(screen.getByRole('button', { name: /^Copy$/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.queryByText('Copied to clipboard.')).not.toBeInTheDocument();
  });

  test('reveal dialog closes on "I\'ve saved it"', async () => {
    render(<ApiTokensPage />);
    await screen.findByText('Prod backend');
    await userEvent.click(screen.getByRole('button', { name: /generate token/i }));
    fireEvent.change(await screen.findByLabelText(/Label/), { target: { value: 'CI' } });
    await userEvent.click(screen.getByRole('button', { name: /^Generate$/ }));
    await screen.findByText('Token created — copy it now');
    await userEvent.click(screen.getByRole('button', { name: /saved it/i }));
    await waitFor(() =>
      expect(screen.queryByText('Token created — copy it now')).not.toBeInTheDocument(),
    );
  });

  test('error alert can be dismissed via its close button', async () => {
    list.mockRejectedValueOnce({ message: 'boom' });
    render(<ApiTokensPage />);
    await screen.findByText('boom');
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByText('boom')).not.toBeInTheDocument());
  });
});
