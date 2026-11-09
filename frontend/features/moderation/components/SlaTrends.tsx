'use client';

import { useState } from 'react';
import { AntSelect } from '@/components/ui';
import { baseApi } from '@/store/api/baseApi';

export type SlaRow = {
  day: string;
  onTime: number;
  nearOverdue: number;
  breached: number;
  unknown: number;
};

const api = baseApi.injectEndpoints({
  endpoints: (build) => ({
    slaTrend: build.query<{ generatedAt: string; rows: SlaRow[] }, number>({
      query: (days) => ({ url: '/moderation/sla', params: { days } }),
      transformResponse: (r: { data: { generatedAt: string; rows: SlaRow[] } }) => r.data,
    }),
  }),
});

function getCubicBezierPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function SlaTrends() {
  const [days, setDays] = useState(7);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const query = api.useSlaTrendQuery(days, { pollingInterval: 3_600_000, refetchOnFocus: true });

  const rows = query.data?.rows ?? [];
  const totalOnTime = rows.reduce((acc, r) => acc + (r.onTime ?? 0), 0);
  const totalBreached = rows.reduce((acc, r) => acc + (r.breached ?? 0), 0);

  // Compute maximum value for Y scale
  const rawMax = Math.max(10, ...rows.map((r) => Math.max(r.onTime ?? 0, r.breached ?? 0)));
  const yMax = Math.ceil(rawMax * 1.15);

  // Chart dimensions inside SVG viewBox="0 0 800 240"
  const chartWidth = 800;
  const chartHeight = 240;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 45;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const bottomY = chartHeight - paddingBottom;

  const pointsOnTime = rows.map((r, i) => {
    const x = rows.length <= 1 ? paddingLeft + innerWidth / 2 : paddingLeft + (i / (rows.length - 1)) * innerWidth;
    const y = bottomY - ((r.onTime ?? 0) / yMax) * innerHeight;
    return { x, y, row: r };
  });

  const pointsBreached = rows.map((r, i) => {
    const x = rows.length <= 1 ? paddingLeft + innerWidth / 2 : paddingLeft + (i / (rows.length - 1)) * innerWidth;
    const y = bottomY - ((r.breached ?? 0) / yMax) * innerHeight;
    return { x, y, row: r };
  });

  const linePathOnTime = getCubicBezierPath(pointsOnTime);
  const areaPathOnTime =
    pointsOnTime.length > 0
      ? `${linePathOnTime} L ${pointsOnTime[pointsOnTime.length - 1].x} ${bottomY} L ${pointsOnTime[0].x} ${bottomY} Z`
      : '';

  const linePathBreached = getCubicBezierPath(pointsBreached);
  const areaPathBreached =
    pointsBreached.length > 0
      ? `${linePathBreached} L ${pointsBreached[pointsBreached.length - 1].x} ${bottomY} L ${pointsBreached[0].x} ${bottomY} Z`
      : '';

  // 5 grid lines (0, 25%, 50%, 75%, 100%)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = Math.round(ratio * yMax);
    const y = bottomY - ratio * innerHeight;
    return { value, y };
  });

  const dayOfWeekNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs transition-all">
      {/* Header with Title and Ant Design Dropdown */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block shadow-xs" />
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tiến độ xử lý đúng hạn</h2>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <AntSelect<number>
            aria-label="Khoảng thời gian thống kê"
            value={days}
            onChange={(val) => setDays(val)}
            options={[
              { value: 7, label: '7 ngày qua' },
              { value: 14, label: '14 ngày qua' },
              { value: 30, label: '30 ngày qua' },
            ]}
            className="w-36 font-medium"
            size="middle"
          />
        </div>
      </div>

      {/* Metrics Legend Row */}
      <div className="flex flex-wrap items-center gap-6 text-xs sm:text-sm font-semibold text-slate-700 mt-4 mb-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-blue-600 border border-white shadow-xs inline-block" />
          <span>Xử lý đúng hạn: {totalOnTime} phiếu</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-cyan-500 border border-white shadow-xs inline-block" />
          <span>Bị trễ hạn: {totalBreached} phiếu</span>
        </div>
      </div>

      {/* Chart Canvas */}
      {query.isLoading ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-400 font-medium">
          Đang tải biểu đồ xu hướng...
        </div>
      ) : query.isError ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-rose-600">
          <p>Không tải được dữ liệu tiến độ xử lý.</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            Thử lại
          </button>
        </div>
      ) : (
        <div className="relative mt-3 w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-64 sm:h-72 overflow-visible select-none"
            role="img"
            aria-label="Biểu đồ xu hướng SLA"
          >
            <defs>
              <linearGradient id="slaBlueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
              </linearGradient>
              <linearGradient id="slaCyanGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Horizontal Dashed Grid Lines & Y-axis Ticks */}
            {yTicks.map(({ value, y }) => (
              <g key={y}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[11px] font-medium"
                >
                  {value}
                </text>
              </g>
            ))}

            {/* Filled Areas */}
            {areaPathOnTime && <path d={areaPathOnTime} fill="url(#slaBlueGrad)" />}
            {areaPathBreached && <path d={areaPathBreached} fill="url(#slaCyanGrad)" />}

            {/* Spline Lines */}
            {linePathOnTime && (
              <path
                d={linePathOnTime}
                fill="none"
                stroke="#2563eb"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {linePathBreached && (
              <path
                d={linePathBreached}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Circular Markers & Interaction hitboxes for Breached (Cyan) */}
            {pointsBreached.map((p, idx) => (
              <circle
                key={`b-${idx}`}
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === idx ? 6.5 : 4.5}
                fill="#ffffff"
                stroke="#06b6d4"
                strokeWidth={hoveredIndex === idx ? 3.5 : 2.5}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
              />
            ))}

            {/* Circular Markers & Interaction hitboxes for On-time (Blue) */}
            {pointsOnTime.map((p, idx) => (
              <circle
                key={`o-${idx}`}
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === idx ? 7.5 : 5.5}
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth={hoveredIndex === idx ? 4 : 3}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
              />
            ))}

            {/* X-axis Labels */}
            {rows.map((r, i) => {
              const x = rows.length <= 1 ? paddingLeft + innerWidth / 2 : paddingLeft + (i / (rows.length - 1)) * innerWidth;
              const d = new Date(r.day);
              const dayName = isNaN(d.getTime()) ? r.day.slice(5) : dayOfWeekNames[d.getDay()];
              return (
                <text
                  key={r.day}
                  x={x}
                  y={chartHeight - 14}
                  textAnchor="middle"
                  className={`text-[12px] font-semibold transition-colors ${
                    hoveredIndex === i ? 'fill-blue-600 font-bold' : 'fill-slate-500'
                  }`}
                  onMouseEnter={() => setHoveredIndex(i)}
                >
                  {dayName}
                </text>
              );
            })}
          </svg>

          {/* Interactive Tooltip Card */}
          {hoveredIndex !== null && rows[hoveredIndex] && (
            <div
              className="pointer-events-none absolute top-2 right-4 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm text-xs font-medium text-slate-800"
              style={{ minWidth: 140 }}
            >
              <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 mb-1.5">
                Ngày {rows[hoveredIndex].day}
              </div>
              <div className="flex items-center justify-between gap-3 text-blue-600">
                <span>Đúng hạn:</span>
                <span className="font-bold">{rows[hoveredIndex].onTime}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-cyan-600">
                <span>Quá hạn:</span>
                <span className="font-bold">{rows[hoveredIndex].breached}</span>
              </div>
              {rows[hoveredIndex].nearOverdue > 0 && (
                <div className="flex items-center justify-between gap-3 text-amber-600">
                  <span>Gần hạn:</span>
                  <span className="font-bold">{rows[hoveredIndex].nearOverdue}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
