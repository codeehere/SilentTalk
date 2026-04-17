import { FiImage, FiVideo, FiCalendar, FiCheckSquare, FiUser, FiFile } from 'react-icons/fi';

export default function AttachmentMenu({ onSelect, onClose }) {
  const options = [
    { id: 'photo',    label: 'Photo',    icon: <FiImage />,    color: '#38bdf8' },
    { id: 'video',    label: 'Video',    icon: <FiVideo />,    color: '#f43f5e' },
    { id: 'event',    label: 'Event',    icon: <FiCalendar />,  color: '#6366f1' },
    { id: 'task',     label: 'Task',     icon: <FiCheckSquare />, color: '#10b981' },
    { id: 'contact',  label: 'Contact',  icon: <FiUser />,     color: '#f59e0b' },
    { id: 'document', label: 'Document', icon: <FiFile />,     color: '#7c3aed' }
  ];

  return (
    <div className="attachment-menu-container" onClick={e => e.stopPropagation()}>
      {options.map(opt => (
        <div 
          key={opt.id} 
          className="attachment-option" 
          onClick={() => { onSelect(opt.id); onClose(); }}
        >
          <div className="attachment-icon-circle" style={{ color: opt.color }}>
            {opt.icon}
          </div>
          <span>{opt.label}</span>
        </div>
      ))}
    </div>
  );
}
