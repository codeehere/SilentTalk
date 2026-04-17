const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productSnapshot: {
    name: String,
    price: Number,
    mediaUrl: String,
    catalog: String,
    isDigital: Boolean,
    saasLink: String
  },
  quantity: { type: Number, default: 1 },
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Accepted', 'Packaging', 'Out for Delivery', 'Completed', 'Rejected', 'Cancelled'], default: 'Pending' },
  shippingDetails: {
    name: String,
    email: String,
    phone: String,
    address: String,
    pincode: String
  },
  paymentMethod: { type: String, default: 'Cash on Delivery' },
  statusMsgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null }
}, { timestamps: true });

// Optimize pulling orders for businesses or buyers
orderSchema.index({ sellerId: 1, createdAt: -1 });
orderSchema.index({ buyerId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
