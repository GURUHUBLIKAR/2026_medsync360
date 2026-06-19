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
  Settings,
  FlaskConical,
  X
} from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
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
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, className }) => {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const location = useLocation();
  const navigate = useNavigate();
  const [showRosterModal, setShowRosterModal] = useState(false);

  // Create navigation with current state based on location
  const navigation = navigationItems.map(item => ({
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
          "fixed inset-y-0 left-0 z-50 bg-white border-r border-neutral-200",
          // Responsive width
          isTablet ? "w-16" : "w-64",
          // Desktop positioning
          "lg:static lg:translate-x-0",
          className
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header - Mobile/Tablet only */}
          {(isMobile || isTablet) && (
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 lg:hidden">
              {!isTablet && (
                <h2 className="text-lg font-semibold text-neutral-900">Navigation</h2>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X size={20} />
              </Button>
            </div>
          )}

          {/* Navigation */}
          <nav className={cn(
            "flex-1 space-y-2",
            // Responsive padding
            "px-4 py-6",
            isTablet && "px-2 py-4"
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
                    "flex items-center text-sm font-medium rounded-lg transition-all duration-200",
                    // Touch targets - minimum 44px height
                    "min-h-[44px]",
                    // Responsive padding and spacing
                    isTablet ? "px-2 py-3 justify-center" : "px-3 py-2",
                    // Active/inactive states
                    item.current
                      ? 'bg-primary-50 text-primary-600 border-r-2 border-primary-600'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  )}
                  whileHover={{ x: isDesktop ? 4 : 0 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon size={20} className={cn(
                    isTablet ? "" : "mr-3"
                  )} />
                  {!isTablet && item.name}
                  
                  {/* Tooltip for tablet view */}
                  {isTablet && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
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