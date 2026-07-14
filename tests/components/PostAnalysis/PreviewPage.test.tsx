import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

import { PreviewPage } from '../../../src/components/PostAnalysis/PreviewPage';

describe('PreviewPage', () => {
  test('renders the scenario cards and header', () => {
    render(<PreviewPage />);
    expect(screen.getByText(/Post-Analysis Preview/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clean Interview ✓' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Critical Issues' })).toBeInTheDocument();
  });

  test('scenario cards link to the mock analysis routes', () => {
    render(<PreviewPage />);
    const link = screen.getByText('Clean Interview ✓').closest('a');
    expect(link).toHaveAttribute('href', '/interview/demo-session/analysis?mock=clean');
  });
});
