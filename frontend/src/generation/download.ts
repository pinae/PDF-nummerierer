/**
 * Let the browser download a file the server sends as an attachment. The
 * browser streams it to disk, so even very large PDFs never sit in memory.
 */
export function startDownload(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}
