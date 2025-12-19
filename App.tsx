import React, { useState, useEffect, useRef } from 'react';
import ImageUploader from './components/ImageUploader';
import Cropper from './components/Cropper';
import AILoader from './components/AILoader';
import CurveAdjustment from './components/CurveAdjustment';
import { AppState, BackgroundColor, ClothingOption, CurveSettings } from './types';
import { processBackground } from './services/geminiService';
import { generatePassportSheet, applyCurves, createPreviewImage } from './utils/canvasUtils';
import { Download, RefreshCw, Wand2, ArrowLeft, AlertCircle, Shirt, User, Briefcase, Minus, LayoutGrid, Image as ImageIcon } from 'lucide-react';

const DEFAULT_CURVES: CurveSettings = {
  all: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
};

const App = () => {
  const [state, setState] = useState<AppState>(AppState.UPLOAD);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [gradedPreview, setGradedPreview] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [finalSheet, setFinalSheet] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<BackgroundColor>(BackgroundColor.WHITE);
  const [selectedClothing, setSelectedClothing] = useState<ClothingOption>(ClothingOption.NONE);
  const [curveSettings, setCurveSettings] = useState<CurveSettings>(DEFAULT_CURVES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUpdateTimeout = useRef<number | null>(null);

  const handleImageSelected = async (base64: string) => {
    setOriginalImage(base64);
    setError(null);
    setIsProcessing(true);
    try {
      const preview = await createPreviewImage(base64);
      setPreviewImage(preview);
      setState(AppState.CROP);
    } catch (err) {
      console.error("Preview creation failed:", err);
      setPreviewImage(base64);
      setState(AppState.CROP);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCropComplete = (cropped: string) => {
    setCroppedImage(cropped);
    setGradedPreview(cropped);
    setState(AppState.PROCESS);
  };

  // Live Preview Logic for Color Grading
  useEffect(() => {
    if (state !== AppState.PROCESS || !croppedImage) return;

    if (previewUpdateTimeout.current) {
      window.clearTimeout(previewUpdateTimeout.current);
    }

    previewUpdateTimeout.current = window.setTimeout(async () => {
      try {
        const graded = await applyCurves(croppedImage, curveSettings);
        setGradedPreview(graded);
      } catch (err) {
        console.error("Live preview failed:", err);
      }
    }, 50); // Small debounce for performance

    return () => {
      if (previewUpdateTimeout.current) window.clearTimeout(previewUpdateTimeout.current);
    };
  }, [curveSettings, croppedImage, state]);

  const handleProcess = async () => {
    if (!croppedImage) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      // 1. Apply Tone Curves first to get the "Enhanced" base (at full cropped quality)
      const enhancedImage = await applyCurves(croppedImage, curveSettings);
      
      let finalPhoto = enhancedImage;

      // 2. Process Background and Clothing with Gemini if needed
      const needsAI = selectedColor !== BackgroundColor.ORIGINAL || selectedClothing !== ClothingOption.NONE;
      
      if (needsAI) {
        finalPhoto = await processBackground(enhancedImage, selectedColor, selectedClothing);
      }
      
      setProcessedImage(finalPhoto);
      
      // 3. Generate Sheet
      const sheet = await generatePassportSheet(finalPhoto);
      setFinalSheet(sheet);
      
      setState(AppState.PREVIEW);
    } catch (err: any) {
        console.error("Processing error:", err);
        const errorMessage = err.message || "Unknown error";
        try {
            const fallbackPhoto = await applyCurves(croppedImage, curveSettings);
            const sheet = await generatePassportSheet(fallbackPhoto);
            setFinalSheet(sheet);
            setProcessedImage(fallbackPhoto);
            setState(AppState.PREVIEW);
            setError(`AI enhancement failed: ${errorMessage}. Colored photo used.`);
        } catch (innerErr) {
             setError(`Total failure: ${errorMessage}`);
        }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!finalSheet) return;
    const link = document.createElement('a');
    link.href = finalSheet;
    link.download = `passport-photo-sheet-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setState(AppState.UPLOAD);
    setOriginalImage(null);
    setPreviewImage(null);
    setCroppedImage(null);
    setGradedPreview(null);
    setProcessedImage(null);
    setFinalSheet(null);
    setError(null);
    setSelectedClothing(ClothingOption.NONE);
    setCurveSettings(DEFAULT_CURVES);
    setSelectedColor(BackgroundColor.WHITE);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {isProcessing && <AILoader />}

      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://lh3.googleusercontent.com/pw/AP1GczPsT7Kbwl2D3Man0MhE2xxg0egIVMoXN_x-ctR_VS2d6C66XWq-3dkbGU4PmTjxOb5zjUlSuQ5gEhv9QwQ1U1QQofMIuLrD3rsDOygXOUWQ1qVdj6CHukP-gDkY2qdXsU5l_5yF157GHU2Z6UHZRRF2EQ=w1217-h386-s-no?authuser=0" 
              alt="Art Centre" 
              className="h-10 w-auto object-contain"
            />
          </div>
          {state !== AppState.UPLOAD && (
            <button 
              onClick={handleReset}
              className="text-sm text-slate-500 hover:text-red-600 font-medium flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={14} /> Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3 animate-fade-in">
                <AlertCircle size={20} className="flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
            </div>
        )}

        {state === AppState.UPLOAD && (
          <div className="max-w-2xl mx-auto mt-12 animate-fade-in-up">
             <div className="text-center mb-10">
                <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Passport Photo AI</h2>
                <p className="text-lg text-slate-600 font-medium">
                  Professional 35x45mm photos with real-time color grading.
                </p>
             </div>
             <ImageUploader onImageSelected={handleImageSelected} />
          </div>
        )}

        {state === AppState.CROP && previewImage && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-6 flex items-center justify-between px-2">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">1. Frame Face</h2>
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                 <LayoutGrid size={14} /> 35mm x 45mm
              </div>
            </div>
            <Cropper 
              imageSrc={previewImage} 
              onCropComplete={handleCropComplete} 
              onCancel={handleReset} 
            />
          </div>
        )}

        {state === AppState.PROCESS && croppedImage && (
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 items-start animate-fade-in pb-20">
             <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
               <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-3 pt-2">Live Preview</h3>
                  <div className="relative aspect-[35/45] bg-slate-100 rounded-xl overflow-hidden">
                    <img src={gradedPreview || croppedImage} alt="Crop" className="w-full h-full object-cover" />
                  </div>
               </div>
               
               <CurveAdjustment 
                  settings={curveSettings} 
                  onChange={setCurveSettings} 
                  imageSrc={croppedImage}
               />

               <button onClick={() => setState(AppState.CROP)} className="text-slate-400 text-[10px] font-black hover:text-blue-600 uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all py-2 border border-dashed border-slate-200 rounded-xl hover:border-blue-200">
                 <ArrowLeft size={10} /> Re-adjust Crop Area
               </button>
             </div>

             <div className="flex-1 bg-white p-8 lg:p-12 rounded-[2.5rem] shadow-2xl border border-slate-200/60 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <ImageIcon size={120} />
               </div>

               <h2 className="text-3xl font-black text-slate-900 mb-10 tracking-tight">2. Finishing Touches</h2>
               
               <div className="mb-12">
                 <label className="block text-xs font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">Background Color</label>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <button
                     onClick={() => setSelectedColor(BackgroundColor.WHITE)}
                     className={`flex p-5 rounded-2xl border-2 items-center justify-center gap-3 transition-all ${selectedColor === BackgroundColor.WHITE ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-600/10' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                   >
                     <div className="w-6 h-6 rounded-full border border-slate-300 bg-white shadow-inner"></div>
                     <span className="font-black text-slate-700">Pure White</span>
                   </button>
                   
                   <button
                     onClick={() => setSelectedColor(BackgroundColor.BLUE)}
                     className={`flex p-5 rounded-2xl border-2 items-center justify-center gap-3 transition-all ${selectedColor === BackgroundColor.BLUE ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-600/10' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                   >
                     <div className="w-6 h-6 rounded-full border border-slate-300 bg-[#4b9cd3] shadow-inner"></div>
                     <span className="font-black text-slate-700">Sky Blue</span>
                   </button>

                   <button
                     onClick={() => setSelectedColor(BackgroundColor.ORIGINAL)}
                     className={`flex p-5 rounded-2xl border-2 items-center justify-center gap-3 transition-all ${selectedColor === BackgroundColor.ORIGINAL ? 'border-slate-800 bg-slate-900 text-white shadow-xl' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                   >
                     <Minus size={20} className={selectedColor === BackgroundColor.ORIGINAL ? "text-blue-400" : "text-slate-400"} />
                     <span className="font-black">Don't Change</span>
                   </button>
                 </div>
               </div>

               <div className="mb-14">
                  <label className="block text-xs font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">Clothing & Outfit</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {(Object.keys(ClothingOption) as Array<keyof typeof ClothingOption>).map(key => (
                        <button
                          key={key}
                          onClick={() => setSelectedClothing(ClothingOption[key])}
                          className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${selectedClothing === ClothingOption[key] ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-600/10' : 'border-slate-50 hover:border-slate-100'}`}
                        >
                           {key === 'NONE' ? <User size={28} className="text-slate-400" /> : key.includes('BLAZER') ? <Briefcase size={28} className="text-slate-400" /> : <Shirt size={28} className="text-slate-400" />}
                           <span className="text-[10px] font-black text-center leading-tight uppercase text-slate-500">{ClothingOption[key]}</span>
                        </button>
                      ))}
                  </div>
               </div>

               <div className="pt-10 border-t border-slate-100">
                 <button
                   onClick={handleProcess}
                   disabled={isProcessing}
                   className="w-full py-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-[2rem] font-black text-2xl shadow-2xl shadow-blue-600/30 transition-all flex items-center justify-center gap-4 group active:scale-[0.98]"
                 >
                   <Wand2 size={28} className="group-hover:rotate-12 transition-transform" />
                   Generate Print Sheet
                 </button>
                 <p className="text-center text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">Powered by Gemini Vision AI</p>
               </div>
             </div>
          </div>
        )}

        {state === AppState.PREVIEW && finalSheet && (
           <div className="max-w-4xl mx-auto animate-fade-in pb-20">
             <div className="flex items-center justify-between mb-8 px-4">
               <h2 className="text-4xl font-black text-slate-900 tracking-tight">Print Ready</h2>
               <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Success
               </div>
             </div>

             <div className="bg-slate-200 p-8 rounded-[3rem] flex justify-center shadow-inner border border-slate-300">
                <img src={finalSheet} alt="Final Sheet" className="max-w-full h-auto shadow-2xl bg-white ring-1 ring-black/5 rounded-sm" />
             </div>

             <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <LayoutGrid size={80} />
                    </div>
                    <h4 className="text-xl font-black mb-6 flex items-center gap-3">
                        <LayoutGrid size={24} className="text-blue-400" /> Printing Specs
                    </h4>
                    <ul className="text-sm text-slate-400 space-y-4 font-medium">
                        <li className="flex gap-4"><b className="text-white">Paper:</b> 4" x 6" Photo Paper</li>
                        <li className="flex gap-4"><b className="text-white">Scale:</b> Set to 100% (Actual Size)</li>
                        <li className="flex gap-4"><b className="text-white">Layout:</b> 8 Photos (35x45mm each)</li>
                    </ul>
                </div>
                
                <button 
                  onClick={handleDownload} 
                  className="flex flex-col items-center justify-center gap-4 p-8 bg-blue-600 hover:bg-blue-700 text-white rounded-[2.5rem] font-black text-2xl shadow-2xl shadow-blue-600/40 transition-all hover:scale-[1.02] active:scale-95 group"
                >
                   <Download size={48} className="group-hover:translate-y-1 transition-transform" />
                   Save PNG Image
                </button>
             </div>
           </div>
        )}
      </main>
    </div>
  );
};

export default App;
