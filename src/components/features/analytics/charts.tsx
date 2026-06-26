import React from 'react';
import { format, parseISO } from 'date-fns';
import { cn } from '../../../lib/utils';

// ---------------------------------------------------------------------------
// Shared card wrapper (white surface — global CSS adds the soft shadow).
// ---------------------------------------------------------------------------
export const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, action, className, children }) => (
  <div className={cn('bg-white rounded-xl border border-neutral-200 p-4 md:p-5', className)}>
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm md:text-base font-semibold text-neutral-900">{title}</h3>
        {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
export const KpiCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  deltaPct?: number | null;
  icon?: React.ReactNode;
}> = ({ label, value, hint, deltaPct, icon }) => {
  const showDelta = deltaPct !== null && deltaPct !== undefined && Number.isFinite(deltaPct);
  const up = (deltaPct || 0) >= 0;
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs md:text-sm font-medium text-neutral-600">{label}</p>
        {icon && (
          <span className="text-primary-600 bg-primary-50 rounded-lg p-1.5">{icon}</span>
        )}
      </div>
      <p className="mt-2 text-2xl md:text-3xl font-bold text-neutral-900 leading-none">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {showDelta && (
          <span
            className={cn(
              'inline-flex items-center text-xs font-semibold rounded-full px-2 py-0.5',
              up ? 'text-success-700 bg-success-50' : 'text-error-700 bg-error-50'
            )}
          >
            {up ? '▲' : '▼'} {Math.abs(deltaPct as number).toFixed(0)}%
          </span>
        )}
        {hint && <span className="text-xs text-neutral-500">{hint}</span>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Horizontal bar list (departments, status, etc.)
// ---------------------------------------------------------------------------
export const BarList: React.FC<{
  data: { label: string; value: number; color?: string }[];
  emptyText?: string;
}> = ({ data, emptyText = 'No data' }) => {
  if (data.length === 0) return <EmptyHint text={emptyText} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-neutral-700 truncate pr-2" title={d.label}>{d.label}</span>
            <span className="font-semibold text-neutral-900 tabular-nums">{d.value}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color || 'linear-gradient(to right,#4ade80,#16a34a)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Ranked leaderboard list (doctors, etc.)
// ---------------------------------------------------------------------------
export const LeaderboardList: React.FC<{
  data: { name: string; value: number; meta?: string }[];
  valueSuffix?: string;
  emptyText?: string;
}> = ({ data, valueSuffix = '', emptyText = 'No data' }) => {
  if (data.length === 0) return <EmptyHint text={emptyText} />;
  return (
    <div className="space-y-1">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-3 py-1.5">
          <span
            className={cn(
              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold',
              i === 0
                ? 'bg-primary-100 text-primary-700'
                : 'bg-neutral-100 text-neutral-500'
            )}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-neutral-800 truncate" title={d.name}>{d.name}</p>
            {d.meta && <p className="text-xs text-neutral-500">{d.meta}</p>}
          </div>
          <span className="text-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
            {d.value}{valueSuffix}
          </span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Donut chart (urgency / status split)
// ---------------------------------------------------------------------------
export const DonutChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  centerLabel?: string;
  emptyText?: string;
}> = ({ data, centerLabel = 'Total', emptyText = 'No data' }) => {
  const total = data.reduce((a, b) => a + b.value, 0);
  if (total === 0) return <EmptyHint text={emptyText} />;

  const size = 160;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f4" strokeWidth={stroke} />
          {data.map((d) => {
            const len = (d.value / total) * c;
            const seg = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-neutral-900 leading-none">{total}</span>
          <span className="text-xs text-neutral-500 mt-0.5">{centerLabel}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2 w-full">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-neutral-700">
              <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
              {d.label}
            </span>
            <span className="text-neutral-500">
              <span className="font-semibold text-neutral-900">{d.value}</span>{' '}
              ({Math.round((d.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Trend area chart (referral volume over time)
// ---------------------------------------------------------------------------
export const TrendArea: React.FC<{
  data: { date: string; count: number }[];
  height?: number;
  emptyText?: string;
}> = ({ data, height = 200, emptyText = 'No data' }) => {
  if (data.length === 0 || data.every((d) => d.count === 0)) return <EmptyHint text={emptyText} />;

  const W = 600;
  const H = 200;
  const padTop = 12;
  const padBottom = 24;
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const n = data.length;

  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => padTop + (1 - v / maxCount) * (H - padTop - padBottom);

  const linePts = data.map((d, i) => `${x(i)},${y(d.count)}`).join(' ');
  const areaPts = `0,${H - padBottom} ${linePts} ${W},${H - padBottom}`;

  // ~6 evenly spaced x-axis labels.
  const labelIdxs: number[] = [];
  const step = Math.max(1, Math.floor(n / 6));
  for (let i = 0; i < n; i += step) labelIdxs.push(i);
  if (labelIdxs[labelIdxs.length - 1] !== n - 1) labelIdxs.push(n - 1);

  return (
    <div className="w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {/* horizontal gridlines */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={0}
            x2={W}
            y1={padTop + g * (H - padTop - padBottom)}
            y2={padTop + g * (H - padTop - padBottom)}
            stroke="#eef2f0"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polygon points={areaPts} fill="url(#trendFill)" />
        <polyline
          points={linePts}
          fill="none"
          stroke="#16a34a"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative mt-1 h-4">
        {labelIdxs.map((i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 text-[10px] text-neutral-400 whitespace-nowrap"
            style={{ left: `${(x(i) / W) * 100}%` }}
          >
            {safeDayLabel(data[i].date)}
          </span>
        ))}
      </div>
    </div>
  );
};

function safeDayLabel(d: string): string {
  try {
    return format(parseISO(d), 'MMM d');
  } catch {
    return d;
  }
}

const EmptyHint: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center justify-center py-10 text-sm text-neutral-400">{text}</div>
);
