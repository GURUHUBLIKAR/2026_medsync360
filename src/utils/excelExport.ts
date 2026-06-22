import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { Referral, CompletedReferralData, TransferHistory, CompleteMedicationTrail } from '../types/referral.types';

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

// This is the main function that will be called from the UI
export const generateReferralExcelReport = async (data: CompletedReferralData): Promise<void> => {
  console.log('📊 === EXCEL GENERATION FUNCTION START ===');
  console.log('📋 Input data validation:', {
    hasReferral: !!data.referral,
    hasCompletionData: !!data.completionData,
    transferHistoryLength: data.transferHistory?.length || 0,
    completeMedicationTrailLength: data.completeMedicationTrail?.length || 0,
    referralId: data.referral?.id,
    patientName: data.referral?.patientName
  });

  const { referral, completionData, transferHistory, completeMedicationTrail } = data;
  
  // Validate required data
  if (!referral) {
    console.error('❌ Missing referral data');
    throw new Error('Missing referral data - cannot generate report');
  }
  
  if (!completionData) {
    console.error('❌ Missing completion data');
    throw new Error('Missing completion data - cannot generate report');
  }

  if (!referral.patientName) {
    console.error('❌ Missing patient name');
    throw new Error('Missing patient name - cannot generate filename');
  }

  try {
    // --- 1. Data Preparation ---
    console.log('📋 Step 1: Building report data...');
    const reportData = buildReportData(referral, completionData, transferHistory, completeMedicationTrail);
    console.log('✅ Report data built successfully, rows:', reportData.length);

    // --- 2. Worksheet Creation ---
    console.log('📊 Step 2: Creating Excel workbook...');
    let workbook: XLSX.WorkBook;
    let worksheet: XLSX.WorkSheet;
    
    try {
      workbook = XLSX.utils.book_new();
      worksheet = XLSX.utils.aoa_to_sheet(reportData);
      console.log('✅ Workbook and worksheet created successfully');
    } catch (xlsxError: any) {
      console.error('❌ XLSX workbook creation failed:', xlsxError);
      throw new Error(`Excel workbook creation failed: ${xlsxError.message}`);
    }
    
    // --- 3. Styling and Formatting ---
    console.log('🎨 Step 3: Applying styling...');
    try {
      applyStyling(worksheet, reportData);
      console.log('✅ Styling applied successfully');
    } catch (styleError: any) {
      console.error('❌ Styling failed:', styleError);
      // Continue without styling rather than failing
      console.warn('⚠️ Continuing without styling...');
    }
    
    // --- 4. File Generation ---
    console.log('💾 Step 4: Generating and downloading file...');
    try {
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Referral Report');
      
      // Generate safe filename
      const safePatientName = referral.patientName
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .substring(0, 30); // Limit length
      
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
      const filename = `Referral_${safePatientName}_${timestamp}.xlsx`;
      
      console.log('💾 Writing file:', filename);
      XLSX.writeFile(workbook, filename);
      
      console.log('✅ Excel report generated successfully:', filename);
      console.log('🎉 === EXCEL GENERATION FUNCTION SUCCESS ===');
      
    } catch (fileError: any) {
      console.error('❌ File generation failed:', fileError);
      throw new Error(`Excel file generation failed: ${fileError.message}`);
    }
    
  } catch (error: any) {
    console.error('💥 === EXCEL GENERATION FUNCTION FAILED ===');
    console.error('❌ Error Type:', error.constructor.name);
    console.error('❌ Error Message:', error.message);
    console.error('❌ Error Stack:', error.stack);
    console.error('❌ Context:', {
      referralId: referral?.id,
      patientName: referral?.patientName,
      hasTransferHistory: !!(transferHistory && transferHistory.length > 0),
      hasMedicationTrail: !!(completeMedicationTrail && completeMedicationTrail.length > 0)
    });
    
    // Re-throw with more context
    if (error.message.includes('buildReportData')) {
      throw new Error(`Report data processing failed: ${error.message}`);
    } else if (error.message.includes('XLSX') || error.message.includes('Excel')) {
      throw new Error(`Excel file creation failed: ${error.message}`);
    } else {
      throw new Error(`Excel report generation failed: ${error.message}`);
    }
  }
};

// Helper function to structure the report data
function buildReportData(referral: Referral, completionData: any, transferHistory: TransferHistory[] = [], completeMedicationTrail: CompleteMedicationTrail[] = []): any[][] {
  console.log('🔧 === BUILD REPORT DATA START ===');
  console.log('📋 Input validation:', {
    hasReferral: !!referral,
    hasCompletionData: !!completionData,
    transferHistoryLength: transferHistory?.length || 0,
    medicationTrailLength: completeMedicationTrail?.length || 0,
    referralKeys: referral ? Object.keys(referral) : [],
    completionDataKeys: completionData ? Object.keys(completionData) : []
  });

  try {
    // Validate required data
    if (!referral) {
      throw new Error('buildReportData: Missing referral data');
    }
    
    if (!completionData) {
      throw new Error('buildReportData: Missing completion data');
    }

    // Safely extract medication data - Use medication trail for accurate initial/final detection
    let initialMedication = 'None specified';
    let finalMedication = 'None specified';
    
    if (completeMedicationTrail.length > 0) {
      // Use the first step from medication trail as the true initial medication
      initialMedication = completeMedicationTrail[0]?.medication_prescribed || 'None specified';
      // Use the last step from medication trail as the true final medication
      finalMedication = completeMedicationTrail[completeMedicationTrail.length - 1]?.medication_prescribed || 'None specified';
    } else {
      // Fallback to referral data if no trail available
      initialMedication = referral.initialMedication || referral.medicationGiven || 'None specified';
      finalMedication = completionData.updatedMedication || referral.medicationGiven || 'None specified';
    }
    
    console.log('💊 Medication data extracted:', {
      initialMedication,
      finalMedication,
      medicationTrailLength: completeMedicationTrail.length,
      referralMedicationGiven: referral.medicationGiven,
      completionUpdatedMedication: completionData.updatedMedication,
      firstStepMedication: completeMedicationTrail[0]?.medication_prescribed,
      lastStepMedication: completeMedicationTrail[completeMedicationTrail.length - 1]?.medication_prescribed
    });

    // Extract medication trail summary data
    const originalDoctor = completeMedicationTrail[0]?.doctor_name || 'N/A';
    const originalMedication = completeMedicationTrail[0]?.medication_prescribed || 'N/A';
    const finalDoctor = completeMedicationTrail[completeMedicationTrail.length - 1]?.doctor_name || 'N/A';
    const finalMedicationFromTrail = completeMedicationTrail[completeMedicationTrail.length - 1]?.medication_prescribed || 'N/A';
    const totalDoctorsInvolved = completeMedicationTrail.length > 0 ? new Set(completeMedicationTrail.map(s => s.doctor_id)).size : 0;
    const totalDepartmentsInvolved = completeMedicationTrail.length > 0 ? new Set(completeMedicationTrail.map(s => s.department_context)).size : 0;

    console.log('📊 Extracted medication trail summary:', {
      originalDoctor,
      originalMedication,
      finalDoctor,
      finalMedicationFromTrail,
      totalDoctorsInvolved,
      totalDepartmentsInvolved
    });

    // For multi-hop chains the true "created" time is the first step of the medication
    // trail (the original referral), not this leaf referral's created_at (= transfer time).
    const originalCreatedAt = (completeMedicationTrail.length > 0 && completeMedicationTrail[0]?.record_timestamp)
      ? completeMedicationTrail[0].record_timestamp
      : referral.createdAt;

    // Hop summary for the timeline: ordered department path (consecutive duplicates
    // collapsed) + number of holder (doctor) changes counted as transfers. Derived
    // from the chain-complete medication trail so it works in every report path.
    const departmentPath: string[] = [];
    let totalTransfers = 0;
    let lastDoctorId: string | undefined;
    for (const step of completeMedicationTrail) {
      const dept = (step as any).department_context;
      if (dept && departmentPath[departmentPath.length - 1] !== dept) {
        departmentPath.push(dept);
      }
      const docId = (step as any).doctor_id;
      if (lastDoctorId !== undefined && docId && docId !== lastDoctorId) {
        totalTransfers++;
      }
      if (docId) lastDoctorId = docId;
    }
    const departmentsVisited = departmentPath.length > 0
      ? departmentPath.join(' → ')
      : [referral.fromDepartment, referral.department].filter(Boolean).join(' → ');

    // Create the exact 2-column format matching the screenshot
    const data = [
      // Report Header
      ['MedSync 360 - Referral Completion Report', `Generated on: ${format(new Date(), 'MMMM d, yyyy - h:mm a')}`],
      [], // Spacer

      // PATIENT INFORMATION Section
      ['PATIENT INFORMATION', ''],
      ['Patient Name:', referral.patientName],
      ['Age:', `${referral.age} years`],
      ['Sex:', referral.sex],
      ['Room No:', referral.roomNo || 'N/A'],
      ['Patient IP No:', referral.patientIpNo || 'N/A'],
      ['Admission Date:', format(new Date(referral.admissionDate), 'MMMM d, yyyy')],
      ['Admission Time:', referral.patientAdmissionTime ? formatTimeAMPM(referral.patientAdmissionTime) : 'N/A'],
      [], // Spacer

      // REFERRAL DETAILS Section
      ['REFERRAL DETAILS', ''],
      ['Referral ID:', referral.id],
      ['Chief Complaint:', referral.chiefComplaint],
      ['Past History:', referral.pastHistory || 'N/A'],
      ['General Examination:', referral.generalExamination || 'N/A'],
      ['Urgency Level:', referral.urgency],
      ['Status:', referral.status],
      [], // Spacer

      // REFERRAL PATH Section
      ['REFERRAL PATH', ''],
      ['From Department:', referral.fromDepartment],
      ['From Doctor:', referral.fromDoctor],
      ['To Department:', referral.department],
      ['To Doctor:', referral.doctor],
      [], // Spacer

      // MEDICATION DETAILS Section
      ['MEDICATION DETAILS', ''],
      ['Initial Medication:', initialMedication],
      ['Final Medication:', finalMedication],
      ['Medication Changed:', (initialMedication !== finalMedication) ? 'Yes' : 'No'],
      ['Total Journey Steps:', completeMedicationTrail.length],
      [], // Spacer

      // COMPLETE MEDICATION JOURNEY Section
      ['COMPLETE MEDICATION JOURNEY', ''],
      ...completeMedicationTrail.flatMap(step => [
        [`Step ${step.step_number}: ${step.action_type}`, step.record_timestamp ? format(new Date(step.record_timestamp), 'MMMM d, yyyy - h:mm a') : ''],
        ['Doctor / Department', `${step.doctor_name} (${step.department_context})`],
        ['Medication Prescribed', step.medication_prescribed],
        ['Context', step.medication_context],
        ['', ''] // Spacer between steps
      ]),
      [], // Spacer

      // MEDICATION TRAIL SUMMARY Section
      ['MEDICATION TRAIL SUMMARY', ''],
      ['Original Doctor:', originalDoctor],
      ['Original Medication:', originalMedication],
      ['Final Doctor:', finalDoctor],
      ['Final Medication:', finalMedicationFromTrail],
      ['Total Doctors Involved:', totalDoctorsInvolved.toString()],
      ['Total Departments Involved:', totalDepartmentsInvolved.toString()],
      [], // Spacer

      // COMPLETION DETAILS Section
      ['COMPLETION DETAILS', ''],
      ['Patient Attended:', completionData.isPatientAttended ? 'Yes' : 'No'],
      ['Completion Date:', completionData.completedAt ? format(new Date(completionData.completedAt), 'MMMM d, yyyy - h:mm a') : 'N/A'],
      ['Completed By:', completionData.completedBy || 'N/A'],
      [], // Spacer

      // ATTENDANCE DETAILS Section
      ['ATTENDANCE DETAILS', ''],
      ['Patient was successfully attended and treated', ''],
      ['Final Medication:', finalMedication],
      [], // Spacer

      // FINAL DIAGNOSIS Section
      ['FINAL DIAGNOSIS', ''],
      ['Diagnosis Category:', completionData.finalDiagnosisCategory || 'N/A'],
      ['Diagnosis Details:', completionData.finalDiagnosisDetails || 'N/A'],
      ['Diagnosed At:', completionData.finalDiagnosisTimestamp ? format(new Date(completionData.finalDiagnosisTimestamp), 'MMMM d, yyyy - h:mm a') : 'N/A'],
      ['Diagnosed By:', completionData.finalDiagnosisBy || 'N/A'],
      [], // Spacer

      // TIMELINE Section
      ['TIMELINE', ''],
      ['Referral Created:', originalCreatedAt ? format(new Date(originalCreatedAt), 'MMMM d, yyyy - h:mm a') : 'N/A'],
      ['Referral Accepted:', referral.acceptedAt ? format(new Date(referral.acceptedAt), 'MMMM d, yyyy - h:mm a') : 'N/A'],
      ['Referral Completed:', completionData.completedAt ? format(new Date(completionData.completedAt), 'MMMM d, yyyy - h:mm a') : 'N/A'],
      ['Departments Visited:', departmentsVisited || 'N/A'],
      ['Total Transfers:', totalTransfers.toString()],
      ['Total Duration:', originalCreatedAt && completionData.completedAt ? calculateDuration(originalCreatedAt, completionData.completedAt) : 'N/A'],
      [], // Spacer

      // SUMMARY Section
      ['SUMMARY', ''],
      ['Referral Successful:', completionData.isPatientAttended ? 'Yes' : 'No'],
      ['Medication Provided:', 'Yes'],
      ['Attachments Count:', (referral.attachments?.length || 0).toString()],
      [], // Spacer

      // Footer
      ['Report generated by MedSync 360 - Healthcare Referral Management System', ''],
      ['For internal use only - Contains confidential patient information', '']
    ];

    console.log('✅ Report data structure built successfully');
    console.log('🔧 === BUILD REPORT DATA SUCCESS ===');
    return data;
    
  } catch (error: any) {
    console.error('💥 === BUILD REPORT DATA FAILED ===');
    console.error('❌ Error in buildReportData:', error);
    console.error('❌ Context:', {
      referralId: referral?.id,
      patientName: referral?.patientName,
      hasTransferHistory: !!(transferHistory && transferHistory.length > 0),
      hasMedicationTrail: !!(completeMedicationTrail && completeMedicationTrail.length > 0)
    });
    
    throw new Error(`buildReportData failed: ${error.message}`);
  }
}

// Helper function for styling (updated for 2-column format)
function applyStyling(worksheet: XLSX.WorkSheet, data: any[][]) {
  // Set column widths for 2-column layout
  worksheet['!cols'] = [{ wch: 40 }, { wch: 60 }]; // Label column and Value column

  // Merge cells for the main report header (spans both columns)
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]; // A1:B1

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 },
    fill: { fgColor: { rgb: "4F81BD" } },
    alignment: { vertical: 'center', horizontal: 'center' }
  };
  
  const sectionHeaderStyle = {
    font: { bold: true, sz: 12 },
    fill: { fgColor: { rgb: "4F81BD" } }, // Blue background for section headers
    alignment: { vertical: 'center' }
  };

  const labelStyle = {
    font: { bold: true, sz: 10 },
    alignment: { vertical: 'center' }
  };

  const valueStyle = {
    font: { sz: 10 },
    alignment: { vertical: 'center' }
  };

  data.forEach((row, r) => {
    const rowNum = r + 1; // Excel is 1-indexed
    
    // Main Header (row 0)
    if (r === 0) {
      if (worksheet[`A${rowNum}`]) {
        worksheet[`A${rowNum}`].s = headerStyle;
      }
    }
    // Section Headers (all-caps rows with empty second column)
    else if (row[0] && typeof row[0] === 'string' && row[0] === row[0].toUpperCase() && (!row[1] || row[1] === '')) {
      if (worksheet[`A${rowNum}`]) {
        worksheet[`A${rowNum}`].s = sectionHeaderStyle;
      }
    }
    // Data rows (label: value pairs)
    else if (row[0] && row[1] && row[0] !== '') {
      // Label column
      if (worksheet[`A${rowNum}`]) {
        worksheet[`A${rowNum}`].s = labelStyle;
      }
      // Value column
      if (worksheet[`B${rowNum}`]) {
        worksheet[`B${rowNum}`].s = valueStyle;
      }
    }
  });

  console.log('🎨 Applied 2-column styling with', data.length, 'rows');
}

export const generateBulkReferralReport = (referrals: CompletedReferralData[]): void => {
  try {
    // Create summary data
    const summaryData = [
      ['MedSync 360 - Bulk Referral Report', '', '', '', '', ''],
      ['Generated on:', format(new Date(), 'MMMM d, yyyy - h:mm a'), '', '', '', ''],
      ['Total Referrals:', referrals.length.toString(), '', '', '', ''],
      ['', '', '', '', '', ''],
      
      // Headers
      ['Patient Name', 'Department', 'Doctor', 'Attended', 'Completion Date', 'Duration'],
    ];
    
    // Add referral data
    const referralRows = referrals.map(({ referral, completionData }) => [
      referral.patientName,
      referral.department,
      referral.doctor,
      completionData.isPatientAttended ? 'Yes' : 'No',
      format(new Date(completionData.completedAt), 'MMM d, yyyy'),
      calculateDuration(referral.createdAt, completionData.completedAt)
    ]);
    
    const allData = [...summaryData, ...referralRows];
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(allData);
    
    // Set column widths
    worksheet['!cols'] = [
      { width: 25 }, // Patient Name
      { width: 20 }, // Department  
      { width: 20 }, // Doctor
      { width: 12 }, // Attended
      { width: 15 }, // Completion Date
      { width: 15 }  // Duration
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bulk Report');
    
    // Generate filename
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
    const filename = `Bulk_Referral_Report_${timestamp}.xlsx`;
    
    // Save file
    XLSX.writeFile(workbook, filename);
    
    console.log(`Bulk Excel report generated: ${filename}`);
    
  } catch (error) {
    console.error('Error generating bulk Excel report:', error);
    throw new Error('Failed to generate bulk Excel report');
  }
};

// Helper function to calculate duration between two dates
const calculateDuration = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  } else {
    return `${diffMinutes}m`;
  }
};

export default {
  generateReferralExcelReport,
  generateBulkReferralReport
};
