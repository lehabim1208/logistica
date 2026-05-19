import React, { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Loader2, ImagePlus, X, Eye, FileText, Image as ImageIcon } from 'lucide-react';
import { processLogisticsData, ProcessingResult } from '../lib/gemini';
import toast from 'react-hot-toast';
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
        const maxDimension = 500; // Reducido para ahorrar datos y procesar MÁS rápido
        
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
        resolve(canvas.toDataURL('image/jpeg', 0.5)); // Menos calidad = menos peso
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
    let loadingToast = toast.loading('Obteniendo ubicación...');
    
    try {
      // Get location
      let userLocation: { lat: number, lng: number } | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { 
            timeout: 5000, 
            maximumAge: 5 * 60 * 1000 // usa caché de 5 mins para volar
          });
        });
        userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        toast.loading('Extrayendo datos y creando ruta...', { id: loadingToast });
      } catch (locErr) {
        console.warn('Geolocation failed', locErr);
        toast.loading('Analizando sin ubicación precisa...', { id: loadingToast });
        // We proceed without location (it will fallback in Gemini prompt)
      }

      const base64Images = images.map(img => ({
        mimeType: 'image/jpeg',
        data: img.dataUrl.split(',')[1] // Strip "data:image/jpeg;base64," prefix for API
      }));

      const result = await processLogisticsData(base64Images, financialText, userLocation);
      toast.dismiss(loadingToast);
      toast.success('¡Ruta generada y optimizada con éxito!');
      onProcessed(result);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error('Hubo un error procesando los datos. ' + (error.message || ''));
      console.error(error);
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
          disabled={isProcessing || images.length === 0}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-base shadow-md transition-all flex items-center justify-center gap-2"
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
    </div>
  );
}
