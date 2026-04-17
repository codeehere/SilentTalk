import React, { useState, useEffect } from 'react';
import { FiPackage, FiChevronLeft, FiExternalLink, FiBox, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

const STATUS_PIPELINE = [
  { key: 'Pending',          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Pending',          icon: '⏳' },
  { key: 'Accepted',         color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Accepted',         icon: '✅' },
  { key: 'Packaging',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  label: 'Packaging',        icon: '📦' },
  { key: 'Out for Delivery', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   label: 'Out for Delivery', icon: '🚚' },
  { key: 'Completed',        color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'Delivered!',       icon: '🎉' },
  { key: 'Rejected',         color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Rejected',         icon: '❌' },
];

const PHYSICAL_PIPELINE = ['Pending', 'Accepted', 'Packaging', 'Out for Delivery', 'Completed'];
const DIGITAL_PIPELINE  = ['Pending', 'Accepted', 'Completed'];

function StatusBadge({ status }) {
  const conf = STATUS_PIPELINE.find(s => s.key === status) || STATUS_PIPELINE[0];
  return (
    <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: conf.bg, color: conf.color }}>
      {conf.icon} {conf.label}
    </span>
  );
}

function OrderTracker({ order }) {
  const pipeline = order.productSnapshot?.isDigital ? DIGITAL_PIPELINE : PHYSICAL_PIPELINE;
  const currentIdx = pipeline.indexOf(order.status);
  if (order.status === 'Rejected' || order.status === 'Cancelled') {
    return (
      <div style={{ padding: '12px 0', color: '#ef4444', fontWeight: 700, fontSize: 14 }}>
        ❌ This order was rejected by the seller. Any reserved stock has been reinstated.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '8px 0 16px' }}>
      {pipeline.map((step, i) => {
        const isCompleted = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <React.Fragment key={step}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                border: `2px solid ${isCompleted ? '#22c55e' : 'var(--border)'}`,
                background: isCurrent ? '#22c55e' : isCompleted ? 'rgba(34,197,94,0.15)' : 'var(--bg-surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                transition: '0.3s', boxShadow: isCurrent ? '0 0 14px rgba(34,197,94,0.5)' : 'none'
              }}>
                {isCompleted ? '✓' : ''}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 6, color: isCompleted ? 'var(--accent)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
                {step}
              </div>
            </div>
            {i < pipeline.length - 1 && (
              <div style={{ height: 2, flex: 1, background: isCompleted && i < currentIdx ? '#22c55e' : 'var(--border)', marginBottom: 28, transition: '0.5s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function BuyerOrders({ onBack }) {
  const { authFetch, API } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await authFetch(`${API}/api/orders`);
        if (res.ok) setOrders(await res.json());
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  return (
    <div className="section-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {onBack && (
          <button className="icon-btn" onClick={onBack}><FiChevronLeft size={22} /></button>
        )}
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)' }}>My Orders</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Track deliveries and access digital products</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--text-muted)', gap: 12 }}>
            <FiRefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 16 }}>
            <FiPackage size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No orders yet</div>
            <div>Browse stores and place your first order!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {orders.map(order => (
              <div key={order._id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                {/* Order Header */}
                <div style={{ padding: '14px 20px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>ORDER #{order._id.slice(-8).toUpperCase()} &bull; {new Date(order.createdAt).toLocaleString()}</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{order.productSnapshot?.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {order.quantity} item{order.quantity > 1 ? 's' : ''} &bull; ${Number(order.totalAmount).toFixed(2)} total
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <StatusBadge status={order.status} />
                    {order.productSnapshot?.isDigital && <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>☁️ Digital / SaaS</span>}
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {order.productSnapshot?.mediaUrl
                      ? <img src={order.productSnapshot.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <FiBox size={24} color="var(--border)" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{order.productSnapshot?.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      ${order.productSnapshot?.price?.toFixed(2)} &times; {order.quantity}
                    </div>
                    {/* SaaS Access Button */}
                    {order.productSnapshot?.isDigital && order.productSnapshot?.saasLink && order.status === 'Completed' && (
                      <a
                        href={order.productSnapshot.saasLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12,
                          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                          color: '#fff', padding: '10px 20px', borderRadius: 20,
                          fontWeight: 700, fontSize: 14, textDecoration: 'none',
                          boxShadow: '0 4px 16px rgba(99,102,241,0.4)'
                        }}
                      >
                        <FiExternalLink size={15} /> Get Access to Your App →
                      </a>
                    )}
                    {order.productSnapshot?.isDigital && order.status !== 'Completed' && order.status !== 'Rejected' && (
                      <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)', background: 'rgba(59,130,246,0.1)', padding: '8px 14px', borderRadius: 8 }}>
                        🔒 SaaS access link will activate once seller confirms your order.
                      </div>
                    )}
                    {/* Physical Shipping Info */}
                    {!order.productSnapshot?.isDigital && order.shippingDetails?.address && (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 8 }}>
                        📍 <strong>Shipping to:</strong> {order.shippingDetails.address}, PIN {order.shippingDetails.pincode}
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Tracker */}
                <div style={{ padding: '0 20px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 8 }}>Order Progress</div>
                  <OrderTracker order={order} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
