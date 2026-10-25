import type { ReactNode } from 'react';
import { MdCode, MdDescription, MdDesignServices, MdInsights, MdSlideshow, MdTableChart, MdVideocam } from 'react-icons/md';
import type { DeliverableType } from '../../types/assessment.types';

/** What a candidate can hand in for an assignment, in the order it's offered. */
export const DELIVERABLES: Array<{ value: DeliverableType; label: string; hint: string; accepts: string; icon: ReactNode }> = [
  { value: 'code', label: 'Code', hint: 'A public GitHub repo', accepts: 'A public GitHub repo link', icon: <MdCode /> },
  { value: 'spreadsheet', label: 'Spreadsheet', hint: 'A model or workbook', accepts: '.xlsx, .xlsm, .csv or a Google Sheets link', icon: <MdTableChart /> },
  { value: 'document', label: 'Document', hint: 'A spec, plan or report', accepts: '.pdf, .docx, .md or a Google Docs / Notion link', icon: <MdDescription /> },
  { value: 'presentation', label: 'Presentation', hint: 'A deck', accepts: '.pptx, .pdf or a Google Slides link', icon: <MdSlideshow /> },
  { value: 'data_analysis', label: 'Data analysis', hint: 'A notebook and findings', accepts: '.ipynb, .csv, .py, .xlsx or a Colab link', icon: <MdInsights /> },
  { value: 'design', label: 'Design', hint: 'Screens or a prototype', accepts: 'A Figma link, .fig, .png or .jpg', icon: <MdDesignServices /> },
  { value: 'video', label: 'Video', hint: 'A recorded walkthrough', accepts: 'A Loom, YouTube or video link', icon: <MdVideocam /> },
];

export const DELIVERABLE_LABEL = Object.fromEntries(DELIVERABLES.map((d) => [d.value, d.label])) as Record<DeliverableType, string>;
