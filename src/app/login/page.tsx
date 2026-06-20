'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    fetch('/api/public/settings')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setSettings(json.data);
        }
      })
      .catch(err => console.error('Error fetching settings', err))
      .finally(() => setLoadingSettings(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor ingrese usuario y contraseña');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/app/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const json = await res.json();

      if (res.ok && json.success) {
        // Store user info in localStorage for client-side UI states
        localStorage.setItem('user', JSON.stringify(json.data.user));
        localStorage.setItem('token', json.data.token);
        
        // Redirect to internal app dashboard
        router.push('/app/inicio');
        router.refresh();
      } else {
        setError(json.message || 'Credenciales inválidas. Intente de nuevo.');
      }
    } catch (err) {
      console.error('Error logging in:', err);
      setError('Ocurrió un error en el servidor. Intente más tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Background Watermark */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none dark:opacity-[0.02]"
        style={{
          backgroundImage: `url(${settings?.logo_base64 || '/logo-gobernacion.png'})`,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
        }}
      />

      {/* Top Header back link */}
      <header className="relative z-10 p-4 flex items-center justify-between">
        <Link href="/public/inicio" className="flex items-center gap-1.5 text-xs font-semibold hover:text-indigo-600" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Portal Público</span>
        </Link>
      </header>

      {/* Main Login Form Box */}
      <div className="relative z-10 flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Logo Brand */}
          <div className="flex flex-col items-center space-y-4 text-center">
            {loadingSettings ? (
               <div className="h-24 w-24 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
            ) : (
              <img 
                src={settings?.logo_base64 || "/logo-gobernacion.png"} 
                alt="Logo Estación" 
                className="h-24 w-auto object-contain drop-shadow-sm" 
              />
            )}
            <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
              {loadingSettings ? 'Cargando...' : (settings?.nombre_peaje || 'ESTACIÓN PEAJE LA PUNTA')}
            </h2>
          </div>

          {/* Form Card */}
          <div className="peaje-card space-y-5" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Iniciar Sesión</h3>
            <hr style={{ borderColor: 'var(--border-color)' }} />
            
            {error && (
              <div className="p-3 rounded-lg flex items-start gap-2.5 text-xs font-semibold" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500" htmlFor="username">Usuario</label>
                <div className="relative">
                  <input
                    id="username"
                    type="text"
                    className="peaje-input pl-10"
                    placeholder="ej. operador"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <User className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500" htmlFor="password">Contraseña</label>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    className="peaje-input pl-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <Lock className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="peaje-btn w-full py-2.5 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  style={{ backgroundColor: '#1e3a8a' }}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Acceder a la Estación'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 p-4 text-center text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        &copy; {new Date().getFullYear()} {settings?.nombre_peaje || 'ESTACIÓN PEAJE LA PUNTA'}. Todos los derechos reservados.
      </footer>
    </div>
  );
}
