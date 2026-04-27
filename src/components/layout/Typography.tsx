/**
 * Typography — semantic wrappers around MUI's <Typography>.
 *
 * Use these instead of raw <Typography variant="…"> or hand-rolled
 * sx={{ fontSize: … }}. Names describe *role*, not size, so the
 * component tree stays readable and size tweaks can happen in one
 * place (the theme).
 *
 * Canonical roles — match the typography scale defined in src/theme/index.ts:
 *
 *   <PageTitle>       — top-of-page heading, one per route
 *   <SectionHeading>  — major section inside a page
 *   <CardTitle>       — title of a card / stepper / dialog
 *   <SubHeading>      — smaller heading inside a card
 *   <MicroHeading>    — used when a card has multiple nested sub-titles
 *   <Body>            — default paragraph text
 *   <Secondary>       — muted paragraph / helper text
 *   <Caption>         — small labels, badges, meta (e.g. "2 min ago")
 *   <Overline>        — uppercase tracked label, e.g. "RECENT" / "APPS"
 *
 * Pass `sx={{ color: … }}` if you need a different color — prefer theme
 * tokens (TOKENS.textSecondary etc.). Never override fontSize here — if
 * a size isn't in the scale, that's a design problem, not a component
 * problem; fix the scale or pick a different role.
 */

import Typography, { type TypographyProps } from '@mui/material/Typography';

type Role = {
  variant: TypographyProps['variant'];
  component?: TypographyProps['component'];
};

// Each semantic name maps to exactly one MUI variant. Centralising the
// mapping here means the whole app moves in lockstep if we decide (e.g.)
// that PageTitle should shrink on smaller screens.
const roles: Record<string, Role> = {
  PageTitle:      { variant: 'h1', component: 'h1' },
  SectionHeading: { variant: 'h2', component: 'h2' },
  CardTitle:      { variant: 'h3', component: 'h3' },
  SubHeading:     { variant: 'h4', component: 'h4' },
  MicroHeading:   { variant: 'h5', component: 'h5' },
  Body:           { variant: 'body1' },
  Secondary:      { variant: 'body2' },
  Caption:        { variant: 'caption', component: 'span' },
  Overline:       { variant: 'overline', component: 'span' },
};

function make(roleKey: keyof typeof roles) {
  const { variant, component } = roles[roleKey]!;
  const Comp = (props: Omit<TypographyProps, 'variant'>) => (
    <Typography variant={variant} component={component} {...props} />
  );
  Comp.displayName = roleKey;
  return Comp;
}

export const PageTitle      = make('PageTitle');
export const SectionHeading = make('SectionHeading');
export const CardTitle      = make('CardTitle');
export const SubHeading     = make('SubHeading');
export const MicroHeading   = make('MicroHeading');
export const Body           = make('Body');
export const Secondary      = make('Secondary');
export const Caption        = make('Caption');
export const Overline       = make('Overline');
