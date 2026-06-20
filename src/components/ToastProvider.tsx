'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-sky-500" />
  };

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/80 dark:border-emerald-800',
    error: 'bg-rose-50 border-rose-200 dark:bg-rose-950/80 dark:border-rose-800',
    warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950/80 dark:border-amber-800',
    info: 'bg-sky-50 border-sky-200 dark:bg-sky-950/80 dark:border-sky-800'
  };

  const textColors = {
    success: 'text-emerald-800 dark:text-emerald-200',
    error: 'text-rose-800 dark:text-rose-200',
    warning: 'text-amber-800 dark:text-amber-200',
    info: 'text-sky-800 dark:text-sky-200'
  };

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transform transition-all duration-300 animate-in slide-in-from-right-8 fade-in ${bgColors[t.type]}`}
          >
            <div className="shrink-0 mt-0.5">{icons[t.type]}</div>
            <div className={`flex-1 text-sm font-medium ${textColors[t.type]}`}>
              {t.message}
            </div>
            <button 
              onClick={() => removeToast(t.id)}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
