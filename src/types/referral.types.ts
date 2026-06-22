// Define types for the Referral feature

// Match the database enum with UI extension
export type ReferralStatus = 'Sent' | 'Received' | 'Acknowledged' | 'Accepted' | 'Cancelled' | 'Closed' | 'Transferred';
export type UrgencyLevel = 'Emergency' | 'Urgent' | 'Normal' | 'Elective';

// Attachment types
export interface ReferralAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  fileUrl: string;
  uploadedBy: string;
  createdAt: string;
  // Chain-aware fields (populated by useChainAttachments; optional so the
  // per-referral useReferralAttachments shape stays compatible).
  referralId?: string;
  departmentContext?: string;
  hopLevel?: number;
  isCurrentReferral?: boolean;
}

// Medication history types
export type MedicationUpdateType = 'initial' | 'completion_update' | 'transfer_update' | 'manual_update';

export interface MedicationHistory {
  id: string;
  referral_id: string;
  medication_text: string;
  updated_by?: string;
  updated_at: string;
  update_type: MedicationUpdateType;
  notes?: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    department: string;
  };
}

// Complete medication trail across transfer chain
export interface CompleteMedicationTrail {
  step_number: number;
  record_timestamp: string; // Backend returns record_timestamp, not timestamp
  formatted_time: string;
  doctor_name: string;
  doctor_id: string;
  action_type: 'Created Referral' | 'Updated During Transfer' | 'Completed Referral' | 'Initial Medication Set' | 'Received Transfer';
  department_context: string;
  medication_prescribed: string;
  medication_context: string;
  referral_id: string;
  referral_title: string;
  is_original_referral: boolean;
}

export interface Referral {
  id: string;
  patientName: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  admissionDate: string;
  patientAdmissionTime: string;
  roomNo: string;
  patientIpNo: string;
  chiefComplaint: string;
  pastHistory: string;
  generalExamination: string;
  medicationGiven: string;
  initialMedication?: string; // Original medication when referral was created
  urgency: UrgencyLevel;
  status: ReferralStatus;
  department: string;
  doctor: string;
  toUserId?: string | null; // to_user_id in DB — the doctor who currently holds the referral
  fromDoctor: string;
  fromDepartment: string;
  createdAt: string;
  acceptedAt?: string | null; // start_time in DB — set when referral is accepted (Acknowledged)
  end_time?: string | null;
  attachments: string[];
  // New medication tracking fields
  last_medication_update?: string;
  medication_update_count?: number;
  medication_history?: MedicationHistory[];
  // CRITICAL: Transfer system fields (MUST match database schema)
  transfer_parent_id?: string;
  transferred_from_user_id?: string;
  transferred_at?: string;
  transfer_reason?: string;
  transfer_notes?: string;
  transferred_from_department?: string;
  // Final diagnosis fields (both camelCase and snake_case for database compatibility)
  finalDiagnosisCategory?: string;
  finalDiagnosisDetails?: string;
  finalDiagnosisTimestamp?: string;
  finalDiagnosisBy?: string;
  final_diagnosis_category?: string;
  final_diagnosis_details?: string;
  final_diagnosis_timestamp?: string;
  final_diagnosis_by?: string;
}

// Form data for creating a referral
export interface ReferralFormData {
  patientName: string;
  age: string;
  sex: 'Male' | 'Female' | 'Other';
  admissionDate: string;
  patientAdmissionTime: string;
  roomNo: string;
  patientIpNo: string;
  chiefComplaint: string;
  pastHistory: string;
  generalExamination: string;
  medicationGiven: string;
  urgency: UrgencyLevel;
  department: string;
  doctor: string;
  attachments: File[];
}

// Request data for creating a referral
export interface ReferralRequest {
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
}

// Request data for updating a referral status
export interface ReferralStatusUpdate {
  id: string;
  status: ReferralStatus;
}

// Helper function to map database status to UI status
export const mapStatusForDisplay = (status: ReferralStatus): ReferralStatus => {
  if (status === 'Acknowledged') {
    console.log('Mapping DB status Acknowledged to UI status Accepted');
    return 'Accepted';
  }
  return status;
};

// Helper function to map UI status to database status
export const mapStatusForDatabase = (status: ReferralStatus): ReferralStatus => {
  if (status === 'Accepted') {
    console.log('Mapping UI status Accepted to DB status Acknowledged');
    return 'Acknowledged';
  }
  return status;
};

// Transfer history types
export interface TransferHistory {
  id: string;
  referral_id: string;
  from_doctor: string;
  from_department: string;
  to_doctor: string;
  to_department: string;
  transferred_at: string;
  transfer_reason?: string;
  transfer_notes?: string;
  transferred_by?: string;
}

// Decline reason types
export interface DeclineReason {
  id: string;
  code: string;
  label: string;
  description: string;
}

export interface CompletedReferralData {
  referral: Referral;
  completionData: {
    isPatientAttended: boolean;
    updatedMedication?: string;
    reasons?: string;
    completedAt: string;
    completedBy: string;
    finalDiagnosisCategory?: string;
    finalDiagnosisDetails?: string;
    finalDiagnosisTimestamp?: string;
    finalDiagnosisBy?: string;
  };
  transferHistory: TransferHistory[];
  completeMedicationTrail: CompleteMedicationTrail[];
}
