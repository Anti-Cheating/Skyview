/**
 * CompanyTab — Owner-only. Loads the current company on mount and lets
 * the Owner edit:
 *
 *   - Logo (image upload, 2MB, PNG/JPG/WebP/SVG)
 *   - Name
 *   - Website
 *   - Description (short blurb shown on candidate join page)
 *   - HQ location
 *
 * Logo is its own endpoint (POST/DELETE /companies/:id/logo) because
 * it's a multipart upload. Everything else is one PATCH on Save.
 *
 * Save is enabled only when text fields are dirty. Logo upload/clear
 * fires immediately and shows its own spinner — keeping it out of the
 * Save flow means you never have a half-saved state where the logo
 * landed in R2 but the rest of the form blew up validation.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Alert,
  CircularProgress,
  Typography,
  IconButton,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useCompany } from '../../contexts/CompanyContext';
import { CompaniesService, type Company } from '../../services/companies.service';

interface CompanyTabProps {
  companyId: string;
}

const DESCRIPTION_MAX = 280;
const LOCATION_MAX = 120;

function getCompanyInitials(name?: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'CO';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0]! + parts[1][0]!).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export default function CompanyTab({ companyId }: CompanyTabProps) {
  const { showSuccess, showError } = useSnackbar();
  const { updateCompany: pushToContext, refreshCompany } = useCompany();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate the local form state and push the same row into the
  // CompanyContext so the sidebar / candidate join page see the update
  // immediately. The optional `mutated` flag also fires a background
  // refresh — belt-and-suspenders so the workspace chip can never
  // diverge from the server even if the optimistic update is dropped.
  const hydrate = (c: Company, mutated = false) => {
    setCompany(c);
    setName(c.name);
    setWebsite(c.website ?? '');
    setDescription(c.description ?? '');
    setLocation(c.location ?? '');
    pushToContext(c);
    if (mutated) {
      // Fire-and-forget — the optimistic update has already landed, so
      // any failure here is invisible to the user.
      refreshCompany().catch(() => {});
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await CompaniesService.getById(companyId);
        if (cancelled) return;
        if (resp.success && resp.data) {
          hydrate(resp.data);
        } else {
          setError(resp.message || 'Failed to load company');
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.data?.error || err?.message || 'Failed to load company');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const dirty =
    company !== null &&
    (name.trim() !== company.name ||
      website.trim() !== (company.website ?? '') ||
      description.trim() !== (company.description ?? '') ||
      location.trim() !== (company.location ?? ''));

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Company name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const resp = await CompaniesService.update(companyId, {
        name: name.trim(),
        website: website.trim(),
        description: description.trim(),
        location: location.trim(),
      });
      if (resp.success && resp.data) {
        showSuccess('Company details updated');
        hydrate(resp.data, true);
      } else {
        const msg = resp.message || 'Failed to update company';
        setError(msg);
        showError(msg);
      }
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || 'Failed to update company';
      setError(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showError('Logo must be an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showError('Logo must be 2MB or smaller');
      return;
    }
    setLogoBusy(true);
    try {
      const resp = await CompaniesService.uploadLogo(companyId, file);
      if (resp.success && resp.data) {
        hydrate(resp.data, true);
        showSuccess('Logo updated');
      } else {
        showError(resp.message || 'Logo upload failed');
      }
    } catch (err: any) {
      showError(err?.data?.error || err?.message || 'Logo upload failed');
    } finally {
      setLogoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogoRemove = async () => {
    setLogoBusy(true);
    try {
      const resp = await CompaniesService.deleteLogo(companyId);
      if (resp.success && resp.data) {
        hydrate(resp.data, true);
        showSuccess('Logo removed');
      } else {
        showError(resp.message || 'Failed to remove logo');
      }
    } catch (err: any) {
      showError(err?.data?.error || err?.message || 'Failed to remove logo');
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: '12px',
        p: { xs: 2, md: 3 },
      }}
    >
      <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TOKENS.textPrimary, mb: 2.5 }}>
        Company details
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={20} thickness={5} sx={{ color: TOKENS.brand }} />
        </Box>
      ) : (
        <>
          {/* Logo block — one clickable box.
              - Empty state: full-box dropzone with upload icon + helper.
                Clicking anywhere triggers the file picker.
              - Filled state: shows the logo; hovering reveals an Edit
                (replace) and Delete pair pinned to the top-right of the
                same box. Edit re-opens the picker; Delete clears.
              The whole tile is the action surface so the user never has
              to hunt for buttons elsewhere on the page. */}
          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TOKENS.textPrimary, mb: 0.25 }}>
              Logo
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: TOKENS.textSecondary, mb: 1.25 }}>
              PNG, JPG, WebP, or SVG. Up to 2MB.
            </Typography>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoFile(f);
              }}
            />

            <Box
              role={company?.logo_url ? undefined : 'button'}
              tabIndex={company?.logo_url ? -1 : 0}
              onClick={() => {
                if (logoBusy) return;
                if (!company?.logo_url) fileInputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (logoBusy || company?.logo_url) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              sx={{
                position: 'relative',
                width: 120,
                height: 120,
                borderRadius: '50%',
                border: `1px ${company?.logo_url ? 'solid' : 'dashed'} ${TOKENS.border}`,
                bgcolor: '#FAFAFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: company?.logo_url || logoBusy ? 'default' : 'pointer',
                transition: 'border-color 120ms ease, background-color 120ms ease',
                '&:hover': company?.logo_url
                  ? { '& .logo-actions': { opacity: 1 } }
                  : {
                      borderColor: TOKENS.brand,
                      bgcolor: `${TOKENS.brand}08`,
                    },
              }}
            >
              {company?.logo_url ? (
                <>
                  <img
                    key={company.logo_url}
                    src={company.logo_url}
                    alt="Company logo"
                    style={{
                      maxWidth: '82%',
                      maxHeight: '82%',
                      objectFit: 'contain',
                    }}
                  />
                  {/* Hover overlay — full-tile dim with centered Edit +
                      Delete buttons. Same interaction pattern as the
                      profile-picture editor on the Personal tab so
                      both upload surfaces feel like one design. */}
                  <Box
                    className="logo-actions"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(0,0,0,0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      opacity: 0,
                      transition: 'opacity 120ms ease',
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!logoBusy) fileInputRef.current?.click();
                      }}
                      disabled={logoBusy}
                      aria-label="Replace logo"
                      sx={{
                        bgcolor: '#FFFFFF',
                        color: TOKENS.textPrimary,
                        '&:hover': { bgcolor: '#F3F4F6' },
                      }}
                    >
                      <CloudUploadIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!logoBusy) handleLogoRemove();
                      }}
                      disabled={logoBusy}
                      aria-label="Remove logo"
                      sx={{
                        bgcolor: '#FFFFFF',
                        color: TOKENS.textSecondary,
                        '&:hover': { bgcolor: '#FEE2E2', color: '#B91C1C' },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                  {logoBusy && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(255,255,255,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CircularProgress size={20} thickness={5} sx={{ color: TOKENS.brand }} />
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', px: 2 }}>
                  {logoBusy ? (
                    <CircularProgress size={20} thickness={5} sx={{ color: TOKENS.brand }} />
                  ) : (
                    <>
                      <Typography
                        sx={{
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          color: TOKENS.textMuted,
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                      >
                        {getCompanyInitials(company?.name)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: TOKENS.textSecondary, mt: 0.5 }}>
                        Click to upload
                      </Typography>
                    </>
                  )}
                </Box>
              )}
            </Box>
          </Box>

          <FormField
            label="Company name"
            required
            placeholder="Acme Corp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
          <Box sx={{ height: 12 }} />
          <FormField
            label="Website"
            placeholder="https://acme.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={saving}
          />
          <Box sx={{ height: 12 }} />
          <FormField
            label="HQ location"
            placeholder="Bangalore, IN"
            value={location}
            onChange={(e) => setLocation(e.target.value.slice(0, LOCATION_MAX))}
            disabled={saving}
          />
          <Box sx={{ height: 12 }} />
          <FormField
            label="Description"
            placeholder="What you do, in a sentence."
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
            disabled={saving}
            helperText={`${description.length}/${DESCRIPTION_MAX}`}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <ActionButton onClick={handleSave} loading={saving} disabled={!dirty || saving}>
              Save changes
            </ActionButton>
          </Box>
        </>
      )}
    </Box>
  );
}
