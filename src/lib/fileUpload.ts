import { supabase } from './supabase';
import toast from 'react-hot-toast';

export interface UploadResult {
  success: boolean;
  fileName?: string;
  fileUrl?: string;
  error?: string;
  filePath?: string;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

/**
 * Upload a single file to Supabase storage
 */
export const uploadFileToStorage = async (
  file: File,
  bucketName: string = 'referral_attachments',
  subPath?: string
): Promise<UploadResult> => {
  try {
    // 1. Verify user authentication status (Supabase recommendation)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication required for file upload:', authError);
      return {
        success: false,
        error: 'Authentication required. Please log in to upload files.'
      };
    }
    
    console.log('Authenticated user for upload:', user.id);
    
    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${timestamp}_${randomString}.${fileExtension}`;
    
    // 2. Create organized file path with user ID (Supabase recommendation)
    const userPath = user.id;
    const filePath = subPath ? `${userPath}/${subPath}/${uniqueFileName}` : `${userPath}/${uniqueFileName}`;
    
    console.log(`Uploading file: ${file.name} as ${filePath}`);
    
    // 3. Check file path follows expected format (Supabase recommendation)
    console.log('File path format:', filePath);
    
    // 4. Upload file to Supabase storage with proper options (aligned with Supabase recommendations)
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true // Allow overwrite if file exists (Supabase recommendation)
      });

    if (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: `Upload failed: ${error.message}`
      };
    }

    console.log('Upload successful:', data);

    // Generate public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return {
        success: false,
        error: 'Failed to generate file URL'
      };
    }

    return {
      success: true,
      fileName: uniqueFileName,
      fileUrl: urlData.publicUrl,
      filePath: filePath
    };

  } catch (error) {
    console.error('Upload exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
};

/**
 * Upload multiple files with progress tracking
 */
export const uploadMultipleFiles = async (
  files: File[],
  bucketName: string = 'referral_attachments',
  subPath?: string,
  onProgress?: (progress: UploadProgress[]) => void
): Promise<UploadResult[]> => {
  const results: UploadResult[] = [];
  const progressList: UploadProgress[] = files.map(file => ({
    fileName: file.name,
    progress: 0,
    status: 'uploading'
  }));

  // Notify initial progress
  if (onProgress) {
    onProgress([...progressList]);
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      // Update progress to show current file uploading
      progressList[i] = {
        fileName: file.name,
        progress: 50,
        status: 'uploading'
      };
      
      if (onProgress) {
        onProgress([...progressList]);
      }

      // Upload the file
      const result = await uploadFileToStorage(file, bucketName, subPath);
      results.push(result);

      // Update progress based on result
      if (result.success) {
        progressList[i] = {
          fileName: file.name,
          progress: 100,
          status: 'complete'
        };
      } else {
        progressList[i] = {
          fileName: file.name,
          progress: 100,
          status: 'error',
          error: result.error
        };
      }

      if (onProgress) {
        onProgress([...progressList]);
      }

    } catch (error) {
      const errorResult: UploadResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
      results.push(errorResult);

      progressList[i] = {
        fileName: file.name,
        progress: 100,
        status: 'error',
        error: errorResult.error
      };

      if (onProgress) {
        onProgress([...progressList]);
      }
    }
  }

  return results;
};

/**
 * Create attachment record in the database
 */
export const createAttachmentRecord = async (
  referralId: string,
  fileName: string,
  originalFileName: string,
  fileType: string,
  fileSize: number,
  fileUrl: string,
  uploadedBy: string
) => {
  try {
    // NOTE: referral_attachments has no original_file_name column — including it
    // makes Postgres reject the whole row (and the error was historically
    // swallowed), so every attachment insert silently wrote 0 rows. Keep this
    // insert aligned with the actual table schema.
    const { data, error } = await supabase
      .from('referral_attachments')
      .insert({
        referral_id: referralId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        file_url: fileUrl,
        uploaded_by: uploadedBy
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating attachment record:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Database insertion error:', error);
    throw error;
  }
};

/**
 * Delete file from storage
 */
export const deleteFileFromStorage = async (
  fileName: string,
  bucketName: string = 'referral_attachments'
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete exception:', error);
    return false;
  }
};

/**
 * Validate file before upload
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds 5MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(1)}MB`
    };
  }

  // Check file type
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not supported: ${file.type}. Allowed types: Images, PDF, DOC, TXT`
    };
  }

  return { valid: true };
};

/**
 * Get file type category from MIME type
 */
export const getFileTypeCategory = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.startsWith('text/')) return 'text';
  return 'file';
};
