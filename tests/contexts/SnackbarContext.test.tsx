import { describe, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SnackbarProvider, useSnackbar } from '../../src/contexts/SnackbarContext';

function Consumer() {
  const { showError, showSuccess, showInfo } = useSnackbar();
  return (
    <>
      <button onClick={() => showError('Something broke')}>err</button>
      <button onClick={() => showSuccess('Saved!')}>ok</button>
      <button onClick={() => showInfo('Heads up')}>info</button>
    </>
  );
}

function renderConsumer() {
  return render(
    <SnackbarProvider>
      <Consumer />
    </SnackbarProvider>,
  );
}

describe('SnackbarContext', () => {
  test('nothing is shown until a snackbar helper is called', () => {
    renderConsumer();
    expect(screen.queryByText('Something broke')).not.toBeInTheDocument();
  });

  test('showError surfaces the message', async () => {
    renderConsumer();
    await userEvent.click(screen.getByText('err'));
    expect(await screen.findByText('Something broke')).toBeInTheDocument();
  });

  test('showSuccess surfaces its own message', async () => {
    renderConsumer();
    await userEvent.click(screen.getByText('ok'));
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });

  test('closing via the alert action dismisses the snackbar', async () => {
    renderConsumer();
    await userEvent.click(screen.getByText('info'));
    expect(await screen.findByText('Heads up')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByText('Heads up')).not.toBeInTheDocument());
  });

  test('useSnackbar throws when used outside the provider', () => {
    function Lone() {
      useSnackbar();
      return null;
    }
    expect(() => render(<Lone />)).toThrow(/must be used within a SnackbarProvider/);
  });
});
