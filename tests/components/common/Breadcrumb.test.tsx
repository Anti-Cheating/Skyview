import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: any) => <a href={to}>{children}</a>,
}));

import { Breadcrumb } from '../../../src/components/common/Breadcrumb';

const items = [
  { label: 'Dashboard', to: '/' },
  { label: 'Interviews', to: '/interviews' },
  { label: 'Round 2' },
];

describe('Breadcrumb', () => {
  test('renders every crumb label', () => {
    render(<Breadcrumb items={items} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Interviews')).toBeInTheDocument();
    expect(screen.getByText('Round 2')).toBeInTheDocument();
  });

  test('parent crumbs are links, the last crumb is plain text', () => {
    render(<Breadcrumb items={items} />);
    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/');
    expect(screen.getByText('Interviews').closest('a')).toHaveAttribute('href', '/interviews');
    // Current page is not a link.
    expect(screen.getByText('Round 2').closest('a')).toBeNull();
  });

  test('renders a separator between crumbs but not after the last', () => {
    render(<Breadcrumb items={items} />);
    // Two separators for three crumbs.
    expect(screen.getAllByText('›')).toHaveLength(2);
  });
});
