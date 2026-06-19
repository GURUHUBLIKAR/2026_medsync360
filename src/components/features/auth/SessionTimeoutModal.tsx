import React from 'react';
import { Clock } from 'lucide-react';
import { ResponsiveModal } from '../../ui/ResponsiveModal';
import { Button } from '../../ui/Button';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isOpen,
  secondsRemaining,
  onStayLoggedIn,
  onLogout,
}) => {
  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onStayLoggedIn}
      title="Session Timeout Warning"
      size="sm"
      closeOnOverlayClick={false}
      showCloseButton={false}
      zIndexClassName="z-[100]"
    >
      <div className="flex flex-col items-center text-center space-y-4 py-2">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="w-7 h-7 text-amber-600" />
        </div>

        <p className="text-sm text-neutral-600">
          Your session is about to expire due to inactivity. Do you want to
          continue your session or log out?
        </p>

        <p className="text-xs text-neutral-500">
          You will be logged out automatically in
        </p>

        <div className="text-4xl font-bold text-amber-600 tabular-nums">
          {secondsRemaining}s
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onLogout}
            className="flex-1"
          >
            Logout
          </Button>
          <Button type="button" onClick={onStayLoggedIn} className="flex-1">
            Continue Session
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default SessionTimeoutModal;
