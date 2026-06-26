import React, { Suspense, lazy, useMemo } from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { DashboardStats } from './DashboardStats';
import { DashboardUserInfo } from './DashboardUserInfo';
import { useAuthStore } from '../../../store/authStore';
import { useResponsive } from '../../../hooks/useResponsive';
import { cn } from '../../../lib/utils';

// Lazy load non-critical components for performance
const QuickActions = lazy(() => import('./QuickActions'));
const RecentActivity = lazy(() => import('./RecentActivity'));

// Loading component for lazy-loaded sections
const SectionLoader = () => (
  <div className="animate-pulse">
    <div className="h-6 bg-neutral-200 rounded mb-4 w-1/3"></div>
    <div className="space-y-3">
      <div className="h-12 bg-neutral-100 rounded"></div>
      <div className="h-12 bg-neutral-100 rounded"></div>
      <div className="h-12 bg-neutral-100 rounded"></div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { profile, loading } = useAuthStore();
  const { isMobile, isTablet } = useResponsive();

  // Memoize current time to prevent unnecessary re-renders
  const currentTime = useMemo(() => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }, []);

  // Memoize greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Show loading state during initial load
  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-neutral-200 rounded-lg"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 bg-neutral-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-neutral-200 rounded-lg"></div>
            <div className="h-64 bg-neutral-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Welcome Header with User Info */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "bg-white rounded-lg shadow-sm border border-neutral-200 text-neutral-900",
          isMobile ? "p-3" : "p-4 md:p-6"
        )}
      >
        <div className={cn(
          "flex",
          isMobile ? 'flex-col space-y-3' : 'items-start justify-between'
        )}>
          <div className={cn(
            "flex items-center flex-1",
            isMobile ? "gap-3" : "gap-4"
          )}>
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              <div className={cn(
                "rounded-full overflow-hidden bg-primary-100 border-2 border-primary-200",
                isMobile ? "w-12 h-12" : "w-16 h-16 md:w-20 md:h-20"
              )}>
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary-50">
                    <User className={cn(
                      "text-primary-600",
                      isMobile ? "w-6 h-6" : "w-8 h-8 md:w-10 md:h-10"
                    )} />
                  </div>
                )}
              </div>
            </div>
            
            {/* Welcome Text */}
            <div className="flex-1 min-w-0">
              <h1 className={cn(
                "font-bold mb-1 truncate",
                isMobile ? "text-sm" : "text-base md:text-lg lg:text-xl"
              )}>
                {greeting}, Dr. {profile.full_name?.split(' ')[0]}
              </h1>
              <div className={cn(
                "flex flex-wrap items-center gap-2 text-neutral-600",
                isMobile ? "text-xs" : "text-sm md:text-base"
              )}>
                <span className="truncate">{profile.role}</span>
                <span className="hidden sm:inline">•</span>
                <span className="truncate">{profile.department}</span>
                {!isMobile && (
                  <>
                    <span>•</span>
                    <span>{currentTime}</span>
                  </>
                )}
              </div>
              {isMobile && (
                <div className="text-neutral-600 text-xs mt-1">
                  {currentTime}
                </div>
              )}
            </div>
          </div>
          
          {/* User Information Panel - Hide on mobile to save space */}
          {!isMobile && <DashboardUserInfo profile={profile} />}
        </div>
      </motion.div>

      {/* Stats Grid - Now fetches real data */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <DashboardStats />
      </motion.div>

      {/* Quick Actions and Recent Activity with Lazy Loading */}
      <div className={cn(
        "grid gap-6",
        "grid-cols-1 lg:grid-cols-2"
      )}>
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={cn(
            "bg-white rounded-lg shadow-sm border border-neutral-200",
            "p-4 md:p-6"
          )}
        >
          <h2 className={cn(
            "font-semibold text-neutral-900 mb-4",
            "text-base md:text-lg"
          )}>
            Quick Actions
          </h2>
          <Suspense fallback={<SectionLoader />}>
            <QuickActions />
          </Suspense>
        </motion.div>

        {/* Recent Activity - Now fetches real data */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className={cn(
            "bg-white rounded-lg shadow-sm border border-neutral-200",
            "p-4 md:p-6"
          )}
        >
          <h2 className={cn(
            "font-semibold text-neutral-900 mb-4",
            "text-base md:text-lg"
          )}>
            Recent Activity
          </h2>
          <Suspense fallback={<SectionLoader />}>
            <RecentActivity />
          </Suspense>
        </motion.div>
      </div>
    </div>
  );
};

export default React.memo(Dashboard);
export { Dashboard };
