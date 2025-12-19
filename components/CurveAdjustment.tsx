import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Point, CurveSettings } from '../types';
import { calculateHistogram } from '../utils/canvasUtils';
import { Undo2, Redo2 } from 'lucide-react';

interface CurveAdjustmentProps {
  settings: CurveSettings;
  onChange: (settings: CurveSettings) => void;
  imageSrc?: string | null;
}

const CurveAdjustment: React.FC<CurveAdjustmentProps> = ({ settings, onChange, imageSrc }) => {
  const [activeChannel, setActiveChannel] = useState<'all' | 'red' | 'green' | 'blue'>('all');
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [draggingPoint, setDraggingPoint] = useState<number | null>(null);
  const [histogram, setHistogram] = useState<number[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // History State
  const [history, setHistory] = useState<CurveSettings[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const points = useMemo(() => settings[activeChannel], [settings, activeChannel]);

  // Initial history push
  useEffect(() => {
    if (history.length === 0) {
      setHistory([JSON.parse(JSON.stringify(settings))]);
      setHistoryIndex(0);
    }
  }, []);

  const addToHistory = useCallback((newSettings: CurveSettings) => {
    // Only add to history if different from current
    const current = history[historyIndex];
    if (JSON.stringify(current) === JSON.stringify(newSettings)) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newSettings)));
    
    // Limit history size to 50
    if (newHistory.length > 50) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onChange(JSON.parse(JSON.stringify(prev)));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onChange(JSON.parse(JSON.stringify(next)));
    }
  };

  // Compute histogram once per image
  useEffect(() => {
    if (imageSrc) {
      calculateHistogram(imageSrc).then(setHistogram).catch(console.error);
    }
  }, [imageSrc]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (hoveredPoint !== null) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const scaleX = 255 / rect.width;
    const scaleY = 255 / rect.height;
    
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round(255 - (e.clientY - rect.top) * scaleY);

    const newPoints = [...points, { x, y }].sort((a, b) => a.x - b.x);
    const newSettings = { ...settings, [activeChannel]: newPoints };
    onChange(newSettings);
    addToHistory(newSettings);
  };

  const handleMouseDown = (index: number) => {
    setDraggingPoint(index);
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (draggingPoint === null || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = 255 / rect.width;
      const scaleY = 255 / rect.height;

      const x = Math.max(0, Math.min(255, Math.round((e.clientX - rect.left) * scaleX)));
      const y = Math.max(0, Math.min(255, Math.round(255 - (e.clientY - rect.top) * scaleY)));

      const newPoints = [...points];
      if (draggingPoint !== 0 && draggingPoint !== points.length - 1) {
        newPoints[draggingPoint] = { x, y };
      } else {
        newPoints[draggingPoint] = { ...newPoints[draggingPoint], y };
      }
      
      const sorted = newPoints.sort((a, b) => a.x - b.x);
      onChange({ ...settings, [activeChannel]: sorted });
    };

    const handleGlobalUp = () => {
      if (draggingPoint !== null) {
        addToHistory(settings);
      }
      setDraggingPoint(null);
    };

    if (draggingPoint !== null) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [draggingPoint, points, activeChannel, settings, onChange, addToHistory]);

  const removePoint = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (index === 0 || index === points.length - 1) return;
    const newPoints = points.filter((_, i) => i !== index);
    const newSettings = { ...settings, [activeChannel]: newPoints };
    onChange(newSettings);
    addToHistory(newSettings);
  };

  const channelColors = {
    all: '#ffffff',
    red: '#ff4d4d',
    green: '#4dff88',
    blue: '#4d94ff',
  };

  const activePoint = draggingPoint !== null ? points[draggingPoint] : hoveredPoint !== null ? points[hoveredPoint] : null;

  return (
    <div className="bg-[#1a1a1c] p-4 rounded-xl border border-[#333] shadow-2xl w-full select-none">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tone Curve</span>
          <div className="flex gap-1 border-l border-[#333] pl-3">
             <button 
                onClick={undo} 
                disabled={historyIndex <= 0}
                className="p-1 hover:bg-white/5 rounded transition-colors disabled:opacity-20"
                title="Undo"
             >
               <Undo2 size={14} className="text-white" />
             </button>
             <button 
                onClick={redo} 
                disabled={historyIndex >= history.length - 1}
                className="p-1 hover:bg-white/5 rounded transition-colors disabled:opacity-20"
                title="Redo"
             >
               <Redo2 size={14} className="text-white" />
             </button>
          </div>
        </div>
        <div className="flex gap-1.5">
          {(['all', 'red', 'green', 'blue'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setActiveChannel(ch)}
              className={`w-4 h-4 rounded-full border transition-all ${
                activeChannel === ch 
                ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.3)]' 
                : 'border-transparent opacity-40 hover:opacity-100'
              }`}
              style={{ backgroundColor: ch === 'all' ? '#444' : channelColors[ch] }}
              title={ch.toUpperCase()}
            />
          ))}
        </div>
      </div>

      <div className="relative aspect-square w-full bg-[#111] rounded border border-[#2a2a2a] cursor-crosshair overflow-hidden">
        {histogram && (
          <div className="absolute inset-0 flex items-end opacity-20 pointer-events-none px-[1px]">
            {histogram.map((v, i) => (
              <div 
                key={i} 
                style={{ height: `${v * 100}%`, width: `${100/256}%`, backgroundColor: '#fff' }} 
              />
            ))}
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none">
            <svg className="w-full h-full">
                <line x1="0" y1="100%" x2="100%" y2="0" stroke="#333" strokeWidth="1" strokeDasharray="4" />
            </svg>
        </div>

        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-[0.05] pointer-events-none">
          {Array(16).fill(0).map((_, i) => <div key={i} className="border border-white"></div>)}
        </div>

        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          viewBox="0 0 255 255"
          preserveAspectRatio="none"
        >
          <polyline
            points={points.map(p => `${p.x},${255 - p.y}`).join(' ')}
            fill="none"
            stroke={channelColors[activeChannel]}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]"
          />
        </svg>

        <canvas
          ref={canvasRef}
          width={255}
          height={255}
          onClick={handleCanvasClick}
          className="absolute inset-0 w-full h-full"
        />

        {points.map((p, i) => (
          <div
            key={i}
            onMouseEnter={() => setHoveredPoint(i)}
            onMouseLeave={() => setHoveredPoint(null)}
            onMouseDown={() => handleMouseDown(i)}
            onDoubleClick={(e) => removePoint(e, i)}
            style={{
              left: `${(p.x / 255) * 100}%`,
              bottom: `${(p.y / 255) * 100}%`,
              backgroundColor: hoveredPoint === i || draggingPoint === i ? '#fff' : channelColors[activeChannel],
              transform: 'translate(-50%, 50%)',
            }}
            className={`absolute w-3.5 h-3.5 rounded-full border-[3px] border-[#111] cursor-grab active:cursor-grabbing z-30 transition-transform ${
              hoveredPoint === i || draggingPoint === i ? 'scale-125' : ''
            }`}
          />
        ))}
      </div>
      
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black tracking-widest">
            <div className="flex gap-4">
                <div className="flex flex-col">
                    <span>Input</span>
                    <span className="text-white text-xs font-mono">{activePoint ? activePoint.x : '---'}</span>
                </div>
                <div className="flex flex-col">
                    <span>Output</span>
                    <span className="text-white text-xs font-mono">{activePoint ? activePoint.y : '---'}</span>
                </div>
            </div>
            <div className="flex flex-col items-end">
                <span className="opacity-40">Double-click point to remove</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CurveAdjustment;