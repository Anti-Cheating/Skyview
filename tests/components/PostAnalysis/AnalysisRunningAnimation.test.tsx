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

  test('renders the animation container, green radar badge, and active status', () => {
    render(<AnalysisRunningAnimation />);
    expect(screen.getByTestId('analysis-running-animation')).toBeInTheDocument();
    expect(screen.getByText(/AI PIPELINE ACTIVE/i)).toBeInTheDocument();
    expect(screen.getByText(/Analyzing Interview/i)).toBeInTheDocument();
  });

  test('renders stage-wise pills and advances stage periodically', () => {
    render(<AnalysisRunningAnimation />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByText('Checking')).toBeInTheDocument();
    expect(screen.getByText('Transcribing')).toBeInTheDocument();
    expect(screen.getByText('Preparing')).toBeInTheDocument();
    expect(screen.getByText('Synthesizing')).toBeInTheDocument();

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
