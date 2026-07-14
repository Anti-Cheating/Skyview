import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../../src/services/admin.service', () => ({
  AdminService: { contactQueries: vi.fn() },
}));

import { AdminService } from '../../../src/services/admin.service';
import ContactQueriesPage from '../../../src/components/Admin/ContactQueriesPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.contactQueries).mockResolvedValue({
    data: {
      items: [
        { id: 'q-1', name: 'Jane Roe', email: 'jane@corp.com', company: 'Corp', type: 'sales', message: 'Interested in a demo', created_at: '2026-02-01T10:00:00Z' },
      ],
      total: 1,
    },
  } as any);
});

describe('ContactQueriesPage', () => {
  test('renders the heading and an inbound query row', async () => {
    render(<ContactQueriesPage />);
    expect(screen.getByText('Contact queries')).toBeInTheDocument();
    expect(await screen.findByText('Jane Roe')).toBeInTheDocument();
    expect(screen.getByText('jane@corp.com')).toBeInTheDocument();
    expect(screen.getByText('Interested in a demo')).toBeInTheDocument();
  });

  test('shows the empty state when there are no queries', async () => {
    vi.mocked(AdminService.contactQueries).mockResolvedValue({ data: { items: [], total: 0 } } as any);
    render(<ContactQueriesPage />);
    expect(await screen.findByText('No contact queries.')).toBeInTheDocument();
  });
});
