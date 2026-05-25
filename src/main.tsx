import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA only in production to avoid stale browser cache in development preview
if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      let unregisteredAny = false;
      for (const registration of registrations) {
        registration.unregister();
        unregisteredAny = true;
      }
      if (unregisteredAny) {
        console.log('Unregistered service workers in development. Reloading webpage...');
        window.location.reload();
      }
    });
  }
} else {
  registerSW({
    onNeedRefresh() {
      // Show prompt
    },
    onOfflineReady() {
      // Offline ready notification
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
