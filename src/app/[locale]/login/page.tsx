'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';



export default function LoginPage() {
  const t = useTranslations('common');
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => setIsSetup(data.isSetup))
      .catch((err) => console.error(err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isSetup ? '/api/auth/login' : '/api/auth/setup';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t('error'));
      }

      if (!isSetup) {
        // If we just finished setup, reload to switch to login mode or auto-login
        // For simplicity, let's just reload to verify setup state or auto-login if we implemented that
        // But our setup API doesn't set cookie. So we need to login after setup.
        // Let's just switch mode to login
        setIsSetup(true);
        setPassword('');
        toast.success(t('setupComplete'));
      } else {
        toast.success(t('loginSuccess'));
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (isSetup === null) {
    return <div className="flex min-h-screen items-center justify-center">{t('loading')}</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
          {isSetup ? t('loginTitle') : t('setupTitle')}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('passwordPlaceholder')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? t('loading') : isSetup ? t('login') : t('setup')}
          </button>
        </form>
      </div>
    </div>
  );
}
