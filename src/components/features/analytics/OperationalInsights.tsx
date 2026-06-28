import React from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  Sankey,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  BarChart3, FileText, CheckCircle, Clock, RefreshCw, Repeat, AlertCircle, TrendingUp,
  Timer, XCircle, GitBranch, Activity, Stethoscope,
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { useReferralAnalytics, type ReferralAnalytics } from '../../../hooks/useReferralAnalytics';
import { useAuthStore } from '../../../store/authStore';

const STATUS_COLORS: Record<string, string> = {
  Closed: '#22c55e', Transferred: '#3b82f6', Cancelled: '#ef4444',
  Received: '#f59e0b', Acknowledged: '#a855f7', Accepted: '#06b6d4', Sent: '#64748b',
};
const URGENCY_COLORS: Record<string, string> = {
  Normal: '#3b82f6', Urgent: '#f59e0b', Emergency: '#ef4444', Elective: '#22c55e',
};
const INDIGO = '#6366f1';
const VIOLET = '#8b5cf6';
const AMBER = '#f59e0b';
const RED = '#ef4444';

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tint: string }> = ({ icon, label, value, sub, tint }) => (
  <Card padding="md" className="flex items-center gap-3">
    <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      <p className="text-xs text-gray-500 leading-tight">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{sub}</p>}
    </div>
  </Card>
);

const ChartCard: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, subtitle, icon, children, className }) => (
  <Card padding="lg" className={className}>
    <div className="mb-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>{title}
      </h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 ml-6">{subtitle}</p>}
    </div>
    {children}
  </Card>
);

// ---- Shared charts -------------------------------------------------------

const OverTimeChart: React.FC<{ data: ReferralAnalytics['over_time'] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
      <defs>
        <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={INDIGO} stopOpacity={0.35} /><stop offset="95%" stopColor={INDIGO} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="gClosed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
      <Tooltip /><Legend />
      <Area type="monotone" dataKey="count" name="Created" stroke={INDIGO} fill="url(#gTotal)" strokeWidth={2} />
      <Area type="monotone" dataKey="closed" name="Closed" stroke="#22c55e" fill="url(#gClosed)" strokeWidth={2} />
    </AreaChart>
  </ResponsiveContainer>
);

const StatusDonut: React.FC<{ data: ReferralAnalytics['by_status'] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <PieChart>
      <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
        {data.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status] || '#94a3b8'} />)}
      </Pie>
      <Tooltip /><Legend />
    </PieChart>
  </ResponsiveContainer>
);

const UrgencyPie: React.FC<{ data: ReferralAnalytics['by_urgency'] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <PieChart>
      <Pie data={data} dataKey="count" nameKey="urgency" cx="50%" cy="50%" outerRadius={95} label>
        {data.map((u) => <Cell key={u.urgency} fill={URGENCY_COLORS[u.urgency] || '#94a3b8'} />)}
      </Pie>
      <Tooltip /><Legend />
    </PieChart>
  </ResponsiveContainer>
);

const HBar: React.FC<{ data: any[]; xKey: string; barKey: string; name: string; color: string; height?: number; unit?: string }> = ({ data, xKey, barKey, name, color, height = 280, unit }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" unit={unit} />
      <YAxis type="category" dataKey={xKey} width={150} tick={{ fontSize: 11 }} stroke="#94a3b8" />
      <Tooltip cursor={{ fill: '#f8fafc' }} />
      <Bar dataKey={barKey} name={name} fill={color} radius={[0, 4, 4, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

// ---- Doctor (personal, lean) --------------------------------------------

const DoctorView: React.FC<{ data: ReferralAnalytics }> = ({ data }) => (
  <>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard icon={<FileText className="w-5 h-5 text-indigo-600" />} tint="bg-indigo-100" label="My referrals" value={data.totals.total} />
      <KpiCard icon={<CheckCircle className="w-5 h-5 text-green-600" />} tint="bg-green-100" label="Closed" value={data.totals.closed} />
      <KpiCard icon={<Clock className="w-5 h-5 text-amber-600" />} tint="bg-amber-100" label="Pending my action" value={data.totals.in_progress} />
      <KpiCard icon={<TrendingUp className="w-5 h-5 text-blue-600" />} tint="bg-blue-100" label="Avg days to close" value={data.avg_days_to_close ?? '—'} />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ChartCard title="My referrals over time" icon={<TrendingUp className="w-4 h-4" />}><OverTimeChart data={data.over_time} /></ChartCard>
      </div>
      <ChartCard title="By status" icon={<CheckCircle className="w-4 h-4" />}><StatusDonut data={data.by_status} /></ChartCard>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ChartCard title="By urgency" icon={<AlertCircle className="w-4 h-4" />}><UrgencyPie data={data.by_urgency} /></ChartCard>
    </div>
  </>
);

// ---- Superuser / Platform (operational) ---------------------------------

const DeptFlowChart: React.FC<{ data: ReferralAnalytics['dept_flow'] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={320}>
    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
      <YAxis type="category" dataKey="department" width={150} tick={{ fontSize: 11 }} stroke="#94a3b8" />
      <Tooltip cursor={{ fill: '#f8fafc' }} /><Legend />
      <Bar dataKey="received" name="Received (inbound)" stackId="a" fill={INDIGO} radius={[0, 0, 0, 0]} />
      <Bar dataKey="sent" name="Sent (outbound)" stackId="a" fill={VIOLET} radius={[0, 4, 4, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

const FlowSankey: React.FC<{ data: ReferralAnalytics['sankey'] }> = ({ data }) => {
  // Bipartite transform: separate "From:" and "To:" node spaces so the graph
  // can never form a cycle (a dept that is both a source and a target, or a
  // mutual A->B / B->A pair, would otherwise break recharts' Sankey).
  const names: string[] = [];
  const idx = (n: string) => {
    let i = names.indexOf(n);
    if (i < 0) { names.push(n); i = names.length - 1; }
    return i;
  };
  const links = data
    .slice(0, 14)
    .map((f) => ({ source: idx(`From: ${f.source}`), target: idx(`To: ${f.target}`), value: f.count }));
  const nodes = names.map((name) => ({ name }));
  if (links.length === 0) return <p className="text-sm text-gray-400 py-8 text-center">No inter-department flow yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(280, nodes.length * 26)}>
      <Sankey
        data={{ nodes, links }}
        nodePadding={24}
        nodeWidth={12}
        link={{ stroke: VIOLET, strokeOpacity: 0.25 }}
        node={{ fill: INDIGO }}
        margin={{ top: 10, right: 140, bottom: 10, left: 10 }}
      >
        <Tooltip />
      </Sankey>
    </ResponsiveContainer>
  );
};

const SuperuserView: React.FC<{ data: ReferralAnalytics }> = ({ data }) => (
  <>
    {/* Operational KPI strip */}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard icon={<FileText className="w-5 h-5 text-indigo-600" />} tint="bg-indigo-100" label="Total referrals" value={data.totals.total} />
      <KpiCard icon={<Timer className="w-5 h-5 text-blue-600" />} tint="bg-blue-100" label="Avg time to accept" value={data.avg_hours_to_accept != null ? `${data.avg_hours_to_accept}h` : '—'} sub="responsiveness" />
      <KpiCard icon={<TrendingUp className="w-5 h-5 text-green-600" />} tint="bg-green-100" label="Avg days to close" value={data.avg_days_to_close ?? '—'} sub="throughput" />
      <KpiCard icon={<XCircle className="w-5 h-5 text-red-600" />} tint="bg-red-100" label="Decline rate" value={`${data.decline_rate}%`} sub="referral quality" />
      <KpiCard icon={<Repeat className="w-5 h-5 text-purple-600" />} tint="bg-purple-100" label="Transfer rate" value={`${data.transfer_rate}%`} sub="triage accuracy" />
    </div>

    {/* Bottlenecks: where time is lost */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartCard title="Slowest to accept — by department" subtitle="Hours from referral to acceptance. High = staffing/roster bottleneck." icon={<Timer className="w-4 h-4" />}>
        <HBar data={data.accept_by_department} xKey="department" barKey="avg_hours" name="Avg hours to accept" color={AMBER} unit="h" />
      </ChartCard>
      <ChartCard title="Slowest end-to-end — by department" subtitle="Days from creation to closure. High = process review needed." icon={<Activity className="w-4 h-4" />}>
        <HBar data={data.lifecycle_by_department} xKey="department" barKey="avg_days" name="Avg days to close" color={INDIGO} unit="d" />
      </ChartCard>
    </div>

    {/* Throughput trend */}
    <ChartCard title="Throughput — created vs closed" subtitle="If 'Created' keeps outrunning 'Closed', the backlog is growing." icon={<TrendingUp className="w-4 h-4" />}>
      <OverTimeChart data={data.over_time} />
    </ChartCard>

    {/* Friction: declines + transfer hotspots */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartCard title="Why referrals are declined" subtitle="Actionable feedback to improve referral quality / triage." icon={<XCircle className="w-4 h-4" />}>
        {data.decline_reasons.length > 0
          ? <HBar data={data.decline_reasons} xKey="reason" barKey="count" name="Declines" color={RED} height={220} />
          : <p className="text-sm text-gray-400 py-8 text-center">No declines in this period.</p>}
      </ChartCard>
      <ChartCard title="Transfer hotspots" subtitle="Departments that most often transfer after receiving — possible mis-routing." icon={<GitBranch className="w-4 h-4" />}>
        {data.transfer_hotspots.length > 0
          ? <HBar data={data.transfer_hotspots} xKey="department" barKey="count" name="Transfers out" color={VIOLET} height={220} />
          : <p className="text-sm text-gray-400 py-8 text-center">No transfers in this period.</p>}
      </ChartCard>
    </div>

    {/* Workload + patient flow */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartCard title="Workload by department" subtitle="Inbound (received) vs outbound (sent) — spot overloaded teams." icon={<BarChart3 className="w-4 h-4" />}>
        <DeptFlowChart data={data.dept_flow} />
      </ChartCard>
      <ChartCard title="Patient flow between departments" subtitle="Where referrals travel — common intra-hospital journeys." icon={<GitBranch className="w-4 h-4" />}>
        <FlowSankey data={data.sankey} />
      </ChartCard>
    </div>

    {/* Clinical context */}
    {data.top_diagnoses.length > 0 && (
      <ChartCard title="Top referral reasons (closed)" subtitle="Most common diagnosis categories — informs service planning." icon={<Stethoscope className="w-4 h-4" />}>
        <HBar data={data.top_diagnoses} xKey="category" barKey="count" name="Closed referrals" color={INDIGO} height={Math.max(200, data.top_diagnoses.length * 38)} />
      </ChartCard>
    )}
  </>
);

// ---- Embedded section ----------------------------------------------------

/**
 * The original role-scoped Analytics, embedded as a section beneath the
 * charts/leaderboard Overview. Fetches the SECURITY DEFINER
 * `get_referral_analytics` RPC, which aggregates server-side over the last 12
 * months and scopes by role: a doctor sees their own activity, a superuser
 * sees their whole hospital, and a platform owner sees the entire network —
 * a scope the client-side Overview above cannot compute.
 */
export const OperationalInsights: React.FC = () => {
  const { profile } = useAuthStore();
  const appRole = (profile as any)?.app_role as string | undefined;
  const isManager = appRole === 'platform' || appRole === 'superuser';
  const { data, isLoading, isError, error, refetch } = useReferralAnalytics();

  const hasData = (data?.totals.total ?? 0) > 0;

  return (
    <div className="pt-2">
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
        </div>
      ) : isError ? (
        <Card padding="lg" className="border-red-200 bg-red-50">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-800">Could not load analytics</h3>
          </div>
          <p className="text-red-700 text-sm mb-4">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <Button onClick={() => refetch()} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Retry</Button>
        </Card>
      ) : !hasData ? (
        <Card padding="lg">
          <div className="text-center py-10">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No referral data yet</h3>
            <p className="text-gray-500 text-sm">Analytics will appear here once referrals exist.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {isManager ? <SuperuserView data={data!} /> : <DoctorView data={data!} />}
        </div>
      )}
    </div>
  );
};

export default OperationalInsights;
