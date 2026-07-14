import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../../src/services/admin.service', () => ({
  AdminService: { queues: vi.fn(), webhooks: vi.fn() },
}));

import { AdminService } from '../../../src/services/admin.service';
import OpsPage from '../../../src/components/Admin/OpsPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.queues).mockResolvedValue({
    data: { queues: [{ name: 'analysis', waiting: 2, active: 1, completed: 40, failed: 3, delayed: 0 }] },
  } as any);
  vi.mocked(AdminService.webhooks).mockResolvedValue({
    data: {
      items: [
        { id: 'wh-1', company_id: 'c1', company_name: 'Acme Inc', event_type: 'interview.completed', status: 'delivered', http_status: 200, attempt_count: 1, error_message: null, created_at: '2026-03-01T10:00:00Z' },
      ],
      total: 1,
      failed_total: 3,
    },
  } as any);
});

describe('OpsPage', () => {
  test('renders the heading and a queue card', async () => {
    render(<OpsPage />);
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(await screen.findByText('analysis')).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  test('renders webhook deliveries with the failed count chip', async () => {
    render(<OpsPage />);
    expect(await screen.findByText('interview.completed')).toBeInTheDocument();
    expect(screen.getByText('3 failed')).toBeInTheDocument();
  });
});
