import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, SwitchCamera, Circle, Clock, MapPin, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

interface CameraWatermarkModalProps {
  onClose: () => void;
  onCapture?: (dataUrl: string) => void;
}

export function CameraWatermarkModal({ onClose, onCapture }: CameraWatermarkModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [address, setAddress] = useState('Obteniendo ubicación...');
  const [customTime, setCustomTime] = useState('');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customName, setCustomName] = useState(() => {
    return localStorage.getItem('logiruta_camera_name') || '';
  });

  useEffect(() => {
    localStorage.setItem('logiruta_camera_name', customName);
  }, [customName]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Get location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          try {
            // using nominatim
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
            const data = await res.json();
            const streetInfo = data.address?.road || data.address?.pedestrian || data.address?.suburb || 'Ubicación cercana';
            const cityInfo = data.address?.city || data.address?.town || data.address?.village || 'Xalapa';
            setAddress(`${streetInfo}, ${cityInfo}`);
          } catch (e) {
            setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
          }
        },
        () => {
          setAddress('Ubicación no disponible');
        }
      );
    } else {
      setAddress('Ubicación no soportada');
    }
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Wait for formatting
  const formatDate = (d: Date) => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' };
    const str = d.toLocaleDateString('es-MX', options);
    return str.replace(' de 20', ' del 20');
  };

  const getCustomTime12h = (ct: string) => {
    if (!ct) return '';
    try {
      const [h, m] = ct.split(':');
      let hour = parseInt(h, 10);
      const isPm = hour >= 12;
      if (hour === 0) hour = 12;
      else if (hour > 12) hour -= 12;
      return `${hour}:${m} ${isPm ? 'p.m.' : 'a.m.'}`;
    } catch {
      return ct;
    }
  };

  const dateStr = formatDate(currentTime);
  const timeStr = useCustomTime && customTime 
    ? getCustomTime12h(customTime)
    : currentTime.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' }).toLowerCase();

  const [cameraError, setCameraError] = useState(false);

  // Camera handling
  const startCamera = useCallback(async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraError(false);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.error(err);
      setCameraError(true);
      toast.error('Otorga permisos de cámara en tu navegador');
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [facingMode]); // Intentionally not restarting on every render

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We want exactly 3:4 aspect ratio just like the viewer
    const targetAspectRatio = 3 / 4;
    const videoAspectRatio = video.videoWidth / video.videoHeight;
    
    let drawWidth = video.videoWidth;
    let drawHeight = video.videoHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (videoAspectRatio > targetAspectRatio) {
      // video is wider than 3:4 (crop left/right)
      drawWidth = video.videoHeight * targetAspectRatio;
      offsetX = (video.videoWidth - drawWidth) / 2;
    } else if (videoAspectRatio < targetAspectRatio) {
      // video is taller than 3:4 (crop top/bottom)
      drawHeight = video.videoWidth / targetAspectRatio;
      offsetY = (video.videoHeight - drawHeight) / 2;
    }

    // Set canvas to the cropped 3:4 dimensions
    canvas.width = drawWidth;
    canvas.height = drawHeight;
    
    // Draw video
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight, 0, 0, drawWidth, drawHeight);
    
    if (facingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
    }

    const drawLucideIcon = (drawPaths: (ctx: CanvasRenderingContext2D) => void, x: number, y: number, size: number) => {
       ctx.save();
       ctx.translate(x, y - size); // align with bottom baseline mostly
       ctx.scale(size / 24, size / 24);
       ctx.strokeStyle = 'white';
       ctx.lineWidth = 2.5;
       ctx.lineCap = 'round';
       ctx.lineJoin = 'round';
       ctx.shadowColor = 'black';
       ctx.shadowBlur = 4;
       ctx.shadowOffsetX = 1;
       ctx.shadowOffsetY = 1;
       drawPaths(ctx);
       ctx.restore();
    }

    const drawClock = (c: CanvasRenderingContext2D) => {
       c.beginPath();
       c.arc(12, 12, 10, 0, Math.PI * 2);
       c.stroke();
       c.beginPath();
       c.moveTo(12, 6);
       c.lineTo(12, 12);
       c.lineTo(16, 14);
       c.stroke();
    };

    const drawCalendar = (c: CanvasRenderingContext2D) => {
       c.beginPath();
       if (c.roundRect) {
         c.roundRect(3, 4, 18, 18, 2);
       } else {
         c.rect(3, 4, 18, 18);
       }
       c.stroke();
       c.beginPath();
       c.moveTo(16, 2); c.lineTo(16, 6);
       c.moveTo(8, 2); c.lineTo(8, 6);
       c.moveTo(3, 10); c.lineTo(21, 10);
       c.stroke();
    }

    const drawMapPin = (c: CanvasRenderingContext2D) => {
       c.beginPath();
       c.arc(12, 10, 3, 0, Math.PI * 2);
       c.stroke();
       c.beginPath();
       const p = new Path2D("M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z");
       c.stroke(p);
    };

    // Text rendering setup
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.textBaseline = 'bottom';

    // Scale proportional to the 3:4 width
    const CW = canvas.width;
    const CH = canvas.height;
    const vw = CW / 100;
    const vh = CH / 100;

    const timeFontSize = 6.5 * vw;
    const dateFontSize = 3.0 * vw;
    const addressFontSize = 2.6 * vw;
    const nameFontSize = 3.0 * vw;

    const gap = 1.5 * vw;
    const marginX = 3 * vw;
    let currentY = CH - (3 * vh); // bottom-[3%]

    // Address
    ctx.font = `600 ${addressFontSize}px sans-serif`;
    const mapPinSize = 2.5 * vw;
    drawLucideIcon(drawMapPin, marginX, currentY, mapPinSize);
    ctx.fillText(address, marginX + mapPinSize + gap, currentY + (0.1 * vw)); 
    
    // Date
    currentY -= (addressFontSize + 1.0 * vh);
    ctx.font = `600 ${dateFontSize}px sans-serif`;
    const calendarSize = 2.5 * vw;
    drawLucideIcon(drawCalendar, marginX, currentY, calendarSize);
    ctx.fillText(dateStr, marginX + calendarSize + gap, currentY + (0.2 * vw));

    // Time
    currentY -= (dateFontSize + 1.5 * vh);
    ctx.font = `bold ${timeFontSize}px sans-serif`;
    const clockSize = 5.5 * vw;
    drawLucideIcon(drawClock, marginX, currentY, clockSize);
    ctx.fillText(timeStr, marginX + clockSize + gap, currentY + (0.5 * vw));

    if (customName) {
      currentY -= (timeFontSize + 2.0 * vh);
      ctx.font = `bold ${nameFontSize}px sans-serif`;
      ctx.fillText(customName, marginX, currentY);
    }

    // Trigger download - Use 1.0 quality for best result
    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
    
    if (onCapture) {
      onCapture(dataUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col justify-between animate-in fade-in duration-300">
      <button 
        onClick={onClose} 
        className="absolute top-4 left-4 z-10 p-3 bg-black/40 rounded-full text-white hover:bg-black/60 transition"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-black/40 p-3 rounded-xl max-w-[200px]">
        <input 
          type="text" 
          placeholder="Tu Nombre (opcional)"
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          className="bg-transparent text-white border-b border-white/50 text-xs p-1 outline-none placeholder:text-white/70"
        />
        <div className="flex items-center gap-2 mt-1">
          <input 
            type="checkbox" 
            checked={useCustomTime} 
            onChange={e => setUseCustomTime(e.target.checked)} 
            className="w-3 h-3"
          />
          <span className="text-[10px] text-white">Usar hora manual</span>
        </div>
        {useCustomTime && (
          <input 
            type="time" 
            step="1"
            value={customTime}
            onChange={e => setCustomTime(e.target.value)}
            className="bg-transparent text-white border-b border-white/50 text-xs p-1 outline-none"
          />
        )}
      </div>

      <div className="flex-1 bg-black overflow-hidden flex flex-col items-center justify-center">
        <div className="relative w-full max-w-lg aspect-[3/4] bg-black overflow-hidden shadow-2xl flex items-center justify-center">
          {cameraError ? (
            <div className="text-center p-8 bg-gray-900 rounded-2xl border border-gray-700 max-w-xs mx-4 text-white">
              <div className="text-4xl mb-4">📷</div>
              <h3 className="font-bold text-lg mb-2 text-red-400">Error de cámara</h3>
              <p className="text-sm text-gray-300">
                No pudimos acceder a tu cámara. Por favor otorga los permisos necesarios en tu navegador y recarga la página.
              </p>
              <button 
                onClick={startCamera}
                className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          )}
          
          {/* Visual Watermark Overlay */}
          <div className="absolute bottom-[3%] left-[3%] right-[3%] text-white drop-shadow-md pointer-events-none">
            {customName && <div className="text-[3vw] sm:text-sm font-bold mb-[2%] drop-shadow-md">{customName}</div>}
            <div className="text-[6.5vw] sm:text-3xl font-bold mb-[1.5%] drop-shadow-lg flex items-center gap-[1.5vw] leading-none">
              <Clock className="w-[5.5vw] h-[5.5vw] sm:w-8 sm:h-8 drop-shadow-lg" />
              {timeStr}
            </div>
            <div className="text-[3vw] sm:text-sm drop-shadow-md flex items-center gap-[1.5vw] mb-[1%] font-semibold leading-tight">
              <CalendarDays className="w-[2.5vw] h-[2.5vw] sm:w-4 sm:h-4 drop-shadow-md" />
              {dateStr}
            </div>
            <div className="text-[2.6vw] sm:text-[11px] drop-shadow-md flex items-start gap-[1.5vw] font-semibold leading-tight pr-[5%]">
              <MapPin className="w-[2.5vw] h-[2.5vw] sm:w-4 sm:h-4 shrink-0 drop-shadow-md relative top-[0.1vw]" />
              <span>{address}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-32 shrink-0 bg-black flex justify-center items-center gap-12 pb-safe-offset-4">
        <div className="w-12 h-12" /> {/* Spacer */}
        <button 
          onClick={takePhoto}
          disabled={cameraError}
          className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center border-4 border-white hover:bg-white/50 transition-colors disabled:opacity-50"
        >
          <Circle className="w-16 h-16 text-white fill-white" />
        </button>
        <button 
          onClick={toggleCamera}
          className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition"
        >
          <SwitchCamera className="w-6 h-6" />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
