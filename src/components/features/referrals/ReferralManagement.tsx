import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Filter,
  Zap,
  ChevronLeft,
  Search, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Archive,
  ChevronRight,
  AlertTriangle,
  Calendar,
  User,
  Building2
} from 'lucide-react';
import { useResponsive } from '../../../hooks/useResponsive';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ResponsiveModal } from '../../ui/ResponsiveModal';
import { ReferralForm } from './ReferralForm';
import { ReferralCard } from './ReferralCard';
import { ReferralTabs } from './ReferralTabs';
import { ReferralDetails } from './ReferralDetails';
import { ReferralCompletionModal, type CompletionData, type TransferData } from './ReferralCompletionModal';
import { ReferralTransferModal } from './ReferralTransferModal';
import { cn } from '../../../lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useReferrals, useCreateReferral, useUpdateReferralStatus, useAddMedicationHistory, useTransferReferral, referralKeys, useAddDeclineReason, fetchReferralChainTimeline } from '../../../hooks/useReferrals';
import { useCompleteMedicationTrail } from '../../../hooks/useCompleteMedicationTrail';
import { mapStatusForDisplay } from '../../../types/referral.types';
import { useAuthStore } from '../../../store/authStore';
import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import type { Referral, ReferralStatus, UrgencyLevel } from '../../../types/referral.types';
import type { CompletedReferralData } from '../../../utils/excelExport';
import { DeclineReferralModal } from './DeclineReferralModal';

interface ReferralData {
  id: string;
}

const ReferralManagement: React.FC = () => {
  const { isMobile } = useResponsive();
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ReferralStatus | 'Archive'>('Received');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [referralToComplete, setReferralToComplete] = useState<Referral | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [referralToTransfer, setReferralToTransfer] = useState<Referral | null>(null);
  // Medication/attendance captured in the completion modal when the doctor chose "Transfer".
  // Must be carried into the transfer RPC so a transfer-time medication change is recorded.
  const [transferContext, setTransferContext] = useState<{ isPatientAttended: boolean; updatedMedication?: string; reasons?: string } | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [referralToDecline, setReferralToDecline] = useState<Referral | null>(null);
  const addDeclineReasonMutation = useAddDeclineReason();

  // React Query hooks
  const { data: referrals = [], isLoading, error, refetch } = useReferrals();
  const createReferralMutation = useCreateReferral();
  const updateStatusMutation = useUpdateReferralStatus();
  const addMedicationHistory = useAddMedicationHistory();
  const transferReferralMutation = useTransferReferral();
  const queryClient = useQueryClient();

  // Refetch on mount to ensure we have the latest data
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Filter referrals based on active tab and search query
  const filteredReferrals = useMemo(() => referrals.filter(referral => {
    // Determine the user's perspective on the referral
    const direction = referral.fromDoctor === profile?.full_name ? 'sent' : 'received';
    
    const matchesSearch = searchQuery === '' || 
      referral.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      referral.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      referral.doctor.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    // Strict filtering based on tab and direction
    switch (activeTab) {
      case 'Received':
        return direction === 'received' && referral.status === 'Received';
      case 'Accepted':
        return direction === 'received' && (referral.status === 'Accepted' || referral.status === 'Acknowledged');
      case 'Sent':
        // Show referrals the user originated OR transferred onward (they are the fromDoctor).
        // We intentionally do NOT also surface the old "Transferred" original to the doctor
        // who transferred it — after a hop they already see the active onward card (the child
        // they sent), so showing the original too would duplicate the same patient under Sent.
        return direction === 'sent';
      case 'Closed':
        return referral.status === 'Closed';
      case 'Cancelled':
        return referral.status === 'Cancelled';
      case 'Archive':
        return true; // Archive shows all, can be refined later if needed
      default:
        return false;
    }
  }), [referrals, activeTab, searchQuery, profile?.full_name]);

  // Separate referrals into top 10 and archive
  const [topReferrals, archiveReferrals] = useMemo(() => { 
    if (activeTab === 'Archive') {
      return [[], filteredReferrals];
    }
    
    // Sort by creation date (newest first)
    const sorted = [...filteredReferrals].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Split into top 10 and archive
    const top = sorted.slice(0, 10);
    const archive = sorted.slice(10);
    
    return [top, archive];
  }, [filteredReferrals, activeTab]);

  // Get counts for each tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'Received': 0,
      'Accepted': 0,
      'Sent': 0,
      'Cancelled': 0,
      'Closed': 0,
      'Archive': 0
    };
    
    referrals.forEach(referral => {
      const direction = referral.fromDoctor === profile?.full_name ? 'sent' : 'received';

      // Count "Sent" using the same logic as the filter above
      if (direction === 'sent') {
        counts['Sent']++;
      } else { // direction is 'received'
        switch (referral.status) {
        case 'Received':
          counts['Received']++;
          break;
        case 'Accepted':
          case 'Acknowledged':
          counts['Accepted']++;
          break;
        }
      }

      // These statuses are direction-agnostic
      if (referral.status === 'Closed') {
        counts['Closed']++;
      }
      if (referral.status === 'Cancelled') {
        counts['Cancelled']++;
      }
    });
    
    counts['Archive'] = referrals.length; // Can be refined later
    
    return counts;
  }, [referrals, profile?.full_name]);
  
  // Debug referral counts
  useEffect(() => {
    console.log('Referral counts by status:', tabCounts);
  }, [tabCounts]);

  const handleDeclineReferral = (referral: Referral) => {
    setReferralToDecline(referral);
    setShowDeclineModal(true);
  };

  const handleDeclineConfirm = async (reasonCode: string, reasonText: string) => {
    if (!referralToDecline || !profile?.id) return;
    try {
      await addDeclineReasonMutation.mutateAsync({
        referral_id: referralToDecline.id,
        reason_code: reasonCode,
        reason_text: reasonText,
        declined_by: profile.id
      });
      updateStatusMutation.mutate({ id: referralToDecline.id, status: 'Cancelled' });
      toast.success('Referral declined');
      setShowDeclineModal(false);
      setReferralToDecline(null);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleCreateReferral = useCallback((newReferral: Omit<Referral, 'id' | 'createdAt' | 'status'> & { toDoctorId?: string }) => {
    const referralData = {
      ...newReferral,
      fromUserId: profile?.id,
      toUserId: newReferral.toDoctorId || null, // Use the selected doctor's ID
    };
    
    createReferralMutation.mutate(referralData, {
      onSuccess: () => {
        setShowCreateModal(false);
        setActiveTab('Sent');
      }
    });
  }, [profile?.id, createReferralMutation]);

  const handleStatusChange = useCallback((referralId: string, newStatus: ReferralStatus) => {
    console.log(`Changing referral ${referralId} status to ${newStatus}`);
    updateStatusMutation.mutate({ id: referralId, status: newStatus });
  }, [updateStatusMutation]);

  const handleCompleteReferral = useCallback((referral: Referral) => {
    setReferralToComplete(referral);
    setShowCompletionModal(true);
  }, []);

  const [isCompleting, setIsCompleting] = useState(false);
  const handleCompletionAction = useCallback(async (data: CompletionData) => {
    if (isCompleting) return; // guard against duplicate clicks
    setIsCompleting(true);
    if (!referralToComplete || !profile?.id) { setIsCompleting(false); return; }
    
    if (data.action === 'close') {
      if (!data.isPatientAttended) {
        // Handle cases where patient was not attended - simply close the referral
        updateStatusMutation.mutate({ id: referralToComplete.id, status: 'Closed' });
        setShowCompletionModal(false);
        setReferralToComplete(null);
        setIsCompleting(false);
        return;
      }

      try {
        // Cast to any because the generated Supabase types may not yet include this new RPC
        // CRITICAL: The parameter names here MUST EXACTLY MATCH the
      // parameter names in the backend PostgreSQL function `complete_referral`.
      // Mismatches will cause the function call to fail.
      const { error } = await (supabase as any).rpc('complete_referral', {
          p_referral_id: referralToComplete.id,
          p_updated_medication: data.updatedMedication || referralToComplete.medicationGiven,
          p_completed_by_user_id: profile.id,
          p_final_diagnosis_category: data.finalDiagnosisCategory,
          p_final_diagnosis_details: data.finalDiagnosisDetails
        });

        if (error) {
          throw error;
        }

        toast.success('Referral completed successfully!');
        
        // Generate Excel report with the completion data
        try {
          // Fetch fresh medication history and complete trail using raw SQL to avoid type issues
          const [medicationHistoryResult, completeMedicationTrailResult] = await Promise.all([
            supabase.rpc('get_medication_timeline', {
              p_referral_id: referralToComplete.id
            }) as Promise<{ data: any[] | null }>,
            supabase.rpc('get_complete_medication_trail', {
              p_referral_id: referralToComplete.id
            }) as Promise<{ data: any[] | null }>
          ]);

          const freshMedicationHistory = medicationHistoryResult.data;
          const completeMedicationTrail = completeMedicationTrailResult.data || [];

          // The in-memory referral never carries attachments, and diagnosis lives on
          // the DB row — fetch both fresh so the Excel reflects reality (not stale
          // modal/list state). Attachments are counted across the whole chain.
          const chainReferralIds = Array.from(new Set(
            (completeMedicationTrail as any[]).map((s: any) => s.referral_id).filter(Boolean)
          ));
          if (chainReferralIds.length === 0) chainReferralIds.push(referralToComplete.id);

          const [attachmentsResult, freshReferralResult, chainTimeline] = await Promise.all([
            supabase.from('referral_attachments').select('id').in('referral_id', chainReferralIds),
            supabase.from('referrals')
              .select('final_diagnosis_category, final_diagnosis_details, final_diagnosis_timestamp')
              .eq('id', referralToComplete.id)
              .single(),
            fetchReferralChainTimeline(referralToComplete.id)
          ]);

          const chainAttachmentIds = ((attachmentsResult.data as any[]) || []).map((a: any) => a.id as string);
          const freshRef = freshReferralResult.data as any;
          const diagCategory = freshRef?.final_diagnosis_category ?? data.finalDiagnosisCategory;
          const diagDetails = freshRef?.final_diagnosis_details ?? data.finalDiagnosisDetails;
          const diagTimestamp = freshRef?.final_diagnosis_timestamp
            ?? ((data.finalDiagnosisCategory || data.finalDiagnosisDetails) ? new Date().toISOString() : undefined);

          console.log('📊 Excel Report Data:', {
            referralId: referralToComplete.id,
            medicationHistoryCount: freshMedicationHistory?.length || 0,
            completeMedicationTrailCount: completeMedicationTrail?.length || 0,
            trail: completeMedicationTrail
          });

          const reportData: CompletedReferralData = {
            referral: {
              ...referralToComplete,
              status: 'Closed', // we just completed it; reflect that in the report
              attachments: chainAttachmentIds,
              medication_history: freshMedicationHistory || []
            },
            completionData: {
              isPatientAttended: data.isPatientAttended,
              updatedMedication: data.updatedMedication || referralToComplete.medicationGiven,
              reasons: data.reasons,
              completedAt: new Date().toISOString(),
              completedBy: profile.full_name || 'Unknown User',
              finalDiagnosisCategory: diagCategory,
              finalDiagnosisDetails: diagDetails,
              finalDiagnosisTimestamp: diagTimestamp,
              finalDiagnosisBy: (diagCategory || diagDetails) ? (profile.full_name || 'Unknown User') : undefined
            },
            transferHistory: [], // Will be empty for just-completed referrals
            completeMedicationTrail: completeMedicationTrail,
            chainTimeline
          };
          
          // Import the function at the top of the file
          const { generateReferralExcelReport } = await import('../../../utils/excelExport');
          await generateReferralExcelReport(reportData);
          
          toast.success('Excel report generated successfully!');
        } catch (error) {
          console.error('Error generating Excel report:', error);
          // Don't show error toast as the referral was completed successfully
        }
        
        // Invalidate queries to refetch data
        queryClient.invalidateQueries({ queryKey: referralKeys.lists() });
        setShowCompletionModal(false);
        setReferralToComplete(null);
        setIsCompleting(false);
      } catch (error) {
        toast.error('Failed to complete referral. Please try again.');
        console.error("Error calling complete_referral:", error);
        setIsCompleting(false);
      }
    } else if (data.action === 'transfer') {
      const transferData = {
        isPatientAttended: data.isPatientAttended,
        updatedMedication: data.updatedMedication,
        reasons: data.reasons,
      };
      setReferralToTransfer({ ...referralToComplete, ...transferData });
      setTransferContext(transferData);
      setShowCompletionModal(false);
      setShowTransferModal(true);
      setIsCompleting(false);
    }
  }, [referralToComplete, profile?.id, updateStatusMutation, queryClient]);

  const handleTransferAction = useCallback((transferData: any) => {
    console.log('Processing transfer with data:', transferData);

    if (!referralToTransfer || !profile?.id) {
      console.error('Missing referral or user data for transfer');
      return;
    }

    // Prepare transfer data for the database function
    const transferPayload = {
      originalReferralId: referralToTransfer.id,
      newToUserId: transferData.doctorId,
      newToDepartment: transferData.department,
      transferReason: transferData.transferReason || '',
      transferNotes: transferData.specialNotes || '', // Fixed: was transferNotes, now matches specialNotes
      transferredByUserId: profile.id,
      updatedMedicationOnTransfer: transferData.updatedMedication
    };

    console.log('Submitting transfer payload:', transferPayload);

    transferReferralMutation.mutate(transferPayload, {
      onSuccess: () => {
        console.log('✅ Transfer completed successfully');
        toast.success('Referral transferred successfully!');
        setShowTransferModal(false);
        setReferralToTransfer(null);
        setTransferContext(null);
        setReferralToComplete(null);
        // Switch to 'Sent' tab to show the transferred referral
        setActiveTab('Sent');
      },
      onError: (error: any) => {
        console.error('❌ Transfer failed:', error);
        toast.error(`Transfer failed: ${error?.message || 'Unknown error'}`);
        // Modal will stay open so user can try again
      }
    });
  }, [referralToTransfer, profile?.id, transferReferralMutation, setActiveTab]);

  const handleCompletionModalClose = useCallback(() => {
    setShowCompletionModal(false);
    setReferralToComplete(null);
  }, []);

  const handleTransferModalClose = useCallback(() => {
    setShowTransferModal(false);
    setReferralToTransfer(null);
    setTransferContext(null);
  }, []);

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-neutral-900 mb-4">Error Loading Referrals</h2>
        <p className="text-neutral-600">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex gap-4",
          isMobile ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between"
        )}
      >
        <div className="min-w-0 flex-1">
          <h1 className={cn(
            "font-bold text-neutral-900",
            isMobile ? "text-xl" : "text-2xl"
          )}>
            Medical Referrals
          </h1>
          <p className={cn(
            "text-neutral-600 mt-1",
            isMobile ? "text-sm" : "text-base"
          )}>
            Manage patient referrals across departments
          </p>
          {activeTab !== 'Archive' && archiveReferrals.length > 0 && (
            <div className="mt-2">
              <button 
                onClick={() => setActiveTab('Archive')}
                className={cn(
                  "text-blue-600 hover:text-blue-800 flex items-center gap-1",
                  isMobile ? "text-xs" : "text-sm"
                )}
              >
                <Archive className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} /> 
                View {archiveReferrals.length} archived referrals
              </button>
            </div>
          )}
        </div>
        
        <div className={cn(
          "flex items-center gap-2",
          isMobile && "justify-stretch"
        )}>
          {!isMobile && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex"
            >
              <Filter size={16} className="mr-2" />
              Filter
            </Button>
          )}
          
          <Button
            onClick={() => setShowCreateModal(true)}
            className={cn(
              isMobile ? "flex-1" : "flex-none",
              isMobile && "min-h-[44px]" // Touch target
            )}
            size={isMobile ? "md" : "sm"}
          >
            <Plus size={16} className="mr-2" />
            {isMobile ? "New Referral" : "New Referral"}
          </Button>
          
          {isMobile && (
            <Button
              variant="outline"
              size="md"
              className="min-h-[44px] px-3"
            >
              <Filter size={16} />
            </Button>
          )}
        </div>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by patient name, department, or doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <ReferralTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={tabCounts}
        />
        
        {/* Archive Banner - Show when viewing archive */}
        {activeTab === 'Archive' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-blue-900">Archive View</h3>
                <p className="text-sm text-blue-700">Showing {archiveReferrals.length} older referrals</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('Received')}
            >
              <ChevronLeft size={16} className="mr-1" /> Back to Recent
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Referrals List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="h-32 bg-neutral-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {filteredReferrals.length === 0 ? (
              <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card padding="xl" className="text-center">
                <FileText className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 mb-2">
                  No referrals found
                </h3>
                <p className="text-neutral-600">
                  {searchQuery 
                    ? `No referrals match "${searchQuery}" in ${activeTab.toLowerCase()} status.`
                    : `No ${activeTab.toLowerCase()} referrals at the moment.`
                  }
                </p>
                {activeTab === 'Sent' && !searchQuery && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4"
                  >
                    <Plus size={16} className="mr-2" />
                    Create First Referral
                  </Button>
                )}
              </Card>
            </motion.div>
          ) : (
              <div>
                {activeTab === 'Archive' ? (
                  <motion.div
                    key="archive-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {archiveReferrals.map((referral, index) => (
                      <motion.div
                        key={referral.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                                <ReferralCard
                                  referral={referral}
                                  direction={referral.fromDoctor === profile?.full_name ? 'sent' : 'received'}
                                  onStatusChange={(id, status) => {
                                    if (status === 'Cancelled') {
                                      handleDeclineReferral(referral);
                                    } else {
                                      handleStatusChange(id, status);
                                    }
                                  }}
                                  onComplete={handleCompleteReferral}
                                  onClick={() => setSelectedReferral(referral)}
                                />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <div>
                    {/* Top 10 Referrals Section */}
                    <motion.div
                      key="top-list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {topReferrals.length > 0 && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                              <Zap className="w-5 h-5 text-blue-600" />
                              Recent Referrals
                            </h2>
                            <div className="text-sm text-gray-500">
                              Showing {topReferrals.length} most recent
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            {topReferrals.map((referral, index) => (
                              <motion.div
                                key={referral.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                              >
                                <ReferralCard
                                  referral={referral}
                                  direction={referral.fromDoctor === profile?.full_name ? 'sent' : 'received'}
                                  onStatusChange={(id, status) => {
                                    if (status === 'Cancelled') {
                                      handleDeclineReferral(referral);
                                    } else {
                                      handleStatusChange(id, status);
                                    }
                                  }}
                                  onComplete={handleCompleteReferral}
                                  onClick={() => setSelectedReferral(referral)}
                                />
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Archive Link - Only show if there are archived referrals */}
                      {archiveReferrals.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: topReferrals.length * 0.05 + 0.1 }}
                        >
                          <Card 
                            padding="lg" 
                            className="bg-gray-50 border-dashed border-gray-300 hover:bg-gray-100 cursor-pointer"
                            onClick={() => setActiveTab('Archive')}
                          >
                            <div className="flex items-center justify-center gap-3">
                              <Archive className="w-5 h-5 text-gray-500" />
                              <span className="font-medium text-gray-700">
                                View {archiveReferrals.length} more referrals in archive
                              </span>
                              <ChevronRight className="w-5 h-5 text-gray-500" />
                            </div>
                          </Card>
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                )}
              </div>
          )}
          </AnimatePresence>
        )}
      </motion.div>

      {/* Create Referral Modal */}
      <ResponsiveModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Referral"
        size="full"
      >
        <ReferralForm
          onSubmit={handleCreateReferral}
          onCancel={() => setShowCreateModal(false)}
        />
      </ResponsiveModal>

      {/* Referral Details Modal */}
      <ResponsiveModal
        isOpen={!!selectedReferral}
        onClose={() => setSelectedReferral(null)}
        title="Referral Details"
        size="lg"
      >
        {selectedReferral && (
          <ReferralDetails 
            referral={selectedReferral}
            direction={selectedReferral.fromDoctor === profile?.full_name ? 'sent' : 'received'}
            onStatusChange={handleStatusChange}
            onClose={() => setSelectedReferral(null)}
          />
        )}
      </ResponsiveModal>

      {/* Referral Completion Modal */}
      {referralToComplete && (
        <ReferralCompletionModal
          isOpen={showCompletionModal}
          onClose={handleCompletionModalClose}
          referral={referralToComplete}
          onComplete={handleCompletionAction}
          onTransfer={handleCompletionAction}
        />
      )}

      {/* Referral Transfer Modal */}
      {referralToTransfer && (
        <ReferralTransferModal
          isOpen={showTransferModal}
          onClose={handleTransferModalClose}
          referral={referralToTransfer}
          transferData={{
            isPatientAttended: transferContext?.isPatientAttended ?? true,
            updatedMedication: transferContext?.updatedMedication ?? referralToTransfer.medicationGiven,
            reasons: transferContext?.reasons ?? '',
            department: '',
            doctorId: '',
            transferReason: '',
            specialNotes: '',
            attachments: []
          }}
          onTransfer={handleTransferAction}
        />
      )}

      <DeclineReferralModal
        isOpen={showDeclineModal}
        onClose={() => setShowDeclineModal(false)}
        onDecline={handleDeclineConfirm}
      />
    </div>
  );
};

export { ReferralManagement };
