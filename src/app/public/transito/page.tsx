'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell, PieChart, Pie, AreaChart, Area, LabelList } from 'recharts';
import { Download, PieChart as PieChartIcon, Activity, Clock, Users, ArrowUp, ArrowDown, Calendar, FileText, ChevronDown, Check, LayoutDashboard, Truck, X, Search, Filter, Hash, TrendingUp, TrendingDown, AlertTriangle, AlertCircle, Layers } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { HistoricalBanner } from '@/components/HistoricalBanner';
import { Suspense } from 'react';

const COLORS = ['#0d47a1', '#e53935', '#fbc02d', '#2e7d32', '#8e24aa', '#f97316'];
import { useCountUp } from '@/lib/hooks/useCountUp';
import { formatChartDate, formatShortDate } from '@/lib/formatters';

function TransitoContent() {
  const [data, setData] = useState<any>({ daily: [], categories: [], hourly: [] });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'diario' | 'mensual' | 'anual'>('diario');
  const [activeTab, setActiveTab] = useState<'resumen' | 'hora'>('resumen');
  const [kpis, setKpis] = useState<any>(null);
  
  const searchParams = useSearchParams();
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  // Default to last7 if no period and no startDate is provided
  const period = searchParams.get('period') || (startDate ? '' : 'last7');

  // Dynamic States
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ALTO FLUJO' | 'FLUJO NORMAL' | 'BAJO FLUJO'>('TODOS');


  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const qs = new URLSearchParams();
        if (startDate) qs.append('startDate', startDate);
        if (endDate) qs.append('endDate', endDate);
        if (period) qs.append('period', period);
        
        const res = await fetch('/api/public/transito' + (qs.toString() ? `?${qs.toString()}` : ''));
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          setSelectedPeriod(null); // reset selection on data change

          // ---- Calculate KPIs for Trafico Hora Tab ----
          const daily = json.data.daily || [];
          const categories = json.data.categories || [];
          const hourly = json.data.hourly || [];
          const days = daily.length;

          let tTraffic = 0;
          let daysWithoutTraffic = 0;
          
          daily.forEach((d: any) => {
            tTraffic += d.quantity;
            if (d.quantity === 0) daysWithoutTraffic++;
          });
          
          const avgDaily = days > 0 ? Math.round(tTraffic / days) : 0;
          
          const catMap: Record<string, { q: number, p: number }> = {};
          categories.forEach((c: any) => {
            // Normalizar clave: extraer el número romano (I, II, III, IV)
            const normalizedKey = c.category.replace(/Cat(?:egor[ií]a)?\s*/i, '').trim();
            catMap[normalizedKey] = {
              q: c.quantity,
              p: tTraffic > 0 ? (c.quantity / tTraffic) * 100 : 0
            };
          });

          const hourlyTotals = hourly.map((h: any) => {
            let sum = 0;
            ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(d => {
              sum += h[d] || 0;
            });
            return { hour: h.hour, total: sum };
          });
          
          let pHour = { hour: 0, total: 0 };
          let vHour = { hour: 0, total: Infinity };
          hourlyTotals.forEach((h: any) => {
            if (h.total > pHour.total) pHour = h;
            if (h.total > 0 && h.total < vHour.total) vHour = h;
          });
          if (vHour.total === Infinity) vHour = { hour: 0, total: 0 };

          const peakHourQty = days > 0 ? Math.round(pHour.total / days) : 0;
          const peakHourLabel = pHour.total > 0 ? `${pHour.hour.toString().padStart(2, '0')}:00` : '-';

          const sortedHours = [...hourlyTotals].sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

          const monthlyTotals: Record<string, number> = {};
          daily.forEach((d: any) => {
            const month = d.date.substring(0, 7); // YYYY-MM
            monthlyTotals[month] = (monthlyTotals[month] || 0) + d.quantity;
          });
          const monthKeys = Object.keys(monthlyTotals).sort();
          let monthlyTrend = 0;
          let currentMonthTotal = 0;
          if (monthKeys.length >= 2) {
            const curr = monthlyTotals[monthKeys[monthKeys.length - 1]];
            const prev = monthlyTotals[monthKeys[monthKeys.length - 2]];
            currentMonthTotal = curr;
            monthlyTrend = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
          } else if (monthKeys.length === 1) {
            currentMonthTotal = monthlyTotals[monthKeys[0]];
          }

          setKpis({
            totalTraffic: tTraffic,
            avgDaily,
            catMap,
            peakHour: `${pHour.hour}:00`,
            valleyHour: `${vHour.hour}:00`,
            sortedHours,
            daysWithoutTraffic,
            currentMonthTotal,
            monthlyTrend,
            peakHourQty,
            peakHourLabel,
            daysCount: days
          });

        }
      } catch (err) {
        console.error('Error fetching transito data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate, period]);

  const hasData = data.daily.length > 0;

  // Lógica de Consolidación de Tránsito
  const consolidateTraffic = (dailyList: any[], mode: 'diario' | 'mensual' | 'anual') => {
    if (mode === 'diario') return dailyList;

    const groups: { [key: string]: any } = {};
    dailyList.forEach(item => {
      const dateParts = item.date.split('-');
      const key = mode === 'mensual' ? `${dateParts[0]}-${dateParts[1]}` : dateParts[0];

      if (!groups[key]) {
        groups[key] = {
          date: key,
          label: key,
          weekday: '',
          quantity: 0,
          categories: { I: 0, II: 0, III: 0, IV: 0 },
          buckets: { NORMAL: 0, ESPECIAL: 0, EVASOR: 0, ESPECIAL_EXENTO: 0, EXENTO: 0 }
        };
      }

      const g = groups[key];
      g.quantity += item.quantity || 0;

      if (item.categories) {
        g.categories.I += item.categories.I || 0;
        g.categories.II += item.categories.II || 0;
        g.categories.III += item.categories.III || 0;
        g.categories.IV += item.categories.IV || 0;
      }
      
      if (item.buckets) {
        g.buckets.NORMAL += item.buckets.NORMAL || 0;
        g.buckets.ESPECIAL += item.buckets.ESPECIAL || 0;
        g.buckets.EVASOR += item.buckets.EVASOR || 0;
        g.buckets.ESPECIAL_EXENTO += item.buckets.ESPECIAL_EXENTO || 0;
        g.buckets.EXENTO += item.buckets.EXENTO || 0;
      }
    });

    return Object.values(groups).sort((a: any, b: any) => a.date.localeCompare(b.date));
  };

  const consolidatedList = useMemo(() => {
    const full = consolidateTraffic(data.daily, viewMode);
    return full;
  }, [data.daily, viewMode]);

  // Promedio base para cálculo de desviación (Status)
  let baseTotalTraffic = 0;
  consolidatedList.forEach((d:any) => { baseTotalTraffic += d.quantity; });
  const consolidatedAverage = consolidatedList.length > 0 ? Math.round(baseTotalTraffic / consolidatedList.length) : 0;

  // Cross-filtering: Aplicar filtros a la lista consolidada (crear copias para no mutar el memo)
  const filteredList = consolidatedList.map((d: any) => {
    const deviation = consolidatedAverage > 0 ? d.quantity / consolidatedAverage : 1;
    const statusText = deviation > 1.25 ? 'ALTO FLUJO' : deviation < 0.75 ? 'BAJO FLUJO' : 'FLUJO NORMAL';
    return {
      ...d,
      statusText,
      badgeClass: deviation > 1.25 ? 'peaje-badge-success' : deviation < 0.75 ? 'peaje-badge-warning' : 'peaje-badge-neutral'
    };
  }).filter((d: any) => {
    if (statusFilter !== 'TODOS' && d.statusText !== statusFilter) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const dateStr = formatChartDate(d.date, viewMode).toLowerCase();
      const rawDate = d.date.toLowerCase();
      const weekday = (d.weekday || '').toLowerCase();
      
      if (!dateStr.includes(term) && !rawDate.includes(term) && !weekday.includes(term) && !d.statusText.toLowerCase().includes(term)) {
        return false;
      }
    }
    return true;
  });

  // Cálculos de totales e indicadores basados en los datos filtrados
  let totalTraffic = 0;
  let peakTraffic = 0;
  let peakDate = '-';
  let valleyTraffic = Infinity;
  let valleyDate = '-';

  if (filteredList.length > 0) {
    filteredList.forEach((d: any) => {
      totalTraffic += d.quantity;
      if (d.quantity > peakTraffic) {
        peakTraffic = d.quantity;
        const dateLabel = formatChartDate(d.date, viewMode);
        peakDate = viewMode === 'diario' && d.weekday ? `${dateLabel} (${d.weekday})` : dateLabel;
      }
      if (d.quantity < valleyTraffic && d.quantity > 0) {
        valleyTraffic = d.quantity;
        const dateLabel = formatChartDate(d.date, viewMode);
        valleyDate = viewMode === 'diario' && d.weekday ? `${dateLabel} (${d.weekday})` : dateLabel;
      }
    });
    if (valleyTraffic === Infinity) {
      valleyTraffic = 0;
      valleyDate = '-';
    }
  }

  const filteredAverage = filteredList.length > 0 ? Math.round(totalTraffic / filteredList.length) : 0;

  // Animated KPIs
  const animatedTotal = useCountUp(totalTraffic);
  const animatedAverage = useCountUp(filteredAverage);

  // Categorías globales (respetando filtros)
  const currentCategories = { I: 0, II: 0, III: 0, IV: 0 };
  filteredList.forEach((d: any) => {
    if (d.categories) {
      currentCategories.I += d.categories.I || 0;
      currentCategories.II += d.categories.II || 0;
      currentCategories.III += d.categories.III || 0;
      currentCategories.IV += d.categories.IV || 0;
    }
  });

  // Lógica Dinámica: Categorías globales vs. categorías del periodo seleccionado en el gráfico
  const periodData = selectedPeriod ? filteredList.find((d: any) => d.date === selectedPeriod) : null;
  const activeCategories = periodData ? periodData.categories : currentCategories;

  const pieData = [
    { name: 'Categoría I', value: activeCategories?.I || 0 },
    { name: 'Categoría II', value: activeCategories?.II || 0 },
    { name: 'Categoría III', value: activeCategories?.III || 0 },
    { name: 'Categoría IV', value: activeCategories?.IV || 0 }
  ].filter(p => p.value > 0);

  const CHART_COLORS = ['#0d47a1', '#e53935', '#fbc02d', '#2e7d32'];

  const formattedChartDaily = useMemo(() => {
    let listToUse = filteredList;
    if (viewMode === 'diario' && listToUse.length > 30) {
      listToUse = listToUse.slice(-30);
    }
    return listToUse.map((d: any) => ({
      ...d,
      fecha: formatChartDate(d.date, viewMode)
    }));
  }, [filteredList, viewMode, startDate, endDate]);

  // Pre-computar sparkData para las 5 tarjetas de categoría (evita recalcular en cada render)
  const sparkDataByBucket = useMemo(() => {
    const last14 = formattedChartDaily.slice(-14);
    const buckets = ['NORMAL', 'ESPECIAL', 'EVASOR', 'ESPECIAL_EXENTO', 'EXENTO'];
    const result: Record<string, { value: number }[]> = {};
    buckets.forEach(b => {
      result[b] = last14.map((d: any) => ({ value: d.buckets?.[b] || 0 }));
    });
    return result;
  }, [formattedChartDaily]);

  // Pre-computar Map para tabla horaria: O(1) lookup en lugar de O(n) find()
  const hourlyMap = useMemo(() => {
    const map = new Map<number, any>();
    (data.hourly || []).forEach((h: any) => map.set(h.hour, h));
    return map;
  }, [data.hourly]);

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const clickedDate = data.activePayload[0].payload.date;
      setSelectedPeriod(prev => prev === clickedDate ? null : clickedDate);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Cargando datos de tránsito...</p>
      </div>
    );
  }

  const getDynamicTotalTitle = () => {
    const period = searchParams.get('period');
    const startDate = searchParams.get('startDate');
    
    if (period === 'last7') return 'Tránsito Total (Últ. 7 Días)';
    if (period === 'last30') return 'Tránsito Total (Últ. 30 Días)';
    if (startDate) return 'Tránsito Total (Rango)';
    
    if (viewMode === 'mensual') return 'Tránsito Total Mensual';
    if (viewMode === 'anual') return 'Tránsito Total Anual';
    return 'Tránsito Total Acumulado';
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Page Header and Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-3">
          <HistoricalBanner />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
            {(['diario', 'mensual', 'anual'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  setSelectedPeriod(null);
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('resumen')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'resumen'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Resumen General
        </button>
        <button
          onClick={() => setActiveTab('hora')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'hora'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Tráfico por Hora
        </button>
      </div>
  
      {/* Print Metadata */}
      <div className="hidden print:block text-center text-sm font-bold text-slate-700 dark:text-slate-300 mb-4" suppressHydrationWarning>
        <p>PERÍODO VISUALIZADO: <span className="font-normal uppercase">{selectedPeriod ? formatChartDate(selectedPeriod, viewMode) : 'HISTÓRICO GLOBAL'}</span></p>
        <p>FECHA DE GENERACIÓN: <span className="font-normal">{new Date().toLocaleString('es-CO')}</span></p>
      </div>

      {hasData ? (
        <>
          {activeTab === 'resumen' && (
            <>
              {/* DASHBOARD ESTILO POWER BI */}
              <div id="pdf-section-charts" className="flex flex-col lg:flex-row gap-4 mb-6">
                
                {/* Columna Izquierda: Tarjetas de Categorías (25%) */}
                <div className="lg:w-1/4 flex flex-col gap-3">
                  {[
                    { title: 'Tráfico Normal', key: 'NORMAL', color: '#0d47a1', border: 'border-blue-300' },
                    { title: 'Tarifa Especial', key: 'ESPECIAL', color: '#e53935', border: 'border-red-300' },
                    { title: 'Vehículos Evasores', key: 'EVASOR', color: '#b45309', border: 'border-orange-200' },
                    { title: 'Especiales Exentos', key: 'ESPECIAL_EXENTO', color: '#0369a1', border: 'border-sky-200' },
                    { title: 'Vehículos Exentos', key: 'EXENTO', color: '#475569', border: 'border-slate-200' },
                  ].map((config) => {
                    const total = periodData ? (periodData.buckets?.[config.key] || 0) : filteredList.reduce((acc: number, d: any) => acc + (d.buckets?.[config.key] || 0), 0);
                    const baseTraffic = periodData ? (periodData.quantity || 0) : totalTraffic;
                    const pct = baseTraffic > 0 ? ((total / baseTraffic) * 100).toFixed(1) : '0.0';
                    const sparkData = sparkDataByBucket[config.key] || [];
                    
                    return (
                      <div key={config.key} className={`rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative flex h-24`}>
                        {/* Color Accent Bar */}
                        <div className="w-1.5 absolute left-0 top-0 bottom-0 rounded-l-lg" style={{ backgroundColor: config.color }}></div>
                        
                        <div className="flex w-full p-2 pl-4 items-center">
                          {/* Left Side: Stats */}
                          <div className="w-1/2 flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-slate-500 uppercase leading-tight mb-0.5">{config.title}</p>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">{total.toLocaleString()}</h3>
                            <div className="mt-1.5">
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">{pct}%</p>
                              <div className="w-[90%] bg-slate-100 dark:bg-slate-800 h-1.5 rounded-sm overflow-hidden">
                                 <div className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: config.color }}></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Right Side: Sparkline */}
                          <div className="w-1/2 h-16">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={sparkData}>
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{display:'none'}} />
                                <Bar dataKey="value" fill={config.color} radius={[2,2,0,0]} barSize={8} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Área Principal Derecha (75%) */}
                <div className="lg:w-3/4 flex flex-col gap-4">
                  
                  {/* ROW 2: KPIs + Callout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print-section-kpis">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col justify-center items-center text-center shadow-sm">
                        <p className="text-xs md:text-sm font-bold text-slate-500 uppercase leading-tight mb-2">{getDynamicTotalTitle()}</p>
                        <h4 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white">{totalTraffic.toLocaleString()}</h4>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col justify-center items-center text-center shadow-sm">
                        <p className="text-xs md:text-sm font-bold text-slate-500 uppercase leading-tight mb-2">Promedio {viewMode}</p>
                        <h4 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white">{filteredAverage.toLocaleString()}</h4>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 h-full flex flex-col justify-center items-center text-center shadow-sm relative overflow-hidden">
                        <p className="text-xs md:text-sm font-bold text-slate-500 uppercase mb-2 relative z-10">{viewMode === 'diario' ? 'Día' : viewMode === 'mensual' ? 'Mes' : 'Año'} Pico Histórico</p>
                        <h3 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white relative z-10">{peakTraffic.toLocaleString()}</h3>
                        <p className="text-sm md:text-base font-bold text-indigo-600 dark:text-indigo-400 mt-2 relative z-10">{peakDate !== '-' ? peakDate : 'N/A'}</p>
                      </div>
                  </div>

                  {/* ROW 3: GRÁFICOS (3 Columnas) */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print-section-charts items-stretch">
                    
                    {/* 1. Gráfico de Anillo (Doughnut) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col shadow-sm relative lg:col-span-1 h-full">
                      {selectedPeriod && <div className="absolute inset-0 bg-indigo-50/50 dark:bg-indigo-900/10 pointer-events-none transition-opacity duration-500" />}
                      <div className="relative z-10 text-center mb-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Tiempo de Demora / Tipo</p>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                          {selectedPeriod ? `Distribución ${formatChartDate(selectedPeriod, viewMode)}` : `Distribución Global`}
                        </h4>
                      </div>
                      <div className="flex-1 relative z-10 flex flex-col justify-center">
                        <div className="w-full h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            {pieData.length > 0 ? (
                              <BarChart data={pieData} layout="vertical" margin={{ top: 10, right: 35, left: -10, bottom: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} />
                                <Tooltip 
                                  cursor={{ fill: 'var(--border-color)', opacity: 0.4 }}
                                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'var(--bg-secondary)', fontSize: '11px' }}
                                  formatter={(value: any) => value.toLocaleString()} 
                                />
                                <Bar dataKey="value" name="Vehículos" radius={[0, 4, 4, 0]} barSize={16}>
                                  {pieData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                  ))}
                                  <LabelList 
                                    dataKey="value" 
                                    position="right" 
                                    formatter={(value: any) => {
                                      const total = pieData.reduce((acc: number, curr: any) => acc + curr.value, 0);
                                      const percent = total > 0 ? (value / total * 100).toFixed(1) : 0;
                                      return `${percent}%`;
                                    }}
                                    style={{ fontSize: '10px', fontWeight: 'bold', fill: 'var(--text-secondary)' }}
                                  />
                                </Bar>
                              </BarChart>
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-slate-400">Sin datos</div>
                            )}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* 2. Gráfico de Barras Principal */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col shadow-sm lg:col-span-2">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white mb-0.5">Volumen de Tránsito ({viewMode})</h4>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {formattedChartDaily.length > 0 ? `${formattedChartDaily[0].fecha} al ${formattedChartDaily[formattedChartDaily.length - 1].fecha}` : 'Sin datos'}
                          </p>
                        </div>
                        {selectedPeriod && (
                          <button onClick={() => setSelectedPeriod(null)} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center">
                            <X className="w-2.5 h-2.5 mr-0.5" /> Limpiar
                          </button>
                        )}
                      </div>
                      {/* Unified Container for Chart and Table - Compact without scroll */}
                      <div className="pb-2 mt-2 w-full overflow-hidden">
                        <div className="w-full flex flex-col">
                          
                          <div className="h-64 cursor-pointer">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={formattedChartDaily} margin={{ top: 5, right: 20, left: 0, bottom: 0 }} onClick={handleBarClick} barCategoryGap={1}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                {/* We hide the visual XAxis line/ticks because the table acts as the X-axis */}
                                <XAxis dataKey="fecha" axisLine={false} tick={false} tickLine={false} height={10} />
                                <YAxis width={60} tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} />
                                <Tooltip 
                                  cursor={{ fill: 'var(--border-color)', opacity: 0.4 }}
                                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'var(--bg-secondary)', fontSize: '11px', fontWeight: 'bold' }}
                                  formatter={(value: any) => [`${value.toLocaleString()} Veh.`, 'Tránsito']} 
                                />
                                <Bar dataKey="quantity" radius={[2, 2, 0, 0]}>
                                  {formattedChartDaily.map((entry: any, index: number) => {
                                    const fillCol = selectedPeriod === entry.date ? '#0d47a1' : (selectedPeriod ? '#94a3b8' : '#0d47a1');
                                    return <Cell key={`cell-${index}`} fill={fillCol} />;
                                  })}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Data Grid: Aligned Table */}
                          <table className="w-full text-left border-collapse mt-1">
                            <thead>
                              <tr>
                                <th style={{ width: '40px' }} className="p-1 text-[8px] font-bold text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 bg-transparent text-right pr-2 align-bottom">Fecha</th>
                                {formattedChartDaily.map((d: any, i: number) => (
                                  <th key={`h-${i}`} className="p-0 border-b border-slate-200 dark:border-slate-700 align-bottom" style={{ height: '40px' }}>
                                    <div className="text-[9px] font-bold text-slate-600 dark:text-slate-300 mx-auto flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', padding: '1px' }}>
                                      {d.fecha}
                                    </div>
                                  </th>
                                ))}
                                <th style={{ width: '10px' }} className="border-b border-slate-200 dark:border-slate-700"></th>
                              </tr>
                            </thead>
                          </table>

                        </div>
                      </div>

                    </div>

                  </div>
                </div>
              </div>

              {/* Advanced Table */}
              <div id="pdf-section-table" className="space-y-4 print-section-table">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-white">
                      Tabla Dinámica de Tránsito
                    </h4>
                    <p className="text-xs text-slate-500">Filtra y busca registros específicos ({filteredList.length} resultados)</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Buscar fecha o estado..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                      />
                      {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Status Filter */}
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200/60 dark:border-slate-800/80 w-full sm:w-auto overflow-x-auto">
                      {(['TODOS', 'ALTO FLUJO', 'FLUJO NORMAL', 'BAJO FLUJO'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => setStatusFilter(status)}
                          className={`whitespace-nowrap px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-none text-center ${
                            statusFilter === status
                              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          {status === 'TODOS' ? <Filter className="w-3 h-3 inline-block mr-1" /> : null}
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="peaje-table-container rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
                  <table className="peaje-table">
                    <thead>
                      <tr>
                        {viewMode === 'diario' && <th>Día</th>}
                        <th>{viewMode === 'diario' ? 'Fecha de Registro' : viewMode === 'mensual' ? 'Mes' : 'Año'}</th>
                        <th className="whitespace-normal text-center leading-tight align-middle min-w-[80px]">TRÁFICO<br/>CATEGORIAS<br/>NORMALES</th>
                        <th className="whitespace-normal text-center leading-tight align-middle min-w-[80px]">TRÁFICO<br/>CATEGORIAS<br/>ESPECIALES</th>
                        <th className="whitespace-normal text-center leading-tight align-middle min-w-[80px]">VEHICULOS<br/>EVASORES</th>
                        <th className="whitespace-normal text-center leading-tight align-middle min-w-[80px]">VEHICULOS<br/>ESPECIALES<br/>EXENTOS</th>
                        <th className="whitespace-normal text-center leading-tight align-middle min-w-[80px]">VEHICULOS<br/>EXENTOS</th>
                        <th className="whitespace-normal text-center leading-tight align-middle min-w-[80px]">TOTAL<br/>TRAFICO<br/>DIARIO</th>
                        <th className="text-center">Estado del Tránsito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.length > 0 ? (
                        filteredList.map((d: any) => {
                          return (
                            <tr key={d.date} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                              {viewMode === 'diario' && <td className="capitalize font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">{d.weekday || '-'}</td>}
                              <td className="font-medium font-mono text-slate-600 dark:text-slate-400">
                                {viewMode === 'diario' ? formatShortDate(d.date) : formatChartDate(d.date, viewMode)}
                              </td>
                              <td className="font-bold text-slate-700 dark:text-slate-300 text-center">{(d.buckets?.NORMAL || 0).toLocaleString()}</td>
                              <td className="font-bold text-slate-700 dark:text-slate-300 text-center">{(d.buckets?.ESPECIAL || 0).toLocaleString()}</td>
                              <td className="font-bold text-slate-700 dark:text-slate-300 text-center">{(d.buckets?.EVASOR || 0).toLocaleString()}</td>
                              <td className="font-bold text-slate-700 dark:text-slate-300 text-center">{(d.buckets?.ESPECIAL_EXENTO || 0).toLocaleString()}</td>
                              <td className="font-bold text-slate-700 dark:text-slate-300 text-center">{(d.buckets?.EXENTO || 0).toLocaleString()}</td>
                              <td className="font-bold text-indigo-600 dark:text-indigo-400 text-center">{d.quantity.toLocaleString()}</td>
                              <td className="text-center">
                                <span className={`peaje-badge ${d.badgeClass}`}>{d.statusText}</span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={viewMode === 'diario' ? 9 : 8} className="py-8 text-center text-slate-400">
                            No se encontraron registros que coincidan con la búsqueda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-t-2 border-slate-300 dark:border-slate-600">
                        {viewMode === 'diario' && <td className="font-black text-slate-800 dark:text-white py-2 px-3"></td>}
                        <td className="font-black text-slate-800 dark:text-white py-2 px-3 uppercase text-xs">Totales</td>
                        {['NORMAL', 'ESPECIAL', 'EVASOR', 'ESPECIAL_EXENTO', 'EXENTO'].map((bucket) => (
                          <td key={bucket} className="font-black text-slate-800 dark:text-white text-center py-2 px-3">
                            {filteredList.reduce((acc: number, d: any) => acc + (d.buckets?.[bucket] || 0), 0).toLocaleString()}
                          </td>
                        ))}
                        <td className="font-black text-indigo-600 dark:text-indigo-400 text-center py-2 px-3">
                          {totalTraffic.toLocaleString()}
                        </td>
                        <td className="text-center py-2 px-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'hora' && kpis && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
                {/* 1. Tráfico Total */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Hash className="w-4 h-4 text-indigo-500" />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Tráfico Total</p>
                    </div>
                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{kpis.totalTraffic.toLocaleString()}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">En {kpis.daysCount} días evaluados</p>
                </div>
                
                {/* 2. Promedio Diario */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Promedio Diario</p>
                    </div>
                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{kpis.avgDaily.toLocaleString()}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Vehículos por día</p>
                </div>

                {/* 3. Horas Pico / Valle */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Pico y Valle</p>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-lg font-extrabold text-slate-800 dark:text-white">{kpis.peakHour}</p>
                      <span className="text-[10px] text-slate-400 font-medium">vs</span>
                      <p className="text-lg font-extrabold text-slate-800 dark:text-white">{kpis.valleyHour}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Horas de mayor/menor flujo</p>
                </div>

                {/* 4. Tendencia Mensual */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-4 h-4 text-emerald-500" />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Mes Actual</p>
                    </div>
                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{kpis.currentMonthTotal.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {kpis.monthlyTrend > 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500"/> : <TrendingDown className="w-3.5 h-3.5 text-rose-500"/>}
                    <p className={`text-[10px] font-bold ${kpis.monthlyTrend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {Math.abs(kpis.monthlyTrend).toFixed(1)}% vs mes anterior
                    </p>
                  </div>
                </div>

                {/* 5. Días sin tráfico */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Sin Tráfico</p>
                    </div>
                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{kpis.daysWithoutTraffic}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Días con cero registros</p>
                </div>

                {/* 6. Hora Pico Promedio */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-sky-500" />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Hora Pico Promedio</p>
                    </div>
                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white truncate">{kpis.peakHourLabel}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Horario más frecuente</p>
                </div>

                {/* 7. Flujo en Hora Pico */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Flujo en Hora Pico</p>
                    </div>
                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{kpis.peakHourQty} <span className="text-sm font-medium">v/h</span></p>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Vehículos por hora</p>
                </div>
              </div>

              {/* Participación por Categoría - Fila Completa */}
              <div className="mb-6">
                <div className="peaje-card flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Participación por Categoría</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    {(() => {
                      const colors = ['#6366f1', '#0ea5e9', '#14b8a6', '#94a3b8'];
                      return ['Categoría I', 'Categoría II', 'Categoría III', 'Categoría IV'].map((cat, index) => {
                        const romanKey = ['I', 'II', 'III', 'IV'][index];
                        const cData = kpis?.catMap?.[romanKey] || { q: 0, p: 0 };
                        return (
                          <div key={index} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-2.5">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index] }}></div>
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300">{cat}</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">{cData.p.toFixed(1)}%</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>



              {/* Hourly Analysis Section */}
              <div className="grid grid-cols-1 gap-6">
                <div className="peaje-card space-y-4 flex flex-col h-full">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-4 mb-2">
                    <div>
                      <h4 className="text-base font-bold text-slate-800 dark:text-white">Promedio Horario por Periodo</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Rango analizado: <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {data.daily.length > 0 ? `${formatChartDate(data.daily[0].date, 'diario')} al ${formatChartDate(data.daily[data.daily.length - 1].date, 'diario')}` : 'N/A'}
                        </span> <span className="opacity-75">(basado en {kpis.daysCount} días)</span>
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 text-xs w-full md:w-auto">
                      <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-between gap-6">
                        <span className="font-medium">Día con MAYOR tráfico</span>
                        <span className="font-black text-emerald-800 dark:text-emerald-300">{peakDate}</span>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-3 py-1.5 rounded-lg border border-rose-100 dark:border-rose-800/50 flex items-center justify-between gap-6">
                        <span className="font-medium">Día con MENOR tráfico</span>
                        <span className="font-black text-rose-800 dark:text-rose-300">{valleyDate}</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-96 min-h-[300px] w-full flex-grow">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.hourly || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                        <XAxis dataKey="hour" tickFormatter={(v) => `${v}:00`} tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tickMargin={8} />
                        <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tickMargin={8} />
                        <Tooltip 
                          labelFormatter={(v) => `Hora: ${v}:00`}
                          contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', background: 'var(--bg-secondary)', fontSize: '11px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="Lunes" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Martes" fill="#14b8a6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Miércoles" fill="#10b981" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Jueves" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Viernes" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Sábado" fill="#ec4899" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Domingo" fill="#ef4444" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* TABLA HORARIA RESTAURADA */}
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="min-w-full text-xs md:text-sm">
                        <thead>
                          <tr className="border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                            <th className="py-3 px-2 md:px-4 text-center font-bold text-slate-700 dark:text-slate-300">Hora</th>
                            <th className="py-3 px-2 md:px-4 text-center font-semibold text-slate-600 dark:text-slate-400">Lunes</th>
                            <th className="py-3 px-2 md:px-4 text-center font-semibold text-slate-600 dark:text-slate-400">Martes</th>
                            <th className="py-3 px-2 md:px-4 text-center font-semibold text-slate-600 dark:text-slate-400">Miércoles</th>
                            <th className="py-3 px-2 md:px-4 text-center font-semibold text-slate-600 dark:text-slate-400">Jueves</th>
                            <th className="py-3 px-2 md:px-4 text-center font-semibold text-slate-600 dark:text-slate-400">Viernes</th>
                            <th className="py-3 px-2 md:px-4 text-center font-semibold text-slate-600 dark:text-slate-400">Sábado</th>
                            <th className="py-3 px-2 md:px-4 text-center font-semibold text-slate-600 dark:text-slate-400">Domingo</th>
                            <th className="py-3 px-2 md:px-4 text-center font-bold text-slate-800 dark:text-slate-200">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kpis.sortedHours.map((row: any, i: number) => (
                            <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-2 px-2 md:px-4 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {`${row.hour.toString().padStart(2, '0')}:00`}
                              </td>
                              {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day) => (
                                <td key={day} className="py-2 px-2 md:px-4 text-center text-slate-600 dark:text-slate-400">
                                  {(hourlyMap.get(row.hour)?.[day] || 0).toLocaleString()}
                                </td>
                              ))}
                              <td className="py-2 px-2 md:px-4 text-center font-bold text-indigo-600 dark:text-indigo-400">
                                {row.total.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="peaje-card py-12 text-center text-slate-400">
          No hay datos de tránsito registrados en el sistema.
        </div>
      )}
    </div>
  );
}

export default function PublicTransito() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <TransitoContent />
    </Suspense>
  );
}
