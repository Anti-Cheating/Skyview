import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusDot } from './StatusDot';

describe('StatusDot', () => {
  test('renders a pretty-cased label for a known status', () => {
    render(<StatusDot status="ACTIVE" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  test('renders each lifecycle status', () => {
    for (const [status, label] of [
      ['SCHEDULED', 'Scheduled'],
      ['COMPLETED', 'Completed'],
      ['CANCELLED', 'Cancelled'],
    ] as const) {
      const { unmount } = render(<StatusDot status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  test('falls back gracefully for an unknown status', () => {
    render(<StatusDot status="WEIRD" />);
    expect(screen.getByText('Weird')).toBeInTheDocument();
  });
});
