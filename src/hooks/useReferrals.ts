import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type { 
  Referral, 
  ReferralStatus, 
  ReferralRequest, 
  ReferralStatusUpdate,
  MedicationHistory,
  MedicationUpdateType,
  CompletedReferralData, // Ensure this is imported if defined in referral.types.ts
  mapStatusForDisplay,
  mapStatusForDatabase
} from '../types/referral.types';

// Query keys
export const referralKeys = {
  all: ['referrals'] as const,
  lists: () => [...referralKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...referralKeys.lists(), filters] as const,
  details: () => [...referralKeys.all, 'detail'] as const,
  detail: (id: string) => [...referralKeys.details(), id] as const,
};

// Fetch referrals from Supabase
const fetchReferrals = async (userId: string): Promise<Referral[]> => {
  console.log('Fetching referrals for user:', userId);
  
  try {
    // First check if the fix_referral_categorization function exists and run it
    try {
      await supabase.rpc('fix_referral_categorization');
      console.log('Referral categorization fixed');
    } catch (error) {
      console.log('Fix function not available or already run');
    }
    
    // Fetch all referrals related to this user with proper joins
    const { data: referrals, error: fetchError } = await supabase
      .from('referrals')
      .select(`
        *,
        from_user:users!referrals_from_user_id_fkey(id, full_name, role, department),
        to_user:users!referrals_to_user_id_fkey(id, full_name, role, department)
      `)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching referrals:', fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${referrals?.length || 0} total referrals for user ${userId}`);

    // Transform data to match component interface
    return (referrals || []).map(item => {
      // Determine status - handle special cases with PERSPECTIVE-BASED logic
      let status: ReferralStatus = item.status as ReferralStatus;
      let direction: 'sent' | 'received' = item.from_user_id === userId ? 'sent' : 'received';
      
      // CRITICAL: Handle status mapping based on USER PERSPECTIVE
      if (status === 'Acknowledged') {
        if (direction === 'sent') {
          // For SENDER: Show "Sent" when receiver has acknowledged
          status = 'Sent';
        } else {
          // For RECEIVER: Show "Accepted" when they have acknowledged
          status = 'Accepted';
        }
      } else if (item.end_time) {
        // If end_time is set, it's a closed referral
        status = 'Closed';
      }
      // Preserve transfer statuses as they have specific meaning
      // "Transferred" and "Received" should not be modified
      
      // Format admission date properly
      let formattedAdmissionDate = item.admission_date
        ? format(parseISO(item.admission_date), 'yyyy-MM-dd')
        : (item.metadata ? JSON.parse(item.metadata)?.admissionDate : null) || item.created_at.split('T')[0];
      
      return {
        id: item.id,
        // Use dedicated patient fields if available, fall back to title/metadata
        patientName: item.patient_name || item.title,
        age: item.patient_age || (item.metadata ? JSON.parse(item.metadata)?.age : 45) || 45,
        sex: (item.patient_sex || (item.metadata ? JSON.parse(item.metadata)?.sex : 'Male') || 'Male') as 'Male' | 'Female' | 'Other',
        admissionDate: formattedAdmissionDate,
        patientAdmissionTime: item.patient_admission_time || '',
        roomNo: item.room_no || '',
        patientIpNo: item.patient_ip_no || '',
        chiefComplaint: item.description,
        pastHistory: item.past_history || '',
        generalExamination: item.general_examination || '',
        medicationGiven: item.medication_given || '',
        urgency: item.urgency as any,
        status: status,
        department: item.to_department,
        doctor: item.to_user?.full_name || 'Unassigned',
        toUserId: item.to_user_id || null,
        fromDoctor: item.from_user?.full_name || 'Unknown',
        fromDepartment: item.from_user?.department || 'Unknown',
        createdAt: item.created_at,
        acceptedAt: item.start_time || null,
        attachments: item.attachments || [],
        end_time: item.end_time,
        // Additive fields used by Analytics (safe: optional on the Referral type;
        // `select('*')` already returns them when the columns exist).
        transfer_parent_id: item.transfer_parent_id || undefined,
        transferred_at: item.transferred_at || undefined,
        medication_update_count: item.medication_update_count ?? undefined,
        final_diagnosis_category: item.final_diagnosis_category || undefined,
      };
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    throw error;
  }
};

// Create referral
const createReferral = async (referralData: {
  patientName: string;
  age: number;
  sex: string;
  admissionDate: string;
  patientAdmissionTime: string;
  roomNo: string;
  patientIpNo: string;
  chiefComplaint: string;
  pastHistory: string;
  generalExamination: string;
  medicationGiven: string;
  urgency: string;
  department: string;
  fromUserId?: string;
  toUserId?: string | null;
  attachments?: string[];
}) => {
  try {
    console.log('Creating referral with data:', referralData);
    
    // Get the current user's department for from_department
    const { data: currentUser } = await supabase.auth.getUser();
    let fromDepartment = '';
    
    if (currentUser?.user?.id) {
      const { data: userData } = await supabase
        .from('users')
        .select('department')
        .eq('id', currentUser.user.id)
        .single();
      
      fromDepartment = userData?.department || '';
    }
    
    // Validate that we have a from_department
    if (!fromDepartment) {
      throw new Error('Cannot create referral: User does not have a department assigned');
    }

    // Prepare insert data
    const insertData = {
      title: referralData.patientName,
      description: referralData.chiefComplaint,
      urgency: referralData.urgency,
      from_user_id: referralData.fromUserId,
      from_department: fromDepartment,  // Add the from_department
      to_department: referralData.department,
      to_user_id: referralData.toUserId || null,
      attachments: referralData.attachments || [],
      // Use dedicated patient columns (they exist in the schema)
      patient_name: referralData.patientName,
      patient_age: referralData.age,
      patient_sex: referralData.sex,
      admission_date: referralData.admissionDate,
      patient_admission_time: referralData.patientAdmissionTime,
      room_no: referralData.roomNo,
      patient_ip_no: referralData.patientIpNo,
      past_history: referralData.pastHistory,
      general_examination: referralData.generalExamination,
      medication_given: referralData.medicationGiven
    };

    console.log('Inserting referral data:', insertData);

    const { data, error } = await supabase
      .from('referrals')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error inserting referral:', error);
      throw error;
    }

    console.log('Referral created successfully:', data);

    // Create attachment records if files were uploaded
    if (referralData.attachments && referralData.attachments.length > 0) {
      console.log(`Creating ${referralData.attachments.length} attachment records`);
      
      for (const fileName of referralData.attachments) {
        try {
          // Generate the public URL for the attachment
          const { data: urlData } = supabase.storage
            .from('referral_attachments')
            .getPublicUrl(fileName);

          if (urlData?.publicUrl) {
            // Create attachment record in database
            const { error: attachmentError } = await supabase
              .from('referral_attachments')
              .insert({
                referral_id: data.id,
                file_name: fileName,
                file_type: getFileTypeFromName(fileName),
                file_url: urlData.publicUrl,
                uploaded_by: referralData.fromUserId || null
              });

            if (attachmentError) {
              console.error(`Error creating attachment record for ${fileName}:`, attachmentError);
              // Don't throw here - we still want the referral to be created even if attachment records fail
            } else {
              console.log(`Attachment record created for ${fileName}`);
            }
          }
        } catch (error) {
          console.error(`Error processing attachment ${fileName}:`, error);
          // Continue with other attachments
        }
      }
    }

    return data;
  } catch (error) {
    console.error('Error creating referral:', error);
    throw error;
  }
};

// Update referral status
const updateReferralStatus = async ({ id, status }: { id: string; status: ReferralStatus }) => {
  console.log(`Updating referral ${id} status to ${status}`);
  
  try {
    // Map UI status to database status
    let dbStatus: string = status;
    let updateData: any = {};
    
    // Special handling for different statuses
    switch (status) {
      case 'Accepted':
        // 'Accepted' in UI maps to 'Acknowledged' in DB
        console.log('Mapping UI status Accepted to DB status Acknowledged');
        dbStatus = 'Acknowledged';
        updateData = { 
          status: dbStatus,
          start_time: new Date().toISOString() // Mark acceptance time
        };
        break;
        
      case 'Closed':
        // 'Closed' might be a separate status or use end_time
        console.log('Checking if Closed status exists in enum');
        // Check if 'Closed' exists in the enum
        const { data: statusCheck } = await supabase.rpc('check_enum_value_exists', {
          enum_name: 'referral_status',
          enum_value: 'Closed'
        });
        
        if (statusCheck) {
          console.log('Closed status exists, using it directly');
          dbStatus = 'Closed';
          updateData = { status: dbStatus };
        } else {
          console.log('Closed status does not exist, using Acknowledged with end_time');
          dbStatus = 'Acknowledged'; // Use Acknowledged with end_time
          updateData = { 
            status: dbStatus,
            end_time: new Date().toISOString() // Mark completion time
          };
        }
        break;
        
      default:
        updateData = { status };
    }
    
    // Update the referral
    console.log('Updating referral with data:', updateData);
    const { data: updatedData, error: updateError } = await supabase
      .from('referrals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
      
    if (updateError) throw updateError;
    console.log('Referral updated successfully');
    return updatedData;
  }
  catch (error) {
    console.error('Error updating referral status:', error);
    throw error;
  }
};

// Custom hooks
export const useReferrals = () => {
  const { profile } = useAuthStore(); 
  
  const queryKey = profile?.id ? referralKeys.list({ userId: profile.id }) : referralKeys.list({ userId: 'none' });
  
  return useQuery({
    queryKey: queryKey,
    queryFn: () => profile?.id ? fetchReferrals(profile.id) : Promise.resolve([]),
    enabled: !!profile?.id,
    staleTime: 1 * 60 * 1000, // 1 minute - reduced to ensure we get fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
};

export const useCreateReferral = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createReferral,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.lists() });
      toast.success('Referral created successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create referral');
    },
  });
};

export const useUpdateReferralStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateReferralStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.lists() });
      toast.success('Referral status updated!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update referral');
    },
  });
};

// Add medication history entry
const addMedicationHistory = async (data: {
  referralId: string;
  medicationText: string;
  updateType: MedicationUpdateType;
  notes?: string;
  updatedBy?: string;
}) => {
  try {
    console.log('Adding medication history entry:', data);
    
    const { data: result, error } = await supabase
      .from('medication_history')
      .insert({
        referral_id: data.referralId,
        medication_text: data.medicationText,
        update_type: data.updateType,
        notes: data.notes,
        updated_by: data.updatedBy,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding medication history:', error);
      throw error;
    }

    console.log('Medication history added successfully:', result);
    return result;
  } catch (error) {
    console.error('Error adding medication history:', error);
    throw error;
  }
};

// Fetch medication history for a referral
const fetchMedicationHistory = async (referralId: string): Promise<MedicationHistory[]> => {
  try {
    console.log('Fetching medication history for referral:', referralId);
    
    const { data, error } = await supabase
      .from('medication_history')
      .select(`
        *,
        user:users(id, full_name, department)
      `)
      .eq('referral_id', referralId)
      .order('updated_at', { ascending: true });

    if (error) {
      console.error('Error fetching medication history:', error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} medication history entries`);
    return data || [];
  } catch (error) {
    console.error('Error fetching medication history:', error);
    throw error;
  }
};

// Transfer referral function
const transferReferral = async (data: {
  originalReferralId: string;
  newToUserId: string;
  newToDepartment: string;
  transferReason?: string;
  transferNotes?: string;
  transferredByUserId: string;
  updatedMedicationOnTransfer?: string;
}) => {
  try {
    console.log('Transferring referral:', data);

    // CRITICAL: The parameter names here MUST EXACTLY MATCH the
    // parameter names in the backend PostgreSQL function `transfer_referral`.
    // Mismatches will cause the function call to fail.
    // p_updated_medication_on_transfer carries the medication the doctor
    // updated during completion. The DB function copies it to the new
    // referral AND records the 'transfer_update' medication_history entry.
    const { data: result, error } = await supabase.rpc('transfer_referral', {
      p_original_referral_id: data.originalReferralId,
      p_new_to_user_id: data.newToUserId,
      p_new_to_department: data.newToDepartment,
      p_transfer_reason: data.transferReason,
      p_transfer_notes: data.transferNotes,
      p_transferred_by_user_id: data.transferredByUserId,
      p_updated_medication_on_transfer: data.updatedMedicationOnTransfer || null
    });

    if (error) {
      console.error('Error transferring referral:', error);
      throw error;
    }

    console.log('Referral transferred successfully. New referral ID:', result);

    // NOTE: The 'transfer_update' medication_history entry is now created
    // inside the transfer_referral() RPC using p_updated_medication_on_transfer.
    // We no longer insert it here (the old code incorrectly recorded the
    // transfer *notes* as the medication text).

    return result;
  } catch (error) {
    console.error('Error transferring referral:', error);
    throw error;
  }
};

// Fetch transfer history for a referral
const fetchTransferHistory = async (referralId: string) => {
  try {
    console.log('Fetching transfer history for referral:', referralId);
    
    const { data, error } = await supabase.rpc('get_referral_transfer_history', {
      p_referral_id: referralId
    });

    if (error) {
      console.error('Error fetching transfer history:', error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} transfer history entries`);
    return data || [];
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    return [];
  }
};

// Fetch the full per-stage chain timeline (holder + received/accepted/transferred/
// ended per hop) for the completion report. Uses the SECURITY DEFINER RPC so a
// downstream doctor sees upstream stages past RLS. Returns [] on any failure so a
// report can still be generated with the single-hop fallback.
export const fetchReferralChainTimeline = async (
  referralId: string
): Promise<import('../types/referral.types').ReferralChainTimelineNode[]> => {
  try {
    const { data, error } = await (supabase as any).rpc('get_referral_chain_timeline', {
      p_referral_id: referralId,
    });
    if (error) {
      console.error('Error fetching referral chain timeline:', error);
      return [];
    }
    return ((data as any[]) || []).map((n: any) => ({
      hopLevel: n.hop_level,
      referralId: n.referral_id,
      fromDoctor: n.from_doctor || 'Unknown',
      fromDepartment: n.from_department || '',
      toDoctor: n.to_doctor || 'Unknown',
      toDepartment: n.to_department || '',
      receivedAt: n.received_at,
      acceptedAt: n.accepted_at,
      transferredAt: n.transferred_at,
      endedAt: n.ended_at,
      status: n.status,
    }));
  } catch (e) {
    console.error('Error fetching referral chain timeline:', e);
    return [];
  }
};

// Custom hooks for medication history
export const useMedicationHistory = (referralId: string) => {
  return useQuery({
    queryKey: [...referralKeys.detail(referralId), 'medication-history'],
    queryFn: () => fetchMedicationHistory(referralId),
    enabled: !!referralId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Fetch COMPLETE medication trail for a referral
const fetchCompleteMedicationTrail = async (referralId: string): Promise<CompleteMedicationTrail[]> => {
  try {
    console.log('🔄 Fetching complete medication trail for referral:', referralId);
    
    // Trust the backend function - it already handles transfer logic internally
    const { data, error } = await (supabase as any).rpc('get_complete_medication_trail', {
      p_referral_id: referralId
    });

    if (error) {
      console.error('❌ Error fetching complete medication trail:', error);
      throw error;
    }

    // Enhanced debugging to see exactly what we're getting
    console.log(`✅ Found ${data?.length || 0} complete medication trail entries for referral: ${referralId}`);
    if (data && data.length > 0) {
      console.log('📊 Complete Medication Trail Data:', data);
      console.log('🔍 First step:', data[0]);
      console.log('🔍 Last step:', data[data.length - 1]);
      console.log('🔍 All action types:', data.map((d: any) => d.action_type));
    }
    
    return (data || []) as CompleteMedicationTrail[];
  } catch (error) {
    console.error('❌ Error fetching complete medication trail:', error);
    throw error;
  }
};

export const useCompleteMedicationTrail = (referralId: string) => {
  return useQuery({
    queryKey: [...referralKeys.detail(referralId), 'complete-medication-trail'],
    queryFn: () => fetchCompleteMedicationTrail(referralId),
    enabled: !!referralId,
    staleTime: 0, // Always fetch fresh data to debug the issue
    cacheTime: 0, // Don't cache at all for debugging
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true
  });
};


export const useAddMedicationHistory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addMedicationHistory,
    onSuccess: (data) => {
      // Invalidate medication history queries
      queryClient.invalidateQueries({ 
        queryKey: [...referralKeys.detail(data.referral_id), 'medication-history'] 
      });
      // Also invalidate referrals list to update medication counts
      queryClient.invalidateQueries({ queryKey: referralKeys.lists() });
      toast.success('Medication history updated!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update medication history');
    },
  });
};

// Custom hooks for transfer functionality
export const useTransferReferral = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: transferReferral,
    // transfer_referral is NOT idempotent — a retry would create a second
    // child referral. Never auto-retry (overrides the global mutations retry).
    retry: false,
    onSuccess: () => {
      // Invalidate all referral queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: referralKeys.lists() });
      toast.success('Referral transferred successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to transfer referral');
    },
  });
};

export const useTransferHistory = (referralId: string) => {
  return useQuery({
    queryKey: [...referralKeys.detail(referralId), 'transfer-history'],
    queryFn: () => fetchTransferHistory(referralId),
    enabled: !!referralId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Fetch referral attachments
export const useReferralAttachments = (referralId: string) => {
  return useQuery({
    queryKey: [...referralKeys.detail(referralId), 'attachments', referralId],
    queryFn: async () => {
      try {
        console.log('Fetching attachments for referral:', referralId);
        
        // Try to use the function if it exists
        const { data, error } = await supabase.rpc(
          'get_referral_attachments',
          { ref_id: referralId }
        );
        
        if (error) {
          console.error('Error fetching attachments with RPC:', error.message, error.code, error.details);
          
          // Fallback to direct query if RPC fails
          const { data: directData, error: directError } = await supabase
            .from('referral_attachments')
            .select('*')
            .eq('referral_id', referralId);
            
          if (directError) {
            console.error('Direct query error:', directError);
            throw directError;
          }
          
          if (directData && directData.length > 0) {
            console.log('Found attachments via direct query:', directData.length);
            return await Promise.all(directData.map(async (item: any) => {
              // Generate proper signed URL for the file
              const fileUrl = await getSignedFileUrl(item.file_name);
              
              return {
                id: item.id,
                fileName: item.file_name,
                fileType: item.file_type || getFileTypeFromName(item.file_name),
                fileSize: item.file_size ? formatFileSize(item.file_size) : 'Unknown',
                fileUrl: fileUrl,
                uploadedBy: 'Unknown', // We don't have uploader name in direct query
                createdAt: item.created_at
              };
            }));
          }
        }
        
        if (data && data.length > 0) {
          console.log('Found attachments via RPC:', data.length);
          // Transform data to match component interface
          return await Promise.all(data.map(async (item: any) => {
            // Generate proper signed URL for the file
            const fileUrl = await getSignedFileUrl(item.file_name);
            
            return {
              id: item.id,
              fileName: item.file_name,
              fileType: item.file_type || getFileTypeFromName(item.file_name),
              fileSize: item.file_size ? formatFileSize(item.file_size) : 'Unknown',
              fileUrl: fileUrl,
              uploadedBy: item.uploader_name || 'Unknown',
              createdAt: item.created_at
            };
          }));
        }
        
        // If no attachments found in dedicated table, check the attachments array in referrals
        const { data: referralData, error: referralError } = await supabase
          .from('referrals')
          .select('attachments')
          .eq('id', referralId)
          .single();
          
        if (referralError) {
          console.error('Error fetching referral attachments array:', referralError);
          throw referralError;
        }
        
        if (referralData?.attachments && referralData.attachments.length > 0) {
          console.log('Found attachments in referral array:', referralData.attachments.length);
          // Create attachment objects from the attachment names with proper URLs
          return await Promise.all(referralData.attachments.map(async (name: string, index: number) => {
            const fileUrl = await getSignedFileUrl(name);
            console.log(`Generated URL for ${name}:`, fileUrl);
            
            return {
              id: `legacy-${index}`,
              fileName: name,
              fileType: getFileTypeFromName(name),
              fileSize: 'Unknown',
              fileUrl: fileUrl,
              uploadedBy: 'Unknown',
              createdAt: new Date().toISOString()
            };
          }));
        }
        
        console.log('No attachments found for referral:', referralId);
        return [];
      } catch (error) {
        console.error('Error fetching attachments:', error);
        return [];
      }
    },
    enabled: !!referralId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Fetch attachments across the ENTIRE transfer chain (every hop), so a downstream
// doctor sees files attached upstream — mirrors how the medication journey spans
// the chain. Backed by the SECURITY DEFINER get_chain_attachments RPC, which
// bypasses RLS truncation (see migration 20260619120000_get_chain_attachments).
export const useChainAttachments = (referralId: string) => {
  return useQuery({
    queryKey: [...referralKeys.detail(referralId), 'chain-attachments', referralId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_chain_attachments', {
        p_referral_id: referralId,
      });
      if (error) {
        console.error('Error fetching chain attachments:', error.message);
        throw error;
      }
      if (!data || data.length === 0) return [];
      return await Promise.all((data as any[]).map(async (item: any) => ({
        id: item.id,
        fileName: item.file_name,
        fileType: item.file_type || getFileTypeFromName(item.file_name),
        fileSize: item.file_size ? formatFileSize(item.file_size) : 'Unknown',
        fileUrl: await getSignedFileUrl(item.file_name),
        uploadedBy: item.uploader_name || 'Unknown',
        createdAt: item.created_at,
        referralId: item.referral_id,
        departmentContext: item.referral_department,
        hopLevel: item.hop_level,
        isCurrentReferral: item.is_current_referral,
      })));
    },
    enabled: !!referralId,
    staleTime: 0, // always fresh — clinical evidence must be current
  });
};

// Helper function to get signed URL for file access
const getSignedFileUrl = async (fileName: string): Promise<string> => {
  try {
    console.log('Getting signed URL for file:', fileName);
    
    // Check if fileName already includes user path structure
    let fullFilePath = fileName;
    
    // If fileName doesn't contain a slash, we need to find the correct user path
    if (!fileName.includes('/')) {
      console.log('File name does not include path, searching for file in storage...');
      
      // Try to list files in the bucket to find the correct path
      const { data: fileList, error: listError } = await supabase.storage
        .from('referral_attachments')
        .list('', { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
      
      if (!listError && fileList) {
        // Look for the file recursively
        console.log('Searching for file in bucket...');
        
        // Try to get subdirectories (user folders)
        for (const item of fileList) {
          if (item.name && !item.name.includes('.')) { // This is likely a directory (user ID)
            const { data: subFiles, error: subError } = await supabase.storage
              .from('referral_attachments')
              .list(item.name, { limit: 100 });
            
            if (!subError && subFiles) {
              const foundFile = subFiles.find(f => f.name === fileName || f.name?.endsWith(fileName));
              if (foundFile) {
                fullFilePath = `${item.name}/${foundFile.name}`;
                console.log('Found file at path:', fullFilePath);
                break;
              }
            }
          }
        }
      }
    }
    
    console.log('Using file path:', fullFilePath);
    
    // First, try to get a signed URL (for private files)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('referral_attachments')
      .createSignedUrl(fullFilePath, 3600); // 1 hour expiry
    
    if (signedData?.signedUrl && !signedError) {
      console.log('Generated signed URL:', signedData.signedUrl);
      return signedData.signedUrl;
    }
    
    console.log('Signed URL failed, trying public URL. Error:', signedError?.message);
    
    // If signed URL fails, try public URL (since bucket is public)
    const { data: publicData } = supabase.storage
      .from('referral_attachments')
      .getPublicUrl(fullFilePath);
    
    if (publicData?.publicUrl) {
      console.log('Generated public URL:', publicData.publicUrl);
      return publicData.publicUrl;
    }
    
    // Fallback to manual URL construction
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
      const fallbackUrl = `${supabaseUrl}/storage/v1/object/public/referral_attachments/${fullFilePath}`;
      console.log('Generated fallback URL:', fallbackUrl);
      return fallbackUrl;
    }
    
    console.error('Could not generate file URL for:', fileName);
    return '';
  } catch (error) {
    console.error('Error generating file URL:', error);
    // Return empty string instead of throwing to prevent breaking the UI
    return '';
  }
};

// Helper function to get file type from name
const getFileTypeFromName = (fileName: string): string => {
  console.log('Getting file type for:', fileName);
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'document';
    case 'txt':
      return 'text';
    default: {
      console.log('Unknown file extension:', extension);
      return 'file';
    }
  }
};

// Helper function to format file size
const formatFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
};

export const useAddDeclineReason = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (declineData: {
      referral_id: string;
      reason_code: string;
      reason_text: string;
      declined_by: string;
    }) => {
      const { data, error } = await supabase
        .from('referral_decline_reasons')
        .insert(declineData)
        .select('id')
        .single();
      
      if (error) throw error;

      // Link the decline reason to the referral
      await supabase
        .from('referrals')
        .update({ decline_reason_id: data.id })
        .eq('id', declineData.referral_id);

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(referralKeys.detail(variables.referral_id));
      queryClient.invalidateQueries(referralKeys.lists());
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save decline reason');
    },
  });
};
