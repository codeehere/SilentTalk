import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiX, FiChevronLeft, FiChevronRight, FiEye, FiBook } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import ImageCropper from './ImageCropper';

// mediaUrl may be a full Cloudinary URL or a relative /uploads/... path
const resolveMedia = (url, API) => {
  if (!url) return '';
  // Fix malformed protocol schemes (missing colon)
  if (url.startsWith('https//')) url = url.replace('https//', 'https://');
  if (url.startsWith('http//')) url = url.replace('http//', 'http://');

  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  
  // Prevent missing slashes when prepending API
  if (API && !API.endsWith('/') && !url.startsWith('/')) {
    return `${API}/${url}`;
  }
  return `${API}${url}`;
};

export default function Stories({ onBack }) {
  const { authFetch, API, user } = useAuth();
  const [stories, setStories] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [storyCropSrc, setStoryCropSrc] = useState(null);
  const fileRef = useRef();
  const timerRef = useRef(null);

  const [isPaused, setIsPaused] = useState(false);
  const [mutedUsers, setMutedUsers] = useState(() => JSON.parse(localStorage.getItem('st_muted_stories') || '[]'));

  useEffect(() => { fetchStories(); }, []);

  // Auto-advance timer
  useEffect(() => {
    if (!selectedGroup || isPaused) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const item = selectedGroup.items[storyIndex];
    if (!item || item.mediaType === 'video') return; // videos use onEnded
    timerRef.current = setTimeout(() => advanceStory(), 5000);
    return () => clearTimeout(timerRef.current);
  }, [selectedGroup, storyIndex, isPaused]);

  const fetchStories = async () => {
    const res = await authFetch(`${API}/api/stories`);
    if (res.ok) {
      const data = await res.json();
      const grouped = {};
      data.forEach(s => {
        const uid = s.userId._id;
        if (!grouped[uid]) grouped[uid] = { user: s.userId, items: [] };
        grouped[uid].items.push(s);
      });
      setStories(Object.values(grouped));
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setStoryCropSrc(reader.result);
      reader.readAsDataURL(file);
    } else {
      uploadStory(file);
    }
    e.target.value = null;
  };

  const uploadStory = async (blob) => {
    setStoryCropSrc(null);
    setUploading(true);
    const form = new FormData();
    const isVideo = blob.type?.startsWith('video/');
    form.append('media', blob, isVideo ? 'story.mp4' : 'story.jpg');
    form.append('caption', '');
    const res = await authFetch(`${API}/api/stories`, { method: 'POST', body: form });
    if (res.ok) fetchStories();
    else { const err = await res.json(); alert(err.message || 'Failed to upload story'); }
    setUploading(false);
  };

  const openStory = async (group, idx = 0) => {
    setSelectedGroup(group);
    setStoryIndex(idx);
    markViewed(group, idx);
  };

  const markViewed = async (group, idx) => {
    const story = group.items[idx];
    if (story) {
      await authFetch(`${API}/api/stories/${story._id}/view`, { method: 'POST' });
    }
  };

  const advanceStory = () => {
    if (!selectedGroup) return;
    if (storyIndex < selectedGroup.items.length - 1) {
      const next = storyIndex + 1;
      setStoryIndex(next);
      markViewed(selectedGroup, next);
    } else {
      // Move to next user's story
      const gi = stories.findIndex(g => g.user._id === selectedGroup.user._id);
      if (gi < stories.length - 1) {
        setSelectedGroup(stories[gi + 1]);
        setStoryIndex(0);
        markViewed(stories[gi + 1], 0);
      } else {
        setSelectedGroup(null);
      }
    }
  };

  const prevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1);
    }
  };

  const isSeen = (group) => group.items.every(s => s.viewers?.some(v => v.userId === user._id));

  const deleteStory = async (storyId) => {
    if (!confirm('Delete this story?')) return;
    const res = await authFetch(`${API}/api/stories/${storyId}`, { method: 'DELETE' });
    if (res.ok) {
      setSelectedGroup(null);
      fetchStories();
    }
  };

  const toggleMute = (e, uid) => {
    e.stopPropagation();
    const newMuted = mutedUsers.includes(uid) ? mutedUsers.filter(id => id !== uid) : [...mutedUsers, uid];
    setMutedUsers(newMuted);
    localStorage.setItem('st_muted_stories', JSON.stringify(newMuted));
    if (selectedGroup && selectedGroup.user._id === uid) setSelectedGroup(null);
  };

  const myGroup = stories.find(g => g.user._id === user._id);
  const otherStories = stories.filter(g => g.user._id !== user._id && !mutedUsers.includes(g.user._id));
  const mutedStoriesList = stories.filter(g => g.user._id !== user._id && mutedUsers.includes(g.user._id));

  return (
    <div className="section-pane">
      <div className="panel-header">
        <button className="icon-btn mobile-only-back" onClick={onBack} title="Back" style={{ marginRight: 4 }}>
          <FiChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <span className="panel-title">Stories</span>
        <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Add story">
          <FiPlus size={18} />
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileSelect} />
      </div>

      <div className="stories-split-layout">
        {/* LEFT: Accounts List */}
        <div className="stories-accounts-col">
          {/* Own Story Upload Card */}
          <div className="story-account-card story-add-card" onClick={() => fileRef.current?.click()}>
            <div className="story-card-preview story-card-add-preview">
              {uploading
                ? <div className="story-card-uploading"><div className="story-card-spinner" /></div>
                : <FiPlus size={28} style={{ color: 'var(--accent)' }} />
              }
            </div>
            <div className="story-card-label">Your Story</div>
          </div>

          {/* Contact Story Cards */}
          {myGroup && (
            <div
              className={`story-account-card ${selectedGroup?.user._id === myGroup.user._id ? 'story-card-active' : ''}`}
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--accent)', borderRadius: 12 }}
              onClick={() => openStory(myGroup)}
            >
              <div className={`story-card-preview ${isSeen(myGroup) ? 'story-card-seen' : 'story-card-unseen'}`} style={{ borderColor: 'var(--accent)' }}>
                {myGroup.items[0]?.mediaType !== 'video' && myGroup.items[0]?.mediaUrl && (
                  <img src={resolveMedia(myGroup.items[0].mediaUrl, API)} alt="" className="story-card-bg-img" />
                )}
                <div className="story-card-avatar-wrap">
                  {myGroup.user.avatar
                    ? <img src={myGroup.user.avatar} alt="" className="story-card-avatar" />
                    : <div className="story-card-avatar-fallback">{(myGroup.user.username || '?')[0].toUpperCase()}</div>
                  }
                </div>
              </div>
              <div className="story-card-label" style={{ fontWeight: 600, color: 'var(--accent)' }}>My Story</div>
            </div>
          )}

          {otherStories.map(group => {
            const seen = isSeen(group);
            const previewItem = group.items[0];
            return (
              <div
                key={group.user._id}
                className={`story-account-card ${selectedGroup?.user._id === group.user._id ? 'story-card-active' : ''}`}
                onClick={() => openStory(group)}
              >
                <div className={`story-card-preview ${seen ? 'story-card-seen' : 'story-card-unseen'}`}>
                  {/* Blurred story preview as background */}
                  {previewItem?.mediaType !== 'video' && previewItem?.mediaUrl && (
                    <img
                      src={resolveMedia(previewItem.mediaUrl, API)}
                      alt=""
                      className="story-card-bg-img"
                    />
                  )}
                  {/* Avatar overlay */}
                  <div className="story-card-avatar-wrap">
                    {group.user.avatar
                      ? <img src={group.user.avatar} alt="" className="story-card-avatar" />
                      : <div className="story-card-avatar-fallback">
                          {(group.user.username || '?')[0].toUpperCase()}
                        </div>
                    }
                  </div>
                </div>
                <div className="story-card-label">{group.user.username || 'User'}</div>
                {!seen && <div className="story-card-unseen-dot" />}
                <button className="icon-btn story-mute-btn" onClick={(e) => toggleMute(e, group.user._id)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, zIndex: 10 }}>
                  <FiX size={14} title="Mute Story" />
                </button>
              </div>
            );
          })}

          {mutedStoriesList.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '16px 16px 8px' }}>
                Muted Updates
              </div>
              {mutedStoriesList.map(group => (
                <div
                  key={group.user._id}
                  className="story-account-card"
                  style={{ opacity: 0.6 }}
                  onClick={() => openStory(group)}
                >
                  <div className="story-card-preview story-card-seen">
                    <div className="story-card-avatar-wrap">
                      {group.user.avatar
                        ? <img src={group.user.avatar} alt="" className="story-card-avatar" />
                        : <div className="story-card-avatar-fallback">{(group.user.username || '?')[0].toUpperCase()}</div>
                      }
                    </div>
                  </div>
                  <div className="story-card-label">{group.user.username || 'User'}</div>
                  <button className="icon-btn story-mute-btn" onClick={(e) => toggleMute(e, group.user._id)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.8, zIndex: 10 }}>
                    <FiPlus size={14} title="Unmute Story" />
                  </button>
                </div>
              ))}
            </>
          )}

          {stories.length === 0 && (
            <div className="task-empty-group" style={{ textAlign: 'center', padding: '32px 16px' }}>
              No stories yet.<br />Be the first to share!
            </div>
          )}
        </div>

        {/* RIGHT: Story Viewer Panel */}
        <div className="story-viewer-panel">
          {selectedGroup ? (
              <StoryViewer
                group={selectedGroup}
                index={storyIndex}
                onNext={advanceStory}
                onPrev={prevStory}
                onClose={() => setSelectedGroup(null)}
                API={API}
                onDelete={() => deleteStory(selectedGroup.items[storyIndex]._id)}
                isOwnStory={selectedGroup.user._id === user._id}
                onPointerDown={() => setIsPaused(true)}
                onPointerUp={() => setIsPaused(false)}
                isPaused={isPaused}
              />
          ) : (
            <div className="task-detail-empty">
              <div className="task-detail-empty-icon">
                <FiBook size={36} />
              </div>
              <div className="task-detail-empty-title">Select a story</div>
              <div className="task-detail-empty-sub">Click any contact on the left to view their story</div>
            </div>
          )}
        </div>
      </div>

      {storyCropSrc && (
        <ImageCropper
          imageSrc={storyCropSrc}
          aspect={9 / 16}
          onCropComplete={uploadStory}
          onCancel={() => setStoryCropSrc(null)}
        />
      )}
    </div>
  );
}

function StoryViewer({ group, index, onNext, onPrev, onClose, API, onDelete, isOwnStory, onPointerDown, onPointerUp, isPaused }) {
  const item = group.items[index];
  const total = group.items.length;

  return (
    <div 
      className="story-viewer-container"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Progress bars */}
      <div className="story-viewer-progress">
        {group.items.map((_, i) => (
          <div key={i} className="story-progress-bar">
            <div
              className={`story-progress-bar-fill ${i < index ? 'full' : i === index && !isPaused ? 'animating' : i === index && isPaused ? 'paused' : ''}`}
              key={`${group.user._id}-${index}-${i}`}
            />
          </div>
        ))}
      </div>

      {/* User info */}
      <div className="story-viewer-header">
        {group.user.avatar
          ? <img src={group.user.avatar} alt="" className="story-viewer-avatar" />
          : <div className="story-viewer-avatar-fallback">{(group.user.username || '?')[0].toUpperCase()}</div>
        }
        <div style={{ flex: 1 }}>
          <div className="story-viewer-name">{group.user.username}</div>
          <div className="story-viewer-time">
            {item?.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : ''}
          </div>
        </div>
        {isOwnStory && (
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ marginRight: 8, color: 'var(--red)', background: 'rgba(0,0,0,0.5)' }}>
            <FiX size={16} title="Delete Story" />
          </button>
        )}
        <button className="story-viewer-close" onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)' }}><FiX size={18} /></button>
      </div>

      {/* Media */}
      <div className="story-viewer-media">
        {item?.mediaType === 'video'
          ? <video
              key={item._id}
              src={resolveMedia(item.mediaUrl, API)}
              autoPlay
              playsInline
              muted={false}
              className="story-viewer-img"
              onEnded={onNext}
              ref={(vid) => {
                if (!vid) return;
                if (isPaused) vid.pause();
                else vid.play().catch(()=>{});
              }}
            />
          : <img
              key={item?._id}
              src={resolveMedia(item?.mediaUrl, API)}
              alt=""
              className="story-viewer-img"
            />
        }
        {item?.caption && (
          <div className="story-viewer-caption">{item.caption}</div>
        )}
      </div>

      {/* Navigation */}
      <div className="story-viewer-nav">
        <button className="story-nav-btn" onClick={onPrev} disabled={index === 0}>
          <FiChevronLeft size={22} />
        </button>
        <span className="story-nav-count">{index + 1} / {total}</span>
        <button className="story-nav-btn" onClick={onNext}>
          <FiChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}
