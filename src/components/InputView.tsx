import React, { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Loader2, ImagePlus, X, Eye, FileText, Image as ImageIcon, AlertCircle, Plus } from 'lucide-react';
import { processLogisticsData, ProcessingResult } from '../lib/gemini';
import { toast } from 'sonner';
import localforage from 'localforage';

interface InputViewProps {
  onProcessed: (result: ProcessingResult) => void;
  existingRouteInfo?: ProcessingResult | null;
  onClearRoute?: () => void;
}

interface ImageRow {
  id: string;
  orderImage: string | null;     // '1ra Captura' base64
  financialImage: string | null; // '2da Captura' base64
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

  // New trip mode state variables
  const [mode, setMode] = useState<'manual' | 'image' | null>(null);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [imageRows, setImageRows] = useState<ImageRow[]>([
    { id: crypto.randomUUID(), orderImage: null, financialImage: null }
  ]);
  const [activeUpload, setActiveUpload] = useState<{ rowIndex: number, type: 'order' | 'finance' } | null>(null);

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

        const savedMode = localStorage.getItem('logiruta_input_mode') as 'manual' | 'image' | null;
        if (savedMode) setMode(savedMode);

        const savedRows = await localforage.getItem<ImageRow[]>('logiruta_image_rows');
        if (savedRows && savedRows.length > 0) {
          setImageRows(savedRows);
        } else {
          setImageRows([{ id: crypto.randomUUID(), orderImage: null, financialImage: null }]);
        }
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

      if (mode) {
        localStorage.setItem('logiruta_input_mode', mode);
      } else {
        localStorage.removeItem('logiruta_input_mode');
      }

      if (mode === 'image') {
        localforage.setItem('logiruta_image_rows', imageRows).catch(console.error);
      } else {
        localforage.removeItem('logiruta_image_rows').catch(console.error);
      }
    }
  }, [images, financialText, mode, imageRows, isLoaded]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (mode === 'image' && activeUpload) {
        const file = e.target.files[0];
        const toastId = toast.loading('Procesando imagen...');
        try {
          const dataUrl = await compressImage(file);
          const { rowIndex, type } = activeUpload;
          setImageRows(prev => {
            const copy = [...prev];
            if (type === 'order') {
              copy[rowIndex] = { ...copy[rowIndex], orderImage: dataUrl };
            } else {
              copy[rowIndex] = { ...copy[rowIndex], financialImage: dataUrl };
            }
            return copy;
          });
          onClearRoute?.();
          toast.success('Imagen capturada con éxito', { id: toastId });
        } catch (error) {
          toast.error('Error procesando imagen', { id: toastId });
          console.error(error);
        } finally {
          setActiveUpload(null);
        }
      } else {
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

  const handleAddRow = () => {
    setImageRows(prev => [...prev, { id: crypto.randomUUID(), orderImage: null, financialImage: null }]);
  };

  const handleRemoveRow = (id: string) => {
    if (imageRows.length === 1) return;
    setImageRows(prev => prev.filter(row => row.id !== id));
  };

  const handleClearSlot = (rowIndex: number, type: 'order' | 'finance') => {
    setImageRows(prev => {
      const copy = [...prev];
      if (type === 'order') {
        copy[rowIndex] = { ...copy[rowIndex], orderImage: null };
      } else {
        copy[rowIndex] = { ...copy[rowIndex], financialImage: null };
      }
      return copy;
    });
    onClearRoute?.();
  };

  const handleTriggerUpload = (rowIndex: number, type: 'order' | 'finance') => {
    setActiveUpload({ rowIndex, type });
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleProcessImageMode = async () => {
    const incompleteRow = imageRows.some(row => !row.orderImage || !row.financialImage);
    if (incompleteRow) {
      toast.error("Por favor completa las capturas para todos los pedidos agregados.");
      return;
    }

    setIsProcessing(true);
    let loadingToast = toast.loading('Procesando capturas y asociando datos financieros...');

    try {
      const flatImages: { mimeType: string, data: string }[] = [];
      imageRows.forEach(row => {
        flatImages.push({
          mimeType: 'image/jpeg',
          data: row.orderImage!.split(',')[1]
        });
        flatImages.push({
          mimeType: 'image/jpeg',
          data: row.financialImage!.split(',')[1]
        });
      });

      const result = await processLogisticsData(flatImages, '', true);

      toast.dismiss(loadingToast);
      toast.success('¡Ruta generada y optimizada con éxito!');
      onProcessed(result);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      const errorMessage = error.message || '';
      console.error(error);
      toast.error('Hubo un error al procesar las imágenes. ' + errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Starting State: Select Mode */}
      {mode === null ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 space-y-6 text-center max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm mt-4">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-md">
            <ImageIcon className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Ingreso de Viaje</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Para iniciar un nuevo viaje de reparto, selecciona el método para ingresar la información financiera.
            </p>
          </div>
          <button
            onClick={() => setShowSelectionModal(true)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer transition-all flex items-center justify-center gap-2"
          >
            Iniciar nuevo viaje
          </button>
        </div>
      ) : mode === 'manual' ? (
        // Manual mode flow (original upload captures + financial text)
        <div className="space-y-8">

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
                className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 gap-2 cursor-pointer"
              >
                <ImagePlus className="w-8 h-8" />
                <span className="font-medium text-xs">Haz clic para subir o toma fotos de pedidos</span>
              </button>
            </div>

            {images.length > 0 && (
              <div className="flex flex-col gap-2 mt-4 max-h-48 overflow-y-auto">
                {images.map((img, index) => (
                  <div key={img.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Captura {index + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedImage(img.dataUrl)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => removeImage(img.id)}
                        className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              className="px-5 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-900 text-gray-700 dark:text-gray-300 dark:disabled:text-gray-600 rounded-xl font-semibold text-base transition-all cursor-pointer"
            >
              Limpiar
            </button>
            <button
              onClick={handleProcess}
              disabled={isProcessing || images.length === 0 || !financialText.trim()}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
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

          <div className="flex justify-center pt-2">
            <button
              onClick={() => {
                setMode(null);
                setImages([]);
                setFinancialText('');
                localStorage.removeItem('logiruta_input_mode');
                localforage.removeItem('logiruta_images');
                localforage.removeItem('logiruta_text');
                onClearRoute?.();
              }}
              className="text-xs font-bold text-blue-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              ← Cambiar de modo
            </button>
          </div>
        </div>
      ) : (
        // Image mode flow (New! Double capture pair layout per order)
        <div className="space-y-6">

          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800 dark:text-white">Capturas por Pedido</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sube la captura de datos (1) y la captura financiera (2) para cada pedido. Gemini extraerá y relacionará automáticamente los montos y TR según el tipo de pago.
              </p>
            </div>

            {/* Hidden Single Reusable File Input */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImageChange}
            />

            <div className="space-y-4">
              {imageRows.map((row, idx) => (
                <div key={row.id} className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-2xl">
                  <div className="flex items-center justify-between w-full sm:w-auto gap-2 shrink-0">
                    <span className="text-sm font-bold text-gray-700 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl shadow-xs">
                      Pedido {idx + 1}
                    </span>
                    {imageRows.length > 1 && (
                      <button
                        onClick={() => handleRemoveRow(row.id)}
                        className="sm:hidden p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 flex-1 w-full">
                    {/* Slot 1: Pedido Capture */}
                    <div className="relative">
                      {row.orderImage ? (
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 flex flex-col justify-between p-2">
                          <img src={row.orderImage} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                          <div className="relative z-10 flex justify-between items-start w-full">
                            <span className="text-[10px] bg-green-500 text-white font-bold px-1.5 py-0.5 rounded-full shadow-sm">Pedido listo</span>
                            <button
                              onClick={() => handleClearSlot(idx, 'order')}
                              className="p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-sm cursor-pointer"
                              title="Eliminar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => setSelectedImage(row.orderImage!)}
                            className="relative z-10 w-full py-1 text-center bg-black/60 hover:bg-black/80 rounded-md text-[10px] font-bold text-white uppercase backdrop-blur-xs tracking-wider cursor-pointer"
                          >
                            Ver grande
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleTriggerUpload(idx, 'order')}
                          className="w-full aspect-[4/3] border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-xl flex flex-col items-center justify-center text-gray-500 gap-1.5 p-2 cursor-pointer"
                        >
                          <ImagePlus className="w-5 h-5 text-gray-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-center">1. Captura Pedido</span>
                        </button>
                      )}
                    </div>

                    {/* Slot 2: Financial Capture */}
                    <div className="relative">
                      {row.financialImage ? (
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 flex flex-col justify-between p-2">
                          <img src={row.financialImage} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                          <div className="relative z-10 flex justify-between items-start w-full">
                            <span className="text-[10px] bg-sky-500 text-white font-bold px-1.5 py-0.5 rounded-full shadow-sm">Método listo</span>
                            <button
                              onClick={() => handleClearSlot(idx, 'finance')}
                              className="p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-sm cursor-pointer"
                              title="Eliminar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => setSelectedImage(row.financialImage!)}
                            className="relative z-10 w-full py-1 text-center bg-black/60 hover:bg-black/80 rounded-md text-[10px] font-bold text-white uppercase backdrop-blur-xs tracking-wider cursor-pointer"
                          >
                            Ver grande
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleTriggerUpload(idx, 'finance')}
                          className="w-full aspect-[4/3] border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-xl flex flex-col items-center justify-center text-gray-500 gap-1.5 p-2 cursor-pointer"
                        >
                          <ImagePlus className="w-5 h-5 text-gray-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-center">2. Captura Método</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {imageRows.length > 1 && (
                    <button
                      onClick={() => handleRemoveRow(row.id)}
                      className="hidden sm:block p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all self-center shrink-0 cursor-pointer"
                      title="Eliminar Pedido"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleAddRow}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 text-gray-600 dark:text-gray-300 hover:text-blue-500 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Agregar siguiente pedido
            </button>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                setImageRows([{ id: crypto.randomUUID(), orderImage: null, financialImage: null }]);
                localforage.removeItem('logiruta_image_rows');
                onClearRoute?.();
              }}
              disabled={isProcessing || !imageRows.some(row => row.orderImage || row.financialImage)}
              className="px-5 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-900 text-gray-700 dark:text-gray-300 dark:disabled:text-gray-600 rounded-xl font-semibold text-base transition-all cursor-pointer"
            >
              Limpiar
            </button>
            <button
              onClick={handleProcessImageMode}
              disabled={isProcessing || imageRows.some(row => !row.orderImage || !row.financialImage)}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Procesar fotos de viaje'
              )}
            </button>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={() => {
                setMode(null);
                setImageRows([{ id: crypto.randomUUID(), orderImage: null, financialImage: null }]);
                localStorage.removeItem('logiruta_input_mode');
                localforage.removeItem('logiruta_image_rows');
                onClearRoute?.();
              }}
              className="text-xs font-bold text-blue-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              ← Cambiar de modo
            </button>
          </div>
        </div>
      )}

      {/* Large Image View Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors cursor-pointer"
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

      {/* Mode Selection Modal */}
      {showSelectionModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-5 text-center leading-tight">
              Seleccióna el modo de ingreso de métodos
            </h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setMode('manual');
                  setShowSelectionModal(false);
                }}
                className="w-full py-4 px-4 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-2xl font-bold text-sm transition-all border border-blue-100 dark:border-blue-900/50 flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <span className="text-base font-bold">Manual</span>
                <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">Capturas del pedido + Texto financiero de soporte</span>
              </button>

              <button
                onClick={() => {
                  setMode('image');
                  setShowSelectionModal(false);
                }}
                className="w-full py-4 px-4 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-2xl font-bold text-xs transition-all border border-emerald-100 dark:border-emerald-900/50 flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <span className="text-base font-bold">Imagen</span>
                <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">Captura del pedido + Foto de estado financiero</span>
              </button>
              
              <button
                onClick={() => setShowSelectionModal(false)}
                className="w-full mt-2 py-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/40 dark:hover:bg-gray-900/60 text-gray-500 dark:text-gray-400 rounded-xl font-bold text-xs transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="p-1 px-2.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold rounded-lg transition-colors cursor-pointer"
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
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-md focus:outline-none cursor-pointer"
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
