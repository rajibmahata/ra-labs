import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';

export default function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="offline-banner visible"
      role="alert"
      aria-live="polite"
    >
      {t('offline.message', 'You are currently offline. Some features may be unavailable.')}
    </div>
  );
}
