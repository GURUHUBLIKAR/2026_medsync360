import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  MessageSquare, 
  Calendar, 
  Clock,
  RefreshCw
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { useResponsive } from '../../../hooks/useResponsive';
import { useDashboardStats } from '../../../hooks/useDashboardData';
import { cn } from '../../../lib/utils';

export const DashboardStats: React.FC = () => {
  const { isMobile, isTablet } = useResponsive();
  const { data: stats, isLoading, refetch, isRefetching } = useDashboardStats();

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const statsData = [
    {
      name: 'Active Referrals',
      value: stats?.activeReferrals?.toString() || '0',
      change: 'Real-time data',
      changeType: 'neutral',
      icon: FileText,
      color: 'primary',
    },
    {
      name: 'Unread Messages',
      value: '0', // Placeholder - will be connected to real data later
      change: 'Coming soon',
      changeType: 'neutral',
      icon: MessageSquare,
      color: 'medical',
    },
    {
      name: 'Upcoming Duties',
      value: stats?.upcomingDuties?.toString() || '0',
      change: 'Scheduled shifts',
      changeType: 'neutral',
      icon: Calendar,
      color: 'success',
    },
    {
      name: 'Response Time',
      value: '12m', // Placeholder - will be connected to real data later
      change: 'Average response',
      changeType: 'neutral',
      icon: Clock,
      color: 'warning',
    },
  ];

  if (isLoading) {
    return (
      <div className={cn(
        "grid gap-4",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      )}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="h-24 bg-neutral-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh Button */}
      <div className="flex justify-between items-center">
        <h2 className={cn(
          "font-semibold text-neutral-900",
          isMobile ? "text-base" : "text-lg"
        )}>
          Dashboard Stats
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefetching}
          className={cn(
            "text-neutral-600 hover:text-neutral-900",
            isMobile ? "px-2 py-1" : "px-3 py-2"
          )}
        >
          <RefreshCw size={isMobile ? 14 : 16} className={cn("mr-1", isRefetching && "animate-spin")} />
          {!isMobile && (isRefetching ? 'Refreshing...' : 'Refresh')}
        </Button>
      </div>

      {/* Stats Grid - Enhanced Mobile Layout */}
      <div className={cn(
        "grid gap-3",
        // Mobile: 2 columns for better use of space
        "grid-cols-2",
        // Tablet: 2 columns with more spacing
        "sm:grid-cols-2 sm:gap-4",
        // Desktop: 4 columns
        "lg:grid-cols-4 lg:gap-6"
      )}>
        {statsData.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div
                className={cn(
                  "relative overflow-hidden h-full rounded-xl border border-neutral-200 bg-white shadow-sm transition-colors hover:border-neutral-300",
                  isMobile ? "p-3" : "p-4"
                )}
              >
                {/* Live indicator for real data */}
                {(stat.name === 'Active Referrals' || stat.name === 'Upcoming Duties') && (
                  <div className={cn(
                    "absolute bg-green-400 rounded-full animate-pulse",
                    isMobile ? "top-1 right-1 w-1.5 h-1.5" : "top-2 right-2 w-2 h-2"
                  )}></div>
                )}
                {/* Placeholder indicator for mock data */}
                {(stat.name === 'Unread Messages' || stat.name === 'Response Time') && (
                  <div className={cn(
                    "absolute bg-yellow-400 rounded-full",
                    isMobile ? "top-1 right-1 w-1.5 h-1.5" : "top-2 right-2 w-2 h-2"
                  )}></div>
                )}
                
                <div className={cn(
                  "flex flex-col",
                  isMobile ? "gap-2" : "gap-3"
                )}>
                  {/* Header with Icon */}
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      "rounded-full flex-shrink-0",
                      `bg-${stat.color}-100`,
                      isMobile ? "p-1.5" : "p-2"
                    )}>
                      <Icon className={cn(
                        `text-${stat.color}-600`,
                        isMobile ? "h-3 w-3" : "h-4 w-4 md:h-5 md:w-5"
                      )} />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "font-medium text-neutral-600 leading-tight",
                      isMobile ? "text-xs" : "text-xs md:text-sm"
                    )}>
                      {isMobile ? stat.name.split(' ').slice(0, 2).join(' ') : stat.name}
                    </p>
                    <p className={cn(
                      "font-bold text-neutral-900 mt-1 leading-tight",
                      isMobile ? "text-lg" : "text-xl md:text-2xl lg:text-3xl"
                    )}>
                      {stat.value}
                    </p>
                    <p className={cn(
                      "mt-1 text-neutral-500 leading-tight",
                      isMobile ? "text-xs" : "text-xs"
                    )}>
                      {isMobile ? stat.change.split(' ').slice(0, 2).join(' ') : stat.change}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(DashboardStats);
