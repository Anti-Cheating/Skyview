import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type DataTableColumn } from '../../../src/components/common/DataTable';

interface Row { id: string; name: string; role: string; }

const rows: Row[] = [
  { id: '1', name: 'Alice', role: 'SDE-1' },
  { id: '2', name: 'Bob', role: 'SDE-2' },
];

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', render: (r) => r.name },
  { key: 'role', header: 'Role', render: (r) => r.role },
];

const rowKey = (r: Row) => r.id;

describe('DataTable', () => {
  test('renders headers and row cells', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={rowKey} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('SDE-2')).toBeInTheDocument();
  });

  test('shows the empty state when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={rowKey} emptyText="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  test('renders a custom caption', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={rowKey} caption="Candidates" />);
    expect(screen.getByText('Candidates')).toBeInTheDocument();
  });

  test('onRowClick fires with the clicked row', async () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={rows} rowKey={rowKey} onRowClick={onRowClick} />);
    await userEvent.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
  });

  test('pagination shows the item range and advances on next', async () => {
    const onChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        pagination={{ page: 1, pageSize: 10, total: 25, onChange }}
      />,
    );
    expect(screen.getByText('1-10 of 25 items')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('ChevronRightIcon'));
    expect(onChange).toHaveBeenCalledWith(2, 10);
  });

  test('prev button is disabled on the first page', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        pagination={{ page: 1, pageSize: 10, total: 25, onChange: vi.fn() }}
      />,
    );
    expect(screen.getByTestId('ChevronLeftIcon').closest('button')).toBeDisabled();
  });
  test('onRowClick fires from anywhere in the row, but not from a control inside it', async () => {
    const onRowClick = vi.fn();
    const onAction = vi.fn();
    const withAction: DataTableColumn<Row>[] = [
      ...columns,
      { key: 'actions', header: 'Actions', render: () => <button onClick={onAction}>Delete</button> },
    ];
    render(<DataTable columns={withAction} rows={rows} rowKey={rowKey} onRowClick={onRowClick} />);

    // A plain cell — the whole row is the target.
    await userEvent.click(screen.getByText('SDE-2'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1], 1);

    // The action button belongs to itself, not the row.
    onRowClick.mockClear();
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(onAction).toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  test('a clickable row is reachable by keyboard', async () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={rows} rowKey={rowKey} onRowClick={onRowClick} />);
    const row = screen.getByText('Alice').closest('tr') as HTMLElement;
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
  });
});
