import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const showError = vi.fn();
const showSuccess = vi.fn();
vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError, showSuccess }),
}));

const listEndpoints = vi.fn();
const listDeliveries = vi.fn();
const createEndpoint = vi.fn();
const rotateSecret = vi.fn();
const updateEndpoint = vi.fn();
const revokeEndpoint = vi.fn();
const refireDelivery = vi.fn();
vi.mock('../../services/webhooks.service', () => ({
  WebhooksService: {
    listEndpoints: (...a: unknown[]) => listEndpoints(...a),
    listDeliveries: (...a: unknown[]) => listDeliveries(...a),
    createEndpoint: (...a: unknown[]) => createEndpoint(...a),
    rotateSecret: (...a: unknown[]) => rotateSecret(...a),
    updateEndpoint: (...a: unknown[]) => updateEndpoint(...a),
    revokeEndpoint: (...a: unknown[]) => revokeEndpoint(...a),
    refireDelivery: (...a: unknown[]) => refireDelivery(...a),
  },
}));

import WebhooksPage from './WebhooksPage';

const endpoint = {
  id: 'e1', label: 'ATS production', url: 'https://ats.example.com/hook',
  event_types: ['*'] as const, status: 'active' as const, last_delivery_at: null,
  consecutive_failures: 0, created_at: '2026-07-01T00:00:00Z',
};

const pausedEp = {
  id: 'e2', label: 'Paused hook', url: 'https://p.example.com',
  event_types: ['session.ready', 'session.ended'], status: 'paused' as const,
  last_delivery_at: '2026-07-01T10:00:00Z', consecutive_failures: 2, created_at: '2026-07-01T00:00:00Z',
};

const disabledEp = {
  id: 'e3', label: 'Dead hook', url: 'https://d.example.com',
  event_types: ['*'], status: 'disabled_by_failures' as const,
  last_delivery_at: null, consecutive_failures: 9, created_at: '2026-07-01T00:00:00Z',
};

const deliveries = [
  { id: 'd1', endpoint_id: 'e1', event_id: 'v1', event_type: 'session.ready', status: 'succeeded', http_status: 200, attempt_count: 1, created_at: '2026-07-01T00:00:00.000Z', delivered_at: '2026-07-01T00:00:00.400Z', next_retry_at: null, error_message: null },
  { id: 'd2', endpoint_id: 'e1', event_id: 'v2', event_type: 'session.ended', status: 'failed', http_status: 500, attempt_count: 3, created_at: '2026-07-01T00:00:00.000Z', delivered_at: '2026-07-01T00:00:02.000Z', next_retry_at: null, error_message: 'boom' },
  { id: 'd3', endpoint_id: 'e1', event_id: 'v3', event_type: 'session.risk_pulse', status: 'pending', http_status: null, attempt_count: 0, created_at: '2026-07-01T00:00:00Z', delivered_at: null, next_retry_at: null, error_message: null },
  { id: 'd4', endpoint_id: 'e1', event_id: 'v4', event_type: 'session.report_ready', status: 'dead_lettered', http_status: 502, attempt_count: 5, created_at: '2026-07-01T00:00:00Z', delivered_at: null, next_retry_at: null, error_message: 'gone' },
  { id: 'd5', endpoint_id: 'e1', event_id: 'v5', event_type: 'session.cancelled', status: 'queued' as any, http_status: null, attempt_count: 0, created_at: '2026-07-01T00:00:00Z', delivered_at: null, next_retry_at: null, error_message: null },
];

const writeText = vi.fn();

beforeEach(() => {
  showError.mockClear();
  showSuccess.mockClear();
  listEndpoints.mockReset().mockResolvedValue([endpoint]);
  listDeliveries.mockReset().mockResolvedValue([]);
  createEndpoint.mockReset().mockResolvedValue({
    id: 'e2', label: 'New hook', url: 'https://new.example.com',
    event_types: ['*'], status: 'active', last_delivery_at: null,
    consecutive_failures: 0, created_at: '2026-07-02T00:00:00Z',
    signing_secret: 'whsec_supersecret',
  });
  rotateSecret.mockReset().mockResolvedValue('whsec_rotated');
  updateEndpoint.mockReset().mockResolvedValue(undefined);
  revokeEndpoint.mockReset().mockResolvedValue(undefined);
  refireDelivery.mockReset().mockResolvedValue(undefined);
  writeText.mockReset();
  Object.assign(navigator, { clipboard: { writeText } });
});

async function openRowMenu(label: string) {
  const cell = screen.getByText(label).closest('tr')!;
  await userEvent.click(within(cell).getByLabelText('Row actions'));
}

describe('WebhooksPage', () => {
  test('renders endpoints + deliveries sections after fetch', async () => {
    render(<WebhooksPage />);
    expect(await screen.findByText('ATS production')).toBeInTheDocument();
    expect(screen.getByText('Endpoints')).toBeInTheDocument();
    expect(screen.getByText('Recent deliveries')).toBeInTheDocument();
  });

  test('renders varied endpoint + delivery states', async () => {
    listEndpoints.mockResolvedValue([endpoint, pausedEp, disabledEp]);
    listDeliveries.mockResolvedValue(deliveries);
    render(<WebhooksPage />);
    expect(await screen.findByText('Paused hook')).toBeInTheDocument();
    expect(screen.getByText('Dead hook')).toBeInTheDocument();
    // fmtEvents non-* branch
    expect(screen.getByText('session.ready, session.ended')).toBeInTheDocument();
    // failed / dead_lettered rows expose Re-fire
    expect(screen.getAllByRole('button', { name: 'Re-fire' })).toHaveLength(2);
  });

  test('add-endpoint dialog: open → fill → create → reveals signing secret', async () => {
    render(<WebhooksPage />);
    await screen.findByText('ATS production');

    await userEvent.click(screen.getByRole('button', { name: /add endpoint/i }));
    expect(await screen.findByText('Add webhook endpoint')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Label/), { target: { value: 'New hook' } });
    fireEvent.change(screen.getByLabelText(/HTTPS URL/), { target: { value: 'https://new.example.com' } });
    await userEvent.click(screen.getByRole('button', { name: /create endpoint/i }));

    await waitFor(() =>
      expect(createEndpoint).toHaveBeenCalledWith({
        label: 'New hook',
        url: 'https://new.example.com',
        event_types: ['*'],
      }),
    );
    expect(screen.getByDisplayValue('whsec_supersecret')).toBeInTheDocument();
    expect(showSuccess).toHaveBeenCalledWith('Endpoint "New hook" created');

    // Copy the revealed secret to the clipboard.
    await userEvent.click(screen.getByRole('button', { name: /^Copy$/ }));
    expect(writeText).toHaveBeenCalledWith('whsec_supersecret');
  });

  test('add-endpoint dialog can be cancelled', async () => {
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    await userEvent.click(screen.getByRole('button', { name: /add endpoint/i }));
    await screen.findByText('Add webhook endpoint');
    await userEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    await waitFor(() =>
      expect(screen.queryByText('Add webhook endpoint')).not.toBeInTheDocument(),
    );
  });

  test('create failure surfaces an error alert + snackbar', async () => {
    createEndpoint.mockRejectedValueOnce({ message: 'URL not reachable' });
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    await userEvent.click(screen.getByRole('button', { name: /add endpoint/i }));
    fireEvent.change(await screen.findByLabelText(/Label/), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText(/HTTPS URL/), { target: { value: 'https://x.com' } });
    await userEvent.click(screen.getByRole('button', { name: /create endpoint/i }));
    expect(await screen.findByText('URL not reachable')).toBeInTheDocument();
    expect(showError).toHaveBeenCalledWith('URL not reachable');
  });

  test('event-types selector toggles "All events" off then picks a specific event', async () => {
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    await userEvent.click(screen.getByRole('button', { name: /add endpoint/i }));
    await screen.findByText('Add webhook endpoint');

    await userEvent.click(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    // Toggle "All events" off (it starts selected).
    await userEvent.click(within(listbox).getByText('All events'));
    // Now pick a concrete event.
    await userEvent.click(within(listbox).getByText('session.ready'));
    await userEvent.keyboard('{Escape}');

    fireEvent.change(screen.getByLabelText(/Label/), { target: { value: 'Specific' } });
    fireEvent.change(screen.getByLabelText(/HTTPS URL/), { target: { value: 'https://s.com' } });
    await userEvent.click(screen.getByRole('button', { name: /create endpoint/i }));
    await waitFor(() =>
      expect(createEndpoint).toHaveBeenCalledWith(
        expect.objectContaining({ event_types: ['session.ready'] }),
      ),
    );
  });

  test('rotate secret via the row menu reveals a new secret', async () => {
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    await openRowMenu('ATS production');
    await userEvent.click(await screen.findByText('Rotate secret'));
    await waitFor(() => expect(rotateSecret).toHaveBeenCalledWith('e1'));
    expect(await screen.findByDisplayValue('whsec_rotated')).toBeInTheDocument();
  });

  test('rotate failure shows a snackbar error', async () => {
    rotateSecret.mockRejectedValueOnce({ message: 'rotate boom' });
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    await openRowMenu('ATS production');
    await userEvent.click(await screen.findByText('Rotate secret'));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('rotate boom'));
  });

  test('pause an active endpoint', async () => {
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    await openRowMenu('ATS production');
    await userEvent.click(await screen.findByText('Pause'));
    await waitFor(() => expect(updateEndpoint).toHaveBeenCalledWith('e1', { status: 'paused' }));
    expect(showSuccess).toHaveBeenCalledWith('"ATS production" paused');
  });

  test('resume a paused endpoint', async () => {
    listEndpoints.mockResolvedValue([pausedEp]);
    render(<WebhooksPage />);
    await screen.findByText('Paused hook');
    await openRowMenu('Paused hook');
    await userEvent.click(await screen.findByText('Resume'));
    await waitFor(() => expect(updateEndpoint).toHaveBeenCalledWith('e2', { status: 'active' }));
  });

  test('pause failure shows a snackbar error', async () => {
    updateEndpoint.mockRejectedValueOnce({ message: 'pause boom' });
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    await openRowMenu('ATS production');
    await userEvent.click(await screen.findByText('Pause'));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('pause boom'));
  });

  test('delete endpoint: menu → confirm dialog → revoke', async () => {
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    await openRowMenu('ATS production');
    await userEvent.click(await screen.findByText('Delete'));
    expect(await screen.findByText('Delete webhook endpoint')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    await waitFor(() => expect(revokeEndpoint).toHaveBeenCalledWith('e1'));
    expect(showSuccess).toHaveBeenCalledWith('"ATS production" deleted');
  });

  test('delete confirm dialog can be cancelled', async () => {
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    await openRowMenu('ATS production');
    await userEvent.click(await screen.findByText('Delete'));
    await screen.findByText('Delete webhook endpoint');
    await userEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    await waitFor(() =>
      expect(screen.queryByText('Delete webhook endpoint')).not.toBeInTheDocument(),
    );
    expect(revokeEndpoint).not.toHaveBeenCalled();
  });

  test('delete failure shows a snackbar error', async () => {
    revokeEndpoint.mockRejectedValueOnce({ message: 'delete boom' });
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    await openRowMenu('ATS production');
    await userEvent.click(await screen.findByText('Delete'));
    await userEvent.click(await screen.findByRole('button', { name: /^Delete$/ }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('delete boom'));
  });

  test('re-fire a failed delivery', async () => {
    listDeliveries.mockResolvedValue(deliveries);
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    const buttons = await screen.findAllByRole('button', { name: 'Re-fire' });
    await userEvent.click(buttons[0]);
    await waitFor(() => expect(refireDelivery).toHaveBeenCalledWith('d2'));
    expect(showSuccess).toHaveBeenCalledWith('Re-fired delivery');
  });

  test('re-fire failure shows a snackbar error', async () => {
    listDeliveries.mockResolvedValue(deliveries);
    refireDelivery.mockRejectedValueOnce({ message: 'refire boom' });
    render(<WebhooksPage />);
    await screen.findByText('ATS production');
    const buttons = await screen.findAllByRole('button', { name: 'Re-fire' });
    await userEvent.click(buttons[0]);
    await waitFor(() => expect(showError).toHaveBeenCalledWith('refire boom'));
  });

  test('endpoint load failure shows an error banner', async () => {
    listEndpoints.mockRejectedValueOnce({ message: 'endpoints down' });
    render(<WebhooksPage />);
    expect(await screen.findByText('endpoints down')).toBeInTheDocument();
  });

  test('delivery load failure shows an error banner', async () => {
    listDeliveries.mockRejectedValueOnce({ message: 'deliveries down' });
    render(<WebhooksPage />);
    expect(await screen.findByText('deliveries down')).toBeInTheDocument();
  });
});
