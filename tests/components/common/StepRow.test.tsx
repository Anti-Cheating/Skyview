import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StepRow from '../../../src/components/common/StepRow';

const icon = <span data-testid="step-icon" />;

describe('StepRow', () => {
  test('shows the step number when the step is active and not done', () => {
    render(<StepRow number={2} icon={icon} title="Grant permissions" done={false} active />);
    expect(screen.getByText('Grant permissions')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('replaces the number with a check when done', () => {
    render(<StepRow number={2} icon={icon} title="Install" done active={false} />);
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
  });

  test('renders child body content', () => {
    render(
      <StepRow number={1} icon={icon} title="Consent" done={false} active>
        <div>Please review the terms</div>
      </StepRow>,
    );
    expect(screen.getByText('Please review the terms')).toBeInTheDocument();
  });
});
