import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import JoinStepper from './JoinStepper';

describe('JoinStepper', () => {
  test('renders all four step labels', () => {
    render(<JoinStepper current="consent" />);
    for (const label of ['Consent', 'Install', 'Permissions', 'Join']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  test('shows numeric badges for the active + upcoming steps', () => {
    render(<JoinStepper current="consent" />);
    // On step 1: none are complete, so 1/2/3/4 all show as numbers.
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  test('completed steps render a check instead of their number', () => {
    // On "permissions" (step 3), steps 1 and 2 are complete → their number
    // is replaced by a check icon, so "1" and "2" are no longer rendered.
    render(<JoinStepper current="permissions" />);
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    // Step 3 is active (still a number), step 4 upcoming.
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  test('on the last step, only step 4 keeps its number', () => {
    render(<JoinStepper current="join" />);
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
