import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PulseAlertBanner from '../../../src/components/Monitoring/PulseAlertBanner';
import type { PulseAlert } from '../../../src/hooks/useRiskSocket';

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

function detection(apps: string[]): PulseAlert['detections'][number] {
  return {
    categoryId: 'ai_tools',
    categoryLabel: 'AI Tools',
    apps,
    matchedKeywords: [],
  };
}

describe('PulseAlertBanner — duration accumulation', () => {
  test('accumulates total open time across multiple open/close cycles, not time-since-first-seen', () => {
    const alerts: PulseAlert[] = [
      // Cycle 1: open at :00, closed at :02 (2 min = 120000ms)
      { detections: [detection(['Cursor'])], activities: [], timestamp: '2026-07-19T10:00:00.000Z' },
      { detections: [], activities: ['app_closed:cursor'], timestamp: '2026-07-19T10:02:00.000Z' },
      // Cycle 2: open at :10, closed at :13 (3 min = 180000ms)
      { detections: [detection(['Cursor'])], activities: [], timestamp: '2026-07-19T10:10:00.000Z' },
      { detections: [], activities: ['app_closed:cursor'], timestamp: '2026-07-19T10:13:00.000Z' },
    ];

    render(<PulseAlertBanner alerts={alerts} />);

    // Total accumulated = 2 min + 3 min = 5 min, not 13 min (time from first open to last close)
    expect(screen.getByText(/5 min/)).toBeInTheDocument();
    expect(screen.queryByText(/13 min/)).not.toBeInTheDocument();
  });

  test('a still-open app accumulates up to the last event timestamp, not Date.now() (correct for post-interview replay)', () => {
    const alerts: PulseAlert[] = [
      { detections: [detection(['Cursor'])], activities: [], timestamp: '2026-07-19T10:00:00.000Z' },
      // No close event — last known event is 4 minutes later.
      { detections: [detection(['Cursor'])], activities: [], timestamp: '2026-07-19T10:04:00.000Z' },
    ];

    render(<PulseAlertBanner alerts={alerts} />);

    expect(screen.getByText(/4 min/)).toBeInTheDocument();
  });

  test('accumulates correctly even when app_closed casing differs from the open detection\'s app name', () => {
    const alerts: PulseAlert[] = [
      { detections: [detection(['cursor'])], activities: [], timestamp: '2026-07-19T10:00:00.000Z' },
      { detections: [], activities: ['app_closed:Cursor'], timestamp: '2026-07-19T10:03:00.000Z' },
      // A later, unrelated event. If the close-path lookup missed (casing
      // bug), the app never actually closes internally and its cycle keeps
      // accruing all the way to this last timestamp (50 min) instead of
      // stopping at the intended close (3 min).
      { detections: [], activities: ['clipboard_paste'], timestamp: '2026-07-19T10:50:00.000Z' },
    ];

    render(<PulseAlertBanner alerts={alerts} />);

    expect(screen.getByText(/3 min/)).toBeInTheDocument();
    expect(screen.queryByText(/50 min/)).not.toBeInTheDocument();
    expect(screen.getByText(/CLOSED/)).toBeInTheDocument();
  });
});

describe('PulseAlertBanner — appInfos', () => {
  test('renders window_title from appInfos alongside the app name', () => {
    const alerts: PulseAlert[] = [
      {
        detections: [
          {
            categoryId: 'ai_tools',
            categoryLabel: 'AI Tools',
            apps: ['ChatGPT'],
            appInfos: [{ app_name: 'ChatGPT', window_title: 'New chat - ChatGPT', is_excluded: false }],
            matchedKeywords: [],
          },
        ],
        activities: [],
        timestamp: TS,
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText(/New chat - ChatGPT/)).toBeInTheDocument();
  });

  test('merges appInfos across pulses for the same category, deduped by app_name', () => {
    const alerts: PulseAlert[] = [
      {
        detections: [
          {
            categoryId: 'ai_tools',
            categoryLabel: 'AI Tools',
            apps: ['ChatGPT'],
            appInfos: [{ app_name: 'ChatGPT', window_title: 'Chat one', is_excluded: false }],
            matchedKeywords: [],
          },
        ],
        activities: [],
        timestamp: TS,
      },
      {
        detections: [
          {
            categoryId: 'ai_tools',
            categoryLabel: 'AI Tools',
            apps: ['Claude', 'ChatGPT'],
            appInfos: [
              { app_name: 'Claude', window_title: 'Claude chat', is_excluded: false },
              { app_name: 'ChatGPT', window_title: 'Chat one (updated)', is_excluded: false },
            ],
            matchedKeywords: [],
          },
        ],
        activities: [],
        timestamp: '2026-07-05T00:00:05.000Z',
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    // First-seen appInfo entry wins on dedup — not overwritten by the later pulse.
    expect(screen.getByText(/Chat one$/)).toBeInTheDocument();
    expect(screen.getByText(/Claude chat/)).toBeInTheDocument();
  });

  test('no appInfos on the payload falls back to bare app names with "No title"', () => {
    const alerts: PulseAlert[] = [
      {
        detections: [{ categoryId: 'ai_tools', categoryLabel: 'AI Tools', apps: ['ChatGPT'], matchedKeywords: [] }],
        activities: [],
        timestamp: TS,
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
    expect(screen.getByText(/No title/)).toBeInTheDocument();
  });

  test('is_excluded is present in the data but never rendered in the DOM', () => {
    const alerts: PulseAlert[] = [
      {
        detections: [
          {
            categoryId: 'ai_tools',
            categoryLabel: 'AI Tools',
            apps: ['ChatGPT'],
            appInfos: [{ app_name: 'ChatGPT', window_title: 'Hidden window', is_excluded: true }],
            matchedKeywords: [],
          },
        ],
        activities: [],
        timestamp: TS,
      },
    ];
    const { container } = render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText(/Hidden window/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/excluded/i);
  });
});
