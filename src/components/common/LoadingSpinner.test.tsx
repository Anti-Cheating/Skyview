import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  test('renders the default loading message and a spinner', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders a custom message', () => {
    render(<LoadingSpinner message="Fetching sessions" />);
    expect(screen.getByText('Fetching sessions')).toBeInTheDocument();
  });

  test('omits the message text when message is empty', () => {
    render(<LoadingSpinner message="" />);
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders in fullScreen mode', () => {
    render(<LoadingSpinner fullScreen message="Please wait" />);
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });
});
