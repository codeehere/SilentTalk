const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  name: { 
    type: String, 
    required: true,
    maxlength: 150
  },
  description: { 
    type: String,
    maxlength: 2000,
    default: ''
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  catalog: { 
    type: String, 
    default: 'General',
    maxlength: 50
  },
  media: [{
    url: String,
    type: { type: String, enum: ['image', 'video'] }
  }],
  inStock: { type: Boolean, default: true },
  stockQuantity: { type: Number, default: -1 },
  isDigital: { type: Boolean, default: false },
  saasLink: { type: String, default: '' }
}, { timestamps: true });

// Indexes to speed up queries for a specific business's storefront
productSchema.index({ userId: 1, catalog: 1 });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
