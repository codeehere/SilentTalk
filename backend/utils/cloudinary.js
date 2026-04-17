const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a buffer or local file path/stream to Cloudinary.
 * @param {Buffer|string} source  - file buffer or local path
 * @param {string} folder         - Cloudinary subfolder, e.g. 'media', 'avatars', 'stories', 'audio'
 * @param {string} resourceType   - 'image' | 'video' | 'raw' | 'auto'
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function uploadToCloudinary(source, folder = 'media', resourceType = 'auto') {
  return new Promise((resolve, reject) => {
    const uploadFn = (result) => {
      if (result.error) return reject(result.error);
      resolve({ url: result.secure_url, publicId: result.public_id });
    };

    const options = {
      folder: `silenttalk/${folder}`,
      resource_type: resourceType,
      // Avatars: crop to square. All other images: preserve full HD resolution
      ...(folder === 'avatars'
        ? { transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto:best' }] }
        : resourceType === 'image'
          ? { quality: 'auto:best', fetch_format: 'auto' }
          : {}
      )
    };

    if (Buffer.isBuffer(source)) {
      const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      });
      const { Readable } = require('stream');
      Readable.from(source).pipe(uploadStream);
    } else {
      cloudinary.uploader.upload(source, options, (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      });
    }
  });
}

/**
 * Delete a Cloudinary asset by publicId.
 */
async function deleteFromCloudinary(publicId, resourceType = 'image') {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = { cloudinary, uploadToCloudinary, deleteFromCloudinary };
