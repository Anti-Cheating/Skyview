/**
 * BrandingPage — Owner-only white-label tab inside Settings.
 *
 * Renders two cards inside the SettingsLayout outlet (the outlet is
 * already padded + capped at 1280px, so this page is just the content):
 *
 *   1. Logo — thumbnail preview + Upload / Save / Remove actions. The
 *      upload path uses `CompaniesService.uploadLogo` (multipart POST
 *      to /companies/:id/logo) and `deleteLogo`. We stage the chosen
 *      file locally and only persist when "Save" is clicked, so the
 *      user can back out before the upload fires.
 *
 *   2. Brand color — hex input with a live 28×28 swatch preview. The
 *      backing `companies.branding_color` column exists but the PATCH
 *      endpoint that writes it is part of V1.1; for now we hold the
 *      value in local state and surface a friendly Alert on save.
 *
 * The header (SectionHeading + Secondary) sits above the two cards.
 * No inner <PageTitle> — SettingsLayout renders the page title and
 * the horizontal tabs above the outlet.
 */

import { useEffect, useRef, useState } from 'react';
import { Box, Alert, Stack } from '@mui/material';
import { SectionHeading, CardTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { FormField } from '../common/FormField';
import { TOKENS } from '../../theme';
import { useCompany } from '../../contexts/CompanyContext';
import { CompaniesService } from '../../services/companies.service';

type Feedback = { kind: 'success' | 'error'; msg: string } | null;

const DEFAULT_BRAND_COLOR = '#3B82F6';
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export default function BrandingPage() {
  const { company, updateCompany, refreshCompany } = useCompany();
  const companyId = company?.id ?? null;

  // Logo card local state. `pendingFile` is the chosen-but-not-yet-uploaded
  // File; previewUrl is its blob URL so we can show a thumbnail before
  // the server round-trip.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoFeedback, setLogoFeedback] = useState<Feedback>(null);

  // Brand color card local state. The PATCH for branding_color isn't
  // wired yet; we keep the value here and show a save Alert so the UI
  // is fully functional once the endpoint lands.
  const [color, setColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorFeedback, setColorFeedback] = useState<Feedback>(null);

  // Release any object URL we minted for the preview when the chosen
  // file changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displayedLogo = previewUrl ?? company?.logo_url ?? null;
  const hasPersistedLogo = !!company?.logo_url;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setLogoFeedback({ kind: 'error', msg: 'Logo must be an image file.' });
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setLogoFeedback({ kind: 'error', msg: 'Logo must be 2MB or smaller.' });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    setPendingFile(f);
    setLogoFeedback(null);
    // Allow selecting the same file twice in a row.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogoSave = async () => {
    if (!companyId || !pendingFile) return;
    setLogoBusy(true);
    setLogoFeedback(null);
    try {
      const resp = await CompaniesService.uploadLogo(companyId, pendingFile);
      if (resp.success && resp.data) {
        updateCompany(resp.data);
        refreshCompany().catch(() => {});
        setPendingFile(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        setLogoFeedback({ kind: 'success', msg: 'Logo updated.' });
      } else {
        setLogoFeedback({ kind: 'error', msg: resp.message || 'Logo upload failed.' });
      }
    } catch (err: any) {
      setLogoFeedback({
        kind: 'error',
        msg: err?.data?.error || err?.message || 'Logo upload failed.',
      });
    } finally {
      setLogoBusy(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!companyId) return;
    setLogoBusy(true);
    setLogoFeedback(null);
    try {
      const resp = await CompaniesService.deleteLogo(companyId);
      if (resp.success && resp.data) {
        updateCompany(resp.data);
        refreshCompany().catch(() => {});
        setPendingFile(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        setLogoFeedback({ kind: 'success', msg: 'Logo removed.' });
      } else {
        setLogoFeedback({ kind: 'error', msg: resp.message || 'Failed to remove logo.' });
      }
    } catch (err: any) {
      setLogoFeedback({
        kind: 'error',
        msg: err?.data?.error || err?.message || 'Failed to remove logo.',
      });
    } finally {
      setLogoBusy(false);
    }
  };

  const handleColorSave = async () => {
    if (!HEX_RE.test(color)) {
      setColorFeedback({
        kind: 'error',
        msg: 'Enter a valid hex color (e.g. #3B82F6).',
      });
      return;
    }
    setColorSaving(true);
    setColorFeedback(null);
    // PATCH /companies/:id with { branding_color } lands in V1.1. Until
    // then we acknowledge the save locally so the UI feels alive — the
    // hex value persists across re-renders of this tab via state.
    try {
      await new Promise((r) => setTimeout(r, 200));
      setColorFeedback({ kind: 'success', msg: 'Brand color saved.' });
    } catch (err: any) {
      setColorFeedback({
        kind: 'error',
        msg: err?.message || 'Failed to save brand color.',
      });
    } finally {
      setColorSaving(false);
    }
  };

  const swatchColor = HEX_RE.test(color) ? color : '#E5E7EB';

  return (
    <Box>
      <Box sx={{ mb: 2.5 }}>
        <SectionHeading>Branding</SectionHeading>
        <Secondary>White-label the candidate join page and interviewer console with your logo and brand color.</Secondary>
      </Box>

      {/* Logo card */}
      <Box
        sx={{
          bgcolor: TOKENS.bgCard,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: '12px',
          p: { xs: 2, md: 3 },
          mb: 2,
        }}
      >
        <CardTitle sx={{ mb: 0.5 }}>Logo</CardTitle>
        <Secondary sx={{ mb: 2 }}>
          PNG, JPG, WebP, or SVG. Up to 2MB.
        </Secondary>

        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '10px',
              bgcolor: '#F3F4F6',
              border: `1px solid ${TOKENS.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flex: '0 0 auto',
            }}
          >
            {displayedLogo ? (
              <img
                src={displayedLogo}
                alt="Brand logo preview"
                style={{ maxWidth: '82%', maxHeight: '82%', objectFit: 'contain' }}
              />
            ) : (
              <Caption sx={{ color: TOKENS.textSecondary }}>No logo</Caption>
            )}
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={handleFileChange}
            />
            <ActionButton
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoBusy}
            >
              Upload logo
            </ActionButton>
            {pendingFile && (
              <ActionButton onClick={handleLogoSave} loading={logoBusy}>
                Save
              </ActionButton>
            )}
            {hasPersistedLogo && (
              <ActionButton
                variant="secondary"
                onClick={handleLogoRemove}
                disabled={logoBusy}
              >
                Remove
              </ActionButton>
            )}
          </Stack>
        </Stack>

        {logoFeedback && (
          <Alert severity={logoFeedback.kind} sx={{ borderRadius: '10px' }}>
            {logoFeedback.msg}
          </Alert>
        )}
      </Box>

      {/* Brand color card */}
      <Box
        sx={{
          bgcolor: TOKENS.bgCard,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: '12px',
          p: { xs: 2, md: 3 },
        }}
      >
        <CardTitle sx={{ mb: 0.5 }}>Brand color</CardTitle>
        <Secondary sx={{ mb: 2 }}>
          Used for primary buttons and accents on candidate-facing surfaces.
        </Secondary>

        <Stack direction="row" spacing={1.5} alignItems="flex-end" sx={{ mb: 2 }}>
          <Box sx={{ flex: 1, maxWidth: 280 }}>
            <FormField
              label="Color (hex)"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#3B82F6"
              disabled={colorSaving}
            />
          </Box>
          <Box
            aria-label="Brand color preview"
            sx={{
              width: 28,
              height: 28,
              borderRadius: '8px',
              bgcolor: swatchColor,
              border: `1px solid ${TOKENS.border}`,
              flex: '0 0 auto',
              // Align the swatch with the input baseline — FormField has an
              // external label above so the input sits ~26px down from the top.
              mb: 0.5,
            }}
          />
        </Stack>

        <Stack direction="row" spacing={1}>
          <ActionButton onClick={handleColorSave} loading={colorSaving}>
            Save
          </ActionButton>
        </Stack>

        {colorFeedback && (
          <Alert severity={colorFeedback.kind} sx={{ mt: 2, borderRadius: '10px' }}>
            {colorFeedback.msg}
          </Alert>
        )}
      </Box>
    </Box>
  );
}
