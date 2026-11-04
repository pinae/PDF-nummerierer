/** Stand-in for react-pdf in jsdom (pdf.js needs a real browser; e2e covers it). */
import { useEffect, type ReactNode } from "react";

interface DocumentProps {
  file: string;
  children?: ReactNode;
  onLoadError?: (error: Error) => void;
  error?: ReactNode;
}

export function Document({ file, children, onLoadError, error }: DocumentProps) {
  const broken = file.includes("broken");
  useEffect(() => {
    if (broken) onLoadError?.(new Error("Invalid PDF structure"));
  }, [broken, onLoadError]);
  if (broken) return <>{error}</>;
  return (
    <div data-testid="pdf-document" data-file={file}>
      {children}
    </div>
  );
}

export function Page({ pageNumber, width }: { pageNumber: number; width: number }) {
  return <div data-testid="pdf-page" data-page-number={pageNumber} data-width={width} />;
}

export const pdfjs = { GlobalWorkerOptions: { workerSrc: "" }, version: "test" };
