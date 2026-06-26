import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  FileText, 
  User, 
  Building2, 
  Stethoscope,
  AlertTriangle,
  ArrowRightLeft,
  Download
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { ResponsiveModal } from '../../ui/ResponsiveModal';
import { VoiceTextarea } from '../../ui/VoiceInput';
import { cn } from '../../../lib/utils';
import { useAuthStore } from '../../../store/authStore';
import { useAddMedicationHistory } from '../../../hooks/useReferrals';
import type { Referral, ReferralStatus } from '../../../types/referral.types';

interface ReferralCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  referral: Referral;
  onComplete: (data: CompletionData) => void;
  onTransfer: (data: CompletionData) => void;
}

export interface CompletionData {
  isPatientAttended: boolean;
  updatedMedication?: string;
  reasons?: string;
  action: 'close' | 'transfer';
  finalDiagnosisCategory?: string;
  finalDiagnosisDetails?: string;
}

export interface TransferData {
  isPatientAttended: boolean;
  updatedMedication?: string;
  reasons?: string;
  department: string;
  doctorId: string;
  transferReason?: string;
  specialNotes?: string;
  attachments?: File[];
}

export const ReferralCompletionModal: React.FC<ReferralCompletionModalProps> = ({
  isOpen,
  onClose,
  referral,
  onComplete,
  onTransfer
}) => {
  const { profile } = useAuthStore();
  const addMedicationHistory = useAddMedicationHistory();
  const [step, setStep] = useState<'attendance' | 'action' | 'diagnosis'>('attendance');
  const [isPatientAttended, setIsPatientAttended] = useState<boolean | null>(null);
  const [wantsToUpdateMedication, setWantsToUpdateMedication] = useState(false);
  const [updatedMedication, setUpdatedMedication] = useState('');
  const [reasons, setReasons] = useState('');
  const [finalDiagnosisCategory, setFinalDiagnosisCategory] = useState('');
  const [finalDiagnosisDetails, setFinalDiagnosisDetails] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Diagnosis category options
  const diagnosisCategories = [
    'Complete Recovery',
    'Partial Recovery', 
    'Stable Condition',
    'Referred for Further Treatment',
    'Requires Follow-up',
    'Chronic Condition Management',
    'Emergency Treatment Completed',
    'Discharge Against Medical Advice',
    'Other'
  ];

  const validateAttendanceStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (isPatientAttended === null) {
      newErrors.attendance = 'Please select whether patient was attended';
    }

    if (isPatientAttended === true && wantsToUpdateMedication && !updatedMedication.trim()) {
      newErrors.medication = 'Please update medication given information';
    }

    if (isPatientAttended === false && !reasons.trim()) {
      newErrors.reasons = 'Please provide reasons why patient was not attended';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateDiagnosisStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!finalDiagnosisCategory) {
      newErrors.diagnosisCategory = 'Please select a diagnosis category';
    }

    if (!finalDiagnosisDetails.trim()) {
      newErrors.diagnosisDetails = 'Please provide diagnosis details';
    }

    if (finalDiagnosisDetails.length > 2500) {
      newErrors.diagnosisDetails = 'Diagnosis details cannot exceed 500 words (~2500 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (step === 'attendance' && validateAttendanceStep()) {
      setStep('action');
    }
  };

  const handleClose = () => {
    // If patient was attended, go to diagnosis step first
    if (isPatientAttended) {
      setStep('diagnosis');
      return;
    }
    
    // If patient was not attended, complete directly
    const completionData: CompletionData = {
      isPatientAttended: isPatientAttended!,
      updatedMedication: isPatientAttended && wantsToUpdateMedication ? updatedMedication : referral.medicationGiven,
      reasons: !isPatientAttended ? reasons : undefined,
      action: 'close'
    };
    onComplete(completionData);
  };

  const handleFinalComplete = () => {
    if (!validateDiagnosisStep()) return;
    
    const completionData: CompletionData = {
      isPatientAttended: isPatientAttended!,
      updatedMedication: isPatientAttended && wantsToUpdateMedication ? updatedMedication : referral.medicationGiven,
      reasons: !isPatientAttended ? reasons : undefined,
      action: 'close',
      finalDiagnosisCategory,
      finalDiagnosisDetails
    };
    onComplete(completionData);
  };

  const handleTransfer = () => {
    const transferData: CompletionData = {
      isPatientAttended: isPatientAttended!,
      updatedMedication: isPatientAttended && wantsToUpdateMedication ? updatedMedication : referral.medicationGiven,
      reasons: !isPatientAttended ? reasons : undefined,
      action: 'transfer',
      finalDiagnosisCategory,
      finalDiagnosisDetails
    };
    onTransfer(transferData);
  };

  const handleReset = () => {
    setStep('attendance');
    setIsPatientAttended(null);
    setUpdatedMedication(referral.medicationGiven || '');
    setReasons('');
    setFinalDiagnosisCategory('');
    setFinalDiagnosisDetails('');
    setErrors({});
  };

  const handleModalClose = () => {
    handleReset();
    onClose();
  };

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Complete Referral"
      size="lg"
    >
      <div className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center space-x-2">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
            step === 'attendance' ? "bg-blue-500 text-white" : "bg-green-500 text-white"
          )}>
            1
          </div>
          <div className={cn(
            "flex-1 h-1 rounded",
            step === 'action' || step === 'diagnosis' ? "bg-green-500" : "bg-gray-200"
          )} />
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
            step === 'action' ? "bg-blue-500 text-white" : 
            step === 'diagnosis' ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
          )}>
            2
          </div>
          {step === 'diagnosis' && (
            <>
              <div className="flex-1 h-1 rounded bg-green-500" />
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium bg-blue-500 text-white">
                3
              </div>
            </>
          )}
        </div>

        {/* Step 1: Patient Attendance */}
        {step === 'attendance' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Patient Info Summary */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <User className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-blue-900">Patient Summary</h3>
              </div>
              <p className="text-gray-700">
                <span className="font-medium">{referral.patientName}</span> • 
                <span className="ml-1">{referral.age} years • {referral.sex}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">{referral.chiefComplaint}</p>
            </div>

            {/* Attendance Question */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Was the patient attended?
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Yes Option */}
                <motion.button
                  type="button"
                  onClick={() => setIsPatientAttended(true)}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all text-left",
                    isPatientAttended === true 
                      ? "border-green-500 bg-green-50 text-green-700" 
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center">
                    <CheckCircle className={cn(
                      "w-6 h-6 mr-3",
                      isPatientAttended === true ? "text-green-600" : "text-gray-400"
                    )} />
                    <div>
                      <h4 className="font-semibold">Yes, Patient Attended</h4>
                      <p className="text-sm opacity-75">Patient was seen and treated</p>
                    </div>
                  </div>
                </motion.button>

                {/* No Option */}
                <motion.button
                  type="button"
                  onClick={() => setIsPatientAttended(false)}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all text-left",
                    isPatientAttended === false 
                      ? "border-red-500 bg-red-50 text-red-700" 
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center">
                    <XCircle className={cn(
                      "w-6 h-6 mr-3",
                      isPatientAttended === false ? "text-red-600" : "text-gray-400"
                    )} />
                    <div>
                      <h4 className="font-semibold">No, Patient Not Attended</h4>
                      <p className="text-sm opacity-75">Patient was not seen</p>
                    </div>
                  </div>
                </motion.button>
              </div>
              
              {errors.attendance && (
                <p className="text-sm text-red-600 mt-2">{errors.attendance}</p>
              )}
            </div>

            {/* Conditional Fields */}
            {isPatientAttended === true && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="updateMedicationCheck"
                    checked={wantsToUpdateMedication}
                    onChange={(e) => setWantsToUpdateMedication(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="updateMedicationCheck" className="text-sm font-medium text-gray-700">
                    Do you want to update Medication?
                  </label>
                </div>

                {wantsToUpdateMedication && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2 flex items-center">
                        Initial Medication
                      </label>
                      <div className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
                        {referral.medicationGiven || 'No initial medication was recorded.'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <Stethoscope className="w-4 h-4 mr-2 text-green-600" />
                        Final Medication <span className="text-red-500 ml-1">*</span>
                      </label>
                      <VoiceTextarea
                        value={updatedMedication}
                        onValueChange={(value) => setUpdatedMedication(value)}
                        rows={3}
                        className={cn(
                          "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors resize-none",
                          errors.medication ? 'border-red-300' : 'border-gray-300'
                        )}
                        placeholder="Enter the final medication information..."
                      />
                      {errors.medication && (
                        <p className="text-sm text-red-600 mt-1">{errors.medication}</p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {isPatientAttended === false && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-red-600" />
                    Reasons for Not Attending <span className="text-red-500 ml-1">*</span>
                  </label>
                  <VoiceTextarea
                    value={reasons}
                    onValueChange={(value) => setReasons(value)}
                    rows={3}
                    className={cn(
                      "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors resize-none",
                      errors.reasons ? 'border-red-300' : 'border-gray-300'
                    )}
                    placeholder="Explain why the patient was not attended..."
                  />
                  {errors.reasons && (
                    <p className="text-sm text-red-600 mt-1">{errors.reasons}</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 1 Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleModalClose}>
                Cancel
              </Button>
              <Button onClick={handleNextStep}>
                Next: Choose Action
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Action Selection */}
        {step === 'action' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Choose Completion Action
              </h3>
              <p className="text-gray-600 mb-6">
                Select how you want to complete this referral.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Close Referral */}
              <motion.button
                type="button"
                onClick={handleClose}
                className="p-6 rounded-lg border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center mb-3">
                  <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                  <h4 className="font-semibold text-gray-900 group-hover:text-blue-900">
                    Close Referral
                  </h4>
                </div>
                <p className="text-sm text-gray-600 group-hover:text-blue-700 mb-3">
                  Mark this referral as completed and closed
                </p>
                <div className="flex items-center text-xs text-green-600">
                  <Download className="w-4 h-4 mr-1" />
                  Excel report will be available for download
                </div>
              </motion.button>

              {/* Transfer Referral */}
              <motion.button
                type="button"
                onClick={handleTransfer}
                className="p-6 rounded-lg border-2 border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center mb-3">
                  <ArrowRightLeft className="w-8 h-8 text-purple-600 mr-3" />
                  <h4 className="font-semibold text-gray-900 group-hover:text-purple-900">
                    Transfer Referral
                  </h4>
                </div>
                <p className="text-sm text-gray-600 group-hover:text-purple-700">
                  Transfer this referral to another department
                </p>
              </motion.button>
            </div>

            {/* Step 2 Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep('attendance')}>
                Back
              </Button>
              <Button variant="outline" onClick={handleModalClose}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Final Diagnosis (only for closure) */}
        {step === 'diagnosis' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Final Diagnosis
              </h3>
              <p className="text-gray-600 mb-6">
                Please provide the final diagnosis for this patient before closing the referral.
              </p>
            </div>

            {/* Diagnosis Category Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-blue-600" />
                Diagnosis Category <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                value={finalDiagnosisCategory}
                onChange={(e) => setFinalDiagnosisCategory(e.target.value)}
                className={cn(
                  "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors",
                  errors.diagnosisCategory ? 'border-red-300' : 'border-gray-300'
                )}
              >
                <option value="">Select diagnosis category...</option>
                {diagnosisCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.diagnosisCategory && (
                <p className="text-sm text-red-600 mt-1">{errors.diagnosisCategory}</p>
              )}
            </div>

            {/* Diagnosis Details Text Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Stethoscope className="w-4 h-4 mr-2 text-green-600" />
                Diagnosis Details <span className="text-red-500 ml-1">*</span>
                <span className="text-xs text-gray-500 ml-2">(Max 500 words)</span>
              </label>
              <VoiceTextarea
                value={finalDiagnosisDetails}
                onValueChange={(value) => setFinalDiagnosisDetails(value)}
                rows={6}
                maxLength={2500}
                className={cn(
                  "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors resize-none",
                  errors.diagnosisDetails ? 'border-red-300' : 'border-gray-300'
                )}
                placeholder="Provide detailed diagnosis, treatment summary, recommendations, and any follow-up instructions..."
              />
              <div className="flex justify-between mt-1">
                {errors.diagnosisDetails && (
                  <p className="text-sm text-red-600">{errors.diagnosisDetails}</p>
                )}
                <p className="text-xs text-gray-500 ml-auto">
                  {finalDiagnosisDetails.length}/2500 characters
                </p>
              </div>
            </div>

            {/* Step 3 Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep('action')}>
                Back to Actions
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleModalClose}>
                  Cancel
                </Button>
                <Button onClick={handleFinalComplete} className="bg-green-600 hover:bg-green-700">
                  Complete Referral
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </ResponsiveModal>
  );
};

export default ReferralCompletionModal;
