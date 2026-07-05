import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// jsdom has no IntersectionObserver — the infinite-scroll sentinel needs it.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// Stub the heavy Monitoring feed components — ActivityExplorer only wires
// data into them; their internals are exercised elsewhere.
vi.mock('../Monitoring/PulseAlertBanner', () => ({ default: () => <div /> }));
vi.mock('../Monitoring/AnalyticsPanel', () => ({
  WindowCard: () => <div />,
  TranscriptFeed: () => <div />,
  ImageAnalysisCard: () => <div />,
  ScreenshotLightbox: () => <div />,
}));

const get = vi.fn();
vi.mock('../../services/api.service', () => ({
  ApiService: { get: (...a: unknown[]) => get(...a) },
}));

import ActivityExplorer from './ActivityExplorer';

beforeEach(() => {
  get.mockResolvedValue({ data: { results: [], total: 0 } });
});

describe('ActivityExplorer', () => {
  test('renders the four monitoring tabs', () => {
    render(<ActivityExplorer sessionId="s1" participantId="pt1" />);
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('Risk Timeline')).toBeInTheDocument();
    expect(screen.getByText('Image Analysis')).toBeInTheDocument();
    expect(screen.getByText('Transcript')).toBeInTheDocument();
  });

  test('shows an empty state for the default feed and switches tabs', async () => {
    render(<ActivityExplorer sessionId="s1" participantId="pt1" />);
    expect(await screen.findByText('No alerts recorded for this interview.')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Risk Timeline'));
    expect(await screen.findByText('No risk windows recorded for this interview.')).toBeInTheDocument();
  });
});
