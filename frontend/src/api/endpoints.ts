import { apiRequest } from "./client";
import type {
  ConfigDraft,
  DocumentInfo,
  FontInfo,
  GenerationRequest,
  Job,
  Limits,
  NumberingConfig,
} from "./types";

const segment = encodeURIComponent;

export const documentFileUrl = (documentId: string) =>
  `/api/documents/${segment(documentId)}/file/`;

export const getDocument = (documentId: string) =>
  apiRequest<DocumentInfo>(`/api/documents/${segment(documentId)}/`);

export const deleteDocument = (documentId: string) =>
  apiRequest<void>(`/api/documents/${segment(documentId)}/`, { method: "DELETE" });

/** Tell the server the exam is still open (abandoned uploads are deleted early). */
export const keepAlive = (documentId: string) =>
  apiRequest<void>(`/api/documents/${segment(documentId)}/keepalive/`, { method: "POST" });

export const listConfigs = () => apiRequest<NumberingConfig[]>("/api/configs/");

export const listConfigVersions = (configId: string) =>
  apiRequest<NumberingConfig[]>(`/api/configs/${segment(configId)}/versions/`);

export const saveConfig = (draft: ConfigDraft) =>
  apiRequest<NumberingConfig>("/api/configs/", { method: "POST", json: draft });

export const listFonts = () => apiRequest<FontInfo[]>("/api/fonts/");

export const startGeneration = (documentId: string, request: GenerationRequest) =>
  apiRequest<Job>(`/api/documents/${segment(documentId)}/generate/`, {
    method: "POST",
    json: request,
  });

export const getJob = (jobId: string) => apiRequest<Job>(`/api/jobs/${segment(jobId)}/`);

export const getLimits = () => apiRequest<Limits>("/api/limits/");
