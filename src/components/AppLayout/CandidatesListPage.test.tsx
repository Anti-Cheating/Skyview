import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const list = vi.fn();
vi.mock('../../services/candidates.service', () => ({
  CandidatesService: { list: (...a: unknown[]) => list(...a) },
}));
vi.mock('../../contexts/SnackbarContext', () => ({ useSnackbar: () => ({ showError: vi.fn() }) }));

import CandidatesListPage from './CandidatesListPage';

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({
    success: true,
    data: { items: [{ id: 'c9', first_name: 'Priya', last_name: 'Sharma', email: 'priya@x.com', interviews_count: 2, rounds_count: 5, last_activity: '2026-07-01T00:00:00Z' }], total: 1 },
  });
});

describe('CandidatesListPage', () => {
  test('renders candidates with their counts', async () => {
    render(<CandidatesListPage />);
    expect(await screen.findByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByText('priya@x.com')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // interviews
    expect(screen.getByText('5')).toBeInTheDocument(); // rounds
  });

  test('clicking a candidate opens their detail page', async () => {
    render(<CandidatesListPage />);
    await userEvent.click(await screen.findByText('Priya Sharma'));
    expect(mockNavigate).toHaveBeenCalledWith('/candidates/c9');
  });

  test('typing in search re-queries', async () => {
    render(<CandidatesListPage />);
    await screen.findByText('Priya Sharma');
    await userEvent.type(screen.getByPlaceholderText('Search name or email'), 'pri');
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ search: 'pri' })));
  });
});
