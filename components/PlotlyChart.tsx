/**
 * PlotlyChart — renders a Plotly JSON figure spec returned from the API.
 * Uses dynamic import to avoid SSR issues with plotly.js.
 */
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="h-80 flex items-center justify-center text-[#64748B] text-sm">
      Loading chart…
    </div>
  ),
});

interface Props {
  spec: object;
  height?: number;
}

export default function PlotlyChart({ spec, height = 420 }: Props) {
  const figure = spec as {
    data?: Plotly.Data[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
  };

  const layout: Partial<Plotly.Layout> = {
    font: {
      color: "#E2E8F0",
      family: "Manrope, Segoe UI, sans-serif",
    },
    xaxis: {
      gridcolor: "rgba(148,163,184,0.12)",
      linecolor: "rgba(148,163,184,0.25)",
      ...(figure.layout?.xaxis ?? {}),
    },
    yaxis: {
      gridcolor: "rgba(148,163,184,0.12)",
      linecolor: "rgba(148,163,184,0.25)",
      ...(figure.layout?.yaxis ?? {}),
    },
    height,
    autosize: true,
    margin: { l: 60, r: 20, t: 50, b: 60 },
    legend: { font: { color: "#94A3B8" } },
    ...figure.layout,
    // Always force transparent background
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
  };

  return (
    <Plot
      data={figure.data ?? []}
      layout={layout}
      config={{
        displayModeBar: true,
        modeBarButtonsToRemove: ["toImage", "sendDataToCloud"],
        responsive: true,
        ...figure.config,
      }}
      style={{ width: "100%", height: `${height}px` }}
      useResizeHandler
    />
  );
}
