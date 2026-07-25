import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// helperBridge decides the platform + download URL(s) shown on the card.
let platform: 'mac' | 'windows' | 'unknown';
vi.mock('../../../src/services/helperBridge', () => ({
  detectHelperPlatform: () => platform,
  getHelperDownloadUrl: (p: string, arch?: string) =>
    arch
      ? `https://downloads.trueyy.com/helper-${p}?arch=${arch}`
      : `https://downloads.trueyy.com/helper-${p}`,
}));

import HelperDownloadCard from '../../../src/components/Monitoring/HelperDownloadCard';

beforeEach(() => {
  platform = 'mac';
});

describe('HelperDownloadCard', () => {
  test('macOS → a single Mac link (arm64 — the only published build)', () => {
    render(<HelperDownloadCard />);
    expect(screen.getByRole('heading', { name: 'Install Trueyy Helper' })).toBeInTheDocument();

    const mac = screen.getByRole('link', { name: /download for mac/i });
    expect(mac).toHaveAttribute('href', 'https://downloads.trueyy.com/helper-mac?arch=arm64');
    // Intel was dropped when the pipeline went arm64-only
    expect(screen.queryByRole('link', { name: /intel/i })).not.toBeInTheDocument();
  });

  test('Windows → a single Windows link (x64, no arch param)', () => {
    platform = 'windows';
    render(<HelperDownloadCard />);
    const dl = screen.getByRole('link', { name: /download for windows/i });
    expect(dl).toHaveAttribute('href', 'https://downloads.trueyy.com/helper-windows');
  });

  test('unknown OS → offers Windows + the single Mac build', () => {
    platform = 'unknown';
    render(<HelperDownloadCard />);
    expect(screen.getByRole('link', { name: /download for windows/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download for mac/i })).toHaveAttribute(
      'href', 'https://downloads.trueyy.com/helper-mac?arch=arm64');
    expect(screen.queryByRole('link', { name: /intel/i })).not.toBeInTheDocument();
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
