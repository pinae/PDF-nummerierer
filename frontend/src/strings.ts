/** All user-visible English text, in one place so a translation can be added later. */
export const strings = {
  appName: "PDF-Nummerierer",
  tagline:
    "Stamp serial numbers onto exam PDFs, so pages of different students can never be mixed up.",
  upload: {
    title: "Number an exam",
    dropzoneLabel: "PDF upload",
    dropHint: "Drag your exam PDF here",
    or: "or",
    choose: "Choose a PDF",
    inputLabel: "Exam PDF",
    dropNow: "Drop the PDF to upload it",
    limit: (size: string) => `PDF, up to ${size}`,
    privacy: "Your exam stays private: only this browser can open it.",
    deletion: (duration: string | null) =>
      duration
        ? `It is deleted from the server right after you download the numbered copies, at the latest after ${duration}.`
        : "It is deleted from the server right after you download the numbered copies.",
    uploading: (name: string) => `Uploading ${name}…`,
    progressLabel: "Upload progress",
    cancel: "Cancel",
    stepsLabel: "How it works",
    steps: [
      "Upload your exam as a PDF.",
      "Place the number on the first, odd and even pages and check every page.",
      "Choose the number of copies and download one PDF that is ready to print.",
    ],
    errors: {
      not_pdf: "This file is not a PDF. Please choose a PDF file.",
      single_file: "Please choose a single PDF file.",
      missing_file: "Please choose a PDF file.",
      too_large: (size: string, max: string) =>
        `The file is too large (${size}). The maximum is ${max}.`,
      encrypted_pdf:
        "This PDF is password protected. Please save a copy without password and upload that one.",
      invalid_pdf:
        "This PDF is damaged or empty and cannot be read. Please export it again and retry.",
      throttled: "Too many uploads in a short time. Please wait a few minutes and try again.",
    },
  },
  workspace: {
    title: "Place the number",
    loading: "Loading the exam",
    missingTitle: "This exam is no longer here",
    missingText:
      "It was deleted after the download or expired after some time. Please upload the PDF again.",
    uploadAgain: "Upload a PDF",
  },
  viewer: {
    toolbarLabel: "Pages and zoom",
    previewLabel: "Page preview",
    previous: "Previous page",
    next: "Next page",
    pageOf: (page: number, count: number) => `Page ${page} of ${count}`,
    jump: {
      first: "First page",
      odd: "First odd page",
      even: "First even page",
      last: "Last page",
    },
    jumpText: { first: "First", odd: "Odd", even: "Even", last: "Last" },
    fitPage: "Fit page",
    fitWidth: "Fit width",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    loading: "Loading the PDF",
    loadError: "The PDF could not be displayed. Please upload it again.",
  },
  done: {
    title: "Your copies are ready",
  },
  errors: {
    network: "The server cannot be reached. Please check your connection and try again.",
    server: "Something went wrong on the server. Please try again.",
  },
} as const;
