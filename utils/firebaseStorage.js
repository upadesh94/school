const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage } = require('../config/db');

/**
 * Uploads a file buffer to Firebase Storage and returns the public download URL.
 *
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} originalName - The original filename
 * @param {string} folder - The destination folder in storage (e.g. 'photos' or 'excel')
 * @returns {Promise<string>} - The public download URL
 */
const uploadFileToFirebase = async (fileBuffer, originalName, folder) => {
  try {
    const timestamp = Date.now();
    const sanitizedName = originalName.replace(/\s+/g, '_');
    const storageRef = ref(storage, `${folder}/${timestamp}_${sanitizedName}`);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, fileBuffer);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file to Firebase Storage:', error);
    throw error;
  }
};

module.exports = { uploadFileToFirebase };
