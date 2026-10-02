export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export function BarChart({ data, height = 160 }: { data: BarDatum[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="barchart" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}>
      {data.map((d) => (
        <div key={d.label} className="barchart-column">
          <div className="barchart-track" style={{ height }}>
            <div
              className="barchart-fill"
              style={{ height: `${(d.value / max) * 100}%`, background: d.color ?? 'var(--color-primary)' }}
            />
          </div>
          <span className="barchart-value">{d.value}</span>
          <span className="barchart-label" title={d.label}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}
