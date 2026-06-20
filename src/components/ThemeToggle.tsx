'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useState, useRef, useEffect } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
        title="Cambiar tema"
      >
        {theme === 'dark' ? <Moon className="w-4 h-4" /> : theme === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
          <button 
            onClick={() => { setTheme('light'); setOpen(false); }}
            className={`w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm font-semibold transition-colors ${theme === 'light' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
          >
            <Sun className="w-4 h-4" /> Claro
          </button>
          <button 
            onClick={() => { setTheme('dark'); setOpen(false); }}
            className={`w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm font-semibold transition-colors ${theme === 'dark' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
          >
            <Moon className="w-4 h-4" /> Oscuro
          </button>
          <button 
            onClick={() => { setTheme('system'); setOpen(false); }}
            className={`w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm font-semibold transition-colors ${theme === 'system' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
          >
            <Monitor className="w-4 h-4" /> Sistema
          </button>
        </div>
      )}
    </div>
  );
}
