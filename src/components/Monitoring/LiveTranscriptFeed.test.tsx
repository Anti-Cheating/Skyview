import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LiveTranscriptFeed from './LiveTranscriptFeed';
import type { TranscriptFragment } from '../../hooks/useRiskSocket';

const frag = (over: Partial<TranscriptFragment>): TranscriptFragment => ({
  text: 'hello',
  is_final: true,
  timestamp: '2026-07-05T00:00:00.000Z',
  ...over,
});

describe('LiveTranscriptFeed', () => {
  test('empty → "Waiting for speech" placeholder', () => {
    render(<LiveTranscriptFeed fragments={[]} />);
    expect(screen.getByText('Live Transcript')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for speech/i)).toBeInTheDocument();
  });

  test('renders fragments with speaker labels', () => {
    render(
      <LiveTranscriptFeed
        fragments={[
          frag({ text: 'Tell me about yourself', speaker_role: 'interviewer' }),
          frag({ text: 'Sure, I am a developer', speaker_role: 'candidate' }),
        ]}
      />,
    );
    expect(screen.getByText('Tell me about yourself')).toBeInTheDocument();
    expect(screen.getByText('Sure, I am a developer')).toBeInTheDocument();
    expect(screen.getByText('Interviewer')).toBeInTheDocument();
    expect(screen.getByText('Candidate')).toBeInTheDocument();
  });

  test('final-count chip pluralises utterances', () => {
    render(
      <LiveTranscriptFeed
        fragments={[frag({ text: 'a' }), frag({ text: 'b', timestamp: '2026-07-05T00:00:01.000Z' })]}
      />,
    );
    expect(screen.getByText('2 utterances')).toBeInTheDocument();
  });

  test('missing speaker_role falls back to Candidate', () => {
    render(<LiveTranscriptFeed fragments={[frag({ text: 'anon line' })]} />);
    expect(screen.getByText('Candidate')).toBeInTheDocument();
  });

  test('clicking the header collapses the transcript body', async () => {
    render(<LiveTranscriptFeed fragments={[frag({ text: 'collapse me' })]} />);
    expect(screen.getByText('collapse me')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Live Transcript'));
    expect(screen.queryByText('collapse me')).not.toBeInTheDocument();
  });

  test('interim-only fragment shows the listening chip + pulse dot (dimmed line)', () => {
    // No final fragments → chip reads "listening...", the last fragment is
    // interim so hasInterim is true (renders the animated pulse dot), and the
    // line renders at reduced opacity (is_final ? 1 : 0.4 → 0.4 branch).
    render(
      <LiveTranscriptFeed
        fragments={[frag({ text: 'partial words', is_final: false, speaker_role: 'candidate' })]}
      />,
    );
    expect(screen.getByText('listening...')).toBeInTheDocument();
    expect(screen.getByText('partial words')).toBeInTheDocument();
  });
});
