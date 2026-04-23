import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  MessageSquare, 
  TrendingUp, 
  FileText, 
  LogOut, 
  Database, 
  Upload, 
  ChevronRight,
  Info
} from "lucide-react";
import { listDatasets, loadDataset, uploadCsv, fileToBase64 } from "@/lib/api";
import type { DatasetPayload, User, DatasetInfo } from "@/lib/types";
import { supabase } from "@/lib/supabase";
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
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/");
        return;
      }
      
      setUser({
        id: session.user.id,
        username: session.user.email?.split("@")[0] || "User",
        display_name: session.user.user_metadata?.display_name || session.user.email || "User",
        role: "Pro Analyst",
        token: session.access_token
      });
    }

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/");
      }
    });

    return () => subscription.unsubscribe();
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

  async function handleSignOut() {
    await supabase.auth.signOut();
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

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Data Overview", icon: LayoutDashboard },
    { id: "analyst", label: "AI Analyst", icon: MessageSquare },
    { id: "forecast", label: "Forecasting", icon: TrendingUp },
    { id: "reports", label: "Reports", icon: FileText },
  ];

  return (
    <>
      <Head><title>Nexlytics | Dashboard</title></Head>
      <div className="min-h-screen flex flex-col bg-mesh">
        <header className="bg-white/[0.02] backdrop-blur-md border-b border-white/[0.08] px-6 py-4 flex items-center gap-4 sticky top-0 z-50">
          <motion.div 
            initial={{ rotate: -10, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            className="flex items-center gap-3"
          >
            <LogoMark size={32} />
            <span className="font-bold text-white text-xl tracking-tight">Nexlytics</span>
          </motion.div>
          <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/20 hidden sm:block">
            v2.0 PRO
          </span>
          <div className="ml-auto flex items-center gap-4">
            {user && (
              <div className="hidden md:flex flex-col items-end">
                <span className="text-white text-sm font-medium">{user.display_name}</span>
                <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider">{user.role}</span>
              </div>
            )}
            <button 
              onClick={handleSignOut} 
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-72 bg-white/[0.01] border-r border-white/[0.08] p-6 flex flex-col gap-6 overflow-y-auto shrink-0 hidden md:flex">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4">
                Data Management
              </p>
              <div className="flex p-1 bg-white/[0.05] rounded-xl mb-4">
                <button
                  onClick={() => setDataSource("preloaded")}
                  className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${
                    dataSource === "preloaded"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Samples
                </button>
                <button
                  onClick={() => setDataSource("upload")}
                  className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${
                    dataSource === "upload"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Upload
                </button>
              </div>

              {dataSource === "preloaded" ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Database className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <select
                      className="input text-sm pl-9"
                      value={selectedPreloaded}
                      onChange={(e) => setSelectedPreloaded(e.target.value)}
                    >
                      {availableDatasets.map((d) => (
                        <option key={d.key} value={d.key}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="btn-primary w-full text-sm py-3 flex items-center justify-center gap-2"
                    onClick={handleLoadPreloaded}
                    disabled={loadingDataset || !selectedPreloaded}
                  >
                    {loadingDataset ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Load Dataset <ChevronRight size={16} /></>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    className="btn-secondary w-full text-sm py-3 flex items-center justify-center gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loadingDataset}
                  >
                    {loadingDataset ? (
                      <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    ) : (
                      <><Upload size={16} /> Choose CSV file</>
                    )}
                  </button>
                </div>
              )}

              {datasetError && (
                <motion.p 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-rose-400 text-xs mt-3 flex items-center gap-1.5"
                >
                  <Info size={12} /> {datasetError}
                </motion.p>
              )}

              {datasetPayload && (
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-6 glass-card p-4 text-xs"
                >
                  <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active Dataset
                  </div>
                  <p className="text-white font-medium truncate mb-1">{datasetPayload.filename}</p>
                  <p className="text-slate-400">{datasetPayload.shape[0].toLocaleString()} rows • {datasetPayload.shape[1]} cols</p>
                </motion.div>
              )}
            </motion.div>

            {user && (
              <div className="mt-auto pt-6 border-t border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-500/20">
                    {(user.display_name[0] || "U").toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">{user.display_name}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{user.role}</p>
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

            <div className="flex gap-2 mb-8 bg-white/[0.03] p-1 rounded-2xl w-fit border border-white/[0.05]">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    activeTab === t.id 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                  onClick={() => setActiveTab(t.id)}
                >
                  <t.icon size={16} />
                  {t.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {!datasetPayload ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col items-center justify-center min-h-[60vh] text-center"
                >
                  <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/20">
                    <Database className="text-indigo-400" size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Ready to analyze?
                  </h3>
                  <p className="text-slate-400 max-w-md text-lg">
                    Upload a CSV or select a sample dataset from the sidebar to unlock automated insights and AI-powered analysis.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {activeTab === "overview" && <OverviewTab payload={datasetPayload} />}
                  {activeTab === "analyst" && (
                    <AIAnalyst payload={datasetPayload} user={user!} onSwitchToForecast={() => setActiveTab("forecast")} />
                  )}
                  {activeTab === "forecast" && <ForecastingTab payload={datasetPayload} />}
                  {activeTab === "reports" && <ReportsTab payload={datasetPayload} user={user} />}
                </motion.div>
              )}
            </AnimatePresence>
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
