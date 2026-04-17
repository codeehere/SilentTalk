const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/orders
// @desc    Create a new order (Checkout Flow)
// @access  Private (Buyer)
router.post('/', protect, async (req, res) => {
  try {
    const { sellerId, productId, quantity, shippingDetails } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product no longer exists' });
    if (!product.inStock || (product.stockQuantity !== -1 && product.stockQuantity < quantity)) {
      return res.status(400).json({ message: 'Insufficient stock available.' });
    }

    // Decrement stock if not unlimited
    if (product.stockQuantity !== -1) {
      product.stockQuantity -= quantity;
      if (product.stockQuantity === 0) product.inStock = false;
      await product.save();
    }

    const order = new Order({
      buyerId: req.user._id,
      sellerId,
      productId,
      quantity,
      totalAmount: product.price * quantity,
      productSnapshot: {
        name: product.name,
        price: product.price,
        mediaUrl: product.media && product.media.length > 0 ? product.media[0].url : product.imageUrl,
        catalog: product.catalog,
        isDigital: product.isDigital,
        saasLink: product.saasLink
      },
      shippingDetails,
      paymentMethod: req.body.paymentMethod || 'Cash on Delivery'
    });

    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   GET /api/orders
// @desc    Get all orders associated with the user (either explicitly bought or structurally sold)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    // If the user traverses their Business endpoint, fetch seller orders; otherwise, buyer orders
    const asSeller = req.query.role === 'seller';
    const query = asSeller ? { sellerId: req.user._id } : { buyerId: req.user._id };
    
    // Sort descending layout explicitly mapped
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status (Seller only). Creates/updates a single order_update message in buyer's chat.
// @access  Private (Seller only)
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const Message = require('../models/Message');
    const User = require('../models/User');

    const order = await Order.findOne({ _id: req.params.id, sellerId: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found or unauthorized' });

    order.status = status;
    await order.save();

    // Refund stock on rejection
    if (status === 'Rejected') {
      const product = await Product.findById(order.productId);
      if (product && product.stockQuantity !== -1) {
        product.stockQuantity += order.quantity;
        product.inStock = true;
        await product.save();
      }
    }

    // ─── Transactional Email (Accept / Reject) ────────────────────────────
    if (status === 'Accepted' || status === 'Rejected') {
      try {
        const sendEmail = require('../utils/sendEmail');
        const User = require('../models/User');
        const seller = await User.findById(req.user._id).select('username businessProfile');
        const buyer = await User.findById(order.buyerId).select('username email');
        const sellerName = seller?.businessProfile?.businessName || seller?.username || 'The Seller';
        const buyerName = buyer?.username || 'Customer';
        const buyerEmail = buyer?.email;
        const orderRef = order._id.toString().slice(-6).toUpperCase();
        const isAccepted = status === 'Accepted';

        const accentColor = isAccepted ? '#22c55e' : '#ef4444';
        const headerGrad  = isAccepted
          ? 'linear-gradient(135deg,#16a34a,#22c55e)'
          : 'linear-gradient(135deg,#dc2626,#ef4444)';
        const statusLabel = isAccepted ? 'Order Confirmed!' : 'Order Rejected';
        const statusEmoji = isAccepted ? '✅' : '❌';
        const paymentLine = isAccepted
          ? `<tr><td style="padding:6px 0;color:#9ba3c0;font-size:13px;">Payment Method</td><td style="padding:6px 0;color:#f0f2ff;font-weight:700;font-size:13px;text-align:right;">${order.paymentMethod || 'Cash on Delivery'}</td></tr>`
          : '';

        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${statusLabel}</title></head>
<body style="margin:0;padding:0;background:#0d0f14;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0f14;padding:36px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1a1d28;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);">

      <!-- Header -->
      <tr>
        <td style="background:${headerGrad};padding:32px 40px;text-align:center;">
          <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.2);display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px;">${statusEmoji}</div>
          <div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:4px;">${statusLabel}</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.75);">Order #${orderRef} · ${sellerName}</div>
        </td>
      </tr>

      <!-- Greeting -->
      <tr><td style="padding:28px 40px 0;">
        <p style="margin:0 0 16px;color:#f0f2ff;font-size:16px;font-weight:600;">Hi ${buyerName},</p>
        ${isAccepted
          ? `<p style="margin:0;color:#9ba3c0;font-size:14px;line-height:1.7;">${sellerName} has <strong style="color:#22c55e;">accepted your order</strong>. Your item is being prepared! You'll receive updates as the status progresses.</p>`
          : `<p style="margin:0;color:#9ba3c0;font-size:14px;line-height:1.7;">We're sorry — ${sellerName} was <strong style="color:#ef4444;">unable to fulfill</strong> your order at this time. If you have questions, please reply to this email or contact the seller directly.</p>`
        }
      </td></tr>

      <!-- Order Details Table -->
      <tr><td style="padding:24px 40px;">
        <div style="background:#13161e;border-radius:14px;padding:20px 24px;border:1px solid rgba(255,255,255,0.07);">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#5a6280;margin-bottom:14px;">Order Details</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#9ba3c0;font-size:13px;">Product</td><td style="padding:6px 0;color:#f0f2ff;font-weight:700;font-size:13px;text-align:right;">${order.productSnapshot?.name}</td></tr>
            <tr><td style="padding:6px 0;color:#9ba3c0;font-size:13px;">Quantity</td><td style="padding:6px 0;color:#f0f2ff;font-weight:700;font-size:13px;text-align:right;">${order.quantity}</td></tr>
            <tr><td style="padding:6px 0;color:#9ba3c0;font-size:13px;">Category</td><td style="padding:6px 0;color:#f0f2ff;font-weight:700;font-size:13px;text-align:right;">${order.productSnapshot?.catalog || '—'}</td></tr>
            ${paymentLine}
            <tr><td colspan="2"><div style="height:1px;background:rgba(255,255,255,0.07);margin:10px 0;"></div></td></tr>
            <tr><td style="color:#9ba3c0;font-size:14px;font-weight:700;">Total Amount</td><td style="color:${accentColor};font-size:18px;font-weight:900;text-align:right;">$${order.totalAmount?.toFixed(2)}</td></tr>
          </table>
        </div>
      </td></tr>

      ${isAccepted && !order.productSnapshot?.isDigital ? `
      <!-- Shipping -->
      <tr><td style="padding:0 40px 24px;">
        <div style="background:#13161e;border-radius:14px;padding:18px 24px;border:1px solid rgba(255,255,255,0.07);">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#5a6280;margin-bottom:12px;">Delivery Address</div>
          <div style="color:#9ba3c0;font-size:13px;line-height:1.7;">
            ${order.shippingDetails?.name || buyerName}<br/>
            ${order.shippingDetails?.address || '—'}, ${order.shippingDetails?.pincode || ''}<br/>
            ${order.shippingDetails?.phone || ''}
          </div>
        </div>
      </td></tr>` : ''}

      <!-- CTA -->
      <tr><td style="padding:0 40px 28px;text-align:center;">
        <div style="font-size:13px;color:#9ba3c0;margin-bottom:16px;">
          ${isAccepted ? 'Track your order live inside the app under <strong style="color:#7c6af7;">My Orders</strong>.' : 'You can browse other items and place a new order anytime.'}
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#13161e;padding:18px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
        <div style="font-size:11px;color:#3a3f56;line-height:1.7;">
          Sent to <strong style="color:#5a6280;">${buyerEmail}</strong> for order #${orderRef}<br/>
          © 2025 SilentTalk · End-to-End Encrypted · Privacy First
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

        if (buyerEmail) {
          await sendEmail({
            email: buyerEmail,
            subject: `${statusEmoji} SilentTalk Store — ${statusLabel} · #${orderRef}`,
            message: `Your order for ${order.productSnapshot?.name} from ${sellerName} has been ${status.toLowerCase()}. Order Ref: #${orderRef}.`,
            html
          });
        }
      } catch (emailErr) {
        console.warn('Order email error:', emailErr.message);
      }
    }

    // ─── Unified Order Update Message ─────────────────────────────────────
    try {
      const io = req.app.get('io');
      const seller = await User.findById(req.user._id).select('username businessProfile');
      const sellerName = seller?.businessProfile?.businessName || seller?.username || 'Store';

      const orderData = JSON.stringify({
        orderId: order._id.toString(),
        orderRef: order._id.toString().slice(-6).toUpperCase(),
        status,
        productName: order.productSnapshot?.name,
        productImg: order.productSnapshot?.mediaUrl || '',
        total: order.totalAmount?.toFixed(2),
        sellerName,
        isDigital: order.productSnapshot?.isDigital || false,
        saasLink: order.productSnapshot?.saasLink || ''
      });

      if (order.statusMsgId) {
        // UPDATE the existing message in-place
        await Message.findByIdAndUpdate(order.statusMsgId, { orderData });
        
        // Emit a patch event so frontend updates without re-rendering entire message list
        const patchData = { messageId: order.statusMsgId.toString(), orderData };
        io.to(`user:${order.buyerId.toString()}`).emit('message:order_update', patchData);
        io.to(`user:${req.user._id.toString()}`).emit('message:order_update', patchData);
      } else {
        // CREATE the first order_update message (on Accept)
        const orderMsg = await Message.create({
          senderId: req.user._id,
          receiverId: order.buyerId,
          mediaType: 'order_update',
          orderData,
          isSystemMsg: true,
          status: 'sent'
        });
        // Store so we can update this same message later
        order.statusMsgId = orderMsg._id;
        await order.save();

        const msgObj = orderMsg.toObject();
        io.to(`user:${order.buyerId.toString()}`).emit('message:receive', {
          ...msgObj,
          senderId: req.user._id.toString()
        });
        io.to(`user:${req.user._id.toString()}`).emit('message:receive', {
          ...msgObj,
          senderId: req.user._id.toString()
        });
      }

      // SaaS: also fire the toast notification when Completed
      if (status === 'Completed' && order.productSnapshot?.isDigital) {
        io.to(`user:${order.buyerId.toString()}`).emit('order:saas_ready', {
          orderId: order._id,
          productName: order.productSnapshot.name,
          saasLink: order.productSnapshot.saasLink,
          sellerName
        });
      }

      // Generic status toast for all transitions
      io.to(`user:${order.buyerId.toString()}`).emit('order:status_update', {
        orderId: order._id, status, productName: order.productSnapshot?.name
      });

    } catch (msgErr) {
      console.warn('Order message error:', msgErr.message);
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

