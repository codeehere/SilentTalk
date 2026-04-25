const express = require('express');
const multer = require('multer');
const User = require('../models/User');
const Product = require('../models/Product');
const { protect } = require('../middleware/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');

const router = express.Router();

// Memory storage for image/media uploads
const memStorage = multer.memoryStorage();

const uploadImage = multer({
  storage: memStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Images only'));
  }
});

const uploadMedia = multer({
  storage: memStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for HD media
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  }
});

// Update Business Profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { isBusiness, businessProfile } = req.body;
    const user = await User.findById(req.user._id);

    if (isBusiness !== undefined) user.isBusiness = isBusiness;
    if (businessProfile) {
      if (!user.businessProfile) user.businessProfile = {};
      Object.assign(user.businessProfile, businessProfile);
    }

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get own products (for business owner management)
// IMPORTANT: This must come BEFORE /:userId to avoid Express treating "products" as a userId
router.get('/products/me', protect, async (req, res) => {
  try {
    const products = await Product.find({ userId: req.user._id }).sort('-createdAt');
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get public store profile & catalog (for consumers)
router.get('/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('username avatar uniqueId isBusiness businessProfile');
    if (!user || !user.isBusiness || user.businessProfile?.storeStatus === 'closed') {
      return res.status(404).json({ message: 'Store not found or is closed' });
    }
    
    const products = await Product.find({ userId: req.params.userId });
    res.json({ profile: user, products });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create product
router.post('/products', protect, async (req, res) => {
  try {
    const { name, description, price, catalog, imageUrl, media, inStock } = req.body;
    const product = new Product({
      userId: req.user._id,
      name, description, price, catalog, imageUrl, media, inStock
    });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update product
router.put('/products/:id', protect, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete product
router.delete('/products/:id', protect, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Upload Product Media
router.post('/products/media', protect, uploadMedia.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('No file uploaded');
    const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    const result = await uploadToCloudinary(req.file.buffer, 'products', resourceType);
    res.json({ mediaUrl: result.url, mediaType: resourceType });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Upload Business Logo
router.post('/profile/logo', protect, uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) throw new Error('No image uploaded');
    const result = await uploadToCloudinary(req.file.buffer, 'business_logos', 'image');
    const user = await User.findById(req.user._id);
    if (!user.businessProfile) user.businessProfile = {};
    user.businessProfile.logo = result.url;
    user.markModified('businessProfile');
    await user.save();
    res.json({ logoUrl: result.url });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Upload Business Banner
router.post('/profile/banner', protect, uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) throw new Error('No image uploaded');
    const result = await uploadToCloudinary(req.file.buffer, 'business_banners', 'image');
    const user = await User.findById(req.user._id);
    if (!user.businessProfile) user.businessProfile = {};
    user.businessProfile.banner = result.url;
    user.markModified('businessProfile');
    await user.save();
    res.json({ bannerUrl: result.url });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
