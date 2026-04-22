import { useState } from "react";
import type { DatasetPayload, ForecastResult } from "@/lib/types";
import { forecast } from "@/lib/api";
import PlotlyChart from "./PlotlyChart";

interface Props {
  payload: DatasetPayload;
}

export default function ForecastingTab({ payload }: Props) {
  const [periods, setPeriods] = useState(6);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleForecast() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await forecast(payload.csv_b64, periods);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Forecasting failed.");
    } finally {
      setLoading(false);
    }
  }

  const trendColor = (trend?: string) => {
    if (trend === "increasing") return "text-[#10B981]";
    if (trend === "declining")  return "text-[#EF4444]";
    return "text-[#F59E0B]";
  };

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm text-[#94A3B8] mb-1">
            Forecast periods (months)
          </label>
          <input
            type="number"
            min={1}
            max={24}
            value={periods}
            onChange={(e) => setPeriods(Number(e.target.value))}
            className="input w-32"
          />
        </div>
        <button
          className="btn-primary"
          onClick={handleForecast}
          disabled={loading}
        >
          {loading ? "Generating…" : "🔮 Generate Forecast"}
        </button>
      </div>

      {error && (
        <div className="card border border-[#7f1d1d] bg-[#450a0a] text-[#FCA5A5] text-sm">
          {error}
        </div>
      )}

      {result && !result.available && (
        <div className="card border border-[#7c5200] bg-[#431407] text-[#FDE68A] text-sm">
          ⚠️ {result.message}
        </div>
      )}

      {result?.available && (
        <>
          {/* Trend summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Metric", value: result.metric ?? "—" },
              {
                label: "Trend",
                value: result.trend ? result.trend.charAt(0).toUpperCase() + result.trend.slice(1) : "—",
                cls: trendColor(result.trend),
              },
              { label: "Monthly Slope", value: result.slope != null ? result.slope.toLocaleString() : "—" },
              { label: "Std Error", value: result.std_error != null ? result.std_error.toLocaleString() : "—" },
            ].map((stat) => (
              <div key={stat.label} className="card text-center">
                <p className={`text-lg font-bold ${stat.cls ?? "text-white"}`}>{stat.value}</p>
                <p className="text-xs text-[#64748B] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          {result.chart && (
            <div className="card">
              <h3 className="section-title">Forecast Chart</h3>
              <PlotlyChart spec={result.chart} height={400} />
            </div>
          )}

          {/* Forecast table */}
          {result.forecast && result.forecast.length > 0 && (
            <div className="card overflow-hidden">
              <h3 className="section-title">Forecast Values</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#334155]">
                      {Object.keys(result.forecast[0]).map((col) => (
                        <th key={col} className="py-2 px-3 text-left text-[#64748B] font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.forecast.map((row, i) => (
                      <tr key={i} className="border-b border-[#1E293B] hover:bg-[#1E293B]/50">
                        {Object.entries(row).map(([k, v]) => (
                          <td key={k} className="py-2 px-3 text-[#CBD5E1]">
                            {typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
