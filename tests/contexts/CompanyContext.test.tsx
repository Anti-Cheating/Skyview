import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let mockUser: { company_id?: string | null } | null = null;
vi.mock('../../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

const getById = vi.fn();
vi.mock('../../src/services/companies.service', () => ({
  CompaniesService: { getById: (...a: unknown[]) => getById(...a) },
}));

import { CompanyProvider, useCompany } from '../../src/contexts/CompanyContext';

function Consumer() {
  const { company, isLoading, updateCompany } = useCompany();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="name">{company?.name ?? 'none'}</span>
      <button onClick={() => updateCompany({ id: 'c1', name: 'Renamed' } as never)}>rename</button>
    </div>
  );
}

function renderCompany() {
  return render(
    <CompanyProvider>
      <Consumer />
    </CompanyProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = null;
});

describe('CompanyContext', () => {
  test('candidate / no company_id → company stays null, no fetch', async () => {
    mockUser = { company_id: null };
    renderCompany();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('name')).toHaveTextContent('none');
    expect(getById).not.toHaveBeenCalled();
  });

  test('fetches the company when company_id is present', async () => {
    mockUser = { company_id: 'c1' };
    getById.mockResolvedValue({ success: true, data: { id: 'c1', name: 'Acme' } });
    renderCompany();
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Acme'));
    expect(getById).toHaveBeenCalledWith('c1');
  });

  test('a failed fetch is non-fatal — company stays null, loading resolves', async () => {
    mockUser = { company_id: 'c1' };
    getById.mockRejectedValue(new Error('boom'));
    renderCompany();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('name')).toHaveTextContent('none');
  });

  test('updateCompany merges a new row without refetching', async () => {
    mockUser = { company_id: 'c1' };
    getById.mockResolvedValue({ success: true, data: { id: 'c1', name: 'Acme' } });
    renderCompany();
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Acme'));
    await userEvent.click(screen.getByText('rename'));
    expect(screen.getByTestId('name')).toHaveTextContent('Renamed');
    expect(getById).toHaveBeenCalledTimes(1);
  });

  test('useCompany throws outside a CompanyProvider', () => {
    function Lone() {
      useCompany();
      return null;
    }
    expect(() => render(<Lone />)).toThrow(/must be used within a CompanyProvider/);
  });
});
