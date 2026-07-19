import React from 'react';

interface RadarData {
  key: string;
  name: string;
  score: number;
}

interface RadarChartProps {
  data: RadarData[];
  size?: number;
  maxScore?: number;
}

const LABEL_OFFSET = 22;

const RadarChart: React.FC<RadarChartProps> = ({ data, size = 240, maxScore = 100 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const slices = data.length;
  const angleStep = (2 * Math.PI) / slices;

  // Start from top (12 o'clock) — offset by -PI/2
  const getPoint = (index: number, r: number) => {
    const angle = angleStep * index - Math.PI / 2;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // Grid levels (20%, 40%, 60%, 80%, 100%)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Build the data polygon points
  const dataPoints = data.map((d, i) => {
    const r = (d.score / maxScore) * radius;
    return getPoint(i, r);
  });

  // Build the full outline (including closing back to first)
  const dataPath = dataPoints.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radar-chart">
      {/* Grid rings */}
      {gridLevels.map((level) => {
        const r = radius * level;
        const pts = data.map((_, i) => getPoint(i, r));
        const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x},${p.y}`).join(' ') + 'Z';
        return (
          <path
            key={level}
            d={path}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={1}
          />
        );
      })}

      {/* Axis lines */}
      {data.map((_, i) => {
        const p = getPoint(i, radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#E5E7EB"
            strokeWidth={1}
          />
        );
      })}

      {/* Data area */}
      <path
        d={dataPath}
        fill="rgba(70, 209, 178, 0.25)"
        stroke="#46D1B2"
        strokeWidth={2}
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#1FA576" stroke="white" strokeWidth={2} />
      ))}

      {/* Labels */}
      {data.map((d, i) => {
        const p = getPoint(i, radius + LABEL_OFFSET);
        // Estimate text width — simple centering
        const textAnchor = p.x < cx ? 'end' : p.x > cx ? 'start' : 'middle';
        const dominantBaseline = p.y < cy ? 'hanging' : p.y > cy ? 'auto' : 'central';
        return (
          <text
            key={d.key}
            x={p.x}
            y={p.y}
            textAnchor={textAnchor}
            dominantBaseline={dominantBaseline}
            fontSize={12}
            fill="#4B5563"
            fontWeight={500}
          >
            {d.name}
          </text>
        );
      })}

      {/* Center score */}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={13} fill="#1FA576" fontWeight="bold">
        六维能力
      </text>
    </svg>
  );
};

export default RadarChart;
