import React, { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Loader2, ImagePlus, X, Eye, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { processLogisticsData, ProcessingResult } from '../lib/gemini';
import { toast } from 'sonner';
import localforage from 'localforage';

interface InputViewProps {
  onProcessed: (result: ProcessingResult) => void;
  existingRouteInfo?: ProcessingResult | null;
  onClearRoute?: () => void;
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200; // Resolución equilibrada para velocidad y lectura de texto
        
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85)); // Menos calidad = menos peso
      };
      img.onerror = () => reject('Image load error');
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject('File read error');
    reader.readAsDataURL(file);
  });
};

export function InputView({ onProcessed, existingRouteInfo, onClearRoute }: InputViewProps) {
  // Store base64 data strings now instead of File objects to easily persist
  const [images, setImages] = useState<{ id: string, dataUrl: string }[]>([]);
  const [financialText, setFinancialText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showMismatchModal, setShowMismatchModal] = useState(false);
  const [mismatchData, setMismatchData] = useState<{
    capturedFolios: { folio: string; client: string }[];
    financialFolios: string[];
    missingInFinance: string[];
    missingInCaptures: string[];
  } | null>(null);

  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedImages = await localforage.getItem<{ id: string, dataUrl: string }[]>('logiruta_images');
        const savedText = await localforage.getItem<string>('logiruta_text');
        if (savedImages) setImages(savedImages);
        if (savedText) setFinancialText(savedText);
      } catch (e) {
        console.error('Error loading saved data:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSavedData();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localforage.setItem('logiruta_images', images).catch(console.error);
      localforage.setItem('logiruta_text', financialText).catch(console.error);
    }
  }, [images, financialText, isLoaded]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const toastId = toast.loading('Procesando imágenes...');
      try {
        const newImages = await Promise.all(
          Array.from(e.target.files).map(async (file: any) => {
            const dataUrl = await compressImage(file);
            return { id: crypto.randomUUID(), dataUrl };
          })
        );
        setImages(prev => [...prev, ...newImages]);
        onClearRoute?.();
        toast.success('Imágenes añadidas', { id: toastId });
      } catch (error) {
        toast.error('Error procesando imágenes', { id: toastId });
        console.error(error);
      }
      // Clear input so same files can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    onClearRoute?.();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFinancialText(e.target.value);
    onClearRoute?.();
  };

  const handleProcess = async () => {
    if (existingRouteInfo) {
      onProcessed(existingRouteInfo);
      return;
    }

    if (images.length === 0) {
      toast.error('Por favor sube al menos una imagen de orden.');
      return;
    }
    
    setIsProcessing(true);
    let loadingToast = toast.loading('Extrayendo datos de capturas...');
    
    try {
      const base64Images = images.map(img => ({
        mimeType: 'image/jpeg',
        data: img.dataUrl.split(',')[1] // Strip "data:image/jpeg;base64," prefix for API
      }));

      const result = await processLogisticsData(base64Images, financialText);
      
      // Strict last-4 digit folio validation
      const capturedFolios: {folio: string, client: string, last4: string}[] = [];
      (result.orders || []).forEach((o: any) => {
        const parts = String(o.orderNumber).split(/[,\s&]+/);
        parts.forEach(p => {
          const numMatch = p.match(/\d+/g);
          if (numMatch) {
            const numOnly = numMatch.join('');
            if (numOnly.length >= 4) {
              capturedFolios.push({
                folio: p,
                client: o.clientName || 'Desconocido',
                last4: numOnly.slice(-4)
              });
            }
          }
        });
      });

      const financialLines: string[] = [];
      const financialFolios: string[] = [];
      financialText.split('\n').forEach((line: string) => {
        if (!line.trim()) return;
        financialLines.push(line.trim());
        // Extraemos solo el primer número de 4 dígitos como folio financiero válido
        const folioMatch = line.match(/\d{4}/);
        if (folioMatch) {
          financialFolios.push(folioMatch[0]);
        }
      });

      const missingFin = capturedFolios.filter(c => !financialFolios.includes(c.last4)).map(c => `${c.folio} (..${c.last4})`);
      const missingCap = financialFolios.filter(f => !capturedFolios.some(c => c.last4 === f));

      if (missingFin.length > 0 || missingCap.length > 0) {
        toast.dismiss(loadingToast);
        setMismatchData({
          capturedFolios: capturedFolios,
          financialFolios: financialLines, // Display all lines that were parsed
          missingInFinance: missingFin,
          missingInCaptures: missingCap
        });
        setShowMismatchModal(true);
        toast.error("Advertencia: Conflictos de folios detectados.");
        return;
      }

      toast.dismiss(loadingToast);
      toast.success('¡Ruta generada y optimizada con éxito!');
      onProcessed(result);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      const errorMessage = error.message || '';
      console.error(error);
      
      if (
        errorMessage.includes("API key expired") ||
        errorMessage.includes("API_KEY_INVALID") ||
        errorMessage.includes("La clave API de Google AI Studio") ||
        errorMessage.includes("vencida") ||
        errorMessage.includes("expirado") ||
        errorMessage.includes("inválida")
      ) {
        toast((t) => (
          <div className="flex flex-col gap-2 p-1.5 text-left max-w-xs">
            <span className="font-bold text-red-600 dark:text-red-400 text-sm">Error de clave API de Gemini</span>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              La clave de la plataforma ha vencido o es inválida. ¿Deseas usar una ruta de simulación totalmente funcional para evaluar el resto del sistema, o agregar tu propia clave?
            </span>
            <div className="flex gap-2.5 mt-2">
              <button 
                onClick={() => {
                  toast.dismiss(t.id);
                }} 
                className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        ), { duration: 12000, id: 'gemini-key-expired-toast' });
      } else {
        toast.error('Hubo un error procesando los datos. ' + errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-500" />
          1. Capturas de Pedidos
        </h2>
        <div className="mb-4">
          <input
            type="file"
            multiple
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImageChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 gap-2"
          >
            <ImagePlus className="w-8 h-8" />
            <span className="font-medium">Haz clic para subir o toma fotos</span>
          </button>
        </div>

        {images.length > 0 && (
          <div className="flex flex-col gap-2 mt-4 max-h-48 overflow-y-auto">
            {images.map((img, index) => (
              <div key={img.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Captura {index + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedImage(img.dataUrl)}
                    className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => removeImage(img.id)}
                    className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={selectedImage} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-500" />
          2. Datos Financieros
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Pega el texto con los métodos de pago, montos y TR. (Ej. 0452/$1445.50/tdc4876)
        </p>
        
        <textarea
          value={financialText}
          onChange={handleTextChange}
          placeholder="0452/$1445.50/tdc4876&#10;0072/$1415/tdc4904..."
          className="w-full h-40 p-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-gray-700 dark:text-gray-200 font-mono text-sm leading-relaxed"
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => {
            setImages([]);
            setFinancialText('');
            localforage.removeItem('logiruta_images');
            localforage.removeItem('logiruta_text');
            onClearRoute?.();
          }}
          disabled={isProcessing || (images.length === 0 && financialText === '')}
          className="px-5 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-900 text-gray-700 dark:text-gray-300 dark:disabled:text-gray-600 rounded-xl font-semibold text-base transition-all"
        >
          Limpiar
        </button>
        <button
          onClick={handleProcess}
          disabled={isProcessing || images.length === 0 || !financialText.trim()}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-base shadow-md transition-all flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Procesando...
            </>
          ) : (
            'Siguiente'
          )}
        </button>
      </div>


      {/* Mismatch Warning Modal */}
      {showMismatchModal && mismatchData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-red-50 dark:bg-red-950/10">
              <h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                Error: Folios No Coinciden
              </h3>
              <button 
                onClick={() => setShowMismatchModal(false)} 
                className="p-1 px-2.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                No se puede proceder con la generación de la ruta porque los folios de las capturas de pantalla no coinciden con los folios de los datos financieros.
              </p>
              
              <div className="space-y-3.5 pt-2">
                <div className="bg-red-50/50 dark:bg-red-950/5 p-3 rounded-xl border border-red-100 dark:border-red-900/40">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Resumen de Análisis</h4>
                  <ul className="text-xs space-y-2 text-gray-600 dark:text-gray-400">
                    {mismatchData.missingInFinance.length > 0 && (
                      <li className="flex items-start gap-1">
                        <span className="text-red-500 font-bold shrink-0">•</span>
                        <span>Capturas con folios <strong className="text-red-600 dark:text-red-400">({mismatchData.missingInFinance.join(', ')})</strong> no tienen renglón financiero correspondiente.</span>
                      </li>
                    )}
                    {mismatchData.missingInCaptures.length > 0 && (
                      <li className="flex items-start gap-1">
                        <span className="text-red-500 font-bold shrink-0">•</span>
                        <span>Líneas financieras con folios <strong className="text-red-600 dark:text-red-400">({mismatchData.missingInCaptures.join(', ')})</strong> no coinciden con ninguna captura subida.</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                    <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Capturas ({mismatchData.capturedFolios.length})</h5>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-xs">
                      {mismatchData.capturedFolios.map((c, i) => (
                        <div key={i} className={`p-1.5 rounded ${mismatchData.missingInFinance.includes(c.folio) ? "bg-red-100/50 text-red-800 dark:bg-red-950/25 dark:text-red-400 font-bold" : "text-gray-700 dark:text-gray-300"}`}>
                          #{c.folio} - {c.client.slice(0, 10)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                    <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Financiero ({mismatchData.financialFolios.length})</h5>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-xs">
                      {mismatchData.financialFolios.map((f, i) => (
                        <div key={i} className={`p-1.5 rounded ${mismatchData.missingInCaptures.includes(f) ? "bg-red-100/50 text-red-800 dark:bg-red-950/25 dark:text-red-400 font-bold" : "text-gray-700 dark:text-gray-300"}`}>
                          #{f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 flex justify-end">
              <button 
                onClick={() => setShowMismatchModal(false)}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-md focus:outline-none"
              >
                Corregir mis datos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
