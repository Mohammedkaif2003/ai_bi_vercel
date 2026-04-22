/**
 * API client for Apex Analytics Vercel backend.
 *
 * Each function talks to the corresponding Python serverless endpoint
 * in api/*.py.  The base URL is empty so that calls are relative — this
 * works both locally (Next.js dev server proxies to the Python runtime)
 * and on Vercel (same origin).
 */

import type {
  AnalysisResult,
  DatasetPayload,
  ForecastResult,
  User,
  DatasetInfo,
  AnalysisHistoryEntry,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Request failed");
  return json as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Request failed");
  return json as T;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(username: string, password: string): Promise<User> {
  return post<User>("/api/auth", { username, password });
}

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export async function listDatasets(): Promise<{ datasets: DatasetInfo[] }> {
  return get<{ datasets: DatasetInfo[] }>("/api/datasets");
}

export async function loadDataset(dataset_key: string): Promise<DatasetPayload> {
  return post<DatasetPayload>("/api/datasets", { dataset_key });
}

export async function uploadCsv(
  csv_b64: string,
  filename: string
): Promise<DatasetPayload> {
  return post<DatasetPayload>("/api/upload", { csv_b64, filename });
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export async function analyze(
  query: string,
  csv_b64: string,
  dataset_name?: string
): Promise<AnalysisResult> {
  return post<AnalysisResult>("/api/analyze", { query, csv_b64, dataset_name });
}

// ---------------------------------------------------------------------------
// Forecasting
// ---------------------------------------------------------------------------

export async function forecast(
  csv_b64: string,
  periods: number = 6
): Promise<ForecastResult> {
  return post<ForecastResult>("/api/forecast", { csv_b64, periods });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export async function generateReport(
  analysis_history: AnalysisHistoryEntry[],
  dataset_name: string,
  user_name: string
): Promise<{ pdf_b64: string }> {
  return post<{ pdf_b64: string }>("/api/report", {
    analysis_history,
    dataset_name,
    user_name,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a browser File object and return its contents as a base64 string. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:<mime>;base64,<data>" — strip the prefix
      const b64 = result.split(",")[1];
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
