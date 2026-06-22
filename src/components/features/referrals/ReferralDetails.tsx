import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Calendar, Clock, AlertTriangle, CheckCircle, XCircle, Archive, Download, ExternalLink, Eye, File, FileImage, File as FilePdf, FileText as FileTextIcon, Shield, Tag, User, Building2, X, Stethoscope } from 'lucide-react';
import { Button } from '../../ui/Button';
import {
  useChainAttachments,
  useTransferHistory,
  useMedicationHistory,
  useCompleteMedicationTrail,
  useTransferReferral,
} from '../../../hooks/useReferrals';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../../lib/utils';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { Referral, ReferralStatus, ReferralAttachment } from '../../../types/referral.types';
import { mapStatusForDisplay } from '../../../types/referral.types';
import { ReferralCompletionModal, type CompletionData, type TransferData } from './ReferralCompletionModal';
import { ReferralTransferModal } from './ReferralTransferModal';
import { generateReferralExcelReport } from '../../../utils/excelExport';
import type { CompletedReferralData } from '../../../types/referral.types';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../../lib/supabase';
import { uploadMultipleFiles, getFileTypeCategory } from '../../../lib/fileUpload';
import { DeclineReferralModal } from './DeclineReferralModal';

function formatTimeAMPM(time: string): string {
  if (!time) return '';
  if (/am|pm/i.test(time)) return time;
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

interface ReferralDetailsProps {
  referral: Referral;
  direction?: 'sent' | 'received';
  onStatusChange: (id: string, status: ReferralStatus) => void;
  onClose: () => void;
}



const urgencyConfig = {
  Emergency: {
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    icon: AlertTriangle
  },
  Urgent: {
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    icon: Clock
  },
  Normal: {
    color: 'bg-neutral-500',
    bgColor: 'bg-neutral-50',
    textColor: 'text-neutral-700',
    borderColor: 'border-neutral-200',
    icon: FileText
  },
  Elective: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    icon: Calendar
  }
};

const statusConfig = {
  Received: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    icon: FileText
  },
  Accepted: {
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    icon: CheckCircle
  },
  Acknowledged: { // Database status that maps to Accepted in UI
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    icon: CheckCircle
  },
  Sent: {
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    icon: FileText
  },
  Cancelled: {
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    icon: XCircle
  },
  Closed: {
    color: 'bg-gray-500',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    icon: Archive
  }
};

export const ReferralDetails: React.FC<ReferralDetailsProps> = ({ 
  referral,
  direction = 'received',
  onStatusChange,
  onClose
}) => {
  const queryClient = useQueryClient();
  const transferReferralMutation = useTransferReferral();
  const { data: attachments = [], isLoading: loading } = useChainAttachments(referral.id);
  const { data: transferHistory = [] } = useTransferHistory(referral.id);
  const { data: medicationHistory = [] } = useMedicationHistory(referral.id);
  const { data: completeMedicationTrail = [], isLoading: isLoadingTrail, refetch: refetchTrail } = useCompleteMedicationTrail(referral.id);
  
  // Force cache invalidation on mount to ensure fresh data
  useEffect(() => {
    console.log('🔄 Component mounted, invalidating medication trail cache for:', referral.id);
    queryClient.invalidateQueries({ queryKey: ['referrals', 'detail', referral.id, 'complete-medication-trail'] });
  }, [referral.id, queryClient]);
  
  // Debug logging for complete medication trail
  useEffect(() => {
    const trail = completeMedicationTrail as any[];
    console.log('🔍 Complete Medication Trail Debug:', {
      referralId: referral.id,
      trailLength: trail.length,
      isLoading: isLoadingTrail,
      trail: trail,
      transferParentId: referral.transfer_parent_id,
      referralData: {
        id: referral.id,
        transfer_parent_id: referral.transfer_parent_id,
        status: referral.status,
        medicationGiven: referral.medicationGiven
      }
    });
    
    // Additional debugging for UI rendering
    if (trail.length > 0) {
      console.log('✅ Medication Trail Data Available:', {
        steps: trail.length,
        firstStep: trail[0],
        lastStep: trail[trail.length - 1],
        allSteps: trail.map((step: any, idx: number) => ({
          index: idx,
          stepNumber: step.step_number,
          actionType: step.action_type,
          doctor: step.doctor_name,
          medication: step.medication_prescribed
        }))
      });
      
      // Check if the array is being properly mapped
      const renderedSteps = trail.map((step: any) => `Step ${step.step_number}: ${step.action_type}`);
      console.log('🎨 Steps that should be rendered:', renderedSteps);
    } else if (!isLoadingTrail) {
      console.log('❌ No Medication Trail Data Found');
    }
  }, [referral.id, completeMedicationTrail, isLoadingTrail, referral.transfer_parent_id]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // New completion workflow states
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState<Partial<TransferData>>({});
  const { profile } = useAuthStore();

  // Helper function to deduplicate medication trail steps
  const deduplicateMedicationSteps = (steps: any[]) => {
    console.log('🔧 BEFORE deduplication:', {
      totalSteps: steps.length,
      steps: steps.map((s, i) => `${i+1}. ${s.action_type} by ${s.doctor_name} at ${s.record_timestamp}`)
    });
    
    return steps.reduce((acc: any[], step: any) => {
      // FIXED: Use more specific uniqueness criteria
      // Include referral_id to distinguish between steps in different referrals
      const uniqueKey = `${step.referral_id}-${step.action_type}-${step.doctor_name}-${step.record_timestamp}`;
      
      // Check if we already have this exact step
      const isDuplicate = acc.some(existing => {
        const existingKey = `${existing.referral_id}-${existing.action_type}-${existing.doctor_name}-${existing.record_timestamp}`;
        return existingKey === uniqueKey;
      });
      
      if (!isDuplicate) {
        acc.push(step);
      } else {
        console.log('🚫 Removing duplicate step:', {
          step: `${step.action_type} by ${step.doctor_name}`,
          timestamp: step.record_timestamp,
          referralId: step.referral_id
        });
      }
      
      return acc;
    }, []);
  };

  // Determine the final medication. If the referral is closed, use the last entry from the history.
  const finalMedication = 
    referral.status === 'Closed' && medicationHistory && medicationHistory.length > 0
      ? medicationHistory[medicationHistory.length - 1].medication_text
      : referral.medicationGiven;

  // Get urgency and status config
  const urgency = urgencyConfig[referral.urgency as keyof typeof urgencyConfig] || urgencyConfig.Normal;
  const displayStatus = mapStatusForDisplay(referral.status);
  const status = statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.Sent;
  
  const UrgencyIcon = urgency.icon;
  const StatusIcon = status.icon;

  // Handle file preview
  const handlePreview = (attachment: ReferralAttachment) => {
    if (!attachment.fileUrl || attachment.fileUrl.trim() === '') {
      toast.error('File URL not available. Please contact support if this issue persists.');
      console.error('File URL not available for:', attachment.fileName);
      return;
    }
    
    console.log('Opening preview for file:', attachment.fileName, 'URL:', attachment.fileUrl);
    setPreviewUrl(attachment.fileUrl);
    setPreviewType(attachment.fileType);
    setImageError(false);
    setShowPreview(true);
  };

  // Handle file download
  const handleDownload = (attachment: ReferralAttachment) => {
    if (!attachment.fileUrl || attachment.fileUrl.trim() === '') {
      toast.error('File URL not available. Please contact support if this issue persists.');
      console.error('File URL not available for:', attachment.fileName);
      return;
    }
    
    console.log('Downloading file:', attachment.fileName, 'URL:', attachment.fileUrl);
    
    try {
      // Create a temporary anchor element to trigger download
      const a = document.createElement('a');
      a.href = attachment.fileUrl;
      a.download = attachment.fileName;
      a.target = '_blank'; // Open in new tab as fallback
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success(`Downloading ${attachment.fileName}`);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed. Trying to open in new tab...');
      // Fallback: open in new tab
      window.open(attachment.fileUrl, '_blank');
    }
  };

  // Get file icon based on type
  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image':
        return <FileImage className="w-5 h-5 text-blue-600" />;
      case 'pdf':
        return <FilePdf className="w-5 h-5 text-red-600" />;
      case 'document':
        return <FileTextIcon className="w-5 h-5 text-blue-600" />;
      case 'text':
        return <FileText className="w-5 h-5 text-gray-600" />;
      default:
        return <File className="w-5 h-5 text-gray-600" />;
    }
  };

  // Handle decline with reason
  const handleDecline = async (reasonCode: string, reasonText: string) => {
    try {
      // Step 1: Save the decline reason to the new table
      const { data, error } = await (supabase as any)
        .from('referral_decline_reasons')
        .insert({
          referral_id: referral.id,
          reason_code: reasonCode,
          reason_text: reasonText,
          declined_by: profile?.id
        })
        .select('id')
        .single();

      if (error) throw error;

      // Step 2: Update the referral with the new decline_reason_id
      await (supabase as any)
        .from('referrals')
        .update({ decline_reason_id: data.id, status: 'Cancelled' })
        .eq('id', referral.id);

      // Step 3: Update local UI state
      onStatusChange(referral.id, 'Cancelled');
      
      toast.success(`Referral declined: ${reasonText}`);
      setShowDeclineModal(false);
      onClose();

    } catch (error) {
      console.error('❌ Error declining referral:', error);
      toast.error('Failed to decline referral. Please try again.');
    }
  };

  // Handle completion workflow
  const handleReferralCompletion = async (completionData: CompletionData) => {
    try {
      if (completionData.action === 'close') {
        if (!completionData.isPatientAttended) {
          // Handle cases where patient was not attended - simply close the referral
          onStatusChange(referral.id, 'Closed');
          setShowCompletionModal(false);
          onClose();
          return;
        }

        // Use the same complete_referral RPC as the card quick action path
        console.log('📝 Completing referral with RPC:', referral.id);
        const { error } = await (supabase as any).rpc('complete_referral', {
          p_referral_id: referral.id,
          p_updated_medication: completionData.updatedMedication || referral.medicationGiven,
          p_completed_by_user_id: profile?.id,
          p_final_diagnosis_category: completionData.finalDiagnosisCategory,
          p_final_diagnosis_details: completionData.finalDiagnosisDetails
        });

        if (error) {
          throw error;
        }

        toast.success('Referral completed successfully!');
        
        // Generate Excel report with the completion data
        try {
          // Fetch fresh medication history and complete trail
          const [medicationHistoryResult, completeMedicationTrailResult] = await Promise.all([
            (supabase as any).rpc('get_medication_timeline', {
              p_referral_id: referral.id
            }),
            (supabase as any).rpc('get_complete_medication_trail', {
              p_referral_id: referral.id
            })
          ]);

          const freshMedicationHistory = medicationHistoryResult.data;
          const completeMedicationTrail = completeMedicationTrailResult.data || [];

          // The in-memory referral never carries attachments — count them across the
          // whole transfer chain (derive chain referral ids from the trail) so the
          // report reflects every file added at any hop, not 0.
          const chainReferralIds = Array.from(new Set(
            (completeMedicationTrail as any[]).map((s: any) => s.referral_id).filter(Boolean)
          ));
          if (chainReferralIds.length === 0) chainReferralIds.push(referral.id);
          const { data: chainAttachments } = await supabase
            .from('referral_attachments').select('id').in('referral_id', chainReferralIds);
          const chainAttachmentIds = ((chainAttachments as any[]) || []).map((a: any) => a.id as string);

          console.log('📊 Excel Report Data:', {
            referralId: referral.id,
            medicationHistoryCount: freshMedicationHistory?.length || 0,
            completeMedicationTrailCount: completeMedicationTrail?.length || 0,
            chainAttachmentCount: chainAttachmentIds.length,
            trail: completeMedicationTrail
          });

          const reportData: CompletedReferralData = {
            referral: {
              ...referral,
              attachments: chainAttachmentIds,
              medication_history: freshMedicationHistory || []
            },
            completionData: {
              isPatientAttended: completionData.isPatientAttended,
              updatedMedication: completionData.updatedMedication || referral.medicationGiven,
              reasons: completionData.reasons,
              completedAt: new Date().toISOString(),
              completedBy: profile?.full_name || 'Unknown User',
              finalDiagnosisCategory: completionData.finalDiagnosisCategory,
              finalDiagnosisDetails: completionData.finalDiagnosisDetails,
              finalDiagnosisTimestamp: completionData.finalDiagnosisCategory || completionData.finalDiagnosisDetails ? new Date().toISOString() : undefined,
              finalDiagnosisBy: completionData.finalDiagnosisCategory || completionData.finalDiagnosisDetails ? profile?.full_name || 'Unknown User' : undefined
            },
            transferHistory: transferHistory || [],
            completeMedicationTrail: completeMedicationTrail || []
          };
          
          await generateReferralExcelReport(reportData);
          
          toast.success('Excel report generated successfully!');
        } catch (error) {
          console.error('Error generating Excel report:', error);
          // Don't show error toast as the referral was completed successfully
        }
        
        // Update the referral status locally and in the parent component
        onStatusChange(referral.id, 'Closed');
        
        // Close modals
        setShowCompletionModal(false);
        onClose();

      } else {
        // This is the transfer workflow, which is handled separately.
        setTransferData(completionData);
        setShowCompletionModal(false);
        setShowTransferModal(true);
      }
    } catch (error) {
      console.error('❌ Error processing referral completion:', error);
      toast.error('Failed to complete referral. Please try again.');
    }
  };

  // Handle transfer option from completion modal
  const handleTransferOption = (completionData: CompletionData) => {
    // Store completion data and open transfer modal
    setTransferData(completionData);
    setShowCompletionModal(false);
    setShowTransferModal(true);
  };

  // Handle referral transfer — calls the real transfer_referral RPC
  const handleReferralTransfer = (incomingTransferData: TransferData) => {
    if (!profile?.id) {
      toast.error('User session not found. Please refresh and try again.');
      return;
    }

    const transferPayload = {
      originalReferralId: referral.id,
      newToUserId: incomingTransferData.doctorId,
      newToDepartment: incomingTransferData.department,
      transferReason: incomingTransferData.transferReason || '',
      transferNotes: incomingTransferData.specialNotes || '',
      transferredByUserId: profile.id,
      updatedMedicationOnTransfer: incomingTransferData.updatedMedication
    };

    transferReferralMutation.mutate(transferPayload, {
      onSuccess: async (newReferralId: string) => {
        // Persist any files the doctor attached during the transfer onto the NEW
        // child referral, so they surface at this hop of the chain journey (the
        // child's from_user_id is the transferring doctor, so the RLS INSERT
        // policy on referral_attachments permits this). Best-effort: a file
        // failure must NOT undo the already-committed transfer — but unlike the
        // old create path, we surface failures as toasts instead of swallowing.
        const files = incomingTransferData.attachments || [];
        if (newReferralId && files.length > 0) {
          try {
            const uploadResults = await uploadMultipleFiles(files);
            for (let i = 0; i < uploadResults.length; i++) {
              const res = uploadResults[i];
              const srcFile = files[i];
              if (res.success && res.fileName && res.fileUrl) {
                const { error: attErr } = await supabase
                  .from('referral_attachments')
                  .insert({
                    referral_id: newReferralId,
                    file_name: res.fileName,
                    file_type: getFileTypeCategory(srcFile.type),
                    file_url: res.fileUrl,
                    uploaded_by: profile.id,
                  });
                if (attErr) {
                  console.error('Transfer attachment insert failed:', attErr);
                  toast.error(`Could not save attachment "${srcFile?.name || res.fileName}"`);
                }
              } else {
                toast.error(`Upload failed for "${srcFile?.name || 'file'}": ${res.error || 'unknown error'}`);
              }
            }
          } catch (e) {
            console.error('Transfer attachment processing failed:', e);
            toast.error('Some attachments could not be saved.');
          }
        }
        queryClient.invalidateQueries({ queryKey: ['referrals'] });
        setShowTransferModal(false);
        onClose();
      },
      onError: (error: any) => {
        toast.error(`Transfer failed: ${error?.message || 'Unknown error'}`);
      }
    });
  };

  // Handle on-demand Excel report download for closed referrals
  const [isDownloading, setIsDownloading] = useState(false);
  const handleDownloadReport = async () => {
    console.log('🚀 === EXCEL REPORT GENERATION START ===');
    console.log('📋 Referral ID:', referral.id);
    console.log('👤 User Profile:', profile);
    console.log('📊 Initial Data:', {
      medicationHistoryLength: medicationHistory.length,
      transferHistoryLength: transferHistory?.length || 0,
      referralStatus: referral.status,
      hasTransferParent: !!referral.transfer_parent_id
    });

    try {
      setIsDownloading(true);
      console.log('⏳ Loading state set to true');
      
      // Step 1: Handle final diagnosis data
      console.log('📋 Step 1: Processing final diagnosis data...');
      let finalDiagnosisData = {
        category: (referral as any).final_diagnosis_category || referral.finalDiagnosisCategory,
        details: (referral as any).final_diagnosis_details || referral.finalDiagnosisDetails,
        timestamp: (referral as any).final_diagnosis_timestamp || referral.finalDiagnosisTimestamp,
        by: (referral as any).final_diagnosis_by || referral.finalDiagnosisBy
      };
      console.log('📋 Initial final diagnosis data:', finalDiagnosisData);
      console.log('📋 Raw referral diagnosis fields:', {
        snake_case: {
          category: (referral as any).final_diagnosis_category,
          details: (referral as any).final_diagnosis_details,
          timestamp: (referral as any).final_diagnosis_timestamp,
          by: (referral as any).final_diagnosis_by
        },
        camelCase: {
          category: referral.finalDiagnosisCategory,
          details: referral.finalDiagnosisDetails,
          timestamp: referral.finalDiagnosisTimestamp,
          by: referral.finalDiagnosisBy
        }
      });

      // The final diagnosis is recorded on the referral that was actually COMPLETED
      // (this one), NOT on the parent it was transferred from. Fetch it fresh from
      // this referral's DB row so a re-download always reflects the stored diagnosis.
      try {
        const { data: diagRow, error: diagErr } = await (supabase as any)
          .from('referrals')
          .select('final_diagnosis_category, final_diagnosis_details, final_diagnosis_timestamp, final_diagnosis_by')
          .eq('id', referral.id)
          .single();

        if (diagErr) {
          console.error('❌ Error fetching final diagnosis:', diagErr);
        } else if (diagRow) {
          finalDiagnosisData = {
            category: diagRow.final_diagnosis_category,
            details: diagRow.final_diagnosis_details,
            timestamp: diagRow.final_diagnosis_timestamp,
            by: diagRow.final_diagnosis_by
          };
          console.log('✅ Final diagnosis fetched from completed referral:', finalDiagnosisData);
        }
      } catch (diagnosisError: any) {
        console.error('❌ Critical error in final diagnosis fetch:', diagnosisError);
      }
      
      // Step 1.5: Resolve final diagnosis user ID to user name
      if (finalDiagnosisData.by && typeof finalDiagnosisData.by === 'string' && finalDiagnosisData.by.includes('-')) {
        console.log('🔄 Step 1.5: Resolving diagnosis user ID to name:', finalDiagnosisData.by);
        try {
          const { data: userData, error: userError } = await (supabase as any)
            .from('users')
            .select('full_name')
            .eq('id', finalDiagnosisData.by)
            .single();

          if (userError) {
            console.error('❌ Error fetching user name:', userError);
          } else if (userData) {
            finalDiagnosisData.by = userData.full_name;
            console.log('✅ Resolved diagnosis user name:', userData.full_name);
          }
        } catch (userResolveError: any) {
          console.error('❌ Critical error resolving diagnosis user:', userResolveError);
          // Keep the original ID if resolution fails
        }
      }
      
      // Step 2: Fetch complete medication trail
      console.log('💊 Step 2: Fetching complete medication trail...');
      let completeMedicationTrail: any[] = [];
      try {
        const { data: completeMedicationTrailData, error: trailError } = await (supabase as any).rpc('get_complete_medication_trail', {
          p_referral_id: referral.id
        });

        if (trailError) {
          console.error('❌ Error fetching complete medication trail:', trailError);
          throw new Error(`Medication trail fetch failed: ${trailError.message}`);
        }

        completeMedicationTrail = completeMedicationTrailData || [];
        console.log('✅ Complete medication trail fetched:', {
          count: completeMedicationTrail.length,
          data: completeMedicationTrail.slice(0, 2) // Show first 2 entries for debugging
        });
      } catch (trailError: any) {
        console.error('❌ Critical error in medication trail fetch:', trailError);
        throw new Error(`Medication trail processing failed: ${trailError.message}`);
      }

      // Step 2.5: Count attachments across the whole chain (the in-memory referral
      // object never carries attachments, so the report would otherwise show 0).
      let chainAttachmentIds: string[] = [];
      try {
        const chainIds = Array.from(new Set(
          (completeMedicationTrail as any[]).map((s: any) => s.referral_id).filter(Boolean)
        ));
        if (chainIds.length === 0) chainIds.push(referral.id);
        const { data: atts } = await supabase
          .from('referral_attachments').select('id').in('referral_id', chainIds);
        chainAttachmentIds = ((atts as any[]) || []).map((a: any) => a.id as string);
      } catch (attErr) {
        console.error('❌ Attachment count fetch failed:', attErr);
      }

      // Step 3: Determine final medication
      console.log('💊 Step 3: Determining final medication...');
      const finalMedication = medicationHistory.length > 0 
        ? medicationHistory[medicationHistory.length - 1].medication_text 
        : referral.medicationGiven;
      console.log('💊 Final medication determined:', finalMedication);

      // Step 4: Build report data structure
      console.log('📄 Step 4: Building report data structure...');
      const reportData: CompletedReferralData = {
        referral: {
          ...referral,
          medicationGiven: referral.medicationGiven || 'No medication information available',
          attachments: chainAttachmentIds,
          medication_history: medicationHistory
        },
        completionData: {
          isPatientAttended: true, // closed referrals were attended
          updatedMedication: finalMedication,
          reasons: undefined,
          completedAt: referral.end_time || new Date().toISOString(),
          completedBy: finalDiagnosisData.by || profile?.full_name || 'Unknown User',
          finalDiagnosisCategory: finalDiagnosisData.category,
          finalDiagnosisDetails: finalDiagnosisData.details,
          finalDiagnosisTimestamp: finalDiagnosisData.timestamp,
          finalDiagnosisBy: finalDiagnosisData.by
        },
        transferHistory: transferHistory || [],
        completeMedicationTrail: completeMedicationTrail
      };
      
      console.log('📄 Final report data structure:', {
        referralId: reportData.referral.id,
        patientName: reportData.referral.patientName,
        medicationHistoryCount: reportData.referral.medication_history?.length || 0,
        transferHistoryCount: reportData.transferHistory.length,
        completeMedicationTrailCount: reportData.completeMedicationTrail.length,
        hasFinalDiagnosis: !!(reportData.completionData.finalDiagnosisCategory || reportData.completionData.finalDiagnosisDetails)
      });

      // Step 5: Generate Excel report
      console.log('📊 Step 5: Calling generateReferralExcelReport...');
      await generateReferralExcelReport(reportData);
      console.log('✅ Excel report generation completed successfully!');
      
      toast.success('Excel report downloaded successfully!');
      console.log('🎉 === EXCEL REPORT GENERATION SUCCESS ===');
      
    } catch (error: any) {
      console.error('💥 === EXCEL REPORT GENERATION FAILED ===');
      console.error('❌ Error Type:', error.constructor.name);
      console.error('❌ Error Message:', error.message);
      console.error('❌ Error Stack:', error.stack);
      console.error('❌ Referral Context:', {
        referralId: referral.id,
        referralStatus: referral.status,
        patientName: referral.patientName,
        hasTransferParent: !!referral.transfer_parent_id,
        transferParentId: referral.transfer_parent_id
      });
      
      // More specific error messages
      let userMessage = 'Failed to generate report';
      if (error.message.includes('Final diagnosis fetch failed')) {
        userMessage = 'Failed to fetch referral diagnosis data';
      } else if (error.message.includes('Medication trail')) {
        userMessage = 'Failed to fetch medication history';
      } else if (error.message.includes('buildReportData')) {
        userMessage = 'Failed to process report data';
      } else if (error.message.includes('XLSX')) {
        userMessage = 'Failed to generate Excel file';
      }
      
      toast.error(`${userMessage}: ${error.message}`);
      console.error('🚨 User notified with error message:', userMessage);
      
    } finally {
      setIsDownloading(false);
      console.log('🔄 Loading state reset to false');
      console.log('🏁 === EXCEL REPORT GENERATION END ===');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Status and Urgency */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Patient Referral</h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Badge */}
            <div className={cn(
              "flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
              status.bgColor,
              status.textColor
            )}>
              <StatusIcon size={16} className="mr-1.5" />
              {displayStatus}
            </div>
            
            {/* Urgency Badge */}
            <div className={cn(
              "flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
              urgency.bgColor,
              urgency.textColor
            )}>
              <UrgencyIcon size={16} className="mr-1.5" />
              {referral.urgency}
            </div>
            
            {/* Date Badge */}
            <div className="flex items-center text-sm text-gray-600">
              <Calendar size={14} className="mr-1.5" />
              {format(new Date(referral.createdAt), 'MMM d, yyyy')}
            </div>
          </div>
        </div>
      </div>

      {/* Patient Information */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <User className="w-5 h-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-blue-900">Patient Information</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700 mb-1">Name</p>
            <p className="text-base font-semibold text-gray-900">{referral.patientName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-700 mb-1">Age</p>
            <p className="text-base font-semibold text-gray-900">{referral.age} years</p>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-700 mb-1">Sex</p>
            <p className="text-base font-semibold text-gray-900">{referral.sex}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-700 mb-1">Room No</p>
            <p className="text-base font-semibold text-gray-900">{referral.roomNo || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-700 mb-1">Patient IP No</p>
            <p className="text-base font-semibold text-gray-900">{referral.patientIpNo || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-700 mb-1">Admission Date</p>
            <p className="text-base font-semibold text-gray-900">
              {format(new Date(referral.admissionDate), 'MMMM d, yyyy')}
              {referral.patientAdmissionTime && (
                <span className="text-sm font-normal text-blue-600 ml-2">
                  at {formatTimeAMPM(referral.patientAdmissionTime)}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Chief Complaint */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <Tag className="w-5 h-5 text-gray-600 mr-2" />
          Chief Complaint
        </h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-gray-800 whitespace-pre-wrap">{referral.chiefComplaint}</p>
        </div>
      </div>

      {/* Past History */}
      {referral.pastHistory && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <FileText className="w-5 h-5 text-blue-600 mr-2" />
            Past History
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-gray-800 whitespace-pre-wrap">{referral.pastHistory}</p>
          </div>
        </div>
      )}

      {/* General Examination */}
      {referral.generalExamination && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <Stethoscope className="w-5 h-5 text-purple-600 mr-2" />
            General Examination
          </h3>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-gray-800 whitespace-pre-wrap">{referral.generalExamination}</p>
          </div>
        </div>
      )}

      {/* Enhanced Medication Information with Complete Trail */}
      {(referral.medicationGiven || referral.initialMedication || (completeMedicationTrail as any[]).length > 0 || isLoadingTrail) && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <Stethoscope className="w-5 h-5 text-green-600 mr-2" />
            Medication Information
          </h3>
          
                    {/* Show complete medication trail if available */}
          {(() => {
            const trail = completeMedicationTrail as any[];
            console.log('🔍 Medication Trail Display Check:', {
              trail,
              isArray: Array.isArray(trail),
              length: trail?.length,
              type: typeof trail,
              firstItem: trail?.[0],
              allSteps: trail?.map(s => `${s.step_number}: ${s.action_type} by ${s.doctor_name}`)
            });
            return trail && Array.isArray(trail) && trail.length > 0;
          })() ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-blue-700 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Complete Medication Journey ({(completeMedicationTrail as any[]).length} steps)
                  </h4>
                  {/* Debug button to manually refetch */}
                  <button
                    onClick={() => {
                      console.log('🔄 Manually refetching medication trail...');
                      refetchTrail();
                    }}
                    className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded"
                  >
                    🔄 Refresh
                  </button>
                </div>
                {isLoadingTrail ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-blue-600">Loading complete medication trail...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      // FIXED: Remove duplicates and fix step numbering
                      const uniqueSteps = deduplicateMedicationSteps(completeMedicationTrail as any[]);
                      
                      // Re-number the steps after deduplication
                      const reNumberedSteps = uniqueSteps.map((step, index) => ({
                        ...step,
                        display_step_number: index + 1
                      }));
                      
                      console.log('🎯 FIXED Medication Journey:', {
                        originalCount: (completeMedicationTrail as any[]).length,
                        uniqueCount: reNumberedSteps.length,
                        removedDuplicates: (completeMedicationTrail as any[]).length - reNumberedSteps.length
                      });
                      
                      return reNumberedSteps.map((step: any, index: number) => (
                        <div
                          key={`${step.referral_id}-${step.display_step_number}-${index}-fixed`}
                          data-testid={`medication-step-${step.display_step_number}`}
                          className="flex items-start" // Use flexbox for robust layout
                        >
                        {/* Timeline Column */}
                        <div className="flex flex-col items-center mr-4">
                          {/* Timeline dot */}
                          <div className={cn(
                            "w-3 h-3 rounded-full border-2 bg-white z-10",
                            step.action_type === 'Created Referral' ? "border-blue-500" :
                            step.action_type === 'Updated During Transfer' ? "border-orange-500" :
                            "border-green-500"
                          )} />
                          {/* Timeline line */}
                          {index < reNumberedSteps.length - 1 && (
                            <div className="w-0.5 flex-grow bg-blue-200" />
                          )}
                        </div>
                        
                        {/* Step content */}
                        <div className="bg-white border border-gray-200 rounded-lg p-3 flex-1 mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className={cn(
                                "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                                step.action_type === 'Created Referral' ? "bg-blue-100 text-blue-800" :
                                step.action_type === 'Updated During Transfer' ? "bg-orange-100 text-orange-800" :
                                step.action_type === 'Received Transfer' ? "bg-purple-100 text-purple-800" :
                                step.action_type === 'Completed Referral' ? "bg-green-100 text-green-800" :
                                "bg-gray-100 text-gray-800"
                              )}>
                                Step {step.display_step_number}: {step.action_type}
                              </span>
                              {step.is_original_referral && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  Original
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{step.record_timestamp ? format(new Date(step.record_timestamp), 'MMM d, yyyy h:mm a') : ''}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center text-sm">
                              <User className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="font-medium text-gray-900">{step.doctor_name}</span>
                              <span className="text-gray-500 ml-2">({step.department_context})</span>
                            </div>
                            
                            <div className="bg-gray-50 rounded p-3">
                              <p className="text-sm font-medium text-gray-700 mb-1">Medication Prescribed:</p>
                              <p className="text-gray-900 whitespace-pre-wrap font-mono text-sm bg-white border rounded px-2 py-1">
                                {step.medication_prescribed}
                              </p>
                            </div>
                            
                            <p className="text-xs text-gray-600 italic">{step.medication_context}</p>
                          </div>
                        </div>
                      </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
              
              {/* Summary section showing first and last medication */}
              {(() => {
                // Use the same deduplication logic for the summary
                const uniqueSteps = deduplicateMedicationSteps(completeMedicationTrail as any[]);
                
                return uniqueSteps.length > 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-700 mb-1">Original Medication</p>
                      <p className="text-gray-800 whitespace-pre-wrap font-mono text-sm">
                        {uniqueSteps[0]?.medication_prescribed || 'N/A'}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        By {uniqueSteps[0]?.doctor_name}
                      </p>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-green-700 mb-1">
                        {referral.status === 'Closed' ? 'Final Medication' : 'Current Medication'}
                      </p>
                      <p className="text-gray-800 whitespace-pre-wrap font-mono text-sm">
                        {uniqueSteps[uniqueSteps.length - 1]?.medication_prescribed || 'N/A'}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        By {uniqueSteps[uniqueSteps.length - 1]?.doctor_name}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Fallback to original medication display if trail is not available */
            <div className="space-y-3">
              {/* Initial Medication */}
              {referral.initialMedication && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-700 mb-1">Initial Medication</p>
                  <p className="text-gray-800 whitespace-pre-wrap">{referral.initialMedication}</p>
                </div>
              )}
              
              {/* Current/Final Medication */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-green-700 mb-1">
                  {referral.status === 'Closed' ? 'Final Medication' : 'Current Medication'}
                </p>
                <p className="text-gray-800 whitespace-pre-wrap">{finalMedication}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Referral Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* From */}
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <User className="w-5 h-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-purple-900">From</h3>
          </div>
          <p className="text-base font-semibold text-gray-900 mb-1">{referral.fromDoctor}</p>
          <div className="flex items-center text-sm text-gray-600">
            <Building2 className="w-4 h-4 mr-1.5" />
            <span>{referral.fromDepartment}</span>
          </div>
        </div>
        
        {/* To */}
        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <User className="w-5 h-5 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-green-900">To</h3>
          </div>
          <p className="text-base font-semibold text-gray-900 mb-1">{referral.doctor}</p>
          <div className="flex items-center text-sm text-gray-600">
            <Building2 className="w-4 h-4 mr-1.5" />
            <span>{referral.department}</span>
          </div>
        </div>
      </div>

      {/* Transfer History */}
      {transferHistory && (transferHistory as any[]).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <ExternalLink className="w-5 h-5 text-gray-600 mr-2" />
            Transfer History
          </h3>
          <div className="space-y-4">
            {(transferHistory as any[]).filter((t: any) => t.from_doctor).map((transfer: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="font-semibold">{transfer.from_doctor} ({transfer.from_department}) transferred to {transfer.to_doctor} ({transfer.to_department})</p>
                <p className="text-sm text-gray-600">Date: {format(new Date(transfer.transferred_at), 'MMM d, yyyy, p')}</p>
                <p className="text-sm text-gray-600 font-mono">Referral ID: {transfer.referral_id}</p>
                {transfer.transfer_reason && <p className="text-sm text-gray-600">Reason: {transfer.transfer_reason}</p>}
                {transfer.transfer_notes && <p className="text-sm text-gray-600">Notes: {transfer.transfer_notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments — always shown so users can see "no attachments" rather than a blank gap */}
      <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center" id="attachments-section">
            <FileText className="w-5 h-5 text-gray-600 mr-2" />
            Attachments
            {!loading && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({attachments.length} {attachments.length === 1 ? 'file' : 'files'} across this referral journey)
              </span>
            )}
          </h3>

          {loading ? (
            <div className="flex justify-center items-center h-24 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : attachments.length === 0 ? (
            <div className="flex items-center justify-center h-16 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
              No attachments for this referral journey
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(
                (attachments as any[]).reduce((groups: Record<string, any[]>, att: any) => {
                  const key = String(att.hopLevel ?? 0);
                  (groups[key] = groups[key] || []).push(att);
                  return groups;
                }, {} as Record<string, any[]>)
              )
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([hopKey, items]) => {
                  const groupItems = items as any[];
                  const first = groupItems[0];
                  const hopLevel = first.hopLevel ?? 0;
                  const isCurrent = groupItems.some((i: any) => i.isCurrentReferral);
                  const hopLabel = hopLevel === 0 ? 'ORIGIN' : `HOP ${hopLevel + 1}`;
                  return (
                    <div key={hopKey}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded',
                          isCurrent ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        )}>
                          {hopLabel}{isCurrent ? ' · THIS REFERRAL' : ''}
                        </span>
                        {first.departmentContext && (
                          <span className="text-xs text-gray-500 flex items-center">
                            <Building2 className="w-3 h-3 mr-1" />
                            {first.departmentContext}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {groupItems.map((attachment: any) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center">
                              {getFileIcon(attachment.fileType)}
                              <div className="ml-3">
                                <p className="text-sm font-medium text-gray-900">{attachment.fileName}</p>
                                <div className="flex items-center text-xs text-gray-500 mt-1">
                                  <span className="mr-3">{attachment.fileSize}</span>
                                  <span className="mr-3">{format(new Date(attachment.createdAt), 'MMM d, yyyy')}</span>
                                  {attachment.uploadedBy && attachment.uploadedBy !== 'Unknown' && (
                                    <span>by {attachment.uploadedBy}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e: React.MouseEvent) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handlePreview(attachment);
                                }}
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                <Eye size={14} className="mr-1" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e: React.MouseEvent) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDownload(attachment);
                                }}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                              >
                                <Download size={14} className="mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
      </div>

      {/* Security Note */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
        <div className="flex items-center">
          <Shield className="w-3 h-3 mr-1 text-green-600" />
          <span>All referral data is encrypted and HIPAA compliant</span>
        </div>
        

      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
        {referral.status === 'Received' && direction === 'received' && (
          <>
            <Button
              onClick={() => {
                onStatusChange(referral.id, 'Accepted');
                onClose();
              }}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-500"
            >
              <CheckCircle size={16} className="mr-2" />
              Accept Referral
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeclineModal(true);
              }}
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
            >
              <XCircle size={16} className="mr-2" />
              Decline
            </Button>
          </>
        )}
        
        {(referral.status === 'Acknowledged' || referral.status === 'Accepted') && (
          <Button
            onClick={() => setShowCompletionModal(true)}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            <Archive size={16} className="mr-2" />
            Mark as Completed
          </Button>
        )}
        
        {/* Download Report button for closed referrals */}
        {referral.status === 'Closed' && (
          <Button
            onClick={handleDownloadReport}
            disabled={isDownloading}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-500"
          >
            {isDownloading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Download size={16} className="mr-2" />
                Download Report
              </>
            )}
          </Button>
        )}
        
        {/* Cancel button always visible */}
        <Button
          variant="outline"
          onClick={onClose}
          className={referral.status !== 'Received' && referral.status !== 'Acknowledged' && referral.status !== 'Accepted' && referral.status !== 'Closed' ? "flex-1" : ""}
        >
          Close
        </Button>
      </div>

      {/* Decline Reason Modal */}
      <DeclineReferralModal
        isOpen={showDeclineModal}
        onClose={() => setShowDeclineModal(false)}
        onDecline={handleDecline}
      />
      


      {/* File Preview Modal */}
      {showPreview && previewUrl && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="bg-white rounded-lg p-4 max-w-4xl max-h-[90vh] w-full flex flex-col"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">File Preview</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(false)}
              >
                <X size={20} />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {previewType === 'image' ? (
                <img 
                  src={previewUrl} 
                  alt={imageError ? "Image preview failed to load" : "Preview"} 
                  className="max-w-full h-auto mx-auto object-contain"
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    console.error('Image failed to load:', previewUrl, e);
                    setImageError(true);
                    e.currentTarget.src = 'https://placehold.co/600x400?text=Image+Not+Available';
                    toast.error('Failed to load image. URL may be incorrect or inaccessible.');
                  }}
                />
              ) : previewType === 'pdf' ? (
                <iframe 
                  src={previewUrl} 
                  className="w-full h-full min-h-[500px]" 
                  title="PDF Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64">
                  <FileText className="w-16 h-16 text-gray-400 mb-4" />
                  <p className="text-gray-600">Preview not available</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewUrl, '_blank')}
                    className="mt-4"
                  >
                    <ExternalLink size={14} className="mr-2" />
                    Open in new tab
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Completion Modal */}
      <ReferralCompletionModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        referral={referral}
        onComplete={handleReferralCompletion}
        onTransfer={handleTransferOption}
      />

      {/* Transfer Modal */}
      <ReferralTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        referral={referral}
        transferData={transferData}
        onTransfer={handleReferralTransfer}
      />
    </div>
  );
};

export default ReferralDetails;
