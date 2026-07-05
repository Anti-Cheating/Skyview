import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsentOutcome from './ConsentOutcome';

describe('ConsentOutcome', () => {
  test('renders title, message, and action', () => {
    render(
      <ConsentOutcome
        title="Monitoring stopped"
        message="You withdrew your consent."
        actionLabel="Re-enable monitoring"
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText('Monitoring stopped')).toBeInTheDocument();
    expect(screen.getByText('You withdrew your consent.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /re-enable monitoring/i })).toBeInTheDocument();
  });

  test('the action button fires onAction', async () => {
    const onAction = vi.fn();
    render(
      <ConsentOutcome title="t" message="m" actionLabel="Try again" onAction={onAction} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
