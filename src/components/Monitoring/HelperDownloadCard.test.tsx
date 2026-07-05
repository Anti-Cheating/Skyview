import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// helperBridge decides the platform + download URL shown on the card.
let platform: 'mac' | 'windows' | 'unknown';
vi.mock('../../services/helperBridge', () => ({
  detectHelperPlatform: () => platform,
  getHelperDownloadUrl: (p: string) => `https://downloads.trueyy.com/helper-${p}`,
}));

import HelperDownloadCard from './HelperDownloadCard';

beforeEach(() => {
  platform = 'mac';
});

describe('HelperDownloadCard', () => {
  test('renders the install heading + macOS download link', () => {
    render(<HelperDownloadCard />);
    expect(screen.getByRole('heading', { name: 'Install Trueyy Helper' })).toBeInTheDocument();
    const dl = screen.getByRole('link', { name: /download for macos/i });
    expect(dl).toHaveAttribute('href', 'https://downloads.trueyy.com/helper-mac');
  });

  test('Windows platform → Windows download label', () => {
    platform = 'windows';
    render(<HelperDownloadCard />);
    expect(screen.getByRole('link', { name: /download for windows/i })).toBeInTheDocument();
  });

  test('unknown platform → generic installer label', () => {
    platform = 'unknown';
    render(<HelperDownloadCard />);
    expect(screen.getByRole('link', { name: /download installer/i })).toBeInTheDocument();
  });

  test('checking shows the "already installed" spinner text', () => {
    render(<HelperDownloadCard checking />);
    expect(screen.getByText(/Checking if Trueyy Helper is already installed/i)).toBeInTheDocument();
  });

  test('onRetry renders the retry button and fires on click', async () => {
    const onRetry = vi.fn();
    render(<HelperDownloadCard onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /retry detection/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test('no onRetry → no retry button', () => {
    render(<HelperDownloadCard />);
    expect(screen.queryByRole('button', { name: /retry detection/i })).not.toBeInTheDocument();
  });
});
