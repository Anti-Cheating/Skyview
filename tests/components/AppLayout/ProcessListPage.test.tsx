import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const list = vi.fn();
vi.mock('../../../src/services/process.service', () => ({
  ProcessService: { list: (...a: unknown[]) => list(...a) },
}));

const showError = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError }),
}));

import ProcessListPage from '../../../src/components/AppLayout/ProcessListPage';

function listResponse() {
  return {
    success: true,
    data: {
      items: [
        {
          id: 'p1',
          role: 'SDE-1',
          candidate: { first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' },
          rounds_total: 3,
          rounds_done: 1,
          status: 'IN_PROGRESS',
          updated_at: '2026-06-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue(listResponse());
});

describe('ProcessListPage', () => {
  test('renders the heading and a process row from the list service', async () => {
    render(<ProcessListPage />);
    expect(screen.getByText('Interviews')).toBeInTheDocument();
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@x.com')).toBeInTheDocument();
    expect(screen.getByText('SDE-1')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  test('New interview button navigates to the create page', async () => {
    render(<ProcessListPage />);
    await screen.findByText('Jane Doe');
    await userEvent.click(screen.getByRole('button', { name: /new interview/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/new');
  });

  test('clicking a candidate navigates to the process detail page', async () => {
    render(<ProcessListPage />);
    await userEvent.click(await screen.findByText('Jane Doe'));
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/p1');
  });

  test('typing in search triggers a debounced refetch', async () => {
    render(<ProcessListPage />);
    await screen.findByText('Jane Doe');
    list.mockClear();
    await userEvent.type(screen.getByPlaceholderText(/search candidate/i), 'jane');
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ search: 'jane' })), { timeout: 2000 }
    );
  });
});
