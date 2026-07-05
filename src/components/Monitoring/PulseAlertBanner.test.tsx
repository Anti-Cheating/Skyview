import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PulseAlertBanner from './PulseAlertBanner';
import type { PulseAlert } from '../../hooks/useRiskSocket';

const TS = '2026-07-05T00:00:00.000Z';

describe('PulseAlertBanner', () => {
  test('empty alerts → renders nothing', () => {
    const { container } = render(<PulseAlertBanner alerts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('alerts with no content → renders nothing', () => {
    const alerts: PulseAlert[] = [{ detections: [], activities: [], timestamp: TS }];
    const { container } = render(<PulseAlertBanner alerts={alerts} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders a category detection with its apps', () => {
    const alerts: PulseAlert[] = [
      {
        detections: [
          { categoryId: 'ai_tools', categoryLabel: 'AI Tools', apps: ['ChatGPT', 'Claude'], matchedKeywords: [] },
        ],
        activities: [],
        timestamp: TS,
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText('AI Tools')).toBeInTheDocument();
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  test('renders an activity with an occurrence count', () => {
    const alerts: PulseAlert[] = [
      { detections: [], activities: ['clipboard_paste'], timestamp: TS },
      { detections: [], activities: ['clipboard_paste'], timestamp: '2026-07-05T00:00:05.000Z' },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText('Paste Detected')).toBeInTheDocument();
    expect(screen.getByText('2×')).toBeInTheDocument();
  });

  test('renders keyboard alerts in the feed', () => {
    const alerts: PulseAlert[] = [
      {
        detections: [],
        activities: [],
        keyboardAlerts: [{ type: 'screenshot', label: 'Screenshot shortcut', riskLevel: 'HIGH' }],
        timestamp: TS,
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText('Screenshot shortcut')).toBeInTheDocument();
  });

  test('cheating platforms sort ahead of other detections', () => {
    const alerts: PulseAlert[] = [
      {
        detections: [
          { categoryId: 'search_engines', categoryLabel: 'Search', apps: ['Google'], matchedKeywords: [] },
          { categoryId: 'cheating_platforms', categoryLabel: 'Cheating', apps: ['Chegg'], matchedKeywords: [] },
        ],
        activities: [],
        timestamp: TS,
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    const labels = screen.getAllByText(/Search|Cheating/);
    expect(labels[0]).toHaveTextContent('Cheating');
  });

  test('cheating-first ordering holds with several non-cheating categories', () => {
    // Exercises all three arms of the sort comparator: a==cheating (-1),
    // b==cheating (1), and neither (0).
    const alerts: PulseAlert[] = [
      {
        detections: [
          { categoryId: 'messaging', categoryLabel: 'Messaging', apps: ['Slack'], matchedKeywords: [] },
          { categoryId: 'cheating_platforms', categoryLabel: 'Cheating', apps: ['Chegg'], matchedKeywords: [] },
          { categoryId: 'search_engines', categoryLabel: 'Search', apps: ['Google'], matchedKeywords: [] },
        ],
        activities: [],
        timestamp: TS,
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    const labels = screen.getAllByText(/Messaging|Cheating|Search/);
    expect(labels[0]).toHaveTextContent('Cheating');
  });

  test('a namespaced categoryId resolves its base config', () => {
    // "ai_tools::gpt" → base "ai_tools" via the "::" split in getConfig.
    const alerts: PulseAlert[] = [
      {
        detections: [
          { categoryId: 'ai_tools::gpt', categoryLabel: 'AI Sub', apps: ['ChatGPT'], matchedKeywords: [] },
        ],
        activities: [],
        timestamp: TS,
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText('AI Sub')).toBeInTheDocument();
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
  });

  test('same category across two pulses merges its apps (else branch)', () => {
    const alerts: PulseAlert[] = [
      {
        detections: [{ categoryId: 'ai_tools', categoryLabel: 'AI Tools', apps: ['ChatGPT'], matchedKeywords: [] }],
        activities: [],
        timestamp: TS,
      },
      {
        detections: [{ categoryId: 'ai_tools', categoryLabel: 'AI Tools', apps: ['Claude', 'ChatGPT'], matchedKeywords: [] }],
        activities: [],
        timestamp: '2026-07-05T00:00:05.000Z',
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    // Deduped union across both pulses.
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  test('duration labels cover seconds / minutes / hours branches', () => {
    const now = Date.now();
    const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
    const alerts: PulseAlert[] = [
      {
        detections: [{ categoryId: 'search_engines', categoryLabel: 'Search', apps: ['Recent'], matchedKeywords: [] }],
        activities: [],
        timestamp: iso(30 * 1000), // seconds
      },
      {
        detections: [{ categoryId: 'messaging', categoryLabel: 'Messaging', apps: ['MinsAgo'], matchedKeywords: [] }],
        activities: [],
        timestamp: iso(5 * 60 * 1000), // minutes
      },
      {
        detections: [{ categoryId: 'ai_tools', categoryLabel: 'AI Tools', apps: ['HoursAgo'], matchedKeywords: [] }],
        activities: [],
        timestamp: iso(2 * 60 * 60 * 1000), // hours
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('MinsAgo')).toBeInTheDocument();
    expect(screen.getByText('HoursAgo')).toBeInTheDocument();
  });

  test('an unknown activity falls back to a humanised label', () => {
    const alerts: PulseAlert[] = [
      { detections: [], activities: ['mystery_signal'], timestamp: TS },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText('Mystery Signal')).toBeInTheDocument();
  });

  test('keyboard feed maps varied event types + unknown risk to a fallback colour', () => {
    const alerts: PulseAlert[] = [
      {
        detections: [],
        activities: [],
        keyboardAlerts: [
          { type: 'app_switch_storm', label: 'App switch storm', riskLevel: 'MEDIUM' },
          { type: 'select_all_copy', label: 'Select all + copy', riskLevel: 'LOW' },
          { type: 'cut', label: 'Cut to clipboard', riskLevel: 'CRITICAL' },
          // Unknown type → default keyboard icon; unknown risk → fallback grey.
          { type: 'mystery_combo', label: 'Mystery combo', riskLevel: 'ZZZ' as unknown as 'LOW' },
        ],
        timestamp: TS,
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText('App switch storm')).toBeInTheDocument();
    expect(screen.getByText('Select all + copy')).toBeInTheDocument();
    expect(screen.getByText('Cut to clipboard')).toBeInTheDocument();
    expect(screen.getByText('Mystery combo')).toBeInTheDocument();
  });
});
