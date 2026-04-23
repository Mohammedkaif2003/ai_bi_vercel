import { useState, useEffect } from "react";
import type { DatasetPayload, User, AnalysisHistoryEntry } from "@/lib/types";
import { generateReport } from "@/lib/api";

interface Props {
  payload: DatasetPayload;
  user: User | null;
}

export default function ReportsTab({ payload, user }: Props) {
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("apex_analysis_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  async function handleGenerateReport() {
    setLoading(true);
    setError("");
    try {
      const res = await generateReport(
        history,
        payload.filename,
        user?.display_name || "Apex Analytics User"
      );
      
      // Decode base64 and trigger download
      const binary = atob(res.pdf_b64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = "Apex_Analytics_Report.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <div className="text-4xl mb-4">📑</div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Your report is currently empty
        </h3>
        <p className="text-[#64748B] max-w-sm">
          Head over to the AI Analyst tab and ask a question to start building it.
        </p>
      </div>
    );
  }

  // Calculate stats
  const insightsCount = history.filter((h) => h.insight).length;
  // Note: For now, charts are not directly stored in the analysis history array
  // We mock the charts count to 0 or similar based on history.length
  const chartsCount = history.length;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-[#8fb4db] mb-1">
          Executive Reporting
        </p>
        <h2 className="text-2xl font-bold text-white mb-1">
          Package the analysis into a polished PDF
        </h2>
        <p className="text-[#a8bad8]">
          Bundle saved AI analyses, visuals, and insights into a report that feels presentation-ready.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="card text-center py-4">
          <p className="text-xs text-[#64748B] mb-1">Saved Analyses</p>
          <p className="text-2xl font-bold text-white">{history.length}</p>
          <p className="text-[10px] text-[#475569] mt-1">Sections ready for export</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs text-[#64748B] mb-1">AI Insights</p>
          <p className="text-2xl font-bold text-white">{insightsCount}</p>
          <p className="text-[10px] text-[#475569] mt-1">Narrative findings collected</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs text-[#64748B] mb-1">Items Included</p>
          <p className="text-2xl font-bold text-white">{chartsCount}</p>
          <p className="text-[10px] text-[#475569] mt-1">Available for the brief</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 card">
          <h3 className="section-title">📋 Report Contents ({history.length} Analyses)</h3>
          <p className="text-xs text-[#64748B] mb-4">
            Each saved analysis will become its own section in the final PDF.
          </p>
          <div className="space-y-3">
            {history.map((entry, i) => (
              <div key={i} className="bg-[#0F172A] p-3 rounded border border-[#1E293B]">
                <p className="text-[10px] text-[#94A3B8] font-bold mb-1">
                  ANALYSIS #{i + 1}
                </p>
                <p className="text-sm text-[#E2E8F0] font-semibold">
                  "{entry.query}"
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 card flex flex-col">
          <h3 className="section-title">⚙️ Report Configuration</h3>
          
          <div className="space-y-4 mb-6 flex-1">
            <div>
              <p className="text-sm font-bold text-[#E2E8F0]">Document Type</p>
              <p className="text-xs text-[#94A3B8]">Narrative Executive Briefing</p>
            </div>
            
            <div>
              <p className="text-sm font-bold text-[#E2E8F0] mb-2">What's included</p>
              <ul className="text-xs text-[#94A3B8] space-y-1.5 list-disc pl-4">
                <li>Cover page with dataset & session details</li>
                <li>Executive summary written from AI replies</li>
                <li>Per-question sections in readable prose</li>
                <li>Supporting chart + compact reference table</li>
                <li>Page numbers, proper typography, disclaimer</li>
              </ul>
            </div>
          </div>

          {error && <p className="text-[#EF4444] text-xs mb-3">{error}</p>}

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="btn-primary w-full py-2.5"
          >
            {loading ? "Generating Report..." : "Generate Professional PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
