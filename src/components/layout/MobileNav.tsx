import React from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  FileText, 
  MessageSquare, 
  Calendar, 
  FlaskConical
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import DutyRosterModal from '../features/roster/DutyRosterModal';

const mobileNavItemsBase = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Referrals', href: '/referrals', icon: FileText },
  { name: 'Private Chat', href: '/messages', icon: MessageSquare },
  { name: 'Roster', icon: Calendar },
  { name: 'Research', href: '/research-insight', icon: FlaskConical },
];

const MobileNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showRosterModal, setShowRosterModal] = useState(false);

  // Create navigation with current state based on location
  const mobileNavItems = mobileNavItemsBase.map(item => ({
    ...item,
    current: item.href ? location.pathname === item.href : false
  }));

  return (
    <motion.div 
      className={cn(
        // Fixed bottom navigation
        "fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50",
        // Mobile-specific styling
        "px-4 py-2 md:hidden",
        // Safe area for devices with home indicator
        "pb-safe"
      )}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <React.Fragment key={item.name}>
              <motion.a
                href={item.href || '#'}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.name === 'Roster') {
                    setShowRosterModal(true);
                  } else if (item.href) {
                    navigate(item.href);
                  }
                }}
                className={cn(
                  "flex flex-col items-center rounded-lg transition-colors duration-200",
                  // Touch targets - minimum 44px
                  "py-2 px-3 min-h-[44px] min-w-[44px]",
                  // Active/inactive states
                  item.current
                    ? 'text-primary-600'
                    : 'text-neutral-500 hover:text-neutral-700'
                )}
                whileTap={{ scale: 0.95 }}
              >
                <Icon size={20} className="mb-1" />
                <span className="text-xs font-medium">{item.name}</span>
                {item.current && (
                  <motion.div
                    className="absolute -top-1 w-1 h-1 bg-primary-600 rounded-full"
                    layoutId="activeTab"
                  />
                )}
              </motion.a>
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Duty Roster Modal */}
      <DutyRosterModal 
        isOpen={showRosterModal} 
        onClose={() => setShowRosterModal(false)} 
      />
    </motion.div>
  );
};

export default React.memo(MobileNav);
export { MobileNav };