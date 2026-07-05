import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusTag } from './StatusTag';

describe('StatusTag', () => {
  test('renders a pretty-cased label for a known status', () => {
    render(<StatusTag status="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  test('renders each lifecycle status', () => {
    for (const [status, label] of [
      ['SCHEDULED', 'Scheduled'],
      ['ACTIVE', 'Active'],
      ['CANCELLED', 'Cancelled'],
    ] as const) {
      const { unmount } = render(<StatusTag status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  test('falls back gracefully for an unknown status', () => {
    render(<StatusTag status="PENDING" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});
