import React, { useState, useEffect } from 'react';
import { 
  FiShoppingBag, FiPlus, FiEdit2, FiTrash2, FiImage, FiX, 
  FiCheckCircle, FiXCircle, FiPackage, FiList, FiTruck, FiStar,
  FiBox, FiRefreshCw, FiExternalLink
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

// Order status pipeline config
const STATUS_PIPELINE = [
  { key: 'Pending',          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   label: 'Pending',          icon: '⏳' },
  { key: 'Accepted',         color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   label: 'Accepted',         icon: '✅' },
  { key: 'Packaging',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',   label: 'Packaging',        icon: '📦' },
  { key: 'Out for Delivery', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',    label: 'Out for Delivery', icon: '🚚' },
  { key: 'Completed',        color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    label: 'Delivered',        icon: '🎉' },
  { key: 'Rejected',         color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    label: 'Rejected',         icon: '❌' },
];

const PHYSICAL_PIPELINE = ['Pending', 'Accepted', 'Packaging', 'Out for Delivery', 'Completed'];
const DIGITAL_PIPELINE  = ['Pending', 'Accepted', 'Completed'];

function StatusBadge({ status }) {
  const conf = STATUS_PIPELINE.find(s => s.key === status) || STATUS_PIPELINE[0];
  return (
    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: conf.bg, color: conf.color, whiteSpace: 'nowrap' }}>
      {conf.icon} {conf.label}
    </span>
  );
}

function OrderTracker({ order }) {
  const pipeline = order.productSnapshot?.isDigital ? DIGITAL_PIPELINE : PHYSICAL_PIPELINE;
  const currentIdx = pipeline.indexOf(order.status);
  if (order.status === 'Rejected' || order.status === 'Cancelled') return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 16, marginBottom: 8 }}>
      {pipeline.map((step, i) => {
        const isCompleted = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <React.Fragment key={step}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', border: `2px solid ${isCompleted ? '#22c55e' : 'var(--border)'}`,
                background: isCurrent ? '#22c55e' : isCompleted ? 'rgba(34,197,94,0.2)' : 'var(--bg-surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                transition: '0.3s', boxShadow: isCurrent ? '0 0 12px rgba(34,197,94,0.5)' : 'none'
              }}>
                {isCompleted ? '✓' : ''}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 6, color: isCompleted ? 'var(--accent)' : 'var(--text-muted)', textAlign: 'center' }}>
                {step}
              </div>
            </div>
            {i < pipeline.length - 1 && (
              <div style={{ height: 2, flex: 1, background: isCompleted && i < currentIdx ? '#22c55e' : 'var(--border)', marginBottom: 26, transition: '0.3s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function StoreManager() {
  const { authFetch, API } = useAuth();
  const [activeTab, setActiveTab] = useState('products');
  
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [catalog, setCatalog] = useState('General');
  const [media, setMedia] = useState([]);
  const [inStock, setInStock] = useState(true);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [isDigital, setIsDigital] = useState(false);
  const [saasLink, setSaasLink] = useState('');
  const [unlimitedStock, setUnlimitedStock] = useState(true);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'products') {
        const res = await authFetch(`${API}/api/store/products/me`);
        if (res.ok) setProducts(await res.json());
      } else {
        const res = await authFetch(`${API}/api/orders?role=seller`);
        if (res.ok) setOrders(await res.json());
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openModal = (p = null) => {
    setEditingProduct(p);
    setName(p?.name || '');
    setPrice(p?.price || '');
    setDescription(p?.description || '');
    setCatalog(p?.catalog || 'General');
    setIsDigital(p?.isDigital || false);
    setSaasLink(p?.saasLink || '');
    
    if (p?.media?.length > 0) setMedia(p.media);
    else if (p?.imageUrl) setMedia([{ url: p.imageUrl, type: 'image' }]);
    else setMedia([]);
    
    setInStock(p !== null ? p.inStock : true);
    const sq = p?.stockQuantity ?? -1;
    setUnlimitedStock(sq === -1);
    setStockQuantity(sq === -1 ? 0 : sq);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingProduct(null); };

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setMediaUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await authFetch(`${API}/api/store/products/media`, { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          setMedia(prev => [...prev, { url: data.mediaUrl, type: data.mediaType }]);
        } else { alert(`Failed to upload ${file.name}`); }
      }
    } catch (err) { console.error(err); }
    finally { setMediaUploading(false); e.target.value = null; }
  };

  const removeMedia = (i) => setMedia(prev => prev.filter((_, idx) => idx !== i));

  const saveProduct = async () => {
    if (!name || !price) return alert('Name and Price are required');
    setSaving(true);
    try {
      const payload = {
        name, price: Number(price), description, catalog, media, inStock,
        stockQuantity: unlimitedStock ? -1 : Number(stockQuantity),
        isDigital, saasLink
      };
      if (media.length > 0 && media[0].type === 'image') payload.imageUrl = media[0].url;
      const url = editingProduct ? `${API}/api/store/products/${editingProduct._id}` : `${API}/api/store/products`;
      const res = await authFetch(url, { method: editingProduct ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { fetchData(); closeModal(); }
    } finally { setSaving(false); }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product permanently?')) return;
    await authFetch(`${API}/api/store/products/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const updateOrderStatus = async (id, status) => {
    const res = await authFetch(`${API}/api/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) fetchData();
  };

  const pendingCount = orders.filter(o => o.status === 'Pending').length;

  return (
    <div className="section-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Business Dashboard</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Manage your catalog and incoming orders</div>
        </div>
        {activeTab === 'products' && (
          <button className="btn btn-primary" onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}>
            <FiPlus size={16} /> New Product
          </button>
        )}
      </div>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 24px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[
          { id: 'products', label: 'Product Catalog', icon: FiPackage },
          { id: 'orders',   label: 'Incoming Orders', icon: FiList, badge: pendingCount }
        ].map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
            borderBottom: activeTab === id ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'none',
            color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer',
            fontSize: 14, transition: 'color 0.2s, border-color 0.2s', position: 'relative',
            marginBottom: '-1px'
          }}>
            <Icon size={15} /> {label}
            {badge > 0 && (
              <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 800, padding: '2px 6px', marginLeft: 4 }}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--text-muted)', gap: 12 }}>
            <FiRefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
          </div>
        ) : activeTab === 'products' ? (
          products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 16 }}>
              <FiShoppingBag size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Your store is empty</div>
              <div>Add your first product to start generating sales.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
              {products.map(p => (
                <div key={p._id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 160, background: 'var(--bg-surface)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.media?.length > 0 ? (
                      p.media[0].type === 'video'
                        ? <video src={p.media[0].url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                        : <img src={p.media[0].url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <FiImage size={40} color="var(--border)" />
                    )}
                    {!p.inStock && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(200,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, letterSpacing: 1 }}>OUT OF STOCK</div>
                    )}
                    {p.isDigital && (
                      <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(59,130,246,0.9)', color: '#fff', padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>☁️ SaaS</div>
                    )}
                    {p.media?.length > 1 && (
                      <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 8px', borderRadius: 8, fontSize: 11 }}>+{p.media.length - 1}</div>
                    )}
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {p.catalog} &bull; {p.stockQuantity === -1 ? '∞ Unlimited' : `${p.stockQuantity} in stock`}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>${Number(p.price).toFixed(2)}</div>
                    <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openModal(p)}><FiEdit2 size={13} /> Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'var(--red)' }} onClick={() => deleteProduct(p._id)}><FiTrash2 size={13} /> Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ── ORDERS TAB ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 16 }}>
                <FiList size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No orders yet</div>
                <div>Orders from buyers will appear here.</div>
              </div>
            ) : orders.map(order => (
              <div key={order._id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                {/* Order Header */}
                <div style={{ padding: '16px 20px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                      ORDER #{order._id.slice(-8).toUpperCase()} &bull; {new Date(order.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{order.shippingDetails?.name || 'Anonymous'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {order.shippingDetails?.email} &nbsp;|&nbsp; {order.shippingDetails?.phone}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <StatusBadge status={order.status} />
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>${Number(order.totalAmount).toFixed(2)}</div>
                  </div>
                </div>

                {/* Tracker */}
                <div style={{ padding: '16px 20px' }}>
                  <OrderTracker order={order} />
                </div>

                {/* Product + Address */}
                <div style={{ padding: '0 20px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 240px', background: 'var(--bg-surface)', borderRadius: 12, padding: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-elevated)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {order.productSnapshot?.mediaUrl
                        ? <img src={order.productSnapshot.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <FiBox size={24} color="var(--border)" />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{order.productSnapshot?.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Qty: {order.quantity} &times; ${order.productSnapshot?.price?.toFixed(2)}
                      </div>
                      {order.productSnapshot?.isDigital && order.productSnapshot?.saasLink && (
                        <a href={order.productSnapshot.saasLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: '#3b82f6', fontWeight: 700 }}>
                          <FiExternalLink size={12} /> Open SaaS App
                        </a>
                      )}
                    </div>
                  </div>

                  {!order.productSnapshot?.isDigital && order.shippingDetails?.address && (
                    <div style={{ flex: '1 1 200px', background: 'var(--bg-surface)', borderRadius: 12, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 6 }}>📍 Delivery Address</div>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                        {order.shippingDetails.address}
                        <br /><strong>PIN:</strong> {order.shippingDetails.pincode}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {order.status !== 'Rejected' && order.status !== 'Completed' && order.status !== 'Cancelled' && (
                  <div style={{ padding: '12px 20px 16px', borderTop: '1px dashed var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {order.status === 'Pending' && (
                      <>
                        <button className="btn" style={{ flex: 1, minWidth: 120, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 700 }} onClick={() => updateOrderStatus(order._id, 'Accepted')}>
                          <FiCheckCircle size={14} /> Accept Order
                        </button>
                        <button className="btn" style={{ flex: 1, minWidth: 120, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700 }} onClick={() => updateOrderStatus(order._id, 'Rejected')}>
                          <FiXCircle size={14} /> Reject Order
                        </button>
                      </>
                    )}
                    {order.status === 'Accepted' && !order.productSnapshot?.isDigital && (
                      <button className="btn" style={{ flex: 1, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 700 }} onClick={() => updateOrderStatus(order._id, 'Packaging')}>
                        <FiPackage size={14} /> Mark as Packaging
                      </button>
                    )}
                    {order.status === 'Accepted' && order.productSnapshot?.isDigital && (
                      <button className="btn" style={{ flex: 1, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 700 }} onClick={() => updateOrderStatus(order._id, 'Completed')}>
                        <FiCheckCircle size={14} /> Mark as Delivered
                      </button>
                    )}
                    {order.status === 'Packaging' && (
                      <button className="btn" style={{ flex: 1, background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontWeight: 700 }} onClick={() => updateOrderStatus(order._id, 'Out for Delivery')}>
                        <FiTruck size={14} /> Dispatched — Out for Delivery
                      </button>
                    )}
                    {order.status === 'Out for Delivery' && (
                      <button className="btn" style={{ flex: 1, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 700 }} onClick={() => updateOrderStatus(order._id, 'Completed')}>
                        <FiStar size={14} /> Mark as Delivered ✓
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--glass-border)',
            borderRadius: 24,
            width: 'calc(100% - 32px)',
            maxWidth: 640,
            maxHeight: 'calc(100dvh - 48px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{editingProduct ? 'Edit Product' : 'New Product'}</div>
              <button className="icon-btn" onClick={closeModal}><FiX size={20} /></button>
            </div>
            {/* Modal Body - self-scrolls */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Product Name *</label>
                  <input className="input" placeholder="e.g. Premium Plan" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Price ($) *</label>
                  <input className="input" type="number" placeholder="99.99" value={price} onChange={e => setPrice(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</label>
                  <input className="input" placeholder="e.g. Software" value={catalog} onChange={e => setCatalog(e.target.value)} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</label>
                <textarea className="input" rows={3} placeholder="Describe your product..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>

              {/* Media Upload */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Product Media {mediaUploading && <span style={{ color: 'var(--accent)' }}>Uploading...</span>}
                </label>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                  {media.map((m, i) => (
                    <div key={i} style={{ width: 80, height: 80, flexShrink: 0, borderRadius: 10, overflow: 'hidden', position: 'relative', border: '1px solid var(--border)' }}>
                      {m.type === 'video' ? <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <button onClick={() => removeMedia(i)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <FiX size={11} />
                      </button>
                    </div>
                  ))}
                  <label style={{ width: 80, height: 80, flexShrink: 0, borderRadius: 10, border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: mediaUploading ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', opacity: mediaUploading ? 0.5 : 1 }}>
                    <FiPlus size={20} />
                    <span style={{ fontSize: 10, marginTop: 4 }}>Add Media</span>
                    <input type="file" multiple accept="image/*,video/mp4,video/webm" style={{ display: 'none' }} onChange={handleMediaUpload} disabled={mediaUploading} />
                  </label>
                </div>
              </div>

              {/* Config Panel */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>⚙️ Inventory & Configuration</div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={isDigital} onChange={e => setIsDigital(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>☁️ SaaS / Digital Product</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Hides shipping address at checkout. Shows "Get Access" button instead of stock count.</div>
                  </div>
                </label>

                {isDigital && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>SaaS App Direct Link (Optional)</label>
                    <input className="input" placeholder="https://yourapp.com/login" value={saasLink} onChange={e => setSaasLink(e.target.value)} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Buyers will see a direct "Get Access" link button after ordering.</div>
                  </div>
                )}

                <div style={{ height: 1, background: 'var(--border)' }} />

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={unlimitedStock} onChange={e => { setUnlimitedStock(e.target.checked); if (e.target.checked) setInStock(true); }} />
                  <div style={{ fontWeight: 700, fontSize: 14 }}>∞ Unlimited Stock</div>
                </label>

                {!unlimitedStock && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Units Available</label>
                    <input type="number" min="0" className="input" style={{ maxWidth: 140 }}
                      value={stockQuantity}
                      onChange={e => { setStockQuantity(Number(e.target.value)); setInStock(Number(e.target.value) > 0); }} />
                  </div>
                )}

                <div style={{ height: 1, background: 'var(--border)' }} />

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Force Item Available</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Show in storefront even if stock = 0</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '20px 28px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={saveProduct} disabled={saving || mediaUploading}>
                {saving ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
