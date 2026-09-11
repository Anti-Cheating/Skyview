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
    expect(screen.getAllByText('AI Tools')[0]).toBeInTheDocument();
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getAllByText('Open')).toHaveLength(2);
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
    expect(screen.getByText('Open')).toBeInTheDocument();
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
    expect(screen.getAllByText('Open')).toHaveLength(2);
  });

  test('duration labels cover seconds / minutes / hours branches on close events', () => {
    const base = new Date('2026-07-05T00:00:00.000Z').getTime();
    const alerts: PulseAlert[] = [
      {
        detections: [{ categoryId: 'search_engines', categoryLabel: 'Search', apps: ['Recent'], matchedKeywords: [] }],
        activities: [],
        timestamp: new Date(base).toISOString(),
      },
      {
        detections: [],
        activities: ['app_closed:Recent'],
        timestamp: new Date(base + 30 * 1000).toISOString(), // 30s
      },
      {
        detections: [{ categoryId: 'messaging', categoryLabel: 'Messaging', apps: ['MinsAgo'], matchedKeywords: [] }],
        activities: [],
        timestamp: new Date(base).toISOString(),
      },
      {
        detections: [],
        activities: ['app_closed:MinsAgo'],
        timestamp: new Date(base + 5 * 60 * 1000).toISOString(), // 5 min
      },
      {
        detections: [{ categoryId: 'ai_tools', categoryLabel: 'AI Tools', apps: ['HoursAgo'], matchedKeywords: [] }],
        activities: [],
        timestamp: new Date(base).toISOString(),
      },
      {
        detections: [],
        activities: ['app_closed:HoursAgo'],
        timestamp: new Date(base + (2 * 60 + 15) * 60 * 1000).toISOString(), // 2h 15m
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getAllByText('Recent')).toHaveLength(2);
    expect(screen.getByText(/open 30s/)).toBeInTheDocument();
    expect(screen.getAllByText('MinsAgo')).toHaveLength(2);
    expect(screen.getByText(/open 5 min/)).toBeInTheDocument();
    expect(screen.getAllByText('HoursAgo')).toHaveLength(2);
    expect(screen.getByText(/open 2h 15m/)).toBeInTheDocument();
    expect(screen.getAllByText('Open')).toHaveLength(3);
    expect(screen.getAllByText('Close')).toHaveLength(3);
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
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

    // Each cycle's close row reports its own duration (2 min and 3 min), not time from first open to last close (13 min)
    expect(screen.getByText(/open 2 min/)).toBeInTheDocument();
    expect(screen.getByText(/open 3 min/)).toBeInTheDocument();
    expect(screen.queryByText(/13 min/)).not.toBeInTheDocument();
  });

  test('a still-open app emits an open event row and no close row', () => {
    const alerts: PulseAlert[] = [
      { detections: [detection(['Cursor'])], activities: [], timestamp: '2026-07-19T10:00:00.000Z' },
      // No close event — last known event is 4 minutes later.
      { detections: [detection(['Cursor'])], activities: [], timestamp: '2026-07-19T10:04:00.000Z' },
    ];

    render(<PulseAlertBanner alerts={alerts} />);

    expect(screen.getByText('Cursor')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText('Close')).not.toBeInTheDocument();
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

    expect(screen.getByText(/open 3 min/)).toBeInTheDocument();
    expect(screen.queryByText(/50 min/)).not.toBeInTheDocument();
    expect(screen.getByText('Cursor')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
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
    expect(screen.getByText(/Chat one/)).toBeInTheDocument();
    expect(screen.getByText(/Claude chat/)).toBeInTheDocument();
  });

  test('no appInfos on the payload falls back to bare app names without window title', () => {
    const alerts: PulseAlert[] = [
      {
        detections: [{ categoryId: 'ai_tools', categoryLabel: 'AI Tools', apps: ['ChatGPT'], matchedKeywords: [] }],
        activities: [],
        timestamp: TS,
      },
    ];
    render(<PulseAlertBanner alerts={alerts} />);
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
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

  describe('individual cards & chronological ordering', () => {
    test('renders separate individual cards for apps instead of a shared category block', () => {
      const alerts: PulseAlert[] = [
        {
          detections: [
            {
              categoryId: 'ai_tools',
              categoryLabel: 'AI Tools',
              apps: ['Claude', 'Cursor'],
              appInfos: [
                { app_name: 'Claude', window_title: 'Claude', is_excluded: false },
                { app_name: 'Cursor', window_title: 'CandidateJoinPage.tsx', is_excluded: false },
              ],
              matchedKeywords: ['claude', 'cursor'],
            },
          ],
          activities: [],
          timestamp: TS,
        },
      ];
      render(<PulseAlertBanner alerts={alerts} />);
      const appCards = screen.getAllByTestId('pulse-event-card');
      expect(appCards).toHaveLength(2);
      expect(appCards[0]).toHaveTextContent('Claude');
      expect(appCards[1]).toHaveTextContent('Cursor');
    });

    test('interleaves app open events from different categories chronologically', () => {
      const alerts: PulseAlert[] = [
        {
          detections: [
            { categoryId: 'general_usage', categoryLabel: 'General Usage', apps: ['Terminal'], matchedKeywords: [] },
          ],
          activities: [],
          timestamp: '2026-07-05T10:00:00.000Z',
        },
        {
          detections: [
            { categoryId: 'ai_tools', categoryLabel: 'AI Tools', apps: ['Cursor'], matchedKeywords: [] },
          ],
          activities: [],
          timestamp: '2026-07-05T10:00:05.000Z',
        },
        {
          detections: [
            { categoryId: 'virtual_machines', categoryLabel: 'VMs', apps: ['Docker Desktop'], matchedKeywords: [] },
          ],
          activities: [],
          timestamp: '2026-07-05T10:00:10.000Z',
        },
      ];
      render(<PulseAlertBanner alerts={alerts} />);
      const cards = screen.getAllByTestId('pulse-event-card');
      expect(cards).toHaveLength(3);
      expect(cards[0]).toHaveTextContent('Terminal');
      expect(cards[1]).toHaveTextContent('Cursor');
      expect(cards[2]).toHaveTextContent('Docker Desktop');
    });

    test('timestamps render time only without date', () => {
      const alerts: PulseAlert[] = [
        {
          detections: [
            { categoryId: 'general_usage', categoryLabel: 'General Usage', apps: ['Terminal'], matchedKeywords: [] },
          ],
          activities: [],
          timestamp: '2026-07-05T14:32:45.000Z',
        },
      ];
      const { container } = render(<PulseAlertBanner alerts={alerts} />);
      // Should not contain date information like year "2026" or month "Jul"
      expect(container.textContent).not.toMatch(/2026/);
      expect(container.textContent).not.toMatch(/Jul/);
      // Should contain time (AM/PM)
      expect(container.textContent).toMatch(/\d+:\d+:\d+/);
    });

    test('remediates historical general_usage detection to cheating_platforms if app has is_excluded=true in a mixed set', () => {
      const alerts: PulseAlert[] = [
        {
          detections: [
            {
              categoryId: 'general_usage',
              categoryLabel: 'General Usage',
              apps: ['Terminal', 'Spotify', 'Aside'],
              appInfos: [
                { app_name: 'Terminal', window_title: 'zsh', is_excluded: false },
                { app_name: 'Spotify', window_title: 'Spotify Free', is_excluded: false },
                { app_name: 'Aside', window_title: 'Aside', is_excluded: true },
              ],
              matchedKeywords: ['Terminal', 'Spotify', 'Aside'],
            },
          ],
          activities: [],
          timestamp: TS,
        },
      ];
      render(<PulseAlertBanner alerts={alerts} />);
      const cards = screen.getAllByTestId('pulse-event-card');
      expect(cards).toHaveLength(3);

      // Aside should have category label "Cheating Platform Detected", not "General Usage"
      const asideCard = cards.find((c) => c.textContent?.includes('Aside'));
      expect(asideCard).toBeDefined();
      expect(asideCard).toHaveTextContent('Cheating Platform Detected');

      // Terminal should remain General Usage
      const terminalCard = cards.find((c) => c.textContent?.includes('Terminal'));
      expect(terminalCard).toBeDefined();
      expect(terminalCard).toHaveTextContent('General Usage');
    });

    test('does not escalate when all apps are is_excluded=true (permission missing)', () => {
      const alerts: PulseAlert[] = [
        {
          detections: [
            {
              categoryId: 'general_usage',
              categoryLabel: 'General Usage',
              apps: ['Terminal', 'Spotify', 'Aside'],
              appInfos: [
                { app_name: 'Terminal', window_title: 'zsh', is_excluded: true },
                { app_name: 'Spotify', window_title: 'Spotify Free', is_excluded: true },
                { app_name: 'Aside', window_title: 'Aside', is_excluded: true },
              ],
              matchedKeywords: ['Terminal', 'Spotify', 'Aside'],
            },
          ],
          activities: [],
          timestamp: TS,
        },
      ];
      render(<PulseAlertBanner alerts={alerts} />);
      expect(screen.queryByText('Cheating Platform Detected')).not.toBeInTheDocument();
      expect(screen.getAllByText('General Usage').length).toBeGreaterThan(0);
    });

    test('interleaves app events and keyboard alerts in pure chronological order regardless of modality', () => {
      const alerts: PulseAlert[] = [
        {
          detections: [
            { categoryId: 'ai_tools', categoryLabel: 'AI Tools', apps: ['Cursor'], matchedKeywords: [] },
          ],
          activities: [],
          timestamp: '2026-07-05T10:00:00.000Z',
        },
        {
          detections: [],
          activities: [],
          keyboardAlerts: [
            {
              type: 'app_switch_storm',
              label: 'Rapid app switching (12×): Cursor → Google Chrome → Cursor → Google Chrome',
              riskLevel: 'MEDIUM',
            },
          ],
          timestamp: '2026-07-05T10:16:31.000Z',
        },
        {
          detections: [
            { categoryId: 'cheating_platforms', categoryLabel: 'Cheating Platform Detected', apps: ['Aside'], matchedKeywords: [] },
          ],
          activities: ['app_closed:aside'],
          timestamp: '2026-07-05T10:35:18.000Z',
        },
      ];

      const { container } = render(<PulseAlertBanner alerts={alerts} />);
      const text = container.textContent || '';

      // 10:16:31 alert must appear before 10:35:18 app close in the DOM
      const lower = text.toLowerCase();
      const switchIndex = lower.indexOf('rapid app switching');
      const closeIndex = lower.indexOf('close');
      const asideIndex = lower.indexOf('aside');

      expect(switchIndex).toBeGreaterThan(-1);
      expect(closeIndex).toBeGreaterThan(-1);
      expect(asideIndex).toBeGreaterThan(-1);
      expect(switchIndex).toBeLessThan(closeIndex);
      expect(switchIndex).toBeLessThan(asideIndex);
    });

    test('summarizes rapid app switching arrow chain into condensed between/across format', () => {
      const alerts: PulseAlert[] = [
        {
          detections: [],
          activities: [],
          keyboardAlerts: [
            {
              type: 'app_switch_storm',
              label: 'Rapid app switching (12×): Cursor → Google Chrome → Cursor → Google Chrome → Cursor → Google Chrome',
              riskLevel: 'MEDIUM',
            },
          ],
          timestamp: '2026-07-05T10:16:31.000Z',
        },
      ];

      render(<PulseAlertBanner alerts={alerts} />);
      expect(screen.getByText('Rapid app switching (12×): between Cursor and Google Chrome')).toBeInTheDocument();
      expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    });
  });
});
