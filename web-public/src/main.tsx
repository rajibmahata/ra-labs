import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from './i18n';
import App from './App';
import './index.css';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (import.meta.env.DEV) {
          console.debug(
            'ServiceWorker registered:',
            registration.scope
          );
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.debug('ServiceWorker registration failed:', err);
        }
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <App />
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>
);
