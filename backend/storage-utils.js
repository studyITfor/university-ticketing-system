// backend/storage-utils.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client initialized');
} else {
  console.log('⚠️ Supabase credentials not found, using local storage fallback');
}

/**
 * Upload ticket file to external storage (Supabase) and return public URL
 * @param {string} localFilePath - Path to local ticket file
 * @param {string} fileName - Desired filename in storage
 * @returns {Promise<{success: boolean, publicUrl?: string, error?: string}>}
 */
async function uploadTicketToStorage(localFilePath, fileName) {
  try {
    // If Supabase is not configured, return local file path
    if (!supabase) {
      const publicUrl = `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/tickets/${fileName}`;
      console.log('📁 Using local storage fallback:', publicUrl);
      return { success: true, publicUrl };
    }

    // Read file content
    const fileContent = fs.readFileSync(localFilePath);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('tickets')
      .upload(`tickets/${fileName}`, fileContent, { 
        upsert: true,
        contentType: 'application/pdf'
      });

    if (error) {
      console.error('❌ Supabase upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('tickets')
      .getPublicUrl(`tickets/${fileName}`);

    const publicUrl = publicUrlData.publicURL;
    console.log('✅ Ticket uploaded to Supabase:', publicUrl);
    
    return { success: true, publicUrl };

  } catch (error) {
    console.error('❌ Storage upload error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete ticket from external storage
 * @param {string} fileName - Filename in storage
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteTicketFromStorage(fileName) {
  try {
    if (!supabase) {
      // For local storage, just return success (file will be cleaned up by system)
      return { success: true };
    }

    const { error } = await supabase.storage
      .from('tickets')
      .remove([`tickets/${fileName}`]);

    if (error) {
      console.error('❌ Supabase delete error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Ticket deleted from Supabase:', fileName);
    return { success: true };

  } catch (error) {
    console.error('❌ Storage delete error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  uploadTicketToStorage,
  deleteTicketFromStorage
};
