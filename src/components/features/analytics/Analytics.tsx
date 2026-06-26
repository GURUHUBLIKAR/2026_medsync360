import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Activity,
  CheckCircle2,
  Clock,
  Timer,
  XCircle,
  ArrowRightLeft,
  RefreshCw,
  BarChart3,
  Trophy,
  Share2,
  Pill,
  GitBranch,
  CalendarRange,
} from 'lucide-react';
import { subDays, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { Button } from '../../ui/Button';
import { cn } from '../../../lib/utils';
import { useReferralAnalytics, type AnalyticsFilters } from '../../../hooks/useReferralAnalytics';
import { useDeclineReasonStats, useDutyAnalytics } from '../../../hooks/useOpsAnalytics';
import { ChartCard, KpiCard, BarList, DonutChart, TrendArea, LeaderboardList } from './charts';

type RangeKey = '7d' | '30d' | '90d' | '12m' | 'month';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: '12m', label: 'Last 12 months' },
  { key: 'month', label: 'This month' },
];

const URGENCY_COLORS: Record<string, string> = {
  Emergency: '#dc2626',
  Urgent: '#d97706',
  Normal: '#16a34a',
  Elective: '#0284c7',
};

const STATUS_COLORS: Record<string, string> = {
  Open: '#16a34a',
  Closed: '#475569',
  Transferred: '#d97706',
  Cancelled: '#dc2626',
};

function rangeToDates(key: RangeKey): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = endOfDay(now);
  switch (key) {
    case '7d':
      return { startDate: startOfDay(subDays(now, 6)), endDate };
    case '30d':
      return { startDate: startOfDay(subDays(now, 29)), endDate };
    case '90d':
      return { startDate: startOfDay(subDays(now, 89)), endDate };
    case '12m':
      return { startDate: startOfDay(subDays(now, 364)), endDate };
    case 'month':
      return { startDate: startOfMonth(now), endDate };
  }
}

function fmtDuration(min: number | null): string {
  if (min == null) return '—';
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return hr ? `${d}d ${hr}h` : `${d}d`;
}

const Analytics: React.FC = () => {
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d');
  const [department, setDepartment] = useState<string>('all');

  const { startDate, endDate } = useMemo(() => rangeToDates(rangeKey), [rangeKey]);

  const filters: AnalyticsFilters = useMemo(
    () => ({ startDate, endDate, department }),
    [startDate, endDate, department]
  );

  const { analytics, departments, isLoading, refetch, isRefetching } =
    useReferralAnalytics(filters);

  const { data: declineReasons = [] } = useDeclineReasonStats(startDate, endDate);
  const { data: duty } = useDutyAnalytics(startDate, endDate, department);

  const leaderboardData = analytics.leaderboard.map((d) => ({
    name: d.name,
    value: d.count,
    meta: `avg acknowledge ${fmtDuration(d.avgAckMinutes)}`,
  }));

  const urgencyData = analytics.byUrgency.map((u) => ({
    ...u,
    color: URGENCY_COLORS[u.label] || '#16a34a',
  }));
  const statusData = analytics.byStatus.map((s) => ({
    ...s,
    color: STATUS_COLORS[s.label] || '#16a34a',
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary-600" />
            Analytics
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Referral performance across your departments and team.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value as RangeKey)}
            className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Date range"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>

          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-[200px]"
            aria-label="Department"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            aria-label="Refresh analytics"
          >
            <RefreshCw className={cn('w-4 h-4 mr-1', isRefetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <AnalyticsSkeleton />
      ) : analytics.total === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <BarChart3 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-neutral-900">No referrals in this period</h3>
          <p className="text-sm text-neutral-500 mt-1">
            Try widening the date range or selecting a different department.
          </p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            <KpiCard
              label="Total Referrals"
              value={String(analytics.total)}
              deltaPct={analytics.totalDeltaPct}
              hint="vs prev. period"
              icon={<FileText className="w-4 h-4" />}
            />
            <KpiCard
              label="Open / Active"
              value={String(analytics.open)}
              hint="currently in progress"
              icon={<Activity className="w-4 h-4" />}
            />
            <KpiCard
              label="Closed"
              value={String(analytics.closed)}
              hint="completed referrals"
              icon={<CheckCircle2 className="w-4 h-4" />}
            />
            <KpiCard
              label="Avg. Acknowledge"
              value={fmtDuration(analytics.avgAckMinutes)}
              hint="created → accepted"
              icon={<Clock className="w-4 h-4" />}
            />
            <KpiCard
              label="Avg. Close Time"
              value={fmtDuration(analytics.avgCloseMinutes)}
              hint="created → closed"
              icon={<Timer className="w-4 h-4" />}
            />
            <KpiCard
              label="Decline / Cancel Rate"
              value={`${analytics.declineRate.toFixed(0)}%`}
              hint={`${analytics.cancelled} cancelled`}
              icon={<XCircle className="w-4 h-4" />}
            />
            <KpiCard
              label="Transfer Rate"
              value={`${analytics.transferRate.toFixed(0)}%`}
              hint={`${analytics.transferred} transferred`}
              icon={<ArrowRightLeft className="w-4 h-4" />}
            />
          </div>

          {/* Trend (full width) */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <ChartCard
              title="Referral Volume"
              subtitle="New referrals created over time"
            >
              <TrendArea data={analytics.volume} />
            </ChartCard>
          </motion.div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <ChartCard title="By Urgency" subtitle="Distribution of referral priority">
              <DonutChart data={urgencyData} centerLabel="Referrals" />
            </ChartCard>

            <ChartCard title="By Status" subtitle="Where referrals stand">
              <BarList data={statusData} />
            </ChartCard>

            <ChartCard
              title="By Department"
              subtitle="Referrals received per department"
              className="lg:col-span-2"
            >
              <BarList data={analytics.byDepartment} emptyText="No departments" />
            </ChartCard>
          </div>

          {/* Operational insights */}
          <div>
            <h2 className="text-base md:text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary-600" />
              Operational Insights
            </h2>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
              <KpiCard
                label="Multi-hop Referrals"
                value={String(analytics.multiHopCount)}
                hint={`${analytics.total ? Math.round((analytics.multiHopCount / analytics.total) * 100) : 0}% arrived via transfer`}
                icon={<Share2 className="w-4 h-4" />}
              />
              <KpiCard
                label="Longest Transfer Chain"
                value={`${analytics.longestChain} ${analytics.longestChain === 1 ? 'hop' : 'hops'}`}
                hint="deepest lineage"
                icon={<ArrowRightLeft className="w-4 h-4" />}
              />
              <KpiCard
                label="Avg. Medication Changes"
                value={analytics.avgMedChanges == null ? '—' : analytics.avgMedChanges.toFixed(1)}
                hint="updates per referral"
                icon={<Pill className="w-4 h-4" />}
              />
              <KpiCard
                label="Duty Shifts"
                value={String(duty?.totalShifts ?? 0)}
                hint="in selected period"
                icon={<CalendarRange className="w-4 h-4" />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <ChartCard
                title="Top Receiving Doctors"
                subtitle="Most referrals handled, with average acknowledge time"
                action={<Trophy className="w-4 h-4 text-warning-500" />}
              >
                <LeaderboardList data={leaderboardData} valueSuffix="" emptyText="No doctors" />
              </ChartCard>

              <ChartCard
                title="Cross-Department Flow"
                subtitle="Most common origin → destination paths"
              >
                <BarList data={analytics.departmentFlow} emptyText="No cross-department referrals" />
              </ChartCard>

              <ChartCard
                title="Decline / Cancel Reasons"
                subtitle="Why referrals were declined"
              >
                <BarList
                  data={declineReasons.map((d) => ({ ...d, color: '#dc2626' }))}
                  emptyText="No decline reasons recorded"
                />
              </ChartCard>

              <ChartCard
                title="Final Diagnosis Categories"
                subtitle="Outcomes recorded on closed referrals"
              >
                <BarList data={analytics.finalDiagnosis} emptyText="No diagnoses recorded yet" />
              </ChartCard>
            </div>
          </div>

          {/* Workforce & duty */}
          <div>
            <h2 className="text-base md:text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-primary-600" />
              Workforce &amp; Duty
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <ChartCard title="Shifts by Department" subtitle="Duty coverage per department">
                <BarList data={duty?.byDepartment ?? []} emptyText="No shifts in this period" />
              </ChartCard>
              <ChartCard title="Shifts per Doctor" subtitle="Workload distribution">
                <LeaderboardList
                  data={(duty?.byDoctor ?? []).map((d) => ({ name: d.label, value: d.value }))}
                  valueSuffix=" shifts"
                  emptyText="No shifts in this period"
                />
              </ChartCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const AnalyticsSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 bg-neutral-200 rounded-xl" />
      ))}
    </div>
    <div className="h-64 bg-neutral-200 rounded-xl" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-56 bg-neutral-200 rounded-xl" />
      <div className="h-56 bg-neutral-200 rounded-xl" />
    </div>
  </div>
);

export default React.memo(Analytics);
export { Analytics };
