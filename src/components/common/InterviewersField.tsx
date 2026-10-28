/**
 * InterviewersField — type-to-search multi-select of company team members
 * for a round. Type part of a name or email, pick from the matches, remove
 * with the chip's ×. Used by New interview and the Add / Edit round dialog.
 * Only team members are offered; the backend also rejects anyone else.
 */
import { Autocomplete, Box, createFilterOptions } from '@mui/material';
import { FormField } from './FormField';
import { TOKENS } from '../../theme';
import type { TeamMember } from '../../services/invites.service';

const nameOf = (m: TeamMember) => [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || m.email;

// Match on name and email, so "priya" and "priya@acme" both find Priya.
const filterOptions = createFilterOptions<TeamMember>({ stringify: (m) => `${nameOf(m)} ${m.email}` });

export function InterviewersField({
  members,
  value,
  onChange,
  disabled,
  hint,
}: {
  members: TeamMember[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const selected = value.flatMap((id) => members.find((m) => m.id === id) ?? []);

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={members}
      value={selected}
      onChange={(_, picked) => onChange(picked.map((m) => m.id))}
      getOptionLabel={nameOf}
      filterOptions={filterOptions}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      disabled={disabled}
      noOptionsText="No team member matches. Invite them from the Team page first."
      slotProps={{ chip: { size: 'small' } }}
      renderOption={({ key, ...props }, m) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
          {nameOf(m)}
          <Box component="span" sx={{ fontSize: '0.75rem', color: TOKENS.textMuted }}>{m.email}</Box>
        </Box>
      )}
      renderInput={(params) => (
        <FormField
          {...params}
          label="Interviewers"
          required
          placeholder={selected.length ? '' : 'Type a name or email'}
          hint={members.length === 0 ? 'No team members — invite someone from the Team page first.' : hint}
        />
      )}
    />
  );
}
