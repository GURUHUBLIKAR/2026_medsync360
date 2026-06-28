import React from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  Calendar,
  MessageSquare,
  FileText,
  Bot,
  BarChart3,
  FlaskConical,
  Building2,
  ShieldCheck,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X
} from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import DutyRosterModal from '../features/roster/DutyRosterModal';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Referrals', href: '/referrals', icon: FileText },
  { name: 'Private Chat', href: '/messages', icon: MessageSquare },
  { name: 'Duty Roster', icon: Calendar, action: 'roster' },
  { name: 'Research Insight', href: '/research-insight', icon: FlaskConical },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
  // Superuser + platform owner: approve doctors / superuser requests.
  { name: 'Approvals', href: '/approvals', icon: ShieldCheck, adminOnly: true },
  // Platform-owner-only: onboard hospitals.
  { name: 'Hospitals', href: '/hospitals', icon: Building2, platformOnly: true },
];

const COLLAPSE_KEY = 'sidebar-collapsed';

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, className }) => {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const location = useLocation();
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const appRole = (profile as any)?.app_role;
  const isPlatform = appRole === 'platform';
  const isAdmin = appRole === 'platform' || appRole === 'superuser';
  const [showRosterModal, setShowRosterModal] = useState(false);

  // Manual collapse (desktop only); persisted across reloads.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Icon-only when tablet (automatic) or when the user collapsed it on desktop.
  const iconOnly = isTablet || (isDesktop && collapsed);

  // Create navigation with current state based on location.
  // Platform-only items (Hospitals) → owner; admin items (Approvals) → owner or superuser.
  const navigation = navigationItems
    .filter(item => {
      if ((item as any).platformOnly) return isPlatform;
      if ((item as any).adminOnly) return isAdmin;
      return true;
    })
    .map(item => ({
      ...item,
      current: item.href ? location.pathname === item.href : false
    }));

  const sidebarVariants = {
    open: {
      x: 0,
      transition: { duration: 0.3, ease: 'easeOut' }
    },
    closed: {
      x: isTablet ? -64 : -256, // Adjust based on sidebar width
      transition: { duration: 0.3, ease: 'easeIn' }
    }
  };

  const overlayVariants = {
    open: {
      opacity: 1,
      pointerEvents: 'auto' as const,
      transition: { duration: 0.3 }
    },
    closed: {
      opacity: 0,
      pointerEvents: 'none' as const,
      transition: { duration: 0.3 }
    }
  };

  return (
    <>
      {/* Mobile/Tablet Overlay */}
      {(isMobile || isTablet) && (
        <motion.div
          variants={overlayVariants}
          animate={isOpen ? 'open' : 'closed'}
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <motion.div
        variants={sidebarVariants}
        animate={isOpen ? 'open' : 'closed'}
        className={cn(
          "fixed inset-y-0 left-0 z-50 text-neutral-700",
          // Themed surface (mint light / slate dark via CSS vars)
          "bg-[var(--sidebar-bg)] border-r border-[var(--chrome-border)]",
          // Responsive width (tablet = icon rail, desktop collapsed = wider icon rail)
          isTablet ? "w-16" : collapsed ? "w-20" : "w-64",
          // Desktop positioning
          "lg:static lg:translate-x-0",
          className
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header - Mobile/Tablet only */}
          {(isMobile || isTablet) && (
            <div className="flex items-center justify-between p-4 border-b border-[var(--chrome-border)] lg:hidden">
              {!isTablet && (
                <h2 className="text-lg font-semibold text-neutral-900">Navigation</h2>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-neutral-600 hover:bg-black/5"
              >
                <X size={20} />
              </Button>
            </div>
          )}

          {/* Collapse / Restore toggle (desktop only) — top */}
          {isDesktop && (
            <div className={cn(
              "flex items-center p-3 border-b border-[var(--chrome-border)]",
              collapsed ? "justify-center" : "justify-end"
            )}>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="flex items-center justify-center rounded-lg p-2 min-h-[40px] min-w-[40px] text-neutral-500 hover:text-neutral-900 hover:bg-black/5 transition-colors"
              >
                {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
              </button>
            </div>
          )}

          {/* Navigation */}
          <nav className={cn(
            "flex-1 space-y-2",
            // Responsive padding
            "px-4 py-6",
            iconOnly && "px-2 py-4"
          )}>
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <motion.a
                  key={item.name}
                  href={item.href || '#'}
                  onClick={(e) => {
                    e.preventDefault();
                    if (item.action === 'roster') {
                      setShowRosterModal(true);
                    } else if (item.href) {
                      navigate(item.href);
                      onClose();
                    }
                  }}
                  className={cn(
                    "group relative flex items-center text-sm font-medium rounded-lg transition-all duration-200",
                    // Touch targets - minimum 44px height
                    "min-h-[44px]",
                    // Responsive padding and spacing
                    iconOnly ? "px-2 py-3 justify-center" : "px-3 py-2",
                    // Active/inactive states (mint theme — green pill)
                    item.current
                      ? 'bg-primary-100 text-primary-700 font-semibold'
                      : 'text-neutral-700 hover:text-neutral-900 hover:bg-primary-50'
                  )}
                  whileHover={{ x: isDesktop && !iconOnly ? 4 : 0 }}
                  whileTap={{ scale: 0.98 }}
                  title={iconOnly ? item.name : undefined}
                >
                  <Icon size={20} className={cn(
                    iconOnly ? "" : "mr-3"
                  )} />
                  {!iconOnly && item.name}

                  {/* Tooltip for icon-only view */}
                  {iconOnly && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </motion.a>
              );
            })}
          </nav>
        </div>
      </motion.div>

      {/* Duty Roster Modal */}
      <DutyRosterModal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
      />
    </>
  );
};

export default React.memo(Sidebar);
export { Sidebar };
