import React, { useState, useEffect, useMemo } from 'react';
import { FiShoppingBag, FiInfo, FiChevronLeft, FiChevronRight, FiMessageSquare, FiSearch, FiX, FiCheckCircle } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

export default function StoreFront({ contactId, onClose, onBuyItem }) {
  const { authFetch, API, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]); // Array of raw products
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  
  // Checkout State
  const [checkoutProduct, setCheckoutProduct] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({ name: user.username || '', email: user.email || '', phone: '', address: '', pincode: '', quantity: 1, paymentMethod: '' });
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null); // { product, total }
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const res = await authFetch(`${API}/api/store/${contactId}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setProducts(data.products || []);
        } else {
          setError('Store not found or currently closed.');
        }
      } catch (err) {
        setError('Failed to load storefront.');
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [contactId, API, authFetch]);

  // E-commerce Filtering
  const uniqueCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.catalog));
    return ['All', ...Array.from(cats)];
  }, [products]);
  
  const displayedProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.catalog === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    
    // Group
    return filtered.reduce((acc, p) => {
      acc[p.catalog] = acc[p.catalog] || [];
      acc[p.catalog].push(p);
      return acc;
    }, {});
  }, [products, selectedCategory, searchQuery]);

  if (loading) return (
    <div className="section-pane" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div className="section-pane">
      <div className="section-header">
        <button className="icon-btn" onClick={onClose}><FiChevronLeft size={20} /></button>
        <div className="section-title">Storefront</div>
      </div>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        {error}
      </div>
    </div>
  );

  const handleSelectProduct = (p) => {
    setSelectedProduct(p);
    setMediaIndex(0);
  };

  const biz = profile.businessProfile || {};
  
  const handleCheckoutSubmit = async () => {
    if (!checkoutForm.name || !checkoutForm.email || !checkoutForm.phone) return alert('Please fill in vital contact fields');
    if (!checkoutProduct.isDigital && (!checkoutForm.address || !checkoutForm.pincode)) return alert('Please fill in shipping address');
    
    setCheckoutSubmitting(true);
    try {
      const payload = {
        sellerId: profile._id,
        productId: checkoutProduct._id,
        quantity: checkoutForm.quantity,
        paymentMethod: checkoutForm.paymentMethod || profile?.businessProfile?.acceptedPayments?.[0] || 'Cash on Delivery',
        shippingDetails: {
          name: checkoutForm.name,
          email: checkoutForm.email,
          phone: checkoutForm.phone,
          ...( !checkoutProduct.isDigital && { address: checkoutForm.address, pincode: checkoutForm.pincode } )
        }
      };
      
      const res = await authFetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const placedOrder = await res.json();
        // Update local stock
        if (checkoutProduct.stockQuantity !== -1) {
          setProducts(prev => prev.map(p => p._id === checkoutProduct._id 
            ? { ...p, stockQuantity: p.stockQuantity - checkoutForm.quantity, inStock: p.stockQuantity - checkoutForm.quantity > 0 } 
            : p
          ));
        }
        setCheckoutProduct(null);
        setSelectedProduct(null);
        // Trigger success celebration modal
        setOrderSuccess({
          product: checkoutProduct,
          quantity: checkoutForm.quantity,
          total: (checkoutProduct.price * checkoutForm.quantity).toFixed(2)
        });
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to place order');
      }
    } catch (err) {
      console.error(err);
      alert('Error placing order');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  return (
    <div className="section-pane" style={{ position: 'relative' }}>
      {/* Store Header Banner */}
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '30px 24px', display: 'flex', gap: 20, alignItems: 'center' }}>
        <button className="icon-btn" onClick={onClose} style={{ color: '#fff', background: 'rgba(255,255,255,0.2)' }}><FiChevronLeft size={20} /></button>
        <div style={{ width: 64, height: 64, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {biz.logo ? (
             <img src={biz.logo} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover', background: '#fff' }} />
          ) : profile.avatar ? (
             <img src={profile.avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover' }} />
          ) : (
             <FiShoppingBag size={32} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{biz.businessName || profile.username}</div>
          <div style={{ opacity: 0.9, marginTop: 4, fontWeight: 600 }}>{biz.storeType || 'Store'} &bull; Owned by {biz.ownerName || `@${profile.uniqueId}`}</div>
        </div>
      </div>

      <div className="section-content" style={{ padding: '24px', overflowY: 'auto' }}>
        
        {/* Commercial Search & Filter Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 30 }}>
          <div style={{ position: 'relative' }}>
            <FiSearch size={18} style={{ position: 'absolute', top: 18, left: 18, color: 'var(--text-muted)' }} />
            <input 
              className="input" 
              placeholder="Search store..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              style={{ paddingLeft: 46, borderRadius: 24, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            />
          </div>
          {uniqueCategories.length > 2 && (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
              {uniqueCategories.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setSelectedCategory(cat)}
                  style={{ whiteSpace: 'nowrap', padding: '6px 16px', borderRadius: 20, border: 'none', background: selectedCategory === cat ? 'var(--accent)' : 'var(--bg-elevated)', color: selectedCategory === cat ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', transition: '0.2s' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {biz.description && (
          <div style={{ marginBottom: 30, padding: 20, background: 'var(--accent-10)', borderRadius: 12, color: 'var(--text)' }}>
            <span style={{ fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--accent)' }}>About Store</span>
            <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.9 }}>{biz.description}</div>
          </div>
        )}

        {Object.entries(displayedProducts).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 12, marginTop: 20 }}>
            {searchQuery ? 'No products match your search.' : 'This store has no products yet.'}
          </div>
        ) : Object.entries(displayedProducts).map(([catalog, items]) => (
          <div key={catalog} style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center' }}>
               <span style={{ width: 8, height: 24, background: 'var(--accent)', borderRadius: 4, marginRight: 12 }}></span>
               {catalog}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
              {items.map(p => (
                <div 
                  key={p._id} 
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: p.inStock ? 1 : 0.6, cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                  onClick={() => handleSelectProduct(p)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ height: 200, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {p.media && p.media.length > 0 ? (
                      p.media[0].type === 'video' ? (
                         <video src={p.media[0].url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted loop playsInline />
                      ) : (
                         <img src={p.media[0].url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )
                    ) : p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <FiShoppingBag size={40} color="var(--border)" />
                    )}
                  </div>
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{p.name}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 12, marginBottom: 12 }}>${p.price.toFixed(2)}</div>
                    <div style={{ color: p.inStock ? 'var(--accent)' : 'var(--text-muted)', fontSize: 13, fontWeight: 600, textAlign: 'center', background: p.inStock ? 'var(--accent-10)' : 'var(--bg-surface)', padding: '8px', borderRadius: 8 }}>
                       {p.inStock ? (p.isDigital ? 'View SaaS Details' : 'View Details') : 'Out of Stock'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {biz.policies && (
          <div style={{ marginTop: 40, padding: 20, background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 12 }}>
              <FiInfo size={18} color="var(--accent)" /> Store Policies
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>
              {biz.policies}
            </div>
          </div>
        )}
      </div>

      {/* Product Detail Modal Overlay */}
      {selectedProduct && (
        <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-base)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <button className="icon-btn" onClick={() => setSelectedProduct(null)} style={{ marginRight: 8 }}><FiChevronLeft size={22} /></button>
            <span className="panel-title">{selectedProduct.name}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 30, display: 'flex', flexDirection: 'column' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
              <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                
                {/* Left col: Image Carousel */}
                <div style={{ flex: '1 1 300px', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, background: '#000' }}>
                    {selectedProduct.media && selectedProduct.media.length > 0 ? (
                      selectedProduct.media[mediaIndex].type === 'video' ? (
                         <video src={selectedProduct.media[mediaIndex].url} style={{ width: '100%', maxHeight: 400, objectFit: 'contain' }} controls autoPlay muted loop playsInline />
                      ) : (
                         <img src={selectedProduct.media[mediaIndex].url} style={{ width: '100%', maxHeight: 400, objectFit: 'contain', cursor: 'zoom-in' }} onClick={() => setLightboxMedia({ url: selectedProduct.media[mediaIndex].url, type: 'image' })} />
                      )
                    ) : selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} style={{ width: '100%', maxHeight: 400, objectFit: 'contain', cursor: 'zoom-in' }} onClick={() => setLightboxMedia({ url: selectedProduct.imageUrl, type: 'image' })} />
                    ) : (
                      <FiShoppingBag size={80} color="var(--border)" />
                    )}
                    
                    {/* Carousel Nav */}
                    {selectedProduct.media && selectedProduct.media.length > 1 && (
                      <>
                        <button style={{ position: 'absolute', left: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setMediaIndex((i) => i === 0 ? selectedProduct.media.length - 1 : i - 1)}>
                          <FiChevronLeft size={20} />
                        </button>
                        <button style={{ position: 'absolute', right: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setMediaIndex((i) => (i + 1) % selectedProduct.media.length)}>
                          <FiChevronRight size={20} />
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Carousel Thumbnails */}
                  {selectedProduct.media && selectedProduct.media.length > 1 && (
                    <div style={{ display: 'flex', gap: 8, padding: 12, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                      {selectedProduct.media.map((m, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setMediaIndex(idx)}
                          style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 8, border: `2px solid ${idx === mediaIndex ? 'var(--accent)' : 'transparent'}`, overflow: 'hidden', cursor: 'pointer', opacity: idx === mediaIndex ? 1 : 0.6, transition: '0.2s' }}
                        >
                          {m.type === 'video' ? (
                            <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <img src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right col: Details */}
                <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    {selectedProduct.catalog}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8, lineHeight: 1.2 }}>
                    {selectedProduct.name}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--text)', marginBottom: 24 }}>
                    ${selectedProduct.price.toFixed(2)}
                  </div>
                  
                  <div style={{ height: 1, background: 'var(--border)', marginBottom: 24 }} />

                  <div style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 32 }}>
                    {selectedProduct.description || 'No detailed description provided by the seller.'}
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
                    {selectedProduct.isDigital ? (
                      <div style={{ background: 'rgba(0, 150, 255, 0.1)', color: '#0096ff', padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                        ☁️ SaaS / Digital Platform
                      </div>
                    ) : (
                      <>
                        <div style={{ background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                          📦 Physical Goods
                        </div>
                        <div style={{ background: selectedProduct.inStock ? 'var(--accent-10)' : 'rgba(255,50,50,0.1)', color: selectedProduct.inStock ? 'var(--accent)' : '#ff3333', padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                          {selectedProduct.inStock ? (selectedProduct.stockQuantity === -1 ? 'Unlimited Access' : `Only ${selectedProduct.stockQuantity} Left`) : 'Sold Out!'}
                        </div>
                      </>
                    )}
                  </div>

                  <button 
                    className={`btn ${selectedProduct.inStock ? 'btn-primary' : 'btn-ghost'}`} 
                    disabled={!selectedProduct.inStock}
                    onClick={() => setCheckoutProduct(selectedProduct)}
                    style={{ width: '100%', padding: '16px', fontSize: 18, fontWeight: 700, display: 'flex', justifyContent: 'center', gap: 12, marginTop: 'auto',
                      background: selectedProduct.inStock && selectedProduct.isDigital ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : undefined
                    }}
                  >
                    {selectedProduct.inStock ? (
                      selectedProduct.isDigital
                        ? <><span>☁️</span> Get Access Now</>
                        : <><FiShoppingBag size={22} /> Order Now</>
                    ) : (
                      'Item Currently Unavailable'
                    )}
                  </button>
                  {selectedProduct.inStock && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
                      {selectedProduct.isDigital
                        ? '☁️ Digital delivery — no shipping required. Access link granted after seller confirmation.'
                        : `📦 Secure checkout with ${biz.businessName || profile.username}.`}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal Overlay */}
      {checkoutProduct && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ maxWidth: 500, width: '100%', background: 'var(--bg-base)', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '24px 30px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Complete Your Order</div>
              <button className="icon-btn" onClick={() => setCheckoutProduct(null)}><FiX size={24} /></button>
            </div>
            
            <div style={{ padding: 30, overflowY: 'auto', maxHeight: '70vh', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: 'var(--bg-elevated)', borderRadius: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', background: '#000', flexShrink: 0 }}>
                  <img src={checkoutProduct.media && checkoutProduct.media.length > 0 ? checkoutProduct.media[0].url : checkoutProduct.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{checkoutProduct.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>${checkoutProduct.price.toFixed(2)}</div>
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Quantity</label>
                <input type="number" min="1" max={checkoutProduct.stockQuantity === -1 ? 999 : checkoutProduct.stockQuantity} className="input" value={checkoutForm.quantity} onChange={e => setCheckoutForm({...checkoutForm, quantity: Number(e.target.value)})} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Full Name</label>
                  <input className="input" value={checkoutForm.name} onChange={e => setCheckoutForm({...checkoutForm, name: e.target.value})} placeholder="John Doe" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Email</label>
                  <input className="input" value={checkoutForm.email} onChange={e => setCheckoutForm({...checkoutForm, email: e.target.value})} placeholder="john@example.com" />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Phone Number</label>
                <input className="input" value={checkoutForm.phone} onChange={e => setCheckoutForm({...checkoutForm, phone: e.target.value})} placeholder="+1 (234) 567-8900" />
              </div>
              
              {!checkoutProduct.isDigital && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Shipping Address</label>
                    <textarea className="input" rows={3} value={checkoutForm.address} onChange={e => setCheckoutForm({...checkoutForm, address: e.target.value})} placeholder="123 Example Street, Apt 4B..." />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Pincode / Zip Code</label>
                    <input className="input" value={checkoutForm.pincode} onChange={e => setCheckoutForm({...checkoutForm, pincode: e.target.value})} placeholder="10001" />
                  </div>
                </>
              )}

              {/* Payment Method Selector */}
              {(profile?.businessProfile?.acceptedPayments?.length > 0) && (
                <div>
                  <label style={{ display: 'block', marginBottom: 12, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Payment Method
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {(profile.businessProfile.acceptedPayments).map(method => {
                      const icons = { 'UPI': '📲', 'Credit / Debit Card': '💳', 'Cash on Delivery': '💵', 'Bank Transfer': '🏦', 'PayPal': '🅿️', 'Crypto': '₿', 'Wallet': '👛' };
                      const isSelected = checkoutForm.paymentMethod === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setCheckoutForm({ ...checkoutForm, paymentMethod: method })}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                            fontWeight: 700, fontSize: 13,
                            background: isSelected ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                            color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                            borderTop: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            borderLeft: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            borderRight: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            borderBottom: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            transition: '0.2s', transform: isSelected ? 'scale(1.04)' : 'scale(1)'
                          }}
                        >
                          <span>{icons[method] || '💰'}</span> {method}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
            </div>
            
            <div style={{ padding: '20px 30px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Total: ${(checkoutProduct.price * checkoutForm.quantity).toFixed(2)}</div>
              <button className="btn btn-primary" onClick={handleCheckoutSubmit} disabled={checkoutSubmitting}>
                {checkoutSubmitting ? 'Processing...' : 'Place Secure Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Overlay */}
      {lightboxMedia && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLightboxMedia(null)}>
          <button className="icon-btn" onClick={() => setLightboxMedia(null)} style={{ position: 'absolute', top: 20, right: 20, color: '#fff', background: 'rgba(255,255,255,0.1)' }}>
            <FiX size={24} />
          </button>
          
          {lightboxMedia.type === 'video' ? (
            <video src={lightboxMedia.url} controls autoPlay style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          ) : (
            <img src={lightboxMedia.url} style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          )}
        </div>
      )}

      {/* ── Order Success Celebration Modal ──────────────────────────────── */}
      {orderSuccess && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5000,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
          animation: 'fadeIn 0.3s ease'
        }}>
          {/* Floating confetti particles */}
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: 10, height: 10,
              borderRadius: i % 3 === 0 ? '50%' : 2,
              background: ['#7c6af7','#22c55e','#f59e0b','#3b82f6','#ec4899','#06b6d4'][i % 6],
              left: `${8 + (i * 7.5)}%`,
              top: `${15 + (i % 4) * 15}%`,
              animation: `confettiFall ${1.2 + (i * 0.15)}s cubic-bezier(0.25,0.46,0.45,0.94) both`,
              animationDelay: `${i * 0.07}s`,
              opacity: 0.85
            }} />
          ))}

          <style>{`
            @keyframes confettiFall {
              0%   { transform: translateY(-60px) rotate(0deg); opacity: 0; }
              20%  { opacity: 1; }
              100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
            }
            @keyframes checkPop {
              0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
              60%  { transform: scale(1.2) rotate(8deg); opacity: 1; }
              80%  { transform: scale(0.92) rotate(-4deg); }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes ringPulse {
              0%   { transform: scale(0.7); opacity: 0; }
              50%  { opacity: 0.3; }
              100% { transform: scale(2.2); opacity: 0; }
            }
            @keyframes slideUpCard {
              0%   { transform: translateY(40px); opacity: 0; }
              100% { transform: translateY(0); opacity: 1; }
            }
          `}</style>

          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 28,
            padding: '48px 40px 36px',
            maxWidth: 400, width: '100%',
            textAlign: 'center',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            animation: 'slideUpCard 0.5s cubic-bezier(0.34,1.56,0.64,1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Subtle top glow */}
            <div style={{
              position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
              width: 200, height: 200,
              background: 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />

            {/* Pulsing ring behind checkmark */}
            <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '3px solid rgba(34,197,94,0.4)',
                animation: 'ringPulse 1.8s ease-out infinite',
                animationDelay: '0.3s'
              }} />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '3px solid rgba(34,197,94,0.25)',
                animation: 'ringPulse 1.8s ease-out infinite',
                animationDelay: '0.6s'
              }} />
              {/* Green circle */}
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(34,197,94,0.5)',
                animation: 'checkPop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both'
              }}>
                {/* SVG checkmark */}
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <path
                    d="M8 18 L15 25 L28 11"
                    stroke="white"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="40"
                    strokeDashoffset="0"
                    style={{ animation: 'none' }}
                  />
                </svg>
              </div>
            </div>

            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', marginBottom: 8, fontFamily: 'var(--font-display)' }}>
              Order Placed! 🎉
            </div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.5 }}>
              Your order for <strong style={{ color: 'var(--text)' }}>{orderSuccess.product.name}</strong> is confirmed and sent to the seller.
            </div>

            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
                <span>Quantity</span> <strong style={{ color: 'var(--text)' }}>{orderSuccess.quantity}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                <span>Total Paid</span> <span style={{ color: '#22c55e' }}>${orderSuccess.total}</span>
              </div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Track your order progress in <strong style={{ color: 'var(--accent)' }}>My Orders</strong> → Notifications will keep you updated!
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setOrderSuccess(null)}
              style={{ width: '100%', padding: 16, fontSize: 16, fontWeight: 700, borderRadius: 14 }}
            >
              Continue Shopping ✨
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
