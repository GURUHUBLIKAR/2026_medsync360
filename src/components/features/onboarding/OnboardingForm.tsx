import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useHospitals } from '../../../hooks/useHospitals';
import { 
  User, 
  Camera, 
  Upload, 
  X, 
  Check, 
  AlertCircle, 
  Loader2,
  LogOut,
  Stethoscope,
  Calendar,
  Phone,
  MapPin,
  GraduationCap,
  Building,
  CreditCard,
  Users
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../../lib/supabase';
import { isKmcNumberTaken } from '../../../lib/kmc';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface OnboardingData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  profilePicture: File | null;
  role: string;
  yearOfGraduation: string;
  graduatedFrom: string;
  currentlyWorkingAt: string;
  department: string;
  kmcNumber: string;
  aadharNumber: string;
  primaryPhone: string;
  secondaryPhone: string;
}

interface ValidationErrors {
  [key: string]: string;
}

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

const ROLES = ['PG', 'Senior Resident', 'House', 'Consultant'];
const GENDERS = ['Male', 'Female', 'Other'];

export const OnboardingForm: React.FC = () => {
  const { user, signOut, updateProfile } = useAuthStore();
  const { data: hospitals = [] } = useHospitals();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<OnboardingData>({
    firstName: user?.user_metadata?.full_name?.split(' ')[0] || '',
    lastName: user?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
    dateOfBirth: '',
    gender: '',
    profilePicture: null,
    role: '',
    yearOfGraduation: '',
    graduatedFrom: '',
    currentlyWorkingAt: '',
    department: '',
    kmcNumber: '',
    aadharNumber: '',
    primaryPhone: '',
    secondaryPhone: ''
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  // Generate year options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i);

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'firstName':
      case 'lastName':
        return value.length < 2 ? 'Must be at least 2 characters' : '';
      
      case 'dateOfBirth':
        if (!value) return 'Date of birth is required';
        const age = new Date().getFullYear() - new Date(value).getFullYear();
        return age < 22 || age > 70 ? 'Age must be between 22 and 70' : '';
      
      case 'kmcNumber':
        const kmcPattern = /^KMC\d{6}$/i;
        return !kmcPattern.test(value) ? 'Format: KMC followed by 6 digits' : '';
      
      case 'aadharNumber':
        const aadharPattern = /^\d{12}$/;
        return !aadharPattern.test(value.replace(/\s/g, '')) ? 'Must be exactly 12 digits' : '';
      
      case 'primaryPhone':
        const phonePattern = /^\d{10}$/;
        return !phonePattern.test(value) ? 'Must be exactly 10 digits' : '';
      
      case 'secondaryPhone':
        if (value && !/^\d{10}$/.test(value)) return 'Must be exactly 10 digits';
        return '';
      
      case 'role':
      case 'department':
      case 'graduatedFrom':
      case 'currentlyWorkingAt':
      case 'yearOfGraduation':
      case 'gender':
        return !value ? 'This field is required' : '';
      
      default:
        return '';
    }
  };

  const handleInputChange = (name: string, value: string) => {
    // Format specific fields
    if (name === 'aadharNumber') {
      value = value.replace(/\D/g, '').slice(0, 12);
      value = value.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3').trim();
    } else if (name === 'primaryPhone' || name === 'secondaryPhone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    } else if (name === 'kmcNumber') {
      value = value.toUpperCase();
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, profilePicture: 'File size must be less than 5MB' }));
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, profilePicture: 'Only image files are allowed' }));
      return;
    }

    setFormData(prev => ({ ...prev, profilePicture: file }));
    setErrors(prev => ({ ...prev, profilePicture: '' }));

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setProfilePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const calculateProgress = (): number => {
    const requiredFields = [
      'firstName', 'lastName', 'dateOfBirth', 'gender', 'role',
      'yearOfGraduation', 'graduatedFrom', 'currentlyWorkingAt',
      'department', 'kmcNumber', 'aadharNumber', 'primaryPhone'
    ];
    
    const filledFields = requiredFields.filter(field => formData[field as keyof OnboardingData]);
    return Math.round((filledFields.length / requiredFields.length) * 100);
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};
    
    Object.keys(formData).forEach(key => {
      if (key !== 'profilePicture' && key !== 'secondaryPhone') {
        const error = validateField(key, formData[key as keyof OnboardingData] as string);
        if (error) newErrors[key] = error;
      }
    });

    // Validate secondary phone if provided
    if (formData.secondaryPhone) {
      const error = validateField('secondaryPhone', formData.secondaryPhone);
      if (error) newErrors.secondaryPhone = error;
    }

    setErrors(newErrors);
    
    // Scroll to first error
    if (Object.keys(newErrors).length > 0) {
      const firstErrorField = document.querySelector(`[data-error="true"]`);
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // A KMC number uniquely identifies a doctor — reject one already
      // registered to another account before creating this profile.
      if (await isKmcNumberTaken(formData.kmcNumber, user?.id)) {
        const message = 'This KMC number is already registered to another account.';
        setErrors(prev => ({ ...prev, kmcNumber: message }));
        toast.error(message);
        document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      let avatarUrl = null;
      
      // Upload profile picture if provided
      if (formData.profilePicture) {
        const fileExt = formData.profilePicture.name.split('.').pop();
        const fileName = `${user?.id}/${user?.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, formData.profilePicture);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        
        avatarUrl = publicUrl;
      }
      
      // Update user profile
      const profileData = {
        full_name: `${formData.firstName} ${formData.lastName}`,
        role: formData.role as any,
        department: formData.department,
        kmc_number: formData.kmcNumber,
        aadhar_number: formData.aadharNumber.replace(/\s/g, ''),
        phone: formData.primaryPhone,
        avatar_url: avatarUrl,
        // Additional fields for extended profile
        date_of_birth: formData.dateOfBirth,
        gender: formData.gender,
        year_of_graduation: parseInt(formData.yearOfGraduation),
        graduated_from: formData.graduatedFrom,
        currently_working_at: formData.currentlyWorkingAt,
        // Link to the real hospital record (multi-tenant scoping). New doctors stay
        // approval_status='pending' (DB default) until their hospital superuser approves.
        hospital_id: hospitals.find(h => h.name === formData.currentlyWorkingAt)?.id || null,
        secondary_phone: formData.secondaryPhone || null,
        profile_completed_at: new Date().toISOString()
      } as any;
      
      // Use updateProfile which now handles upsert logic
      await updateProfile(profileData);

      // New doctors are created as 'pending' and must be approved by their hospital
      // superuser/platform owner — tell them clearly instead of implying they're in.
      toast.success('Account created — your registration has been submitted for verification.', { duration: 6000 });

      // The approval gate on /dashboard will route a pending user to the
      // "Waiting for approval" screen.
      navigate('/dashboard', {
        replace: true,
        state: { fromOnboarding: true }
      });

    } catch (error: any) {
      console.error('Onboarding error:', error);
      
      const errMsg = String(error?.message || '');
      if (error?.code === '23505' && errMsg.toLowerCase().includes('kmc')) {
        // KMC unique-index backstop (e.g. a concurrent registration).
        const message = 'This KMC number is already registered to another account.';
        setErrors(prev => ({ ...prev, kmcNumber: message }));
        toast.error(message);
      } else if (errMsg.includes('duplicate key value violates unique constraint')) {
        toast.error('Some information is already registered. Please check your details.');
      } else {
        toast.error('Failed to complete profile. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const progress = calculateProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Complete Your Profile</h1>
                <p className="text-sm text-gray-600">Welcome to MedSync360</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Profile Completion</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile Picture */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              Profile Picture
            </h2>
            
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  {profilePreview ? (
                    <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                {profilePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfilePreview(null);
                      setFormData(prev => ({ ...prev, profilePicture: null }));
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Upload Photo
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Optional • Max 5MB • JPG, PNG, GIF
                </p>
                {errors.profilePicture && (
                  <p className="text-xs text-red-600 mt-1">{errors.profilePicture}</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Personal Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              Personal Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.firstName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your first name"
                  data-error={!!errors.firstName}
                />
                {errors.firstName && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.firstName}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.lastName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your last name"
                  data-error={!!errors.lastName}
                />
                {errors.lastName && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.lastName}
                  </p>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.dateOfBirth ? 'border-red-300' : 'border-gray-300'
                    }`}
                    data-error={!!errors.dateOfBirth}
                  />
                </div>
                {errors.dateOfBirth && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.dateOfBirth}
                  </p>
                )}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none ${
                      errors.gender ? 'border-red-300' : 'border-gray-300'
                    }`}
                    data-error={!!errors.gender}
                  >
                    <option value="">Select gender</option>
                    {GENDERS.map(gender => (
                      <option key={gender} value={gender}>{gender}</option>
                    ))}
                  </select>
                </div>
                {errors.gender && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.gender}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Medical Credentials */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <GraduationCap className="w-5 h-5 mr-2 text-blue-600" />
              Medical Credentials
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Stethoscope className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={formData.role}
                    onChange={(e) => handleInputChange('role', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none ${
                      errors.role ? 'border-red-300' : 'border-gray-300'
                    }`}
                    data-error={!!errors.role}
                  >
                    <option value="">Select your role</option>
                    {ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                {errors.role && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.role}
                  </p>
                )}
              </div>

              {/* Year of Graduation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year of Graduation <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={formData.yearOfGraduation}
                    onChange={(e) => handleInputChange('yearOfGraduation', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none ${
                      errors.yearOfGraduation ? 'border-red-300' : 'border-gray-300'
                    }`}
                    data-error={!!errors.yearOfGraduation}
                  >
                    <option value="">Select year</option>
                    {yearOptions.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                {errors.yearOfGraduation && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.yearOfGraduation}
                  </p>
                )}
              </div>

              {/* Graduated From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Graduated From <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.graduatedFrom}
                    onChange={(e) => handleInputChange('graduatedFrom', e.target.value)}
                    placeholder="College / university you graduated from"
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.graduatedFrom ? 'border-red-300' : 'border-gray-300'
                    }`}
                    data-error={!!errors.graduatedFrom}
                  />
                </div>
                {errors.graduatedFrom && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.graduatedFrom}
                  </p>
                )}
              </div>

              {/* Currently Working At */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currently Working At <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={formData.currentlyWorkingAt}
                    onChange={(e) => handleInputChange('currentlyWorkingAt', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none ${
                      errors.currentlyWorkingAt ? 'border-red-300' : 'border-gray-300'
                    }`}
                    data-error={!!errors.currentlyWorkingAt}
                  >
                    <option value="">Select hospital</option>
                    {hospitals.map(h => (
                      <option key={h.id} value={h.name}>{h.name}</option>
                    ))}
                  </select>
                </div>
                {errors.currentlyWorkingAt && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.currentlyWorkingAt}
                  </p>
                )}
              </div>

              {/* Department */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Stethoscope className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none ${
                      errors.department ? 'border-red-300' : 'border-gray-300'
                    }`}
                    data-error={!!errors.department}
                  >
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                {errors.department && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.department}
                  </p>
                )}
              </div>

              {/* KMC Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  KMC Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.kmcNumber}
                    onChange={(e) => handleInputChange('kmcNumber', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.kmcNumber ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="KMC123456"
                    data-error={!!errors.kmcNumber}
                  />
                </div>
                {errors.kmcNumber && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.kmcNumber}
                  </p>
                )}
              </div>

              {/* Aadhar Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aadhar Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.aadharNumber}
                    onChange={(e) => handleInputChange('aadharNumber', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.aadharNumber ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="1234 5678 9012"
                    data-error={!!errors.aadharNumber}
                  />
                </div>
                {errors.aadharNumber && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.aadharNumber}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <Phone className="w-5 h-5 mr-2 text-blue-600" />
              Contact Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Primary Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Phone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.primaryPhone}
                    onChange={(e) => handleInputChange('primaryPhone', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.primaryPhone ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="9876543210"
                    data-error={!!errors.primaryPhone}
                  />
                </div>
                {errors.primaryPhone && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.primaryPhone}
                  </p>
                )}
              </div>

              {/* Secondary Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Phone <span className="text-gray-400">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.secondaryPhone}
                    onChange={(e) => handleInputChange('secondaryPhone', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.secondaryPhone ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="9876543210"
                    data-error={!!errors.secondaryPhone}
                  />
                </div>
                {errors.secondaryPhone && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.secondaryPhone}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Submit Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 pt-6"
          >
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 sm:flex-none px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || progress < 100}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completing Profile...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Complete Profile
                </>
              )}
            </button>
          </motion.div>
        </form>
      </div>
    </div>
  );
};