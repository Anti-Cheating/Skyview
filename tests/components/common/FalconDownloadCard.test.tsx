import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FalconDownloadCard from '../../../src/components/common/FalconDownloadCard';

afterEach(() => vi.restoreAllMocks());

describe('FalconDownloadCard', () => {
  test('renders the download prompt copy', () => {
    render(<FalconDownloadCard />);
    expect(screen.getByText('Download Trueyy App')).toBeInTheDocument();
    expect(screen.getByText(/Download and install the Trueyy desktop app/)).toBeInTheDocument();
  });

  test('the button opens the Trueyy download site in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<FalconDownloadCard />);
    await userEvent.click(screen.getByRole('button', { name: /download app/i }));
    expect(open).toHaveBeenCalledWith('https://www.trueyy.com/', '_blank', 'noopener');
  });
});
