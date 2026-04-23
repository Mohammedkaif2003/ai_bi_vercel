import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { listDatasets, loadDataset, uploadCsv, fileToBase64 } from "@/lib/api";
import type { DatasetPayload, User, DatasetInfo } from "@/lib/types";
import KPICards from "@/components/KPICards";
import AIAnalyst from "@/components/AIAnalyst";
import ForecastingTab from "@/components/Forecasting";
import ReportsTab from "@/components/Reports";
import LogoMark from "@/components/LogoMark";

type Tab = "overview" | "analyst" | "forecast" | "reports";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [availableDatasets, setAvailableDatasets] = useState<DatasetInfo[]>([]);
  const [dataSource, setDataSource] = useState<"upload" | "preloaded">("preloaded");
  const [datasetPayload, setDatasetPayload] = useState<DatasetPayload | null>(null);
  const [loadingDataset, setLoadingDataset] = useState(false);
  const [datasetError, setDatasetError] = useState("");
  const [selectedPreloaded, setSelectedPreloaded] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("nexlytics_user");
    const token = sessionStorage.getItem("nexlytics_token");
    if (!raw || !token) {
      router.replace("/");
      return;
    }
    try {
      setUser(JSON.parse(raw));
    } catch {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    listDatasets()
      .then((r) => {
        setAvailableDatasets(r.datasets);
        if (r.datasets.length > 0) setSelectedPreloaded(r.datasets[0].key);
      })
      .catch((err: unknown) => {
        setDatasetError(err instanceof Error ? err.message : "Failed to load dataset list.");
      });
  }, []);

  function handleSignOut() {
    sessionStorage.clear();
    router.replace("/");
  }

  async function handleLoadPreloaded() {
    if (!selectedPreloaded) return;
    setLoadingDataset(true);
    setDatasetError("");
    try {
      const payload = await loadDataset(selectedPreloaded);
      setDatasetPayload(payload);
    } catch (err: unknown) {
      setDatasetError(err instanceof Error ? err.message : "Failed to load dataset.");
    } finally {
      setLoadingDataset(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingDataset(true);
    setDatasetError("");
    try {
      const b64 = await fileToBase64(file);
      const payload = await uploadCsv(b64, file.name);
      setDatasetPayload(payload);
    } catch (err: unknown) {
      setDatasetError(err instanceof Error ? err.message : "Failed to upload file.");
    } finally {
      setLoadingDataset(false);
      e.target.value = "";
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Data Overview" },
    { id: "analyst", label: "AI Analyst" },
    { id: "forecast", label: "Forecasting" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <>
      <Head><title>Nexlytics</title></Head>
      <div className="min-h-screen flex flex-col">
        <header className="bg-[#0B1120] border-b border-[#1E293B] px-5 py-3 flex items-center gap-4">
          <LogoMark size={28} />
          <span className="font-bold text-white text-lg">Nexlytics</span>
          <span className="text-[#475569] text-sm hidden sm:block">v2.0</span>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="text-[#94A3B8] text-sm hidden md:block">
                {user.display_name}
              </span>
            )}
            <button onClick={handleSignOut} className="btn-secondary text-sm py-1.5 px-3">
              Sign Out
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 bg-[#0B1120] border-r border-[#1E293B] p-4 flex flex-col gap-4 overflow-y-auto shrink-0 hidden md:flex">
            <div>
              <p className="text-xs font-semibold text-[#475569] uppercase tracking-widest mb-3">
                Data Source
              </p>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setDataSource("preloaded")}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                    dataSource === "preloaded"
                      ? "bg-[#4F46E5] text-white"
                      : "bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155]"
                  }`}
                >
                  Sample
                </button>
                <button
                  onClick={() => setDataSource("upload")}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                    dataSource === "upload"
                      ? "bg-[#4F46E5] text-white"
                      : "bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155]"
                  }`}
                >
                  Upload CSV
                </button>
              </div>

              {dataSource === "preloaded" ? (
                <div className="space-y-2">
                  <select
                    className="input text-sm"
                    value={selectedPreloaded}
                    onChange={(e) => setSelectedPreloaded(e.target.value)}
                  >
                    {availableDatasets.map((d) => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                  <button
                    className="btn-primary w-full text-sm py-2"
                    onClick={handleLoadPreloaded}
                    disabled={loadingDataset || !selectedPreloaded}
                  >
                    {loadingDataset ? "Loading..." : "Load Dataset"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    className="btn-secondary w-full text-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loadingDataset}
                  >
                    {loadingDataset ? "Uploading..." : "Choose CSV file"}
                  </button>
                </div>
              )}

              {datasetError && (
                <p className="text-[#EF4444] text-xs mt-2">{datasetError}</p>
              )}

              {datasetPayload && (
                <div className="mt-3 bg-[#1E293B] rounded-lg p-2.5 text-xs text-[#94A3B8]">
                  <p className="text-[#10B981] font-medium mb-1">Loaded: {datasetPayload.filename}</p>
                  <p>{datasetPayload.shape[0].toLocaleString()} rows x {datasetPayload.shape[1]} cols</p>
                </div>
              )}
            </div>

            {user && (
              <div className="mt-auto border-t border-[#1E293B] pt-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(user.display_name[0] || "U").toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{user.display_name}</p>
                    <p className="text-xs text-[#64748B] capitalize">{user.role}</p>
                  </div>
                </div>
              </div>
            )}
          </aside>

          <main className="flex-1 overflow-y-auto p-5">
            {datasetPayload && (
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">{datasetPayload.filename}</h2>
                <span className="text-[#64748B] text-sm">
                  {datasetPayload.shape[0].toLocaleString()} rows, {datasetPayload.shape[1]} columns
                </span>
              </div>
            )}

            <div className="flex gap-2 mb-5 flex-wrap">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`tab-button ${activeTab === t.id ? "active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {!datasetPayload ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <div className="text-5xl mb-4 font-bold text-[#818CF8]">BI</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Analyze your data instantly
                </h3>
                <p className="text-[#64748B] max-w-sm">
                  Upload a CSV or select a sample dataset from the sidebar to start exploring insights.
                </p>
              </div>
            ) : (
              <>
                {activeTab === "overview" && <OverviewTab payload={datasetPayload} />}
                {activeTab === "analyst" && (
                  <AIAnalyst payload={datasetPayload} onSwitchToForecast={() => setActiveTab("forecast")} />
                )}
                {activeTab === "forecast" && <ForecastingTab payload={datasetPayload} />}
                {activeTab === "reports" && <ReportsTab payload={datasetPayload} user={user} />}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

function OverviewTab({ payload }: { payload: DatasetPayload }) {
  const [showAll, setShowAll] = useState(false);
  const { schema, kpis, insights, preview_rows: previewRows = [] } = payload;
  const displayedInsights = showAll ? insights : insights.slice(0, 4);

  return (
    <div className="space-y-5">
      <KPICards kpis={kpis} />

      {insights.length > 0 && (
        <section className="card">
          <h3 className="section-title">Auto Insights</h3>
          <ul className="space-y-1.5">
            {displayedInsights.map((ins, i) => (
              <li key={i} className="text-sm text-[#CBD5E1] flex gap-2">
                <span className="text-[#4F46E5] mt-0.5">•</span>
                <span>{ins}</span>
              </li>
            ))}
          </ul>
          {insights.length > 4 && (
            <button
              className="text-xs text-[#818CF8] mt-2 hover:underline"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show less" : `Show ${insights.length - 4} more...`}
            </button>
          )}
        </section>
      )}

      <section className="card">
        <h3 className="section-title">Dataset Schema</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Rows", value: schema.rows.toLocaleString() },
            { label: "Columns", value: schema.columns },
            { label: "Numeric", value: schema.numeric_columns.length },
            { label: "Categorical", value: schema.categorical_columns.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#0F172A] rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-[#64748B] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {schema.column_names.map((col) => (
            <span
              key={col}
              className="text-xs bg-[#1E293B] border border-[#334155] text-[#94A3B8] px-2 py-0.5 rounded"
            >
              {col}
            </span>
          ))}
        </div>
      </section>

      {previewRows.length > 0 && (
        <section className="card overflow-hidden">
          <h3 className="section-title">Data Preview (first 20 rows)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#334155]">
                  {schema.column_names.map((col) => (
                    <th key={col} className="text-left py-2 px-3 text-[#64748B] font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr key={ri} className="border-b border-[#1E293B] hover:bg-[#1E293B]/50 transition-colors">
                    {schema.column_names.map((col) => (
                      <td key={col} className="py-1.5 px-3 text-[#CBD5E1] whitespace-nowrap">
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
