import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { cn } from '../../lib/utils';

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  // z-index for the outer container. Override (e.g. "z-[100]") for modals that
  // must sit above other modals — like the session-timeout warning.
  zIndexClassName?: string;
}

const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  zIndexClassName = 'z-50'
}) => {
  const { isMobile } = useResponsive();

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: isMobile ? 1 : 0.9,
      y: isMobile ? '100%' : 0,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    },
    exit: {
      opacity: 0,
      scale: isMobile ? 1 : 0.95,
      y: isMobile ? '100%' : 0,
      transition: {
        duration: 0.2,
        ease: 'easeIn'
      }
    }
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        duration: 0.3
      }
    },
    exit: { opacity: 0 }
  };

  const modalClasses = cn(
    "transform transition-all",
    isMobile ? [
      // Mobile: Full screen with rounded corners
      "fixed inset-x-0 bottom-0 top-2 z-50", // a bit closer to the top for more height
      "bg-white rounded-t-2xl shadow-2xl"
    ] : [
      // Desktop/Tablet: Centered modal
      "relative z-50 mx-auto my-8 bg-white rounded-xl shadow-2xl border border-gray-200",
      size === 'sm' && "max-w-sm w-full",
      size === 'md' && "max-w-md w-full",
      size === 'lg' && "max-w-lg w-full",
      size === 'xl' && "max-w-5xl w-full", // slightly wider for chat layout
      size === 'full' && "max-w-7xl w-full"
    ]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={cn("fixed inset-0 overflow-y-auto", zIndexClassName)}>
          {/* Overlay */}
          <motion.div 
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit" 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Modal Container */}
          <div className={cn(
            "flex min-h-full items-center justify-center",
            isMobile ? "items-end" : "p-4" 
          )}>
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={modalClasses}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {(title || showCloseButton) && (
                <div className={cn(
                  "flex items-center justify-between border-b border-gray-200 sticky top-0 z-10",
                  "px-4 py-4 sm:px-6 sm:py-4 bg-gradient-to-r from-primary-50 to-success-50",
                  isMobile ? "rounded-t-2xl" : "rounded-t-xl"
                )}>
                  {title && (
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      {title}
                    </h2>
                  )}
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label="Close"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              <div className={cn(
                // Responsive padding
                "px-4 py-4 sm:px-6 sm:py-5",
                // Mobile full height handling - REMOVED fixed height to allow content to grow
                isMobile ? "overflow-y-auto" : ""
              )}>
                {children}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(ResponsiveModal);
export { ResponsiveModal };