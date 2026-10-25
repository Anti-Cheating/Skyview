import { useState, useRef } from 'react';
import { Box, Chip, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { MdCheck, MdContentCopy, MdDownload, MdUploadFile, MdClose, MdLink } from 'react-icons/md';
import { ENV } from '../../config/env';
import { TOKENS } from '../../theme';
import type { DeliverableType } from '../../types/assessment.types';

type Os = 'mac' | 'windows';
const isWindows = () => /Win/i.test(navigator.platform || navigator.userAgent);

function command(os: Os, url: string, folder: string): string {
  const steps = os === 'mac'
    ? [`curl -fsSL "${url}" -o ${folder}.zip`, `unzip -q ${folder}.zip`, `rm ${folder}.zip`, `cd ${folder}`]
    : [`curl.exe -fsSL "${url}" -o ${folder}.zip`, `tar -xf ${folder}.zip`, `del ${folder}.zip`, `cd ${folder}`];
  steps.push('git init -q -b main', 'git add -A', 'git commit -qm "Starter from Trueyy"', `gh repo create ${folder} --public --source=. --push`);
  return steps.join(os === 'mac' ? ' && ' : '; ');
}

export type DeliverableFileEntry = {
  name: string;
  url?: string;
  content?: string;
  size?: number;
  type?: string;
};

const DELIVERABLE_LABELS: Record<DeliverableType, { title: string; hint: string; formats: string; placeholder: string }> = {
  code: {
    title: 'Code Repository',
    hint: 'Build in your repository and submit the public link.',
    formats: '.zip, git',
    placeholder: 'https://github.com/you/repo',
  },
  spreadsheet: {
    title: 'Financial Model / Spreadsheet',
    hint: 'Upload your completed workbook or provide a viewable Google Sheets link.',
    formats: '.xlsx, .xlsm, .csv',
    placeholder: 'https://docs.google.com/spreadsheets/d/...',
  },
  document: {
    title: 'Document / Product Spec',
    hint: 'Upload your document or provide a shareable Google Docs / Notion link.',
    formats: '.pdf, .docx, .md',
    placeholder: 'https://docs.google.com/document/d/...',
  },
  presentation: {
    title: 'Presentation / Pitch Deck',
    hint: 'Upload your slides or provide a shareable Google Slides link.',
    formats: '.pptx, .pdf',
    placeholder: 'https://docs.google.com/presentation/d/...',
  },
  data_analysis: {
    title: 'Data Analysis / Notebook',
    hint: 'Upload your Jupyter notebook and dataset, or link your public workspace.',
    formats: '.ipynb, .csv, .py, .xlsx',
    placeholder: 'https://colab.research.google.com/... or notebook URL',
  },
  design: {
    title: 'Design / Wireframe Prototype',
    hint: 'Provide a link to your Figma file or upload exported screens.',
    formats: 'Figma URL, .fig, .png, .jpg',
    placeholder: 'https://www.figma.com/file/...',
  },
  video: {
    title: 'Walkthrough / Demo Video',
    hint: 'Paste the link to your recorded Loom or YouTube presentation.',
    formats: 'Loom, YouTube, or direct video link',
    placeholder: 'https://www.loom.com/share/...',
  },
};

export function BuildTaskAnswer({
  starter,
  value,
  deliverableType = 'code',
  deliverableFiles = [],
  onChange,
  onFilesChange,
  error,
}: {
  starter: { path: string; folder: string } | null | undefined;
  value: string;
  deliverableType?: DeliverableType | null;
  deliverableFiles?: DeliverableFileEntry[] | null;
  onChange: (v: string) => void;
  onFilesChange?: (files: DeliverableFileEntry[]) => void;
  error?: string | null;
}) {
  const [os, setOs] = useState<Os>(isWindows() ? 'windows' : 'mac');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const type = deliverableType || 'code';
  const meta = DELIVERABLE_LABELS[type] || DELIVERABLE_LABELS.code;

  const url = starter ? `${ENV.AUTH_API_URL}${starter.path}` : '';
  const cmd = starter ? command(os, url, starter.folder) : '';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !onFilesChange) return;

    const newEntries: DeliverableFileEntry[] = [];
    const readPromises: Promise<void>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const reader = new FileReader();
      const p = new Promise<void>((resolve) => {
        reader.onload = () => {
          const content = reader.result ? String(reader.result) : undefined;
          newEntries.push({
            name: file.name,
            size: file.size,
            type: file.type,
            content,
          });
          resolve();
        };
        // Read text/markdown as text, binary as data URL
        if (/\.(md|txt|csv|json)$/i.test(file.name)) {
          reader.readAsText(file);
        } else {
          reader.readAsDataURL(file);
        }
      });
      readPromises.push(p);
    }

    Promise.all(readPromises).then(() => {
      const combined = [...(deliverableFiles || []), ...newEntries];
      onFilesChange(combined);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  const handleRemoveFile = (index: number) => {
    if (!onFilesChange) return;
    const next = [...(deliverableFiles || [])];
    next.splice(index, 1);
    onFilesChange(next);
  };

  // 1. Code Deliverable Interface
  if (type === 'code') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: TOKENS.textPrimary, mb: 0.5 }}>
            1. Put the starter repo on your GitHub
          </Typography>
          {!starter ? (
            <Typography sx={{ fontSize: '0.85rem', color: TOKENS.textSecondary }}>The starter repo isn't ready yet. Refresh in a minute.</Typography>
          ) : (
            <>
              <Typography sx={{ fontSize: '0.85rem', color: TOKENS.textSecondary, mb: 1 }}>
                Run this in a terminal. It downloads the starter, makes it a git repo and pushes it to a new public repo on your GitHub.
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                {(['mac', 'windows'] as Os[]).map((o) => (
                  <Box
                    key={o}
                    component="button"
                    type="button"
                    onClick={() => { setOs(o); setCopied(false); }}
                    sx={{
                      all: 'unset',
                      cursor: 'pointer',
                      px: 1.25,
                      py: 0.4,
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      bgcolor: os === o ? TOKENS.brandBg : 'transparent',
                      color: os === o ? '#047857' : TOKENS.textSecondary,
                      '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` },
                    }}
                  >
                    {o === 'mac' ? 'macOS / Linux' : 'Windows (PowerShell)'}
                  </Box>
                ))}
              </Box>
              <Box sx={{ position: 'relative', bgcolor: '#0F172A', borderRadius: '10px', p: 1.5, pr: 6 }}>
                <Box
                  component="code"
                  sx={{
                    display: 'block',
                    color: '#E2E8F0',
                    fontSize: '0.78rem',
                    lineHeight: 1.6,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    wordBreak: 'break-all',
                  }}
                >
                  {cmd}
                </Box>
                <Tooltip title={copied ? 'Copied' : 'Copy command'}>
                  <IconButton
                    size="small"
                    aria-label="Copy command"
                    onClick={() => { void navigator.clipboard.writeText(cmd); setCopied(true); }}
                    sx={{ position: 'absolute', top: 8, right: 8, color: '#CBD5E1', '&:hover': { color: '#fff' } }}
                  >
                    {copied ? <MdCheck /> : <MdContentCopy />}
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography sx={{ fontSize: '0.78rem', color: TOKENS.textSecondary, mt: 1 }}>
                Needs git and GitHub CLI (<Box component="code" sx={{ fontSize: '0.75rem' }}>gh auth login</Box>). Or{' '}
                <Box component="a" href={url} sx={{ color: TOKENS.success, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                  <MdDownload /> Download the starter
                </Box>
                , and push it manually.
              </Typography>
            </>
          )}
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: TOKENS.textPrimary, mb: 0.5 }}>
            2. Paste your public repo link
          </Typography>
          <TextField
            fullWidth
            placeholder="https://github.com/you/repo"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            error={!!error}
            helperText={error ?? undefined}
            inputProps={{ 'aria-label': 'Your public GitHub repo link', inputMode: 'url' }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        </Box>
      </Box>
    );
  }

  // 2. Non-Code Universal Deliverable Interface
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* File Upload Zone */}
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: TOKENS.textPrimary, mb: 0.5 }}>
          1. Upload Deliverable Files ({meta.formats})
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: TOKENS.textSecondary, mb: 1.5 }}>
          {meta.hint}
        </Typography>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        <Box
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: '2px dashed #CBD5E1',
            borderRadius: '10px',
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: '#F8FAFC',
            transition: 'border-color 0.2s',
            '&:hover': { borderColor: TOKENS.brand, bgcolor: '#F1F5F9' },
          }}
        >
          <MdUploadFile style={{ fontSize: 32, color: '#64748B', marginBottom: 8 }} />
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: TOKENS.textPrimary }}>
            Click to upload files
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: TOKENS.textMuted }}>
            Accepted: {meta.formats} (Max 25MB each)
          </Typography>
        </Box>

        {/* Uploaded Files Chips */}
        {deliverableFiles && deliverableFiles.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
            {deliverableFiles.map((f, i) => (
              <Chip
                key={i}
                label={`${f.name}${f.size ? ` (${Math.round(f.size / 1024)} KB)` : ''}`}
                onDelete={() => handleRemoveFile(i)}
                deleteIcon={<MdClose />}
                variant="outlined"
                sx={{ borderRadius: '6px', fontWeight: 500, bgcolor: '#FFFFFF' }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Shareable Link Input */}
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: TOKENS.textPrimary, mb: 0.5 }}>
          2. Or Provide Public Shareable Link
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: TOKENS.textSecondary, mb: 1 }}>
          Make sure view permissions are set to public so our review engine can access it.
        </Typography>
        <TextField
          fullWidth
          placeholder={meta.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={!!error}
          helperText={error ?? undefined}
          InputProps={{
            startAdornment: <MdLink style={{ marginRight: 8, color: '#94A3B8' }} />,
          }}
          inputProps={{ 'aria-label': 'Deliverable link', inputMode: 'url' }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
      </Box>
    </Box>
  );
}
