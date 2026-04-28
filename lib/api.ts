/**
 * API client for Nexlytics Vercel backend.
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

import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

async function getAuthToken(): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Request failed");
  return json as T;
}

async function get<T>(path: string): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Request failed");
  return json as T;
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
  dataset_key: string,
  dataset_name?: string
): Promise<AnalysisResult> {
  return post<AnalysisResult>("/api/analyze", { query, dataset_key, dataset_name });
}

// ---------------------------------------------------------------------------
// Forecasting
// ---------------------------------------------------------------------------

export async function forecast(
  dataset_key: string,
  periods: number = 6
): Promise<ForecastResult> {
  return post<ForecastResult>("/api/forecast", { dataset_key, periods });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export async function generateReport(
  analysis_history: AnalysisHistoryEntry[],
  dataset_name: string,
  user_name: string,
  report_title?: string,
  report_intro?: string,
  theme?: string,
  brand_logo_b64?: string,
  brand_color?: string
): Promise<{ pdf_b64: string }> {
  return post<{ pdf_b64: string }>("/api/report", {
    analysis_history,
    dataset_name,
    user_name,
    report_title,
    report_intro,
    theme,
    brand_logo_b64,
    brand_color,
  });
}

// ---------------------------------------------------------------------------
// Pinned Insights (Live Dashboard)
// ---------------------------------------------------------------------------

export async function pinInsight(data: {
  dataset_key: string;
  filename: string;
  query: string;
  chart_spec: any;
  narration?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  const { data: result, error } = await supabase
    .from("pinned_insights")
    .insert({
      ...data,
      user_id: user.id
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function unpinInsight(id: string) {
  const { error } = await supabase
    .from("pinned_insights")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function listPinnedInsights() {
  const { data, error } = await supabase
    .from("pinned_insights")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}


export async function inspectData(dataset_key: string): Promise<any> {
  return post("/api/wrangle", { dataset_key, action: "inspect" });
}

export async function cleanData(dataset_key: string): Promise<any> {
  return post("/api/wrangle", { dataset_key, action: "clean" });
}

export async function searchDataset(
  dataset_key: string, 
  query: string, 
  page: number = 1, 
  page_size: number = 20,
  filters: Record<string, string> = {}
): Promise<{ results: any[], total_matches: number, total_pages: number, page: number }> {
  return post("/api/search", { dataset_key, query, page, page_size, filters });
}


export async function createAlert(alert: any) {
  const { data, error } = await supabase.from("alerts").insert([alert]).select();
  if (error) throw error;
  return data[0];
}

export async function listAlerts() {
  const { data, error } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteAlert(id: string) {
  const { error } = await supabase.from("alerts").delete().eq("id", id);
  if (error) throw error;
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
