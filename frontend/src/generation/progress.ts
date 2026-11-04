import type { Job } from "../api/types";
import { strings } from "../strings";

const text = strings.generation.stages;

/** Label and a determinate 0..100 value for a job (stamping dominates the run time). */
export function progressOf(job: Job): { label: string; percent: number } {
  if (job.status === "done") return { label: text.done, percent: 100 };
  switch (job.stage) {
    case "preparing":
      return { label: text.preparing, percent: 2 };
    case "stamping": {
      const share = job.copies_total ? job.copies_done / job.copies_total : 0;
      return {
        label: text.stamping(job.copies_done, job.copies_total),
        percent: 5 + Math.round(share * 85),
      };
    }
    case "writing":
      return { label: text.writing, percent: 92 };
    default:
      return { label: text.waiting, percent: 0 };
  }
}

export interface RunSummary {
  pagesPerCopy: number;
  totalPages: number;
  /** Whether a blank page is added to every copy. */
  padded: boolean;
}

/** Same arithmetic as the backend's page limit check. */
export function runSummary({
  copies,
  pageCount,
  padToEven,
}: {
  copies: number;
  pageCount: number;
  padToEven: boolean;
}): RunSummary {
  const padded = padToEven && pageCount % 2 === 1;
  const pagesPerCopy = pageCount + (padded ? 1 : 0);
  return { pagesPerCopy, totalPages: copies * pagesPerCopy, padded };
}
