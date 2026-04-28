/**
 * PlotlyChart — renders a Plotly JSON figure spec returned from the API.
 * Uses dynamic import to avoid SSR issues with plotly.js.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    // If IntersectionObserver isn't available, load immediately.
    if (typeof window === "undefined" || !('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    const el = containerRef.current;
    if (!el) {
      setInView(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        });
      },
      { rootMargin: '200px', threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const figure = spec as {
    data?: any[];
    layout?: any;
    config?: Partial<Plotly.Config>;
  };

  // Enhance the figure data with better colors if none are provided
  const enhancedData = (figure.data ?? []).map((trace: any, i: number) => {
    const semanticColors = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
    const color = semanticColors[i % semanticColors.length];
    
    // If it's a bar chart, add some styling
    if (trace.type === 'bar') {
      return {
        ...trace,
        marker: {
          color: trace.marker?.color || color,
          line: { color: 'rgba(255,255,255,0.1)', width: 1 }
        },
        hoverlabel: { bgcolor: '#1E293B', font: { color: 'white' } }
      };
    }
    
    // If it's a line chart, make it smooth
    if (trace.type === 'scatter' || trace.type === 'scattergl') {
      return {
        ...trace,
        line: { 
          shape: 'spline', 
          width: 3, 
          color: trace.line?.color || color 
        },
        marker: { 
          size: 8, 
          color: trace.marker?.color || color,
          line: { color: '#0F172A', width: 2 }
        }
      };
    }
    
    return trace;
  });

  const layout: Partial<Plotly.Layout> = {
    font: {
      color: "#E2E8F0",
      family: "Inter, system-ui, sans-serif",
    },
    xaxis: {
      gridcolor: "rgba(148,163,184,0.05)",
      linecolor: "rgba(148,163,184,0.1)",
      tickfont: { size: 11, color: "#94A3B8" },
      automargin: true,
      ...(figure.layout?.xaxis ?? {}),
    },
    yaxis: {
      gridcolor: "rgba(148,163,184,0.05)",
      linecolor: "rgba(148,163,184,0.1)",
      tickfont: { size: 11, color: "#94A3B8" },
      automargin: true,
      ...(figure.layout?.yaxis ?? {}),
    },
    height,
    autosize: true,
    margin: { l: 50, r: 20, t: 40, b: 50 },
    legend: { 
      font: { color: "#94A3B8", size: 11 },
      orientation: 'h',
      y: -0.2,
      x: 0.5,
      xanchor: 'center'
    },
    hovermode: 'closest',
    ...figure.layout,
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
  };

  return (
    <div className="relative group/chart" ref={containerRef}>
      {!inView ? (
        <div className="h-80 flex items-center justify-center text-[#64748B] text-sm">
          Loading chart…
        </div>
      ) : (
        <Plot
          data={enhancedData}
          layout={layout}
          config={{
            displayModeBar: false,
            responsive: true,
            ...figure.config,
          }}
          style={{ width: "100%", height: `${height}px` }}
          useResizeHandler
        />
      )}
    </div>
  );
}
