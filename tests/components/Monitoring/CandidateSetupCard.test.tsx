import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CandidateSetupCard from '../../../src/components/Monitoring/CandidateSetupCard';
import type { CandidateStatus } from '../../../src/hooks/useRiskSocket';

const allTrue: CandidateStatus = {
  extension_installed: true,
  screen_recording: true,
  mic_granted: true,
  keyboard_granted: true,
  joined: true,
  updated_at: '2026-07-05T00:00:00.000Z',
};

const noneStatus: CandidateStatus = {
  extension_installed: false,
  screen_recording: false,
  mic_granted: false,
  keyboard_granted: false,
  joined: false,
  updated_at: null,
};

describe('CandidateSetupCard', () => {
  test('null status → every check pending, 0/5, waiting headline', () => {
    render(<CandidateSetupCard status={null} />);
    expect(screen.getByText('Waiting for candidate setup')).toBeInTheDocument();
    expect(screen.getByText('0/5')).toBeInTheDocument();
    // The five row pills render their labels.
    expect(screen.getByText('Trueyy Helper')).toBeInTheDocument();
    expect(screen.getByText('Screen Monitor')).toBeInTheDocument();
    expect(screen.getByText('Microphone')).toBeInTheDocument();
    expect(screen.getByText('Keyboard')).toBeInTheDocument();
    expect(screen.getByText('Joined')).toBeInTheDocument();
  });

  test('all flags true → "Candidate ready" and 5/5', () => {
    render(<CandidateSetupCard status={allTrue} consent="given" />);
    expect(screen.getByText('Candidate ready')).toBeInTheDocument();
    expect(screen.getByText('5/5')).toBeInTheDocument();
  });

  test('partial status counts only the granted checks', () => {
    render(
      <CandidateSetupCard
        status={{ ...noneStatus, extension_installed: true, screen_recording: true }}
      />,
    );
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  test('consent pill: pending shows the neutral "Consent" label', () => {
    render(<CandidateSetupCard status={null} consent="pending" />);
    expect(screen.getByText('Consent')).toBeInTheDocument();
  });

  test('consent pill: declined shows the alert label', () => {
    render(<CandidateSetupCard status={null} consent="declined" />);
    expect(screen.getByText('Consent declined')).toBeInTheDocument();
  });

  test('consent pill: revoked shows the withdrawn label', () => {
    render(<CandidateSetupCard status={allTrue} consent="revoked" />);
    expect(screen.getByText('Consent withdrawn')).toBeInTheDocument();
  });

  test('revoked prop flips the headline to "Monitoring paused"', () => {
    render(<CandidateSetupCard status={allTrue} consent="given" revoked />);
    expect(screen.getByText('Monitoring paused')).toBeInTheDocument();
  });
});
