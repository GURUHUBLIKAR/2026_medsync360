import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { NamedCount } from './useReferralAnalytics';

// ---------------------------------------------------------------------------
// Decline-reason breakdown (from the referral_decline_reasons table).
// Fails soft (returns []) if the table/columns are missing or RLS blocks it,
// so the Analytics page never errors out.
// ---------------------------------------------------------------------------
export function useDeclineReasonStats(startDate: Date, endDate: Date) {
  return useQuery<NamedCount[]>({
    queryKey: ['analytics', 'decline-reasons', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('referral_decline_reasons')
          .select('reason_code, reason_text, created_at')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (error) {
          console.warn('Decline-reason analytics unavailable:', error.message);
          return [];
        }

        const map = new Map<string, number>();
        (data || []).forEach((row: any) => {
          const label = (row.reason_text || row.reason_code || 'Unspecified').toString().trim();
          map.set(label, (map.get(label) || 0) + 1);
        });
        return Array.from(map, ([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);
      } catch (e) {
        console.warn('Decline-reason analytics failed:', e);
        return [];
      }
    },
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Duty-roster analytics (shifts by department + by doctor).
// ---------------------------------------------------------------------------
export interface DutyAnalytics {
  byDepartment: NamedCount[];
  byDoctor: NamedCount[];
  totalShifts: number;
}

export function useDutyAnalytics(startDate: Date, endDate: Date, department: string = 'all') {
  return useQuery<DutyAnalytics>({
    queryKey: ['analytics', 'duties', startDate.toISOString(), endDate.toISOString(), department],
    queryFn: async () => {
      const empty: DutyAnalytics = { byDepartment: [], byDoctor: [], totalShifts: 0 };
      try {
        let query = (supabase as any)
          .from('duty_roster')
          .select('department, shift_date, user:users(full_name)')
          .gte('shift_date', format(startDate, 'yyyy-MM-dd'))
          .lte('shift_date', format(endDate, 'yyyy-MM-dd'));

        if (department !== 'all') {
          query = query.eq('department', department);
        }

        const { data, error } = await query;

        if (error) {
          console.warn('Duty analytics unavailable:', error.message);
          return empty;
        }

        const deptMap = new Map<string, number>();
        const docMap = new Map<string, number>();
        (data || []).forEach((row: any) => {
          const dept = row.department || 'Unassigned';
          deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
          const name = row.user?.full_name || 'Unknown';
          docMap.set(name, (docMap.get(name) || 0) + 1);
        });

        return {
          totalShifts: (data || []).length,
          byDepartment: Array.from(deptMap, ([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
          byDoctor: Array.from(docMap, ([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
        };
      } catch (e) {
        console.warn('Duty analytics failed:', e);
        return empty;
      }
    },
    staleTime: 60_000,
  });
}
