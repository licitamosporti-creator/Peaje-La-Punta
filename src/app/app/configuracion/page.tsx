'use client';

import React, { useEffect, useState } from 'react';
import { Save, AlertCircle, Loader2, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Upload, X } from 'lucide-react';

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const router = useRouter();

  useEffect(() => {
    async function fetchSettings() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/app/settings', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const json = await res.json();
        
        if (res.status === 401) {
          setError('No tienes permisos para acceder a esta configuración.');
          setLoading(false);
          return;
        }

        if (json.success) {
          setSettings(json.data);
        } else {
          setError(json.error || 'Error al cargar las configuraciones');
        }
      } catch (err) {
        setError('Error de conexión al cargar configuraciones');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings })
      });
      const json = await res.json();
      
      if (json.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(json.error || 'Error al guardar configuraciones');
      }
    } catch (err) {
      setError('Error de conexión al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSaving(true);
    setPwdError(null);
    setPwdSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwdError('Las contraseñas nuevas no coinciden');
      setPwdSaving(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const json = await res.json();
      
      if (json.success) {
        setPwdSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPwdSuccess(false), 3000);
      } else {
        setPwdError(json.error || 'Error al cambiar contraseña');
      }
    } catch (err) {
      setPwdError('Error de conexión');
    } finally {
      setPwdSaving(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => prev.map(s => s.setting_key === key ? { ...s, setting_value: value } : s));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('La imagen no debe superar los 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        handleChange(key, base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg">
          <Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Configuración Global</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Administra los parámetros generales del sistema y la información de contacto pública.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="font-medium text-sm">Configuraciones guardadas correctamente.</p>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          {settings.length === 0 && !error ? (
            <p className="text-slate-500 italic text-sm">No hay configuraciones disponibles.</p>
          ) : (
            settings.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  {item.label}
                </label>
                {item.description && (
                  <p className="text-xs text-slate-500 mb-2">{item.description}</p>
                )}
                {item.setting_key === 'logo_base64' ? (
                  <div className="flex items-center gap-4">
                    {item.setting_value ? (
                      <div className="relative w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 p-2 group">
                        <img src={item.setting_value} alt="Logo" className="max-w-full max-h-full object-contain" />
                        <button 
                          type="button"
                          onClick={() => handleChange(item.setting_key, '')}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-lg flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-700">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-[10px] text-slate-500 font-medium">Vacío</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="cursor-pointer bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold py-2 px-4 rounded-lg transition-colors inline-block">
                        Seleccionar Imagen
                        <input 
                          type="file" 
                          accept="image/png, image/jpeg, image/svg+xml" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, item.setting_key)}
                        />
                      </label>
                      <p className="text-[10px] text-slate-500 mt-2">Formatos permitidos: PNG, JPG, SVG. Máximo 2MB.</p>
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={item.setting_value || ''}
                    onChange={(e) => handleChange(item.setting_key, e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-shadow"
                  />
                )}
              </div>
            ))
          )}
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 p-4 flex justify-end">
          <button
            type="submit"
            disabled={saving || settings.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>
      </form>

      {/* CHANGE PASSWORD SECTION */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mt-12">
        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
          <Settings className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Cambio de Contraseña</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Actualiza tu contraseña de acceso a la consola administrativa.</p>
        </div>
      </div>

      {pwdError && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="font-medium text-sm">{pwdError}</p>
        </div>
      )}

      {pwdSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="font-medium text-sm">Contraseña actualizada correctamente.</p>
        </div>
      )}

      <form onSubmit={handlePasswordChange} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden mb-12">
        <div className="p-6 space-y-6">
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Contraseña Actual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-shadow"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Nueva Contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-shadow"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Confirmar Nueva Contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-shadow"
              required
              minLength={6}
            />
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 p-4 flex justify-end">
          <button
            type="submit"
            disabled={pwdSaving || !currentPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
          >
            {pwdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Actualizar Contraseña
          </button>
        </div>
      </form>
    </div>
  );
}
