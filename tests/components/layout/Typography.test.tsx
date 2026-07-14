import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PageTitle,
  SectionHeading,
  CardTitle,
  SubHeading,
  MicroHeading,
  Body,
  Secondary,
  Caption,
  Overline,
} from '../../../src/components/layout/Typography';

describe('Typography semantic wrappers', () => {
  test('PageTitle renders as an h1', () => {
    render(<PageTitle>Dashboard</PageTitle>);
    const el = screen.getByText('Dashboard');
    expect(el.tagName).toBe('H1');
  });

  test('SectionHeading renders as an h2', () => {
    render(<SectionHeading>Section</SectionHeading>);
    expect(screen.getByText('Section').tagName).toBe('H2');
  });

  test('CardTitle renders as an h3', () => {
    render(<CardTitle>Card</CardTitle>);
    expect(screen.getByText('Card').tagName).toBe('H3');
  });

  test('the remaining roles all render their text', () => {
    render(
      <div>
        <SubHeading>sub</SubHeading>
        <MicroHeading>micro</MicroHeading>
        <Body>body</Body>
        <Secondary>secondary</Secondary>
        <Caption>caption</Caption>
        <Overline>overline</Overline>
      </div>,
    );
    for (const t of ['sub', 'micro', 'body', 'secondary', 'caption', 'overline']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });

  test('forwards sx / props through to the underlying Typography', () => {
    render(<Body data-testid="para">hello</Body>);
    expect(screen.getByTestId('para')).toHaveTextContent('hello');
  });
});
