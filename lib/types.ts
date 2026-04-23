// Shared TypeScript types for the Nexlytics Vercel app

export interface User {
  id: string;
  token: string;
  username: string;
  display_name: string;
  role: string;
}

export interface DatasetInfo {
  key: string;
  label: string;
}

export interface Schema {
  rows: number;
  columns: number;
  column_names: string[];
  numeric_columns: string[];
  categorical_columns: string[];
  datetime_columns: string[];
  examples: Record<string, string>;
}

export interface KPI {
  metric: string;
  total: number | string;
  average: number | string;
  max: number | string;
  min: number | string;
}

export interface DatasetPayload {
  csv_b64: string;
  schema: Schema;
  kpis: KPI[];
  insights: string[];
  preview_rows: Record<string, unknown>[];
  filename: string;
  shape: [number, number];
}

export interface AnalysisResult {
  query_type: string;
  summary: string;
  narration: string;
  result: Record<string, unknown>[];
  chart: object | null;
  chart_type: string | null;
}

export interface ForecastResult {
  available: boolean;
  message: string;
  metric?: string;
  trend?: string;
  slope?: number;
  std_error?: number;
  forecast?: Record<string, unknown>[];
  historical?: Record<string, unknown>[];
  chart?: object | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  result?: Record<string, unknown>[];
  chart?: object | null;
  query_type?: string;
  timestamp: number;
}

export interface AnalysisHistoryEntry {
  query: string;
  ai_response: string;
  insight: string;
  result: Record<string, unknown>[];
}
