import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Check, RotateCcw } from 'lucide-react';
import { getCroppedImg } from '../utils/canvasUtils';

interface CropperProps {
  imageSrc: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
}

const Cropper: React.FC<CropperProps> = ({ imageSrc, onCropComplete, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const ASPECT_RATIO = 35 / 45; 
  const CROP_BOX_HEIGHT = 420; 
  const CROP_BOX_WIDTH = CROP_BOX_HEIGHT * ASPECT_RATIO;

  useEffect(() => {
    if (!imageRef.current || !containerRef.current) return;
    const img = imageRef.current;
    
    const setupAutoCrop = () => {
      const widthZoom = (CROP_BOX_WIDTH / img.naturalWidth) * 2.8;
      const heightZoom = (CROP_BOX_HEIGHT / img.naturalHeight) * 1.5;
      
      let finalZoom = Math.max(widthZoom, heightZoom);
      finalZoom = Math.min(finalZoom, 4.0);
      setZoom(finalZoom);

      const renderedHeight = img.naturalHeight * finalZoom;
      const initialY = - (renderedHeight * 0.18);
      setPosition({ x: 0, y: initialY });
    };

    if (img.complete) {
      setupAutoCrop();
    } else {
      img.onload = setupAutoCrop;
    }
  }, [imageSrc]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; 
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    setIsDragging(true);
    dragStartRef.current = { 
      x: e.clientX - position.x, 
      y: e.clientY - position.y 
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
  };

  const handleCrop = async () => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;
    
    const renderedWidth = img.naturalWidth * zoom;
    const renderedHeight = img.naturalHeight * zoom;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    
    const cropBoxLeft = (containerW - CROP_BOX_WIDTH) / 2;
    const cropBoxTop = (containerH - CROP_BOX_HEIGHT) / 2;

    const imgLeftInContainer = (containerW - renderedWidth) / 2 + position.x;
    const imgTopInContainer = (containerH - renderedHeight) / 2 + position.y;

    const offsetX = cropBoxLeft - imgLeftInContainer;
    const offsetY = cropBoxTop - imgTopInContainer;
    const scale = img.naturalWidth / renderedWidth;
    
    try {
      const cropped = await getCroppedImg(imageSrc, {
        x: offsetX * scale,
        y: offsetY * scale,
        width: CROP_BOX_WIDTH * scale,
        height: CROP_BOX_HEIGHT * scale,
      }, rotation);
      onCropComplete(cropped);
    } catch (e) {
      console.error(e);
      alert('Failed to crop');
    }
  };

  const handleQuickRotate = (deg: number) => {
    setRotation(prev => prev + deg);
  };

  const handleManualRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setRotation(val);
    } else if (e.target.value === '' || e.target.value === '-') {
      setRotation(0); 
    }
  };

  return (
    <div className="flex flex-col items-center w-full animate-fade-in select-none">
      <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch">
        {/* Left Side: Large Preview & Zoom */}
        <div className="flex-1 w-full flex flex-col gap-4">
          <div 
            className="relative w-full h-[520px] bg-slate-900 overflow-hidden rounded-2xl shadow-2xl border border-slate-800 cursor-move touch-none"
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Crop Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
               <div className="absolute inset-0 bg-black/70"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <div 
                    style={{ width: CROP_BOX_WIDTH, height: CROP_BOX_HEIGHT }} 
                    className="border-2 border-blue-400/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] z-20 pointer-events-none relative"
                 >
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
                      <div className="border-r border-white/50"></div>
                      <div className="border-r border-white/50"></div>
                      <div></div>
                      <div className="border-t border-white/50 col-span-3"></div>
                      <div className="border-t border-white/50 col-span-3"></div>
                    </div>
                    <div className="absolute top-[15%] left-[15%] right-[15%] bottom-[25%] border border-dashed border-white/20 rounded-[50%] pointer-events-none"></div>
                    <div className="absolute -top-8 left-0 right-0 flex justify-center">
                       <div className="bg-blue-600 text-white text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-lg">
                         Auto-Framing: India Standard
                       </div>
                    </div>
                 </div>
               </div>
            </div>

            {/* The Image */}
            <div className="flex items-center justify-center w-full h-full pointer-events-none">
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop target"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0.4, 1)',
                  willChange: 'transform'
                }}
                className="max-w-none pointer-events-none"
                draggable={false}
              />
            </div>
          </div>

          {/* Zoom Slider Below Preview */}
          <div className="w-full bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <ZoomIn size={12} /> Adjust Zoom
                </span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {Math.round(zoom * 100)}%
                </span>
            </div>
            <div className="flex items-center gap-4">
                <ZoomOut size={18} className="text-slate-400" />
                <input
                  type="range"
                  min="0.1"
                  max="4"
                  step="0.001"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-all hover:bg-slate-200"
                />
                <ZoomIn size={18} className="text-slate-400" />
            </div>
          </div>
        </div>

        {/* Right Side: Rotation Sidebar (Vertical Layout) */}
        <div className="w-full lg:w-48 bg-slate-950 text-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-6 shrink-0">
          <div className="flex flex-col items-center w-full">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Rotation</span>
            
            {/* Vertical Range Slider */}
            <div className="relative h-64 w-12 flex items-center justify-center mb-6">
              <input
                type="range"
                min="-90"
                max="90"
                step="1"
                value={((rotation + 90) % 180) - 90} // Normalized for -90 to 90 range display
                onChange={(e) => setRotation(parseInt(e.target.value))}
                className="w-64 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 absolute z-10 -rotate-90 origin-center"
              />
              
              {/* Scale Ticks */}
              <div className="absolute inset-y-0 right-0 flex flex-col justify-between py-1 pointer-events-none">
                 {[90, 45, 0, -45, -90].map(deg => (
                   <div key={deg} className="flex items-center gap-2">
                      <div className={`h-[1px] ${deg === 0 ? 'w-4 bg-blue-400' : 'w-2 bg-slate-700'}`}></div>
                      <span className={`text-[8px] font-bold ${deg === 0 ? 'text-blue-400' : 'text-slate-600'}`}>{deg}°</span>
                   </div>
                 ))}
              </div>
            </div>
            
            {/* Manual Text Input Field */}
            <div className="w-full flex flex-col items-center gap-3">
              <div className="relative group">
                <input 
                  type="number"
                  value={Math.round(rotation * 10) / 10}
                  onChange={handleManualRotationChange}
                  className="w-24 bg-slate-900 border border-slate-800 text-white text-center font-black text-xl py-2 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="absolute -right-4 top-1/2 -translate-y-1/2 text-blue-500 font-black text-lg">°</span>
              </div>
              
              <button 
                onClick={() => setRotation(0)}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-slate-800 text-slate-400 text-[10px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all w-full"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>

          <div className="w-full border-t border-slate-900 my-2"></div>

          {/* Quick Rotation Buttons */}
          <div className="flex flex-col gap-2 w-full">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 text-center mb-1">Quick Steps</span>
            <div className="grid grid-cols-2 gap-2">
              {[-180, -90, 90, 180].map(deg => (
                <button
                  key={deg}
                  onClick={() => handleQuickRotate(deg)}
                  className="py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-400 hover:text-blue-400 hover:border-blue-900 transition-all active:scale-95"
                >
                  {deg > 0 ? '+' : ''}{deg}°
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex gap-4 mt-8 pb-4">
        <button 
          onClick={onCancel}
          className="px-8 py-3 rounded-2xl border border-slate-300 text-slate-500 font-bold hover:bg-slate-100 transition-all active:scale-95"
        >
          Cancel
        </button>
        <button 
          onClick={handleCrop}
          className="flex items-center gap-2 px-12 py-3 rounded-2xl bg-blue-600 text-white font-black text-xl hover:bg-blue-700 shadow-2xl shadow-blue-600/20 transition-all active:scale-95 group"
        >
          <Check size={24} className="group-hover:scale-110 transition-transform" />
          Apply & Continue
        </button>
      </div>
    </div>
  );
};

export default Cropper;
