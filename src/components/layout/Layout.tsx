import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useResponsive } from '../../hooks/useResponsive';
import { cn } from '../../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, showSidebar = true }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Desktop/Tablet Header */}
      {!isMobile && <Header onMenuToggle={toggleSidebar} isSidebarOpen={sidebarOpen} />}
      
      <div className="flex">
        {/* Sidebar for desktop/tablet */}
        {showSidebar && (isDesktop || isTablet) && (
          <Sidebar
            isOpen={isDesktop || sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            className="transition-all duration-300"
          />
        )}

        {/* Main content */}
        <main className={cn(
          "flex-1 min-w-0 min-h-screen transition-all duration-300",
          // Tablet spacing
          showSidebar && isTablet && "ml-16",
          // Mobile spacing for bottom nav
          isMobile && "pb-16"
        )}>
          <div className={cn(
            // Full-width, mobile-first responsive padding
            "w-full px-4 py-4",
            "md:px-6 md:py-6",
            "lg:px-8 lg:py-8"
          )}>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && <MobileNav />}
    </div>
  );
};
