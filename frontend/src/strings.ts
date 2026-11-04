/** All user-visible English text, in one place so a translation can be added later. */
export const strings = {
  appName: "PDF-Nummerierer",
  tagline:
    "Stamp serial numbers onto exam PDFs, so pages of different students can never be mixed up.",
  upload: {
    title: "Number an exam",
  },
  workspace: {
    title: "Place the number",
  },
  done: {
    title: "Your copies are ready",
  },
  errors: {
    network: "The server cannot be reached. Please check your connection and try again.",
    server: "Something went wrong on the server. Please try again.",
  },
} as const;
