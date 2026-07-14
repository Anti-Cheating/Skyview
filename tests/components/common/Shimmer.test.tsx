import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  ShimmerBlock,
  StatCardShimmer,
  WelcomeBannerShimmer,
  DashboardShimmer,
  InterviewCardShimmer,
  InterviewListShimmer,
} from '../../../src/components/common/Shimmer';

// Shimmer components are purely presentational skeletons with no text or
// roles — a smoke render that mounts a non-empty DOM node is the
// meaningful assertion.
describe('Shimmer skeletons', () => {
  test('ShimmerBlock renders', () => {
    const { container } = render(<ShimmerBlock />);
    expect(container.firstChild).not.toBeNull();
  });

  test('StatCardShimmer renders', () => {
    const { container } = render(<StatCardShimmer />);
    expect(container.firstChild).not.toBeNull();
  });

  test('WelcomeBannerShimmer renders', () => {
    const { container } = render(<WelcomeBannerShimmer />);
    expect(container.firstChild).not.toBeNull();
  });

  test('DashboardShimmer renders', () => {
    const { container } = render(<DashboardShimmer />);
    expect(container.firstChild).not.toBeNull();
  });

  test('InterviewCardShimmer renders', () => {
    const { container } = render(<InterviewCardShimmer />);
    expect(container.firstChild).not.toBeNull();
  });

  test('InterviewListShimmer renders the requested number of cards', () => {
    const { container } = render(<InterviewListShimmer count={4} />);
    // The grid wrapper holds `count` card children.
    expect(container.firstChild?.childNodes).toHaveLength(4);
  });
});
