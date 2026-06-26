import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Calendar, 
  CreditCard, 
  Phone, 
  Building2,
  GraduationCap,
  Shield
} from 'lucide-react';
import { useResponsive } from '../../../hooks/useResponsive';
import { cn } from '../../../lib/utils';
import type { Database } from '../../../types/database.types';

type UserProfile = Database['public']['Tables']['users']['Row'];

interface DashboardUserInfoProps {
  profile: UserProfile;
}

export const DashboardUserInfo: React.FC<DashboardUserInfoProps> = ({ profile }) => {
  const { isMobile } = useResponsive();

  // Calculate age from date of birth
  const calculateAge = useMemo(() => (dateOfBirth: string | null): number | null => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }, []);

  // Format KMC number for display
  const formatKMCNumber = useMemo(() => (kmcNumber: string | null): string => {
    if (!kmcNumber) return 'Not provided';
    // Ensure proper KMC format (KMC followed by 6 digits)
    const cleaned = kmcNumber.replace(/\D/g, '');
    if (cleaned.length === 6) {
      return `KMC${cleaned}`;
    }
    return kmcNumber.toUpperCase();
  }, []);

  // Validate KMC number format
  const isValidKMC = useMemo(() => (kmcNumber: string | null): boolean => {
    if (!kmcNumber) return false;
    const kmcPattern = /^KMC\d{6}$/i;
    return kmcPattern.test(kmcNumber);
  }, []);

  const age = useMemo(() => calculateAge(profile.date_of_birth), [calculateAge, profile.date_of_birth]);
  const formattedKMC = useMemo(() => formatKMCNumber(profile.kmc_number), [formatKMCNumber, profile.kmc_number]);
  const isKMCValid = useMemo(() => isValidKMC(profile.kmc_number), [isValidKMC, profile.kmc_number]);

  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-primary-50 border border-primary-100 rounded-lg p-4 mt-4"
      >
        <div className="grid grid-cols-2 gap-2 md:gap-3 text-xs md:text-sm">
          <div className="grid grid-cols-2 gap-1 md:gap-2 text-xs">
            {/* Age */}
            {age && (
              <div className="flex items-center">
                <Calendar className="w-3 h-3 mr-1 text-primary-600" />
                <span className="text-neutral-600">{age} years</span>
              </div>
            )}
            
            {/* KMC Number */}
            <div className="flex items-center">
              <CreditCard className="w-3 h-3 mr-1 text-primary-600" />
              <span className={cn(
                "text-neutral-600 font-mono text-xs",
                !isKMCValid && "text-yellow-700"
              )}>
                {formattedKMC}
              </span>
              {isKMCValid && (
                <Shield className="w-2 h-2 ml-1 text-success-600" />
              )}
            </div>
            
            {/* Phone */}
            {profile.phone && (
              <div className="flex items-center col-span-2">
                <Phone className="w-3 h-3 mr-1 text-primary-600" />
                <span className="text-neutral-600">{profile.phone}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-primary-50 border border-primary-100 rounded-lg p-4 md:p-5 lg:p-6 min-w-[280px] md:min-w-[320px]"
    >
      <div className="flex items-center mb-4">
        <User className="w-3 h-3 md:w-4 md:h-4 mr-2 text-primary-600" />
        <h3 className="text-sm md:text-base font-semibold text-neutral-900">Profile Information</h3>
      </div>
      
      <div className="space-y-1 md:space-y-2">
        {/* Age Display */}
        {age && (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="w-3 h-3 md:w-3 md:h-3 mr-1 md:mr-2 text-primary-600" />
              <span className="text-neutral-600 text-xs md:text-xs">Age</span>
            </div>
            <span className="text-neutral-900 font-medium text-xs md:text-sm">{age} years</span>
          </div>
        )}
        
        {/* KMC Number with Validation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CreditCard className="w-3 h-3 md:w-3 md:h-3 mr-1 md:mr-2 text-primary-600" />
            <span className="text-neutral-600 text-xs md:text-xs">KMC Number</span>
          </div>
          <div className="flex items-center">
            <span className={cn(
              "font-mono text-xs md:text-xs",
              isKMCValid ? "text-neutral-900" : "text-yellow-700"
            )}>
              {formattedKMC}
            </span>
            {isKMCValid ? (
              <Shield className="w-3 h-3 md:w-3 md:h-3 ml-1 md:ml-2 text-success-600" />
            ) : (
              <div className="w-3 h-3 md:w-3 md:h-3 ml-1 md:ml-2 rounded-full bg-yellow-400 flex items-center justify-center">
                <span className="text-yellow-800 text-xs font-bold">!</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Graduation Info */}
        {profile.year_of_graduation && (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <GraduationCap className="w-3 h-3 md:w-3 md:h-3 mr-1 md:mr-2 text-primary-600" />
              <span className="text-neutral-600 text-xs md:text-xs">Graduated</span>
            </div>
            <span className="text-neutral-900 font-medium text-xs md:text-sm">{profile.year_of_graduation}</span>
          </div>
        )}
        
        {/* Current Workplace */}
        {profile.currently_working_at && (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Building2 className="w-3 h-3 md:w-3 md:h-3 mr-1 md:mr-2 text-primary-600" />
              <span className="text-neutral-600 text-xs md:text-xs">Workplace</span>
            </div>
            <span className="text-neutral-900 font-medium text-right text-xs md:text-xs max-w-[100px] md:max-w-[120px] truncate">
              {profile.currently_working_at}
            </span>
          </div>
        )}
        
        {/* Contact Information */}
        {profile.phone && (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Phone className="w-3 h-3 md:w-3 md:h-3 mr-1 md:mr-2 text-primary-600" />
              <span className="text-neutral-600 text-xs md:text-xs">Phone</span>
            </div>
            <span className="text-neutral-900 font-medium text-xs md:text-sm">{profile.phone}</span>
          </div>
        )}
      </div>
      
      {/* KMC Validation Warning */}
      {!isKMCValid && profile.kmc_number && (
        <div className="mt-2 md:mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-700 text-xs">
            ⚠️ KMC number format may be incorrect. Expected format: KMC123456
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default React.memo(DashboardUserInfo);