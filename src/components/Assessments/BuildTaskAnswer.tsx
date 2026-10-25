import { useRef, useState } from 'react';
import { Box, Chip, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { MdCheck, MdContentCopy, MdUploadFile, MdClose, MdLink } from 'react-icons/md';
import { TOKENS } from '../../theme';
import type { DeliverableType } from '../../types/assessment.types';

/** Putting their project on GitHub, one command at a time (run inside the project folder). */
const PUSH_STEPS: Array<{ text: string; cmd?: string; link?: string }> = [
  { text: 'Turn your project folder into a git repo', cmd: 'git init -b main' },
  { text: 'Add all your files', cmd: 'git add -A' },
  { text: 'Save them in a first commit', cmd: 'git commit -m "My assignment"' },
  { text: 'Create a new, empty public repo on GitHub (no README), and copy its link', link: 'https://github.com/new' },
  { text: 'Connect your folder to it (use your repo’s link)', cmd: 'git remote add origin https://github.com/you/repo.git' },
  { text: 'Upload your work', cmd: 'git push -u origin main' },
];

/** One command, with its own copy button. */
function Command({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the text is selectable */ }
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#0F172A', borderRadius: '8px', pl: 1.5, pr: 0.5, py: 0.25 }}>
      <Box component="code" sx={{ flex: 1, minWidth: 0, color: '#E2E8F0', fontSize: '0.8rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', overflowX: 'auto', whiteSpace: 'nowrap', py: 0.75 }}>{cmd}</Box>
      <Tooltip title={copied ? 'Copied' : 'Copy'}>
        <IconButton size="small" aria-label={`Copy: ${cmd}`} onClick={copy} sx={{ color: '#CBD5E1', '&:hover': { color: '#fff' } }}>
          {copied ? <MdCheck /> : <MdContentCopy />}
        </IconButton>
      </Tooltip>
    </Box>
  );
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

/** A build task's answer: a public repo link (code) or files / a link (other deliverables). The brief above has the requirements. */
export function BuildTaskAnswer({
  value,
  deliverableType = 'code',
  deliverableFiles = [],
  onChange,
  onFilesChange,
  error,
}: {
  value: string;
  deliverableType?: DeliverableType | null;
  deliverableFiles?: DeliverableFileEntry[] | null;
  onChange: (v: string) => void;
  onFilesChange?: (files: DeliverableFileEntry[]) => void;
  error?: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const type = deliverableType || 'code';
  const meta = DELIVERABLE_LABELS[type] || DELIVERABLE_LABELS.code;

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

  // 1. Code: a public repo link, with the git steps folded below for anyone not on GitHub yet.
  if (type === 'code') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box component="label" htmlFor="repo-link" sx={{ fontWeight: 600, fontSize: '0.9rem', color: TOKENS.textPrimary }}>Your repo link</Box>
        <TextField
          id="repo-link"
          fullWidth
          placeholder="https://github.com/you/repo"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={!!error}
          helperText={error ?? undefined}
          inputProps={{ inputMode: 'url' }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
        <Box component="details" sx={{ borderTop: `1px solid ${TOKENS.borderLight}`, pt: 1.5 }}>
          <Box component="summary" sx={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: TOKENS.textSecondary, width: 'fit-content' }}>Not on GitHub yet?</Box>
          <Box component="ol" sx={{ listStyle: 'none', m: 0, mt: 1, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {PUSH_STEPS.map((st, i) => (
              <Box component="li" key={st.text} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: '0.875rem', color: TOKENS.textPrimary }}>
                <Box sx={{ width: 24, height: 24, flex: 'none', borderRadius: '50%', bgcolor: TOKENS.borderLight, color: TOKENS.textSecondary, fontSize: '0.75rem', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</Box>
                {st.cmd ? <Box sx={{ flex: 1, minWidth: 0 }}><Command cmd={st.cmd} /></Box> : (
                  <Box sx={{ flex: 1 }}>Make an empty public repo at <Box component="a" href={st.link} target="_blank" rel="noopener noreferrer" sx={{ color: TOKENS.success, fontWeight: 600 }}>github.com/new</Box></Box>
                )}
              </Box>
            ))}
          </Box>
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
