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
  test('macOS → Apple Silicon + Intel links with the matching arch URLs, and the "which Mac?" hint', () => {
    render(<HelperDownloadCard />);
    expect(screen.getByRole('heading', { name: 'Install Trueyy Helper' })).toBeInTheDocument();

    const silicon = screen.getByRole('link', { name: /apple silicon/i });
    expect(silicon).toHaveAttribute('href', 'https://downloads.trueyy.com/helper-mac?arch=arm64');
    const intel = screen.getByRole('link', { name: /intel/i });
    expect(intel).toHaveAttribute('href', 'https://downloads.trueyy.com/helper-mac?arch=x86_64');
  });

  test('Windows → a single Windows link (x64, no arch param)', () => {
    platform = 'windows';
    render(<HelperDownloadCard />);
    const dl = screen.getByRole('link', { name: /download for windows/i });
    expect(dl).toHaveAttribute('href', 'https://downloads.trueyy.com/helper-windows');
  });

  test('unknown OS → offers Windows + both Mac arches', () => {
    platform = 'unknown';
    render(<HelperDownloadCard />);
    expect(screen.getByRole('link', { name: /download for windows/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /apple silicon/i })).toHaveAttribute(
      'href', 'https://downloads.trueyy.com/helper-mac?arch=arm64');
    expect(screen.getByRole('link', { name: /intel/i })).toHaveAttribute(
      'href', 'https://downloads.trueyy.com/helper-mac?arch=x86_64');
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
