import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../../src/components/common/ErrorBoundary';

function Bomb(): null {
  throw new Error('kaboom');
}

// React logs caught render errors to console.error — silence for clean output.
let spy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  spy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => spy.mockRestore());

describe('ErrorBoundary', () => {
  test('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  test('renders the default fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  test('renders a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
