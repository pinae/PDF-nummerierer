/** Payloads of the backend API (see docs/PLANNING.md, API sketch). */

export type PageRole = "first" | "odd" | "even";

/** Position in PDF points from the bottom-left corner of the page as displayed. */
export interface Placement {
  x: number;
  y: number;
  font: string;
  font_size: number;
}

export type Placements = Record<PageRole, Placement | null>;

export interface NumberFormat {
  prefix: string;
  digits: number;
  suffix: string;
}

export interface ConfigDraft {
  name: string;
  number_format: NumberFormat;
  placements: Placements;
}

export interface NumberingConfig extends ConfigDraft {
  id: string;
  version: number;
  created_at: string;
}

export type FontCategory = "serif" | "sans-serif" | "handwritten";

export interface FontInfo {
  id: string;
  label: string;
  category: FontCategory;
  url: string;
}

export interface DocumentInfo {
  id: string;
  name: string;
  size: number;
  page_count: number;
  /** [width, height] in points per page, as displayed. */
  page_sizes: [number, number][];
  created_at: string;
  expires_at: string;
}

export interface GenerationRequest {
  copies: number;
  start: number;
  pad_to_even: boolean;
  number_format: NumberFormat;
  placements: Placements;
}

export type JobStatus = "pending" | "running" | "done" | "failed";
export type JobStage = "" | "preparing" | "stamping" | "writing" | "done";

export interface Job {
  id: string;
  document_id: string;
  status: JobStatus;
  stage: JobStage;
  copies_done: number;
  copies_total: number;
  total_pages: number;
  error: { code: string; message: string } | null;
  download_url: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface Limits {
  max_upload_bytes: number;
  retention_seconds: number;
  max_copies: number;
  max_output_pages: number;
}
