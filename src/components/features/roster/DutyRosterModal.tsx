import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  RefreshCw,
  Users,
  Search,
  User,
  AlertCircle,
  Loader,
  Trash2,
  Database,
  Upload
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useResponsive } from '../../../hooks/useResponsive';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ResponsiveModal } from '../../ui/ResponsiveModal';
import { RosterCalendar } from './RosterCalendar';
import { ScheduleDutyForm } from './ScheduleDutyForm';
import { SwapDutyModal } from './SwapDutyModal';
import { RosterFilters } from './RosterFilters';
import { ExportRoster } from './ExportRoster';
import { cn } from '../../../lib/utils';
import { format, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { useDuties, useCreateDuty, useSwapDuty, useDeleteDuty, testDirectDbConnection } from '../../../hooks/useDuties';
import toast from 'react-hot-toast'; 
import type { Duty, DutySwapRequest, ShiftType } from '../../../types/duty.types';

// Lazy-loaded: pulls in the xlsx library, which is otherwise unused by most
// visitors of this always-mounted sidebar modal — keep it out of the eager bundle.
const BulkUploadRosterModal = React.lazy(() => import('./BulkUploadRosterModal'));

// Shortened department list for better UI performance
const DEPARTMENTS = [
  'MD General Medicine',
  'MD General Surgery',
  'MD Pediatrics',
  'MD Obstetrics & Gynecology',
  'MD Orthopedics',
  'MD Psychiatry',
  'MD Dermatology',
  'MD Radiology',
  'MD Anesthesiology',
  'MD Ophthalmology',
  'MD ENT',
  'DM Cardiology',
  'DM Neurology',
  'DM Nephrology',
  'DM Oncology'
];

const SHIFT_CONFIGS = {
  'Day': { 
    start: '08:00', 
    end: '16:00', 
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200'
  },
  'Afternoon': { 
    start: '16:00', 
    end: '00:00', 
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200'
  },
  'Night': { 
    start: '00:00', 
    end: '08:00', 
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200'
  }
};

interface DutyRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DutyRosterModal: React.FC<DutyRosterModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuthStore();
  const { isMobile } = useResponsive();
  
  // Get user's department from profile - ensure it's never empty
  const userDepartment = useMemo(() => {
    if (!profile?.department) {
      return '';
    }
    return profile.department;
  }, [profile?.department]);
  
  // State management
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [selectedDuty, setSelectedDuty] = useState<Duty | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [dutyToDelete, setDutyToDelete] = useState<Duty | null>(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [personalViewOnly, setPersonalViewOnly] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [queryStartTime, setQueryStartTime] = useState<number>(0);
  const [queryEndTime, setQueryEndTime] = useState<number>(0);
  const [memoryUsage, setMemoryUsage] = useState<{current: number, peak: number} | null>(null); 

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      // Reset state but keep viewMode as 'monthly'
      setSelectedDepartments([]);
      setShowScheduleModal(false);
      setShowSwapModal(false);
      setShowDeleteConfirmModal(false);
      setSelectedDuty(null);
      setDutyToDelete(null);
      setShowBulkUploadModal(false);
      setViewMode('monthly'); // Always use monthly view
    }
  }, [isOpen]); 

  // Properly constructed duty query parameters
  const dutyParams = useMemo(() => {
    const params = {
      currentDate,
      viewMode,
      personalViewOnly: personalViewOnly ? profile?.id : undefined
    };
    
    return params;
  }, [currentDate, viewMode, personalViewOnly, profile?.id]);

  // React Query hooks
  const { 
    data: duties = [], 
    isLoading,
    isFetching,
    error, 
    refetch,
    isError 
  } = useDuties(dutyParams);

  // Track query performance
  useEffect(() => {
    if (isFetching) {
      setQueryStartTime(performance.now());
    } else if (queryStartTime > 0) {
      setQueryEndTime(performance.now());
    }
  }, [isFetching]); // Removed queryStartTime from dependencies to prevent infinite loop
  
  // Monitor memory usage
  useEffect(() => {
    // Check if performance.memory is available (Chrome only)
    if (typeof window !== 'undefined' && (performance as any).memory) {
      const checkMemory = () => {
        const currentUsage = (performance as any).memory.usedJSHeapSize / (1024 * 1024);
        setMemoryUsage(prev => ({
          current: currentUsage,
          peak: prev && prev.peak > currentUsage ? prev.peak : currentUsage
        }));
      };
      
      // Check memory initially
      checkMemory();
      
      // Set up interval to check memory usage
      const intervalId = setInterval(checkMemory, 5000);
      
      // Clean up interval on unmount
      return () => clearInterval(intervalId);
    }
  }, []);
  
  const createDutyMutation = useCreateDuty();
  const swapDutyMutation = useSwapDuty(); 
  const deleteDutyMutation = useDeleteDuty();

  // Filtered duties with comprehensive filtering
  const filteredDuties = useMemo(() => {
    if (!duties || duties.length === 0) {
      return [];
    }

    let filtered = [...duties];

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      
      filtered = filtered.filter(duty => {
        const doctorName = duty.user?.full_name?.toLowerCase() || '';
        const kmcNumber = duty.user?.kmc_number?.toLowerCase() || '';
        const department = duty.department.toLowerCase();
        const shiftType = duty.shift_type.toLowerCase();
        
        return doctorName.includes(query) ||
               kmcNumber.includes(query) ||
               department.includes(query) ||
               shiftType.includes(query);
      });
    }

    // Apply department filter
    if (selectedDepartments.length > 0) {
      filtered = filtered.filter(duty => selectedDepartments.includes(duty.department));
    }

    return filtered;
  }, [duties, searchQuery, selectedDepartments]);

  // Test database connection with performance tracking
  const testDbConnection = useCallback(async () => {
    const startTime = performance.now();
    try {
      const result = await testDirectDbConnection();
      const duration = performance.now() - startTime;
      toast.success(`Database connection successful (${duration.toFixed(0)}ms)`);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      toast.error(`Database connection failed (${duration.toFixed(0)}ms)`);
      throw error;
    }
  }, []);

  // Navigation handlers
  const navigatePrevious = useCallback(() => {
    if (viewMode === 'weekly') {
      setCurrentDate(prev => subWeeks(prev, 1));
    } else {
      setCurrentDate(prev => subMonths(prev, 1));
    }
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    if (viewMode === 'weekly') {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => addMonths(prev, 1));
    }
  }, [viewMode]);

  const navigateToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Handle duty creation
  const handleDutyCreated = useCallback(async (newDuty: Omit<Duty, 'id' | 'created_at' | 'updated_at' | 'user'>) => {
    if (!profile?.id) {
      toast.error('User not authenticated');
      return;
    }
    
    if (!newDuty.department) {
      toast.error('Department is required');
      return;
    }

    // Check if user already has a duty on the selected date
    try {
      const { data, error } = await supabase
        .from('duty_roster')
        .select('id')
        .eq('user_id', profile.id)
        .eq('shift_date', newDuty.shift_date)
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        toast.error('You already have a duty on the same day');
        return;
      }
    } catch (error) {
      console.error('Error checking for duplicate duties:', error);
    }

    const dutyData = {
      user_id: profile.id,
      department: newDuty.department,
      shift_date: newDuty.shift_date,
      shift_type: newDuty.shift_type,
      start_time: newDuty.start_time,
      end_time: newDuty.end_time,
      status: 'Scheduled' as const
    };
    
    createDutyMutation.mutate(dutyData, {
      onSuccess: () => {
        setShowScheduleModal(false);
        toast.success('Duty scheduled successfully');
      },
      onError: (error) => {
        toast.error(`Failed to schedule duty: ${error.message}`);
      }
    });
  }, [profile?.id, createDutyMutation]);

  // Handle duty swap
  const handleDutySwap = useCallback((swapRequest: DutySwapRequest) => {
    swapDutyMutation.mutate(swapRequest, {
      onSuccess: () => {
        setShowSwapModal(false);
        setSelectedDuty(null);
        toast.success('Duty swapped successfully');
      }
    });
  }, [swapDutyMutation]);

  // Handle duty click
  const handleDutyClick = useCallback((duty: Duty) => {
    setSelectedDuty(duty);
    setShowSwapModal(true);
  }, []);

  // Handle duty delete
  const handleDutyDelete = useCallback((duty: Duty) => {
    setDutyToDelete(duty);
    setShowDeleteConfirmModal(true);
  }, []);

  // Confirm duty deletion
  const confirmDeleteDuty = useCallback(() => {
    if (!dutyToDelete) return;
    
    deleteDutyMutation.mutate(dutyToDelete.id, {
      onSuccess: () => {
        setShowDeleteConfirmModal(false);
        setDutyToDelete(null);
        toast.success('Duty deleted successfully');
      }
    });
  }, [dutyToDelete, deleteDutyMutation]);

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="Duty Roster"
      size="xl"
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <Button onClick={navigatePrevious} variant="outline" size="sm">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="text-center min-w-[150px]">
              <h2 className="font-semibold text-gray-900 text-sm">
                {viewMode === 'weekly' 
                  ? format(currentDate, 'MMM d, yyyy')
                  : format(currentDate, 'MMMM yyyy')
                }
              </h2>
              <p className="text-xs text-gray-500">
                {viewMode === 'weekly' ? 'Week View' : 'Month View'}
              </p>
            </div>
            
            <Button onClick={navigateNext} variant="outline" size="sm">
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <Button onClick={navigateToday} variant="outline" size="sm">
              Today 
            </Button>
          </div>

          {/* View Controls */}
          <div className="flex items-center gap-2 flex-wrap">
          {/* All Duties */}
          <Button
            onClick={() => setPersonalViewOnly(false)}
            variant={!personalViewOnly ? "primary" : "outline"}
            size="sm"
            aria-label="Show all duties"
          >
            <Users className="w-4 h-4 mr-2" />
            All Duties
          </Button>

          {/* My Duties */}
          <Button
            onClick={() => setPersonalViewOnly(true)}
            variant={personalViewOnly ? "primary" : "outline"}
            size="sm"
            aria-label="Show my duties only"
          >
            <User className="w-4 h-4 mr-2" />
            My Duties
          </Button>

          {/* Export (Excel) */}
          <ExportRoster duties={filteredDuties} isLoading={isLoading} />

          {/* Filters */}
          <Button
            onClick={() => setShowFiltersModal(true)}
            variant="outline"
            size="sm"
            aria-label="Filter duties by department"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {selectedDepartments.length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                {selectedDepartments.length}
              </span>
            )}
          </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (!profile?.id) {
                  toast.error('Please sign in to schedule duties');
                  return;
                }
                if (!userDepartment) {
                  toast.error('Please set your department in your profile');
                  return;
                }
                setShowScheduleModal(true);
              }}
              disabled={!profile?.id || !userDepartment}
              size="sm"
              aria-label="Schedule a new duty"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Duty
            </Button>

            {/* Bulk upload — superusers only, scoped to their own hospital */}
            {(profile as any)?.app_role === 'superuser' && (
              <Button
                onClick={() => setShowBulkUploadModal(true)}
                variant="outline"
                size="sm"
                aria-label="Bulk upload duty roster from a file"
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && duties.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
              <Calendar className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Loading Duty Roster</h3>
            <p className="text-gray-600 text-sm max-w-md text-center">
              Fetching your schedule data. This may take a moment...
            </p>
          </div>
        )}

        {/* No Data State */}
        {!isLoading && duties.length === 0 && (
          <div className="text-center py-6">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Duties Scheduled</h3>
            <div className="space-y-3">
              <p className="text-gray-600">
                {!userDepartment 
                  ? "You need to set your department in your profile before scheduling duties."
                  : "You haven't scheduled any duties yet. Click the button below to create your first duty."}
              </p>
              <div className="flex justify-center gap-3">
                <Button 
                  onClick={() => setShowScheduleModal(true)}
                  disabled={!profile?.id || !userDepartment}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Your First Duty
                </Button>
                <Button 
                  onClick={testDbConnection}
                  variant="outline"
                >
                  <Database className="w-4 h-4 mr-2" />
                  Test Connection
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Filtered Out State */}
        {!isLoading && duties.length > 0 && filteredDuties.length === 0 && (
          <div className="text-center py-6">
            <Filter className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Duties Filtered Out</h3>
            <p className="text-gray-600 mb-4">
              Found {duties.length} duties in database, but your current filters hide them all.
            </p>
            <div className="flex justify-center gap-2">
              {searchQuery && (
                <Button onClick={() => setSearchQuery('')} variant="outline">
                  Clear Search
                </Button>
              )}
              {selectedDepartments.length > 0 && (
                <Button onClick={() => setSelectedDepartments([])} variant="outline">
                  Clear Department Filter
                </Button>
              )}
              {personalViewOnly && (
                <Button onClick={() => setPersonalViewOnly(false)} variant="outline">
                  Show All Duties
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Calendar Display */}
        {filteredDuties.length > 0 && (
          <div className="max-h-[65vh] overflow-auto rounded-lg border border-gray-200 shadow-sm">
            {isLoading && (
              <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center" aria-live="polite" role="status">
                <div className="flex items-center bg-white px-4 py-2 rounded-full shadow-md">
                  <Loader className="w-4 h-4 animate-spin text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Updating roster...</span>
                </div>
              </div>
            )}
            <RosterCalendar
              duties={filteredDuties}
              viewMode={viewMode}
              currentDate={currentDate}
              currentUserId={profile?.id}
              loading={isLoading}
              onDutyClick={handleDutyClick}
              onDutyDelete={handleDutyDelete}
              shiftConfigs={SHIFT_CONFIGS}
              showAllDoctors={!personalViewOnly}
            />
          </div>
        )}

        {/* Error State */}
        {isError && (
          <Card padding="lg" className="border-red-200 bg-red-50">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-red-800">Duty Roster Error</h3>
            </div>
            <p className="text-red-700 mb-4">
              {error instanceof Error ? error.message : 'Failed to load duty roster data'}
            </p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </Card>
        )}

      </div>

      {/* Schedule Duty Modal */}
      <ResponsiveModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule New Duty" 
        size="lg"
      >
        <ScheduleDutyForm
          onSubmit={handleDutyCreated} 
          onCancel={() => setShowScheduleModal(false)}
          departments={DEPARTMENTS}
          userDepartment={userDepartment}
          shiftConfigs={SHIFT_CONFIGS}
          currentDate={currentDate}
          isLoading={createDutyMutation.isLoading}
        />
      </ResponsiveModal>

      {/* Swap Duty Modal */}
      <ResponsiveModal
        isOpen={showSwapModal}
        onClose={() => {
          setShowSwapModal(false);
          setSelectedDuty(null); 
        }}
        title="Swap Duty Assignment" 
      >
        {selectedDuty && (
          <SwapDutyModal
            duty={selectedDuty}
            onSwap={handleDutySwap}
            onCancel={() => {
              setShowSwapModal(false);
              setSelectedDuty(null);
            }}
            isLoading={swapDutyMutation.isLoading}
          />
        )}
      </ResponsiveModal>

      {/* Delete Confirmation Modal */}
      <ResponsiveModal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setDutyToDelete(null); 
        }}
        title="Confirm Duty Deletion" 
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 mb-1">Are you sure you want to delete this duty?</h3>
                {dutyToDelete && (
                  <div className="text-sm text-red-700">
                    <p><strong>Date:</strong> {format(new Date(dutyToDelete.shift_date), 'EEEE, MMMM d, yyyy')}</p>
                    <p><strong>Shift:</strong> {dutyToDelete.shift_type} ({dutyToDelete.start_time} - {dutyToDelete.end_time})</p>
                    <p><strong>Department:</strong> {dutyToDelete.department}</p>
                  </div>
                )}
                <p className="text-sm text-red-700 mt-2">This action cannot be undone.</p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirmModal(false);
                setDutyToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteDuty}
              disabled={deleteDutyMutation.isPending}
              loading={deleteDutyMutation.isPending}
            >
              <Trash2 size={16} className="mr-2" />
              Delete Duty
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* Filters Modal */}
      <ResponsiveModal
        isOpen={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        title="Filter Duties" 
        size="md"
      >
        <RosterFilters
          departments={DEPARTMENTS}
          selectedDepartments={selectedDepartments}
          onDepartmentChange={setSelectedDepartments}
          onClose={() => setShowFiltersModal(false)}
        />
      </ResponsiveModal>

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <React.Suspense fallback={null}>
          <BulkUploadRosterModal
            isOpen={showBulkUploadModal}
            onClose={() => setShowBulkUploadModal(false)}
            shiftConfigs={SHIFT_CONFIGS}
          />
        </React.Suspense>
      )}
    </ResponsiveModal>
  );
};

export default DutyRosterModal;