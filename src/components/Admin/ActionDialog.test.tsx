import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionDialog from './ActionDialog';

const baseProps = {
  open: true,
  title: 'Suspend company',
  onClose: vi.fn(),
  onConfirm: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('ActionDialog', () => {
  test('renders the title and optional message', () => {
    render(<ActionDialog {...baseProps} message="Are you sure?" />);
    expect(screen.getByText('Suspend company')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    render(<ActionDialog {...baseProps} open={false} />);
    expect(screen.queryByText('Suspend company')).not.toBeInTheDocument();
  });

  test('confirm fires onConfirm; a plain confirm passes an empty value', async () => {
    const onConfirm = vi.fn();
    render(<ActionDialog {...baseProps} confirmLabel="Suspend" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  test('cancel fires onClose', async () => {
    const onClose = vi.fn();
    render(<ActionDialog {...baseProps} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('with an input, typed text is passed to onConfirm', async () => {
    const onConfirm = vi.fn();
    render(
      <ActionDialog
        {...baseProps}
        title="Adjust quota"
        input={{ label: 'Interviews to add', type: 'number' }}
        confirmLabel="Adjust"
        onConfirm={onConfirm}
      />
    );
    await userEvent.type(screen.getByLabelText('Interviews to add'), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    expect(onConfirm).toHaveBeenCalledWith('50');
  });

  test('busy disables the cancel button', () => {
    render(<ActionDialog {...baseProps} busy />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
