import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiPlus, FiClock, FiBell, FiBellOff, FiMic, FiMicOff, FiImage,
  FiTrash2, FiChevronLeft, FiChevronRight, FiCheckCircle, FiCircle, FiAlertCircle,
  FiZap, FiX, FiSave, FiPaperclip, FiPlay, FiSquare
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUS_GROUPS = [
  { id: 'todo',       label: 'To Do',       icon: FiCircle,      color: 'var(--text-muted)', accent: '#5a6280' },
  { id: 'inprogress', label: 'In Progress',  icon: FiAlertCircle, color: 'var(--amber)',      accent: '#f59e0b' },
  { id: 'done',       label: 'Done',         icon: FiCheckCircle, color: 'var(--green)',      accent: '#22c55e' },
];

// Alarm scheduler — fires browser notification at alarmAt time
const alarmTimers = new Map();
function scheduleAlarm(task) {
  if (!task.alarmAt || !task._id) return;
  if (alarmTimers.has(task._id)) clearTimeout(alarmTimers.get(task._id));
  const delay = new Date(task.alarmAt).getTime() - Date.now();
  if (delay <= 0) return;
  const tid = setTimeout(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`⏰ Task Reminder`, {
        body: task.title,
        icon: '/vite.svg',
        tag: `task-alarm-${task._id}`
      });
    } else {
      alert(`⏰ Task Alarm: ${task.title}`);
    }
    alarmTimers.delete(task._id);
  }, delay);
  alarmTimers.set(task._id, tid);
}

export default function Tasks({ onBack }) {
  const { authFetch, API } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const recTimerRef = useRef(null);
  const imgInputRef = useRef(null);

  useEffect(() => {
    fetchTasks();
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Schedule alarms for all tasks on load
  useEffect(() => {
    tasks.forEach(t => { if (t.alarmAt) scheduleAlarm(t); });
  }, [tasks]);

  const fetchTasks = async () => {
    const res = await authFetch(`${API}/api/tasks`);
    if (res.ok) setTasks(await res.json());
  };

  const createTask = async () => {
    if (!form.title.trim()) return;
    const res = await authFetch(`${API}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      fetchTasks();
      setShowCreate(false);
      setForm({ title: '', description: '', priority: 'medium', dueDate: '' });
    }
  };

  const saveTask = async (patch) => {
    if (!selectedTask) return;
    setSaving(true);
    const res = await authFetch(`${API}/api/tasks/${selectedTask._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks(prev => prev.map(t => t._id === selectedTask._id ? updated : t));
      setSelectedTask(updated);
      if (updated.alarmAt) scheduleAlarm(updated);
    }
    setSaving(false);
  };

  const deleteTask = async (id) => {
    await authFetch(`${API}/api/tasks/${id}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(t => t._id !== id));
    if (selectedTask?._id === id) setSelectedTask(null);
  };

  const updateStatus = async (id, status) => {
    await authFetch(`${API}/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    setTasks(prev => prev.map(t => t._id === id ? { ...t, status } : t));
    if (selectedTask?._id === id) setSelectedTask(prev => ({ ...prev, status }));
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('file', blob, 'voice.webm');
        const res = await authFetch(`${API}/api/messages/upload`, { method: 'POST', body: fd });
        if (res.ok) {
          const { url } = await res.json();
          await saveTask({ voiceNote: url });
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setRecordingTime(0);
      recTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { alert('Could not access microphone.'); }
  };

  const stopRecording = () => {
    if (mediaRef.current) { mediaRef.current.stop(); mediaRef.current = null; }
    clearInterval(recTimerRef.current);
    setRecording(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImg(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await authFetch(`${API}/api/messages/upload`, { method: 'POST', body: fd });
    if (res.ok) {
      const { url } = await res.json();
      const newAttachments = [...(selectedTask.attachments || []), url];
      await saveTask({ attachments: newAttachments });
    }
    setUploadingImg(false);
    e.target.value = null;
  };

  const formatTime = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div className="section-pane">
      <div className="panel-header">
        <button className="icon-btn mobile-only-back" onClick={onBack} title="Back" style={{ marginRight: 4 }}>
          <FiChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <span className="panel-title">Tasks</span>
        <button className="icon-btn" onClick={() => setShowCreate(true)} title="New Task">
          <FiPlus size={18} />
        </button>
      </div>

      <div className="task-split-layout">
        {/* LEFT: Task List */}
        <div className="task-list-col">
          {STATUS_GROUPS.map(group => {
            const groupTasks = tasks.filter(t => t.status === group.id);
            const Icon = group.icon;
            return (
              <div key={group.id} className="task-status-section">
                <div className="task-status-header">
                  <Icon size={14} style={{ color: group.color }} />
                  <span style={{ color: group.color }}>{group.label}</span>
                  <span className="task-status-count">{groupTasks.length}</span>
                </div>
                {groupTasks.map(task => (
                  <div
                    key={task._id}
                    className={`task-row ${selectedTask?._id === task._id ? 'selected' : ''}`}
                    style={{ '--priority-color': getPriorityColor(task.priority) }}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="task-row-accent" />
                    <div className="task-row-content">
                      <div className="task-row-title">{task.title}</div>
                      <div className="task-row-meta">
                        <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                        {task.dueDate && (
                          <span className="task-row-due">
                            <FiClock size={10} /> {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        {task.alarmAt && <FiBell size={11} style={{ color: 'var(--amber)' }} />}
                        {task.completion > 0 && (
                          <span className="task-row-pct">{task.completion}%</span>
                        )}
                      </div>
                      {task.completion > 0 && (
                        <div className="task-mini-progress">
                          <div className="task-mini-progress-fill" style={{ width: `${task.completion}%`, background: group.accent }} />
                        </div>
                      )}
                    </div>
                    <FiChevronRight size={14} className="task-row-arrow" />
                  </div>
                ))}
                {groupTasks.length === 0 && (
                  <div className="task-empty-group">No tasks here yet</div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT: Task Detail Panel */}
        <div className="task-detail-col">
          {selectedTask ? (
            <TaskDetailPanel
              task={selectedTask}
              onSave={saveTask}
              onDelete={deleteTask}
              onStatusChange={updateStatus}
              saving={saving}
              recording={recording}
              recordingTime={recordingTime}
              onStartRecord={startRecording}
              onStopRecord={stopRecording}
              onImageUpload={() => imgInputRef.current?.click()}
              uploadingImg={uploadingImg}
              formatTime={formatTime}
              API={API}
            />
          ) : (
            <div className="task-detail-empty">
              <div className="task-detail-empty-icon">
                <FiCheckCircle size={36} />
              </div>
              <div className="task-detail-empty-title">Select a task</div>
              <div className="task-detail-empty-sub">Click any task to view and edit details</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                <FiPlus size={14} /> Create Task
              </button>
            </div>
          )}
        </div>
      </div>

      <input ref={imgInputRef} type="file" accept="image/*,video/*" style={{ display:'none' }} onChange={handleImageUpload} />

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiCheckCircle size={20} /> Create Task
            </div>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What needs to be done?" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="input" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Add details…" style={{ resize: 'none' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="input" type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={createTask} disabled={!form.title.trim()}>Create Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getPriorityColor(p) {
  return { low: 'var(--green)', medium: 'var(--amber)', high: 'var(--red)', urgent: 'var(--red)' }[p] || 'var(--text-muted)';
}

function TaskDetailPanel({ task, onSave, onDelete, onStatusChange, saving, recording, recordingTime, onStartRecord, onStopRecord, onImageUpload, uploadingImg, formatTime, API }) {
  const [desc, setDesc] = useState(task.description || '');
  const [completion, setCompletion] = useState(task.completion || 0);
  const [alarmEnabled, setAlarmEnabled] = useState(!!task.alarmAt);
  const [alarmAt, setAlarmAt] = useState(task.alarmAt ? new Date(task.alarmAt).toISOString().slice(0, 16) : '');
  const [dirty, setDirty] = useState(false);

  // Reset when task changes
  useEffect(() => {
    setDesc(task.description || '');
    setCompletion(task.completion || 0);
    setAlarmEnabled(!!task.alarmAt);
    setAlarmAt(task.alarmAt ? new Date(task.alarmAt).toISOString().slice(0, 16) : '');
    setDirty(false);
  }, [task._id]);

  const handleSave = () => {
    onSave({
      description: desc,
      completion,
      alarmAt: alarmEnabled && alarmAt ? new Date(alarmAt).toISOString() : null
    });
    setDirty(false);
  };

  const statusOptions = [
    { id: 'todo', label: 'To Do' },
    { id: 'inprogress', label: 'In Progress' },
    { id: 'done', label: 'Done' }
  ];

  return (
    <div className="task-detail-panel">
      {/* Header */}
      <div className="task-detail-header">
        <div>
          <div className="task-detail-title">{task.title}</div>
          <div className="task-detail-badges">
            <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
            {task.dueDate && (
              <span className="task-row-due"><FiClock size={11} /> {new Date(task.dueDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <button className="icon-btn" style={{ color: 'var(--red)', flexShrink:0 }} onClick={() => { if (confirm('Delete this task?')) onDelete(task._id); }} title="Delete task">
          <FiTrash2 size={16} />
        </button>
      </div>

      {/* Status Selector */}
      <div className="task-detail-section">
        <div className="task-detail-label">Status</div>
        <div className="task-status-pills">
          {statusOptions.map(s => (
            <button key={s.id} className={`task-status-pill ${task.status === s.id ? 'active' : ''}`}
              onClick={() => onStatusChange(task._id, s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Completion Slider */}
      <div className="task-detail-section">
        <div className="task-detail-label" style={{ display:'flex', justifyContent:'space-between' }}>
          <span>Completion</span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{completion}%</span>
        </div>
        <div className="task-progress-track">
          <div className="task-progress-fill" style={{ width: `${completion}%` }} />
        </div>
        <input
          type="range" min="0" max="100" step="5"
          value={completion}
          onChange={e => { setCompletion(Number(e.target.value)); setDirty(true); }}
          className="task-progress-slider"
        />
      </div>

      {/* Description */}
      <div className="task-detail-section" style={{ flex: 1, display:'flex', flexDirection:'column' }}>
        <div className="task-detail-label">Notes</div>
        <textarea
          className="task-notes-area"
          value={desc}
          onChange={e => { setDesc(e.target.value); setDirty(true); }}
          placeholder="Add notes, links, details…"
          rows={5}
        />
      </div>

      {/* Voice Note */}
      <div className="task-detail-section">
        <div className="task-detail-label">Voice Note</div>
        {task.voiceNote ? (
          <div className="task-voice-player">
            <FiPlay size={14} style={{ color:'var(--accent)' }} />
            <audio src={`${API}${task.voiceNote}`} controls style={{ flex:1, height:32 }} />
          </div>
        ) : (
          <button
            className={`task-voice-btn ${recording ? 'recording' : ''}`}
            onClick={recording ? onStopRecord : onStartRecord}
          >
            {recording ? (
              <><FiSquare size={14} /> Stop — {formatTime(recordingTime)}</>
            ) : (
              <><FiMic size={14} /> Record Voice Note</>
            )}
          </button>
        )}
      </div>

      {/* Image Attachments */}
      <div className="task-detail-section">
        <div className="task-detail-label" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>Attachments</span>
          <button className="icon-btn" style={{ width:28, height:28 }} onClick={onImageUpload} disabled={uploadingImg} title="Add image">
            {uploadingImg ? '…' : <FiPaperclip size={13} />}
          </button>
        </div>
        {task.attachments?.length > 0 && (
          <div className="task-attachments-grid">
            {task.attachments.map((url, i) => (
              <img key={i} src={`${API}${url}`} alt="" className="task-attachment-thumb" />
            ))}
          </div>
        )}
      </div>

      {/* Alarm */}
      <div className="task-detail-section">
        <div className="task-detail-label" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}>
            {alarmEnabled ? <FiBell size={13} style={{ color:'var(--amber)' }} /> : <FiBellOff size={13} />}
            Alarm / Reminder
          </span>
          <div className={`toggle ${alarmEnabled ? 'on' : ''}`} onClick={() => { setAlarmEnabled(a => !a); setDirty(true); }} />
        </div>
        {alarmEnabled && (
          <input
            type="datetime-local"
            className="input"
            value={alarmAt}
            onChange={e => { setAlarmAt(e.target.value); setDirty(true); }}
            style={{ marginTop: 8 }}
          />
        )}
      </div>

      {/* Save Button */}
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
