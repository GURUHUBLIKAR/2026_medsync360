import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// App-wide "busy" indicator. Shows automatically whenever ANY React Query
// query is fetching or any mutation is running — no per-screen wiring needed.
// Non-blocking: a thin top progress bar plus a small corner spinner, so
// background refetches don't lock the UI.
export const GlobalLoader = () => {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const busy = isFetching + isMutating > 0;

  return (
    <AnimatePresence>
      {busy && (
        <motion.div
          key="global-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          // Above modals (z-50) and the session-timeout modal (z-[100]).
          className="pointer-events-none fixed inset-x-0 top-0 z-[200]"
          aria-live="polite"
          role="status"
        >
          {/* Indeterminate top progress bar */}
          <div className="relative h-1 w-full overflow-hidden bg-primary-100">
            <motion.div
              className="absolute inset-y-0 w-1/3 bg-primary-600"
              animate={{ x: ['-100%', '320%'] }}
              transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            />
          </div>

          {/* Corner spinner pill */}
          <div className="flex justify-end px-3 pt-2">
            <div className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-md ring-1 ring-neutral-200">
              <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
              Loading…
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalLoader;
