import { useState, useRef, useEffect } from 'react';
import { FiPlay, FiPause, FiMic } from 'react-icons/fi';

export default function AudioPlayer({ src, isMine }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState('0:00');
  const [currentTime, setCurrentTime] = useState('0:00');
  const [loaded, setLoaded] = useState(false);
  const audioRef = useRef(null);

  const formatTime = (time) => {
    if (isNaN(time) || time === Infinity || !time) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setDuration(formatTime(audio.duration));
        setLoaded(true);
      }
    };
    const onTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
      setCurrentTime(formatTime(audio.currentTime));
    };
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime('0:00');
      audio.currentTime = 0;
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    
    // Fallback if metadata is already completely loaded (from cache)
    if (audio.readyState >= 1) {
      onLoadedMetadata();
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    e.stopPropagation(); // prevent message click triggering
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = percent * audioRef.current.duration;
      setProgress(percent * 100);
      setCurrentTime(formatTime(percent * audioRef.current.duration));
    }
  };

  return (
    <div className={`custom-audio-player ${isMine ? 'mine' : ''}`}>
      {/* Cloudinary audio often benefits from crossOrigin attribute */}
      <audio ref={audioRef} src={src} preload="metadata" crossOrigin="anonymous" />
      
      <div className="audio-avatar">
        <FiMic size={16} />
      </div>

      <button className="audio-play-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
        {isPlaying ? <FiPause size={14} /> : <FiPlay size={14} style={{ marginLeft: 2 }} />}
      </button>

      <div className="audio-track-container">
        <div className="audio-track" onClick={handleSeek}>
          <div className="audio-progress" style={{ width: `${progress}%` }} />
          <div className="audio-thumb" style={{ left: `${progress}%` }} />
        </div>
        <div className="audio-timer">
          {isPlaying || progress > 0 ? currentTime : (loaded ? duration : '0:00')}
        </div>
      </div>
    </div>
  );
}
