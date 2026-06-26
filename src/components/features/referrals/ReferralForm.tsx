import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Calendar, 
  FileText, 
  Upload, 
  X, 
  AlertTriangle, 
  Clock, 
  Zap,
  Building2,
  Stethoscope,
  Paperclip,
  Loader2
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { VoiceInput, VoiceTextarea } from '../../ui/VoiceInput';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';
import type { Referral, UrgencyLevel } from '../../../types/referral.types';
import { useAuthStore } from '../../../store/authStore';
import { 
  uploadMultipleFiles, 
  createAttachmentRecord, 
  validateFile, 
  getFileTypeCategory,
  type UploadProgress 
} from '../../../lib/fileUpload';

// Complete list of medical departments matching OnboardingForm
const DEPARTMENTS = [
  'MD Anaesthesiology', 'MD Anatomy', 'MD Aviation Medicine', 'MD Biochemistry',
  'MD Blood Transfusion & Immunohematology', 'DM Cardiology', 'MD Community Medicine',
  'MD Clinical Pharmacology', 'MCh Cardiothoracic and Vascular Surgery', 'MD Critical Care Medicine',
  'MD Dermatology', 'MD Diagnostic Radiology', 'MD Emergency Medicine', 'DM Endocrinology',
  'MD ENT', 'MD Forensic Medicine', 'MD General Medicine', 'MD General Surgery',
  'MD Geriatrics', 'MD Immunohematology and Blood Transfusion', 'MD Infectious Diseases',
  'MD Internal Medicine', 'MD Microbiology', 'MCh Minimal Access Surgery', 'MD Nuclear Medicine',
  'MD Medicine', 'DM Neonatology', 'DM Nephrology', 'DM Neurology', 'MCh Neurosurgery',
  'MD Obstetrics & Gynecology', 'MD Ophthalmology', 'MCh Oncosurgery', 'DM Oncology',
  'MD Orthopedics', 'MD Pathology', 'MD Pediatrics', 'MCh Pediatric Surgery',
  'MD Pharmacology', 'MD Physical Medicine & Rehabilitation', 'MD Physiology',
  'MD Psychiatry', 'MD Pulmonary Medicine', 'MD Radiation Oncology', 'MD Radiology',
  'MD Radiotherapy', 'DM Rheumatology', 'MCh Surgical Gastroenterology',
  'MCh Surgical Oncology', 'MCh Thoracic Surgery', 'DM Transfusion Medicine',
  'DM Tropical Medicine', 'MCh Urology'
];

interface ReferralFormData {
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

interface ReferralFormProps {
  onSubmit: (data: Omit<Referral, 'id' | 'createdAt' | 'status'> & { toDoctorId?: string }) => void;
  onCancel: () => void;
}

interface Doctor {
  id: string;
  full_name: string;
  role: string;
  kmc_number: string | null;
}

// Local-safe "today" as yyyy-MM-dd (avoids the UTC off-by-one from toISOString
// in timezones ahead of UTC, e.g. IST) and current time as HH:mm.
function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

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

const urgencyOptions = [
  {
    value: 'Emergency' as UrgencyLevel,
    label: 'Emergency',
    description: 'Immediate action',
    icon: AlertTriangle,
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200'
  },
  {
    value: 'Urgent' as UrgencyLevel,
    label: 'Urgent', 
    description: 'Manage in hours',
    icon: Clock,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200'
  },
  {
    value: 'Normal' as UrgencyLevel,
    label: 'Normal',
    description: 'Standard priority',
    icon: FileText,
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200'
  }
];

export const ReferralForm: React.FC<ReferralFormProps> = ({ onSubmit, onCancel }) => {
  const { profile } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<ReferralFormData>({
    patientName: '',
    age: '',
    sex: 'Male',
    admissionDate: todayDateString(),
    patientAdmissionTime: nowTimeString(),
    roomNo: '',
    patientIpNo: '',
    chiefComplaint: '',
    pastHistory: '',
    generalExamination: '',
    medicationGiven: '',
    urgency: 'Normal',
    department: '',
    doctor: '',
    attachments: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch doctors when department changes
  useEffect(() => {
    let cancelled = false;

    const fetchDoctors = async () => {
      if (!formData.department) {
        setDoctors([]);
        return;
      }

      setLoadingDoctors(true);
      try {
        const hospitalId = (profile as any)?.hospital_id;
        let doctorsQuery = supabase
          .from('users')
          .select('id, full_name, role, kmc_number')
          .eq('department', formData.department)
          .eq('is_active', true);

        if (hospitalId) {
          doctorsQuery = doctorsQuery.eq('hospital_id', hospitalId);
        }

        const { data, error } = await doctorsQuery.order('full_name', { ascending: true });

        if (cancelled) return;

        if (error) {
          console.error('Error fetching doctors:', error);
          toast.error('Failed to load doctors for this department');
          setDoctors([]);
        } else {
          setDoctors(data || []);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching doctors:', error);
        toast.error('Failed to load doctors');
        setDoctors([]);
      } finally {
        if (!cancelled) setLoadingDoctors(false);
      }
    };

    fetchDoctors();
    return () => { cancelled = true; };
  }, [formData.department]);

  // Reset doctor selection when department changes
  useEffect(() => {
    if (formData.doctor && !doctors.find(d => d.id === formData.doctor)) {
      setFormData(prev => ({ ...prev, doctor: '' }));
    }
  }, [doctors, formData.doctor]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.patientName?.trim()) {
      newErrors.patientName = 'Patient name is required';
    }

    if (!formData.age || parseInt(formData.age) < 0 || parseInt(formData.age) > 150) {
      newErrors.age = 'Valid age is required';
    }

    if (!formData.admissionDate) {
      newErrors.admissionDate = 'Admission date is required';
    }
    
    // Validate admission date is not in the future
    if (formData.admissionDate) {
      const selectedDate = new Date(formData.admissionDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      if (selectedDate > today) {
        newErrors.admissionDate = 'Admission date cannot be in the future';
      }
    }

    if (!formData.roomNo?.trim()) {
      newErrors.roomNo = 'Room number is required';
    }

    if (!formData.patientIpNo?.trim()) {
      newErrors.patientIpNo = 'Patient IP number is required';
    }

    if (!formData.chiefComplaint?.trim()) {
      newErrors.chiefComplaint = 'Chief complaint is required';
    }

    if (!formData.pastHistory?.trim()) {
      newErrors.pastHistory = 'Past history is required';
    }

    if (!formData.generalExamination?.trim()) {
      newErrors.generalExamination = 'General examination is required';
    }

    if (!formData.medicationGiven?.trim()) {
      newErrors.medicationGiven = 'Medication given is required';
    }

    if (!formData.department) {
      newErrors.department = 'Department is required';
    }

    if (!formData.doctor) {
      newErrors.doctor = 'Doctor is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = document.querySelector(`[data-error="true"]`);
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);
    setUploadProgress([]);

    try {
      let uploadedFileNames: string[] = [];

      // Upload files if any are selected
      if (formData.attachments.length > 0) {
        console.log(`Starting upload of ${formData.attachments.length} files`);
        setIsUploading(true);
        
        // Validate all files before uploading
        for (const file of formData.attachments) {
          const validation = validateFile(file);
          if (!validation.valid) {
            toast.error(`File "${file.name}": ${validation.error}`);
            setIsSubmitting(false);
            setIsUploading(false);
            return;
          }
        }

        toast.loading('Uploading attachments...', { id: 'upload-progress' });

        // Upload files to storage
        const uploadResults = await uploadMultipleFiles(
          formData.attachments,
          'referral_attachments',
          undefined, // No subpath needed
          (progress) => {
            setUploadProgress(progress);
            console.log('Upload progress:', progress);
          }
        );

        // Check for upload failures
        const failedUploads = uploadResults.filter(result => !result.success);
        if (failedUploads.length > 0) {
          console.error('Some files failed to upload:', failedUploads);
          toast.error(`${failedUploads.length} file(s) failed to upload. Please try again.`, { id: 'upload-progress' });
          setIsSubmitting(false);
          setIsUploading(false);
          return;
        }

        // Extract uploaded file names
        uploadedFileNames = uploadResults
          .filter(result => result.success && result.fileName)
          .map(result => result.fileName!);

        console.log('Successfully uploaded files:', uploadedFileNames);
        toast.success(`Successfully uploaded ${uploadedFileNames.length} file(s)`, { id: 'upload-progress' });
        setIsUploading(false);
      }

      // Prepare referral data
      const selectedDoctor = doctors.find(d => d.id === formData.doctor);
      
      const referralData = {
        patientName: formData.patientName,
        age: parseInt(formData.age),
        sex: formData.sex,
        admissionDate: formData.admissionDate,
        patientAdmissionTime: formData.patientAdmissionTime,
        roomNo: formData.roomNo,
        patientIpNo: formData.patientIpNo,
        chiefComplaint: formData.chiefComplaint,
        pastHistory: formData.pastHistory,
        generalExamination: formData.generalExamination,
        medicationGiven: formData.medicationGiven,
        urgency: formData.urgency,
        department: formData.department,
        doctor: selectedDoctor?.full_name || 'Unknown Doctor',
        toDoctorId: formData.doctor, // Pass the selected doctor's ID
        fromDoctor: profile?.full_name || 'Unknown Doctor', // Use actual user name
        fromDepartment: profile?.department || 'Unknown Department', // Use actual department
        attachments: uploadedFileNames // Use uploaded file names instead of original file names
      };

      console.log('Submitting referral with data:', referralData);
      
      // Submit the referral
      onSubmit(referralData);

      // Reset form state on successful submission
      setFormData({
        patientName: '',
        age: '',
        sex: 'Male',
        admissionDate: todayDateString(),
        patientAdmissionTime: nowTimeString(),
        roomNo: '',
        patientIpNo: '',
        chiefComplaint: '',
        pastHistory: '',
        generalExamination: '',
        medicationGiven: '',
        urgency: 'Normal',
        department: '',
        doctor: '',
        attachments: []
      });
      setUploadProgress([]);
      setIsSubmitting(false);
      setIsUploading(false);

    } catch (error) {
      console.error('Error during referral submission:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create referral', { id: 'upload-progress' });
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      const isValidType = ['image/', 'application/pdf', 'text/'].some(type => 
        file.type.startsWith(type)
      );
      return isValidSize && isValidType;
    });

    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...validFiles]
    }));
  };

  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Patient Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-900 flex items-center">
          <User className="w-5 h-5 mr-2 text-primary-600" />
          Patient Information
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Patient Name */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Patient Name <span className="text-red-500">*</span>
            </label>
            <VoiceInput
              value={formData.patientName}
              onValueChange={(value) => setFormData(prev => ({ ...prev, patientName: value }))}
              className={cn(
                "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors",
                errors.patientName ? 'border-red-300' : 'border-neutral-300'
              )}
              placeholder="Enter patient's full name"
            />
            {errors.patientName && (
              <p className="text-xs text-red-600 mt-1">{errors.patientName}</p>
            )}
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Age <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
              className={cn(
                "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors",
                errors.age ? 'border-red-300' : 'border-neutral-300'
              )}
              placeholder="Age"
              min="0"
              max="150"
            />
            {errors.age && (
              <p className="text-xs text-red-600 mt-1">{errors.age}</p>
            )}
          </div>

          {/* Sex */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Sex <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.sex}
              onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value as any }))}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors appearance-none"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Admission Date */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Admission Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.admissionDate}
              onChange={(e) => setFormData(prev => ({ ...prev, admissionDate: e.target.value }))}
              className={cn(
                "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors",
                errors.admissionDate ? 'border-red-300' : 'border-neutral-300'
              )}
            />
            {errors.admissionDate && (
              <p className="text-xs text-red-600 mt-1">{errors.admissionDate}</p>
            )}
          </div>

          {/* Patient Admission Time */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Admission Time <span className="text-neutral-500">(Optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={formData.patientAdmissionTime}
                onChange={(e) => setFormData(prev => ({ ...prev, patientAdmissionTime: e.target.value }))}
                className="flex-1 px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              />
              {formData.patientAdmissionTime && (
                <span className="text-sm font-semibold text-primary-700 bg-primary-50 border border-primary-200 px-3 py-2 rounded-lg whitespace-nowrap">
                  {formatTimeAMPM(formData.patientAdmissionTime)}
                </span>
              )}
            </div>
          </div>

          {/* Room No */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Room No <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.roomNo}
              onChange={(e) => setFormData(prev => ({ ...prev, roomNo: e.target.value }))}
              className={cn(
                "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors",
                errors.roomNo ? 'border-red-300' : 'border-neutral-300'
              )}
              placeholder="Enter room number"
            />
            {errors.roomNo && (
              <p className="text-xs text-red-600 mt-1">{errors.roomNo}</p>
            )}
          </div>

          {/* Patient IP No */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Patient IP No <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.patientIpNo}
              onChange={(e) => setFormData(prev => ({ ...prev, patientIpNo: e.target.value }))}
              className={cn(
                "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors",
                errors.patientIpNo ? 'border-red-300' : 'border-neutral-300'
              )}
              placeholder="Enter patient IP number"
            />
            {errors.patientIpNo && (
              <p className="text-xs text-red-600 mt-1">{errors.patientIpNo}</p>
            )}
          </div>
        </div>
      </div>

      {/* Clinical Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chief Complaint */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Chief Complaint <span className="text-red-500">*</span>
        </label>
        <VoiceTextarea
          value={formData.chiefComplaint}
          onValueChange={(value) => setFormData(prev => ({ ...prev, chiefComplaint: value }))}
          rows={3}
          className={cn(
            "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors resize-none",
            errors.chiefComplaint ? 'border-red-300' : 'border-neutral-300'
          )}
          placeholder="Describe the patient's symptoms, condition, and reason for referral..."
        />
        {errors.chiefComplaint && (
          <p className="text-xs text-red-600 mt-1">{errors.chiefComplaint}</p>
        )}
      </div>

      {/* Past History */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Past History <span className="text-red-500">*</span>
        </label>
        <VoiceTextarea
          value={formData.pastHistory}
          onValueChange={(value) => setFormData(prev => ({ ...prev, pastHistory: value }))}
          rows={3}
          className={cn(
            "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors resize-none",
            errors.pastHistory ? 'border-red-300' : 'border-neutral-300'
          )}
          placeholder="Enter patient's medical past history..."
        />
        {errors.pastHistory && (
          <p className="text-xs text-red-600 mt-1">{errors.pastHistory}</p>
        )}
      </div>

      {/* General Examination */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          General Examination <span className="text-red-500">*</span>
        </label>
        <VoiceTextarea
          value={formData.generalExamination}
          onValueChange={(value) => setFormData(prev => ({ ...prev, generalExamination: value }))}
          rows={3}
          className={cn(
            "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors resize-none",
            errors.generalExamination ? 'border-red-300' : 'border-neutral-300'
          )}
          placeholder="Enter general examination findings..."
        />
        {errors.generalExamination && (
          <p className="text-xs text-red-600 mt-1">{errors.generalExamination}</p>
        )}
      </div>

      {/* Medication Given */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Medication Given <span className="text-red-500">*</span>
        </label>
        <VoiceTextarea
          value={formData.medicationGiven}
          onValueChange={(value) => setFormData(prev => ({ ...prev, medicationGiven: value }))}
          rows={3}
          className={cn(
            "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors resize-none",
            errors.medicationGiven ? 'border-red-300' : 'border-neutral-300'
          )}
          placeholder="Medication administered before referral"
        />
        {errors.medicationGiven && (
          <p className="text-xs text-red-600 mt-1">{errors.medicationGiven}</p>
        )}
      </div>
      </div>

      {/* Urgency Level */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-3">
          Urgency Level <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {urgencyOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = formData.urgency === option.value;
            
            return (
              <motion.button
                key={option.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, urgency: option.value }))}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all text-left",
                  isSelected 
                    ? `${option.bgColor} ${option.borderColor} ${option.textColor}` 
                    : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center mb-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center mr-3",
                    isSelected ? option.color : 'bg-neutral-200'
                  )}>
                    <Icon size={16} className="text-white" />
                  </div>
                  <span className="font-semibold">{option.label}</span>
                </div>
                <p className="text-sm opacity-75">{option.description}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Department and Doctor Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-900 flex items-center">
          <Building2 className="w-5 h-5 mr-2 text-primary-600" />
          Referral Destination
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Select Department <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <select
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  department: e.target.value,
                  doctor: '' // Reset doctor when department changes
                }))}
                className={cn(
                  "w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors appearance-none",
                  errors.department ? 'border-red-300' : 'border-neutral-300'
                )}
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            {errors.department && (
              <p className="text-xs text-red-600 mt-1">{errors.department}</p>
            )}
          </div>

          {/* Doctor */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Select Doctor <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Stethoscope className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
              {loadingDoctors && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400 animate-spin" />
              )}
              <select
                value={formData.doctor}
                onChange={(e) => setFormData(prev => ({ ...prev, doctor: e.target.value }))}
                disabled={!formData.department || loadingDoctors}
                className={cn(
                  "w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors appearance-none",
                  errors.doctor ? 'border-red-300' : 'border-neutral-300',
                  (!formData.department || loadingDoctors) && 'bg-neutral-50 cursor-not-allowed'
                )}
              >
                <option value="">
                  {loadingDoctors 
                    ? 'Loading doctors...'
                    : !formData.department 
                    ? 'Select department first'
                    : doctors.length === 0
                    ? 'No doctors found in this department'
                    : `Select Doctor (${doctors.length} available)`
                  }
                </option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.full_name} ({doctor.role})
                    {doctor.kmc_number && ` - ${doctor.kmc_number}`}
                  </option>
                ))}
              </select>
            </div>
            {errors.doctor && (
              <p className="text-xs text-red-600 mt-1">{errors.doctor}</p>
            )}
            {formData.department && doctors.length === 0 && !loadingDoctors && (
              <p className="text-xs text-amber-600 mt-1">
                No doctors found in {formData.department}. Please contact admin to add doctors to this department.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* File Attachments */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-3">
          Attachments <span className="text-neutral-500">(Optional)</span>
        </label>
        
        <div className="space-y-3">
          {/* Upload Button */}
          <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm text-neutral-600 mb-2">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-neutral-500">
              Max file size: 5MB. Supported formats: Images, PDF, DOC
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3"
            >
              <Paperclip size={16} className="mr-2" />
              Add Files
            </Button>
          </div>

          {/* File List */}
          {formData.attachments.length > 0 && (
            <div className="space-y-2">
              {formData.attachments.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <FileText size={16} className="text-neutral-600 mr-2" />
                    <span className="text-sm text-neutral-900">{file.name}</span>
                    <span className="text-xs text-neutral-500 ml-2">
                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    disabled={isUploading || isSubmitting}
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && uploadProgress.length > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="text-sm font-medium text-neutral-700">Upload Progress</h4>
              {uploadProgress.map((progress, index) => (
                <div key={index} className="bg-white border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-700">{progress.fileName}</span>
                    <span className={cn(
                      "text-xs font-medium",
                      progress.status === 'complete' ? "text-green-600" :
                      progress.status === 'error' ? "text-red-600" :
                      "text-blue-600"
                    )}>
                      {progress.status === 'uploading' ? `${progress.progress}%` :
                       progress.status === 'complete' ? 'Complete' :
                       'Error'}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        progress.status === 'complete' ? "bg-green-500" :
                        progress.status === 'error' ? "bg-red-500" :
                        "bg-blue-500"
                      )}
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                  {progress.error && (
                    <p className="text-xs text-red-600 mt-1">{progress.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 sm:flex-none"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={loadingDoctors || isSubmitting || isUploading}
        >
          {isSubmitting || isUploading ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              {isUploading ? 'Uploading Files...' : 'Creating Referral...'}
            </>
          ) : (
            <>
              <FileText size={16} className="mr-2" />
              Create Referral
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
