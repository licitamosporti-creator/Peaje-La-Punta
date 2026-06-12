import React from 'react';
import { Calendar } from 'lucide-react';

export function HistoricalBanner() {
  return (
    <div className="flex items-center gap-1.5 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 px-3 py-1 rounded-md print:hidden shrink-0" style={{ color: '#1e3a8a' }}>
      <Calendar className="w-3.5 h-3.5" />
      <span className="text-[11px] md:text-xs">Datos históricos a partir del <strong>21 de Marzo de 2026</strong></span>
    </div>
  );
}
