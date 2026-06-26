import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, XCircle } from 'lucide-react';
import { Button } from '../../ui/Button';
import { ResponsiveModal } from '../../ui/ResponsiveModal';
import { VoiceTextarea } from '../../ui/VoiceInput';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';

interface DeclineReason {
  id: string;
  label: string;
  description: string;
}

const declineReasons: DeclineReason[] = [
  { id: 'incorrect_details', label: 'Incorrect Details', description: 'Patient information or clinical details are incorrect or incomplete' },
  { id: 'not_needed', label: 'Not Needed Anymore', description: 'Referral is no longer required due to patient condition change or other factors' },
  { id: 'not_on_duty', label: 'Not On Duty', description: 'Currently not available or on duty to handle this referral' }
];

interface DeclineReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDecline: (reasonCode: string, reasonText: string) => void;
}

export const DeclineReferralModal: React.FC<DeclineReferralModalProps> = ({ isOpen, onClose, onDecline }) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState<string>('');

  const handleDecline = () => {
    if (!selectedReason) {
      toast.error('Please select a reason for declining');
      return;
    }
    if (selectedReason === 'other' && !otherReason.trim()) {
      toast.error('Please specify the other reason');
      return;
    }
    const reasonText = selectedReason === 'other' ? otherReason : declineReasons.find(r => r.id === selectedReason)?.label || '';
    onDecline(selectedReason, reasonText);
  };

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Reason for Declining" size="md">
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-yellow-800 mb-1">Please provide a reason</h3>
            <p className="text-sm text-yellow-700">Selecting a reason helps the referring doctor understand why the referral was declined.</p>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">Select a reason:</h3>
          {declineReasons.map((reason) => (
            <div key={reason.id} className={cn("p-3 border-2 rounded-lg cursor-pointer transition-all", selectedReason === reason.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300")} onClick={() => setSelectedReason(reason.id)}>
              <div className="flex items-center">
                <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center mr-3", selectedReason === reason.id ? "border-blue-500" : "border-gray-400")}>
                  {selectedReason === reason.id && <div className="w-3 h-3 bg-blue-500 rounded-full" />}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{reason.label}</h4>
                  <p className="text-sm text-gray-600">{reason.description}</p>
                </div>
              </div>
            </div>
          ))}
          <div className={cn("p-3 border-2 rounded-lg cursor-pointer transition-all", selectedReason === 'other' ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300")} onClick={() => setSelectedReason('other')}>
            <div className="flex items-center mb-2">
              <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center mr-3", selectedReason === 'other' ? "border-blue-500" : "border-gray-400")}>
                {selectedReason === 'other' && <div className="w-3 h-3 bg-blue-500 rounded-full" />}
              </div>
              <h4 className="font-medium text-gray-900">Other reason</h4>
            </div>
            {selectedReason === 'other' && (
              <VoiceTextarea value={otherReason} onValueChange={(value) => setOtherReason(value)} placeholder="Please specify the reason..." className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2" rows={3} />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleDecline} className="bg-red-600 hover:bg-red-700 text-white">
            <XCircle size={16} className="mr-2" />
            Decline Referral
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
};

