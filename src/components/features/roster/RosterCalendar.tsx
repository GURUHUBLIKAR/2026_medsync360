import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday } from 'date-fns';
import { Card } from '../../ui/Card';
import { DutyCard } from './DutyCard';
import { cn } from '../../../lib/utils';
import type { Duty, ShiftType } from '../../../types/duty.types';
import { Calendar } from 'lucide-react';

interface RosterCalendarProps {
  duties: Duty[];
  viewMode: 'weekly' | 'monthly';
  currentDate: Date;
  currentUserId?: string;
  loading: boolean;
  onDutyClick: (duty: Duty) => void;
  onDutyDelete?: (duty: Duty) => void;
  shiftConfigs: Record<ShiftType, any>;
  showAllDoctors?: boolean;
}

const RosterCalendar: React.FC<RosterCalendarProps> = ({
  duties,
  viewMode,
  currentDate,
  currentUserId,
  loading,
  onDutyClick,
  onDutyDelete,
  shiftConfigs,
  showAllDoctors = true
}) => {
  // Reference to track component mounts/unmounts for memory leak detection
  const mountedRef = useRef<boolean>(false);
  const dutyMapRef = useRef<Map<string, Map<string, Duty[]>>>(new Map());
  const renderedDutiesRef = useRef<Set<string>>(new Set());
  
  // Memory usage monitoring
  useEffect(() => {
    mountedRef.current = true;
        
    return () => {
      mountedRef.current = false;
    };
  }, [duties.length]);
  
  const daysInRange = useMemo(() => {
    if (viewMode === 'weekly') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 }); 
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return eachDayOfInterval({ start, end });
    }
  }, [viewMode, currentDate]);

  // Build an optimized lookup map for duties by date and department
  useEffect(() => {
    // Clear previous map to prevent memory leaks
    dutyMapRef.current.clear();
    renderedDutiesRef.current.clear();
    
    // Build new map
    duties.forEach(duty => {
      const dateStr = duty.shift_date.split('T')[0];
      const deptStr = duty.department || 'unknown';
      
      // Get or create date map
      if (!dutyMapRef.current.has(dateStr)) {
        dutyMapRef.current.set(dateStr, new Map());
      }
      
      // Get or create department array
      const dateMap = dutyMapRef.current.get(dateStr)!;
      if (!dateMap.has(deptStr)) {
        dateMap.set(deptStr, []);
      }
      
      // Add duty to department array
      dateMap.get(deptStr)!.push(duty);
    });
    
    console.log(`🗺️ Built duty map with ${dutyMapRef.current.size} dates`);
  }, [duties]);
  
  // Optimized function to get duties for a specific day
  const getDutiesForDay = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dateMap = dutyMapRef.current.get(dateStr);
    
    if (!dateMap) return [];
    
    // Flatten all department duties for this date
    const result: Duty[] = [];
    dateMap.forEach(deptDuties => result.push(...deptDuties));
    return result;
  }, []);

  const groupDutiesByDepartment = useCallback((dayDuties: Duty[]) => {
    const grouped: Record<string, Duty[]> = {};
    dayDuties.forEach(duty => {
      if (!grouped[duty.department]) {
        grouped[duty.department] = [];
      }
      grouped[duty.department].push(duty);
    });
    return grouped;
  }, []);

  // Get unique departments from duties for weekly view
  const activeDepartments = useMemo(() => {
    const depts = new Set(duties.map(d => d.department));
    // Limit to 20 departments max to prevent excessive rendering
    return Array.from(depts).sort().slice(0, 20); 
  }, [duties]);

  const days = daysInRange;
  
  if (loading) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center justify-center py-16" aria-live="polite" role="status"> 
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            <Calendar className="absolute inset-0 m-auto w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading Duty Roster</h3>
          <p className="text-gray-600 max-w-md text-center">
            We're retrieving your schedule data. This should only take a moment. 
          </p>
        </div>
      </Card>
    );
  }

  if (viewMode === 'weekly') {
    return ( 
      <Card padding="none" className="overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-8 border-b border-neutral-200 sticky top-0 z-10 bg-white shadow-sm">
          <div className="p-2 bg-neutral-50 font-medium text-xs text-neutral-600 flex items-center justify-center">
            Department
          </div>
          {days.map(day => (
            <div 
              key={day.toISOString()}
              className={cn(
                "p-2 text-center border-l border-neutral-200",
                isToday(day) && "bg-primary-50"
              )}
            >
              <div className="text-xs font-medium text-neutral-900">
                {format(day, 'EEE')}
              </div>
              <div className={cn( 
                "text-base font-bold",
                isToday(day) ? "text-primary-600" : "text-neutral-700"
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-[calc(100vh-250px)] overflow-y-auto"> 
          {activeDepartments.map(department => (
            <motion.div
              key={department}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-8 border-b border-neutral-100 last:border-b-0"
            >
              {/* Department Label */ }
              <div className="p-2 bg-neutral-50 border-r border-neutral-200">
                <div className="text-xs font-medium text-neutral-900 truncate">
                  {department}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {duties.filter(d => d.department === department).length} duties
                </div>
              </div>

              {/* Days */ }
              {days.map(day => {
                const dayDuties = getDutiesForDay(day).filter(d => d.department === department);
                
                return (
                  <div
                    key={`${department}-${day.toISOString()}`}
                    className={cn(
                      "p-1 border-l border-neutral-200 min-h-[80px]", 
                      isToday(day) && "bg-primary-50/30"
                    )}
                  >
                    <div className="space-y-0.5">
                      {dayDuties.slice(0, 5).map(duty => (
                        <DutyCard
                          key={`${duty.id}-${duty.user_id}`}
                          duty={duty}  
                          isCurrentUser={duty.user_id === currentUserId}
                          onClick={() => onDutyClick(duty)}
                          shiftConfig={shiftConfigs[duty.shift_type]}
                          onDelete={duty.user_id === currentUserId && onDutyDelete ? () => onDutyDelete(duty) : undefined}
                          compact={false}
                          showDoctorInfo={showAllDoctors}
                        />
                      ))}
                      {dayDuties.length > 5 && (
                        <div className="text-[10px] text-center py-1 bg-gray-100 rounded text-gray-600 mt-1"> 
                          +{dayDuties.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          ))}
        </div>

      </Card>
    );
  }

  // Monthly view 
  const weeksInMonth = [];
  for (let i = 0; i < days.length; i += 7) {
    weeksInMonth.push(days.slice(i, i + 7));
  }

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header */ }
      <div className="grid grid-cols-7 border-b border-neutral-200 sticky top-0 z-10 bg-white shadow-sm">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="p-2 text-center bg-neutral-50 font-medium text-xs text-neutral-600">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */ }
      <div className="grid grid-rows-auto max-h-[calc(100vh-220px)] overflow-y-auto">
        {weeksInMonth.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map(day => {
              const dayDuties = getDutiesForDay(day);
              const groupedDuties = groupDutiesByDepartment(dayDuties);
              
              return ( 
                <motion.div
                  key={day.toISOString()}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: weekIndex * 0.1 }}
                  className={cn( 
                    "border-r border-b border-neutral-200 p-1 min-h-[90px] last:border-r-0",
                    isToday(day) && "bg-primary-50/30" 
                  )}
                >
                  {/* Date */}
                  <div className={cn(
                    "text-xs font-medium mb-1 flex items-center justify-between",
                    isToday(day) ? "text-primary-600" : "text-neutral-700"
                  )}>
                    <span>{format(day, 'd')}</span> 
                    {dayDuties.length > 0 && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded-full">
                        {dayDuties.length}
                      </span>
                    )}
                  </div>

                  {/* Duties */ }
                  <div className="space-y-0.5">
                    {Object.entries(groupedDuties).map(([dept, deptDuties]) => (
                      <div key={dept} className="space-y-0.5">
                        {deptDuties.slice(0, 2).map(duty => (
                          <DutyCard
                            key={`${duty.id}-${duty.user_id}`}
                            duty={duty}
                            isCurrentUser={duty.user_id === currentUserId} 
                            onClick={() => onDutyClick(duty)}
                            shiftConfig={shiftConfigs[duty.shift_type]}
                            onDelete={duty.user_id === currentUserId && onDutyDelete ? () => onDutyDelete(duty) : undefined}
                            compact={true}
                            showDoctorInfo={showAllDoctors}
                          />
                        ))}
                        {deptDuties.length > 2 && (
                          <div className="text-[10px] text-neutral-500 text-center py-0.5 bg-neutral-100 rounded"> 
                            +{deptDuties.length - 2} more
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

    </Card>
  );
};

export default React.memo(RosterCalendar);
export { RosterCalendar };