import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionButton } from '../../../src/components/common/ActionButton';

describe('ActionButton', () => {
  test('renders its children as a button', () => {
    render(<ActionButton>Save</ActionButton>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  test('fires onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<ActionButton onClick={onClick}>Go</ActionButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('loading shows a spinner and disables the button', () => {
    render(<ActionButton loading>Saving</ActionButton>);
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('does not fire onClick while disabled', async () => {
    const onClick = vi.fn();
    render(<ActionButton disabled onClick={onClick}>Nope</ActionButton>);
    const btn = screen.getByRole('button', { name: 'Nope' });
    expect(btn).toBeDisabled();
    // Bypass user-event's pointer-events guard to prove the click is a no-op.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('renders the secondary variant', () => {
    render(<ActionButton variant="secondary">Cancel</ActionButton>);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
