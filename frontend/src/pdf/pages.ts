import type { PageRole } from "../api/types";

/** Role of a 1-based page number; the same rules as the backend (odd excludes page 1). */
export function roleOfPage(page: number): PageRole {
  if (page === 1) return "first";
  return page % 2 === 0 ? "even" : "odd";
}

const FIRST_PAGE: Record<PageRole, number> = { first: 1, even: 2, odd: 3 };

/** The first page of a role, or null if the document is too short to have one. */
export function firstPageOfRole(role: PageRole, pageCount: number): number | null {
  const page = FIRST_PAGE[role];
  return page <= pageCount ? page : null;
}
