import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { FiCheck, FiX } from 'react-icons/fi';

// Utility to convert the cropped area into an actual Blob image file
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    if (url && !url.startsWith('data:')) {
      image.setAttribute('crossOrigin', 'anonymous'); 
    }
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      resolve(file);
    }, 'image/jpeg');
  });
}

export default function ImageCropper({ imageSrc, onCropComplete, onCancel, aspect = 1 }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropCompleteEvent = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    try {
      setProcessing(true);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (e) {
      console.error(e);
      setProcessing(false);
    }
  };

  return (
    <div className="cropper-overlay">
      <div className="cropper-container">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onCropComplete={onCropCompleteEvent}
          onZoomChange={setZoom}
          cropShape={aspect === 1 ? 'round' : 'rect'}
          showGrid={true}
        />
      </div>
      <div className="cropper-controls">
        <button className="icon-btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', width: 44, height: 44 }} onClick={onCancel} disabled={processing}>
          <FiX size={20} color="#fff" />
        </button>
        <button className="btn" style={{ background: 'var(--accent)', color: '#fff', borderRadius: 20, padding: '0 24px', height: 44, fontWeight: 'bold' }} onClick={handleApply} disabled={processing}>
          {processing ? '...' : <><FiCheck size={18} style={{ marginRight: 6 }} /> Crop & Apply</>}
        </button>
      </div>
    </div>
  );
}
