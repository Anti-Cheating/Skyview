import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const showError = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError, showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn(), showSnackbar: vi.fn() }),
}));

import AuditLogView from '../../../src/components/Audit/AuditLogView';
import type { AuditListItem, AuditListQuery } from '../../../src/services/audit.service';

const rows: AuditListItem[] = [
  {
    id: 'a1', action: 'auth.login', actor_id: 'u1', actor_name: 'Alice', actor_role: 'Owner',
    entity_type: 'user', entity_id: 'abcdef123456', details: { ok: true }, company_id: 'c1',
    company_name: 'Demo Corp', created_at: '2026-07-05T10:00:00.000Z',
  },
  {
    id: 'a2', action: 'session.activate', actor_id: 'u2', actor_name: 'Bob', actor_role: 'Admin',
    entity_type: 'session', entity_id: 'sess-9', details: null, company_id: 'c1',
    company_name: 'Demo Corp', created_at: '2026-07-05T11:00:00.000Z',
  },
];

const baseProps = {
  title: 'Audit log',
  subtitle: 'Everything your team did',
  onOpen: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuditLogView', () => {
  test('renders the title and fetched rows', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: rows, total: 2 });
    render(<AuditLogView {...baseProps} fetchPage={fetchPage} />);

    expect(screen.getByText('Audit log')).toBeInTheDocument();
    expect(await screen.findByText('auth.login')).toBeInTheDocument();
    expect(screen.getByText('session.activate')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  test('initial fetch uses default paging', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: rows, total: 2 });
    render(<AuditLogView {...baseProps} fetchPage={fetchPage} />);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledWith({ limit: 10, offset: 0 }));
  });

  test('typing in search refetches with a debounced search term', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: rows, total: 2 });
    render(<AuditLogView {...baseProps} fetchPage={fetchPage} />);
    await screen.findByText('auth.login');

    await userEvent.type(screen.getByPlaceholderText(/search action, entity, or user/i), 'login');
    await waitFor(() =>
      expect(fetchPage).toHaveBeenCalledWith(expect.objectContaining({ search: 'login' })),
    );
  });

  test('selecting an action filter refetches with that action', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: rows, total: 2 });
    render(<AuditLogView {...baseProps} fetchPage={fetchPage} />);
    await screen.findByText('auth.login');

    // getAllByRole('combobox')[0] is the action filter; [1] is the
    // DataTable's page-size selector.
    await userEvent.click(screen.getAllByRole('combobox')[0]);
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(within(listbox).getByRole('option', { name: 'auth.signup' }));

    await waitFor(() =>
      expect(fetchPage).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.signup' })),
    );
  });

  test('row click invokes onOpen with the row', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: rows, total: 2 });
    const onOpen = vi.fn();
    render(<AuditLogView {...baseProps} onOpen={onOpen} fetchPage={fetchPage} />);

    await userEvent.click(await screen.findByText('auth.login'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  test('surfaces an error toast when fetch rejects', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error('boom'));
    render(<AuditLogView {...baseProps} fetchPage={fetchPage} />);
    await waitFor(() => expect(showError).toHaveBeenCalledWith('boom'));
  });

  test('customerActions hides the super-admin-only options', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [], total: 0 });
    render(<AuditLogView {...baseProps} fetchPage={fetchPage} customerActions />);

    await userEvent.click(screen.getAllByRole('combobox')[0]);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: 'license.issue' })).not.toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'auth.login' })).toBeInTheDocument();
  });
});

const _typecheck: AuditListQuery = { limit: 10 };
void _typecheck;
