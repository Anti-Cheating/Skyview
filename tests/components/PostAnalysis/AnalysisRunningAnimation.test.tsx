import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import AnalysisRunningAnimation from '../../../src/components/PostAnalysis/AnalysisRunningAnimation';

describe('AnalysisRunningAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders the animation container, radar badge, and active status', () => {
    render(<AnalysisRunningAnimation />);
    expect(screen.getByTestId('analysis-running-animation')).toBeInTheDocument();
    expect(screen.getByText(/AI PIPELINE ACTIVE/i)).toBeInTheDocument();
    expect(screen.getByText(/Analyzing Interview/i)).toBeInTheDocument();
  });

  test('renders pipeline analysis stages and advances stage periodically', () => {
    render(<AnalysisRunningAnimation />);
    expect(screen.getByText(/Transcribing/i)).toBeInTheDocument();
    expect(screen.getByText(/telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/keyboard events/i)).toBeInTheDocument();
    expect(screen.getByText(/integrity verdict/i)).toBeInTheDocument();

    // First step is in progress
    const activeStepsBefore = screen.getAllByTestId('stage-in-progress');
    expect(activeStepsBefore.length).toBeGreaterThan(0);

    // Fast-forward timer by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // A step has now completed
    const completedSteps = screen.getAllByTestId('stage-completed');
    expect(completedSteps.length).toBeGreaterThan(0);
  });
});
