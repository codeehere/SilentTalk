import { useState, useEffect } from 'react';
import {
  FiPlus, FiCalendar, FiMapPin, FiUsers, FiCheck, FiX,
  FiBell, FiBellOff, FiTrash2, FiSave, FiChevronLeft, FiChevronRight,
  FiClock, FiPaperclip
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Alarm scheduler
const alarmTimers = new Map();
function scheduleAlarm(event) {
  if (!event.alarmAt || !event._id) return;
  if (alarmTimers.has(event._id)) clearTimeout(alarmTimers.get(event._id));
  const delay = new Date(event.alarmAt).getTime() - Date.now();
  if (delay <= 0) return;
  const tid = setTimeout(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('📅 Event Reminder', {
        body: event.title,
        icon: '/vite.svg',
        tag: `event-alarm-${event._id}`
      });
    } else {
      alert(`📅 Event Reminder: ${event.title}`);
    }
    alarmTimers.delete(event._id);
  }, delay);
  alarmTimers.set(event._id, tid);
}

export default function Events({ onBack }) {
  const { authFetch, API, user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', date: '', endDate: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  useEffect(() => {
    fetchEvents();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    events.forEach(ev => { if (ev.alarmAt) scheduleAlarm(ev); });
  }, [events]);

  const fetchEvents = async () => {
    const res = await authFetch(`${API}/api/events`);
    if (res.ok) setEvents(await res.json());
  };

  const createEvent = async () => {
    if (!form.title || !form.date) return;
    const res = await authFetch(`${API}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      fetchEvents();
      setShowCreate(false);
      setForm({ title: '', description: '', date: '', endDate: '', location: '' });
    }
  };

  const saveEvent = async (patch) => {
    if (!selectedEvent) return;
    setSaving(true);
    const res = await authFetch(`${API}/api/events/${selectedEvent._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (res.ok) {
      const updated = await res.json();
      setEvents(prev => prev.map(e => e._id === selectedEvent._id ? updated : e));
      setSelectedEvent(updated);
      if (updated.alarmAt) scheduleAlarm(updated);
    }
    setSaving(false);
  };

  const deleteEvent = async (id) => {
    await authFetch(`${API}/api/events/${id}`, { method: 'DELETE' });
    setEvents(prev => prev.filter(e => e._id !== id));
    if (selectedEvent?._id === id) setSelectedEvent(null);
  };

  const rsvp = async (eventId, rsvpVal) => {
    await authFetch(`${API}/api/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rsvp: rsvpVal })
    });
    fetchEvents();
  };

  const myRsvp = (event) => event.participants?.find(
    p => p.userId?._id === user._id || p.userId === user._id
  )?.rsvp;

  // Separate upcoming vs past
  const now = new Date();
  const upcoming = events.filter(e => new Date(e.date) >= now);
  const past = events.filter(e => new Date(e.date) < now);

  return (
    <div className="section-pane">
      <div className="panel-header">
        <button className="icon-btn mobile-only-back" onClick={onBack} title="Back" style={{ marginRight: 4 }}>
          <FiChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <span className="panel-title">Events</span>
        <button className="icon-btn" onClick={() => setShowCreate(true)} title="New Event">
          <FiPlus size={18} />
        </button>
      </div>

      <div className="task-split-layout">
        {/* LEFT: Event List */}
        <div className="task-list-col">
          {events.length === 0 && (
            <div className="task-empty-group" style={{ textAlign:'center', padding: '40px 20px' }}>
              <FiCalendar size={28} style={{ margin: '0 auto 12px', display:'block', color:'var(--text-muted)' }} />
              <div style={{ fontWeight:600, marginBottom:6 }}>No events yet</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>Create Event</button>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="task-status-section">
              <div className="task-status-header">
                <FiCalendar size={14} style={{ color:'var(--accent)' }} />
                <span style={{ color:'var(--accent)' }}>Upcoming</span>
                <span className="task-status-count">{upcoming.length}</span>
              </div>
              {upcoming.map(ev => <EventRow key={ev._id} event={ev} selected={selectedEvent?._id === ev._id} onClick={() => setSelectedEvent(ev)} myRsvp={myRsvp(ev)} />)}
            </div>
          )}

          {past.length > 0 && (
            <div className="task-status-section">
              <div className="task-status-header">
                <FiClock size={14} style={{ color:'var(--text-muted)' }} />
                <span style={{ color:'var(--text-muted)' }}>Past</span>
                <span className="task-status-count">{past.length}</span>
              </div>
              {past.map(ev => <EventRow key={ev._id} event={ev} selected={selectedEvent?._id === ev._id} onClick={() => setSelectedEvent(ev)} myRsvp={myRsvp(ev)} />)}
            </div>
          )}
        </div>

        {/* RIGHT: Event Detail */}
        <div className="task-detail-col">
          {selectedEvent ? (
            <EventDetailPanel
              event={selectedEvent}
              onSave={saveEvent}
              onDelete={deleteEvent}
              onRsvp={rsvp}
              saving={saving}
              myRsvp={myRsvp(selectedEvent)}
              isOrganizer={selectedEvent.organizer?._id === user._id || selectedEvent.organizer === user._id}
              uploadingImg={uploadingImg}
              API={API}
              authFetch={authFetch}
              setUploadingImg={setUploadingImg}
              setSelectedEvent={setSelectedEvent}
              setEvents={setEvents}
            />
          ) : (
            <div className="task-detail-empty">
              <div className="task-detail-empty-icon">
                <FiCalendar size={36} />
              </div>
              <div className="task-detail-empty-title">Select an event</div>
              <div className="task-detail-empty-sub">Click any event to view details and manage RSVP</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                <FiPlus size={14} /> Create Event
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiCalendar size={20} /> Create Event
            </div>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Event name" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Details…" style={{ resize:'none' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="input" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location (optional)" />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Start *</label>
                <input className="input" type="datetime-local" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">End</label>
                <input className="input" type="datetime-local" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={createEvent} disabled={!form.title || !form.date}>Create Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({ event, selected, onClick, myRsvp }) {
  const d = new Date(event.date);
  return (
    <div className={`task-row ${selected ? 'selected' : ''}`} style={{ '--priority-color': event.color || 'var(--accent)' }} onClick={onClick}>
      <div className="task-row-accent" />
      <div className="event-row-date">
        <div className="event-row-day">{d.getDate()}</div>
        <div className="event-row-mon">{MONTHS[d.getMonth()]}</div>
      </div>
      <div className="task-row-content">
        <div className="task-row-title">{event.title}</div>
        <div className="task-row-meta">
          {event.location && <span className="task-row-due"><FiMapPin size={10} /> {event.location}</span>}
          <span className="task-row-due"><FiUsers size={10} /> {event.participants?.length || 0}</span>
          {myRsvp && <span className={`status-badge status-${myRsvp === 'going' ? 'accepted' : myRsvp === 'not_going' ? 'denied' : 'pending'}`} style={{ fontSize:10, padding:'1px 6px' }}>{myRsvp === 'going' ? 'Going' : myRsvp === 'not_going' ? 'Declined' : 'Maybe'}</span>}
          {event.alarmAt && <FiBell size={11} style={{ color:'var(--amber)' }} />}
        </div>
      </div>
      <FiChevronRight size={14} className="task-row-arrow" />
    </div>
  );
}

function EventDetailPanel({ event, onSave, onDelete, onRsvp, saving, myRsvp, isOrganizer, API, authFetch, setUploadingImg, uploadingImg, setSelectedEvent, setEvents }) {
  const [desc, setDesc] = useState(event.description || '');
  const [completion, setCompletion] = useState(event.completion || 0);
  const [alarmEnabled, setAlarmEnabled] = useState(!!event.alarmAt);
  const [alarmAt, setAlarmAt] = useState(event.alarmAt ? new Date(event.alarmAt).toISOString().slice(0, 16) : '');
  const [dirty, setDirty] = useState(false);
  const fileRef = { current: null };

  useEffect(() => {
    setDesc(event.description || '');
    setCompletion(event.completion || 0);
    setAlarmEnabled(!!event.alarmAt);
    setAlarmAt(event.alarmAt ? new Date(event.alarmAt).toISOString().slice(0, 16) : '');
    setDirty(false);
  }, [event._id]);

  const handleSave = () => {
    onSave({
      description: desc,
      completion,
      alarmAt: alarmEnabled && alarmAt ? new Date(alarmAt).toISOString() : null
    });
    setDirty(false);
  };

  const d = new Date(event.date);

  return (
    <div className="task-detail-panel">
      {/* Header */}
      <div className="task-detail-header">
        <div style={{ display:'flex', alignItems:'center', gap:14, flex:1 }}>
          <div className="event-detail-date-box" style={{ background: `${event.color || 'var(--accent)'}22`, borderColor: event.color || 'var(--accent)' }}>
            <div className="event-date-day" style={{ color: event.color || 'var(--accent)' }}>{d.getDate()}</div>
            <div className="event-date-mon">{MONTHS[d.getMonth()]}</div>
          </div>
          <div>
            <div className="task-detail-title">{event.title}</div>
            {event.location && <div className="task-row-due"><FiMapPin size={11} /> {event.location}</div>}
          </div>
        </div>
        {isOrganizer && (
          <button className="icon-btn" style={{ color:'var(--red)', flexShrink:0 }}
            onClick={() => { if (confirm('Delete this event?')) onDelete(event._id); }} title="Delete event">
            <FiTrash2 size={16} />
          </button>
        )}
      </div>

      {/* RSVP */}
      <div className="task-detail-section">
        <div className="task-detail-label">Your RSVP</div>
        <div className="task-status-pills">
          <button className={`task-status-pill ${myRsvp === 'going' ? 'active' : ''}`} style={myRsvp === 'going' ? { background:'var(--green)', color:'#fff', borderColor:'var(--green)' } : {}} onClick={() => onRsvp(event._id, 'going')}>
            <FiCheck size={12} /> Going
          </button>
          <button className={`task-status-pill ${myRsvp === 'maybe' ? 'active' : ''}`} onClick={() => onRsvp(event._id, 'maybe')}>
            Maybe
          </button>
          <button className={`task-status-pill ${myRsvp === 'not_going' ? 'active' : ''}`} style={myRsvp === 'not_going' ? { background:'var(--red)', color:'#fff', borderColor:'var(--red)' } : {}} onClick={() => onRsvp(event._id, 'not_going')}>
            <FiX size={12} /> Decline
          </button>
        </div>
        <div className="task-row-due" style={{ marginTop:6 }}>
          <FiUsers size={11} /> {event.participants?.length || 0} participant{event.participants?.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Completion */}
      <div className="task-detail-section">
        <div className="task-detail-label" style={{ display:'flex', justifyContent:'space-between' }}>
          <span>Progress</span>
          <span style={{ color:'var(--accent)', fontWeight:700 }}>{completion}%</span>
        </div>
        <div className="task-progress-track">
          <div className="task-progress-fill" style={{ width:`${completion}%` }} />
        </div>
        <input type="range" min="0" max="100" step="5" value={completion}
          onChange={e => { setCompletion(Number(e.target.value)); setDirty(true); }}
          className="task-progress-slider" />
      </div>

      {/* Description */}
      <div className="task-detail-section" style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div className="task-detail-label">Notes</div>
        <textarea className="task-notes-area" value={desc}
          onChange={e => { setDesc(e.target.value); setDirty(true); }}
          placeholder="Add notes about this event…" rows={4} />
      </div>

      {/* Alarm */}
      <div className="task-detail-section">
        <div className="task-detail-label" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}>
            {alarmEnabled ? <FiBell size={13} style={{ color:'var(--amber)' }} /> : <FiBellOff size={13} />}
            Reminder
          </span>
          <div className={`toggle ${alarmEnabled ? 'on' : ''}`} onClick={() => { setAlarmEnabled(a => !a); setDirty(true); }} />
        </div>
        {alarmEnabled && (
          <input type="datetime-local" className="input" value={alarmAt}
            onChange={e => { setAlarmAt(e.target.value); setDirty(true); }}
            style={{ marginTop:8 }} />
        )}
      </div>

      {/* Save */}
      {dirty && (
        <div className="task-detail-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <FiSave size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
