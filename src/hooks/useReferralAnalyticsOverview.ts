import { useMemo } from 'react';
import { eachDayOfInterval, format, differenceInMinutes, startOfDay } from 'date-fns';
import { useReferrals } from './useReferrals';
import type { Referral } from '../types/referral.types';

export interface AnalyticsFilters {
  startDate: Date;
  endDate: Date;
  department: string; // 'all' or a department name
}

export interface NamedCount {
  label: string;
  value: number;
}

export interface LeaderboardRow {
  name: string;
  count: number;
  avgAckMinutes: number | null;
}

export interface ReferralAnalytics {
  total: number;
  open: number;        // active (not closed/cancelled/transferred)
  closed: number;
  cancelled: number;
  transferred: number;
  declineRate: number;   // %
  transferRate: number;  // %
  avgAckMinutes: number | null;   // created -> acknowledged
  avgCloseMinutes: number | null; // created -> closed
  totalDeltaPct: number | null;   // vs previous equal-length period
  volume: { date: string; count: number }[];
  byDepartment: NamedCount[];
  byUrgency: NamedCount[];
  byStatus: NamedCount[];
  // Operational insights
  leaderboard: LeaderboardRow[];      // top receiving doctors
  departmentFlow: NamedCount[];       // "Origin → Destination" referral paths
  finalDiagnosis: NamedCount[];       // by final diagnosis category
  multiHopCount: number;              // referrals that arrived via a transfer
  longestChain: number;               // longest transfer lineage in range
  avgMedChanges: number | null;       // avg medication updates per referral
}

const isClosed = (r: Referral) => r.status === 'Closed' || !!r.end_time;

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function computeAnalytics(
  referrals: Referral[],
  { startDate, endDate, department }: AnalyticsFilters
): ReferralAnalytics {
  const matchesDept = (r: Referral) =>
    department === 'all' || (r.department || 'Unassigned') === department;

  const inRange = referrals.filter((r) => {
    const c = new Date(r.createdAt);
    if (isNaN(c.getTime())) return false;
    if (c < startDate || c > endDate) return false;
    return matchesDept(r);
  });

  const total = inRange.length;
  const closed = inRange.filter(isClosed).length;
  const cancelled = inRange.filter((r) => r.status === 'Cancelled').length;
  const transferred = inRange.filter((r) => r.status === 'Transferred').length;
  const open = inRange.filter(
    (r) => !isClosed(r) && r.status !== 'Cancelled' && r.status !== 'Transferred'
  ).length;

  const ackDurations = inRange
    .filter((r) => r.acceptedAt && r.createdAt)
    .map((r) => differenceInMinutes(new Date(r.acceptedAt as string), new Date(r.createdAt)))
    .filter((m) => Number.isFinite(m) && m >= 0);

  const closeDurations = inRange
    .filter((r) => r.end_time && r.createdAt)
    .map((r) => differenceInMinutes(new Date(r.end_time as string), new Date(r.createdAt)))
    .filter((m) => Number.isFinite(m) && m >= 0);

  // Volume per day across the selected window.
  const days = eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) });
  const dayMap = new Map<string, number>(days.map((d) => [format(d, 'yyyy-MM-dd'), 0]));
  inRange.forEach((r) => {
    const key = format(new Date(r.createdAt), 'yyyy-MM-dd');
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
  });
  const volume = Array.from(dayMap, ([date, count]) => ({ date, count }));

  // By department.
  const deptMap = new Map<string, number>();
  inRange.forEach((r) => {
    const key = r.department || 'Unassigned';
    deptMap.set(key, (deptMap.get(key) || 0) + 1);
  });
  const byDepartment = Array.from(deptMap, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // By urgency (fixed order).
  const urgencyOrder = ['Emergency', 'Urgent', 'Normal', 'Elective'];
  const urgencyMap = new Map<string, number>();
  inRange.forEach((r) => urgencyMap.set(r.urgency, (urgencyMap.get(r.urgency) || 0) + 1));
  const byUrgency = urgencyOrder
    .map((label) => ({ label, value: urgencyMap.get(label) || 0 }))
    .filter((u) => u.value > 0);

  // By status (canonical buckets, avoids perspective ambiguity).
  const byStatus: NamedCount[] = [
    { label: 'Open', value: open },
    { label: 'Closed', value: closed },
    { label: 'Transferred', value: transferred },
    { label: 'Cancelled', value: cancelled },
  ].filter((s) => s.value > 0);

  // Top receiving doctors (leaderboard).
  const docMap = new Map<string, { count: number; ack: number[] }>();
  inRange.forEach((r) => {
    const name = r.doctor && r.doctor !== 'Unassigned' ? r.doctor : null;
    if (!name) return;
    const row = docMap.get(name) || { count: 0, ack: [] };
    row.count += 1;
    if (r.acceptedAt && r.createdAt) {
      const m = differenceInMinutes(new Date(r.acceptedAt), new Date(r.createdAt));
      if (Number.isFinite(m) && m >= 0) row.ack.push(m);
    }
    docMap.set(name, row);
  });
  const leaderboard: LeaderboardRow[] = Array.from(docMap, ([name, v]) => ({
    name,
    count: v.count,
    avgAckMinutes: avg(v.ack),
  }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Cross-department flow: origin → destination.
  const flowMap = new Map<string, number>();
  inRange.forEach((r) => {
    const from = r.fromDepartment || 'Unknown';
    const to = r.department || 'Unassigned';
    if (from === to) return; // skip intra-department noise
    const key = `${from} → ${to}`;
    flowMap.set(key, (flowMap.get(key) || 0) + 1);
  });
  const departmentFlow = Array.from(flowMap, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Final diagnosis category breakdown.
  const dxMap = new Map<string, number>();
  inRange.forEach((r) => {
    const dx = (r.final_diagnosis_category || '').trim();
    if (!dx) return;
    dxMap.set(dx, (dxMap.get(dx) || 0) + 1);
  });
  const finalDiagnosis = Array.from(dxMap, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Transfer-chain depth (walk transfer_parent_id over the full dataset).
  const parentOf = new Map<string, string | undefined>(
    referrals.map((r) => [r.id, r.transfer_parent_id])
  );
  const lineage = (id: string): number => {
    let depth = 0;
    let cur = parentOf.get(id);
    let guard = 0;
    while (cur && guard < 25) {
      depth += 1;
      cur = parentOf.get(cur);
      guard += 1;
    }
    return depth; // number of ancestors (transfers before reaching this node)
  };
  const multiHopCount = inRange.filter((r) => !!r.transfer_parent_id).length;
  const longestChain = inRange.reduce((mx, r) => Math.max(mx, lineage(r.id) + 1), 0);

  // Avg medication updates per referral.
  const medCounts = inRange
    .map((r) => r.medication_update_count)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  const avgMedChanges = avg(medCounts);

  // Delta vs previous equal-length period.
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevStart = new Date(startDate.getTime() - periodMs);
  const prevTotal = referrals.filter((r) => {
    const c = new Date(r.createdAt);
    return !isNaN(c.getTime()) && c >= prevStart && c < startDate && matchesDept(r);
  }).length;
  const totalDeltaPct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

  return {
    total,
    open,
    closed,
    cancelled,
    transferred,
    declineRate: total ? (cancelled / total) * 100 : 0,
    transferRate: total ? (transferred / total) * 100 : 0,
    avgAckMinutes: avg(ackDurations),
    avgCloseMinutes: avg(closeDurations),
    totalDeltaPct,
    volume,
    byDepartment,
    byUrgency,
    byStatus,
    leaderboard,
    departmentFlow,
    finalDiagnosis,
    multiHopCount,
    longestChain,
    avgMedChanges,
  };
}

export function useReferralAnalytics(filters: AnalyticsFilters) {
  const { data: referrals = [], isLoading, error, refetch, isRefetching } = useReferrals();

  const analytics = useMemo(
    () => computeAnalytics(referrals, filters),
    [referrals, filters]
  );

  const departments = useMemo(() => {
    const set = new Set<string>();
    referrals.forEach((r) => set.add(r.department || 'Unassigned'));
    return Array.from(set).sort();
  }, [referrals]);

  return { analytics, departments, isLoading, error, refetch, isRefetching };
}
