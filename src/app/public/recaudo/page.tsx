'use client';

import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar, LineChart, Line, LabelList } from 'recharts';
import { DollarSign, CreditCard, Landmark, Coins, Printer, Search, Filter, X, Calendar, Activity, AlertCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { HistoricalBanner } from '@/components/HistoricalBanner';

const COLORS = ['#0d47a1', '#e53935', '#fbc02d', '#2e7d32', '#8e24aa', '#f97316'];
import { formatCOP, formatChartDate, formatShortDate } from '@/lib/formatters';
import { useCountUp } from '@/lib/hooks/useCountUp';

function RecaudoContent() {
  const [data, setData] = useState<any>({ daily: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'diario' | 'mensual' | 'anual'>('diario');
  const searchParams = useSearchParams();
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const week = searchParams.get('week');
  const period = searchParams.get('period') || (startDate || week === 'last7' ? '' : 'todas');

  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ALTO RECAUDO' | 'RECAUDO NORMAL' | 'BAJO RECAUDO'>('TODOS');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const qs = new URLSearchParams();
        if (startDate) qs.append('startDate', startDate);
        if (endDate) qs.append('endDate', endDate);
        if (period) qs.append('period', period);
        
        const res = await fetch('/api/public/recaudo' + (qs.toString() ? `?${qs.toString()}` : ''));
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (err) {
        console.error('Error fetching recaudo data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate, period]);




  const hasData = data.daily.length > 0;

  // Lógica de Consolidación
  const consolidateRevenue = (dailyList: any[], mode: 'diario' | 'mensual' | 'anual') => {
    const listWithOverride = dailyList.map(item => ({
      ...item,
      originalTotalRevenue: item.totalRevenue,
      totalRevenue: (item.cash || 0) + (item.electronic || 0) + (item.iprev || 0)
    }));

    if (mode === 'diario') return listWithOverride;

    const groups: { [key: string]: any } = {};
    listWithOverride.forEach(item => {
      const dateParts = item.date.split('-');
      const key = mode === 'mensual' ? `${dateParts[0]}-${dateParts[1]}` : dateParts[0];

      if (!groups[key]) {
        groups[key] = {
          date: key,
          label: key,
          weekday: '',
          totalRevenue: 0,
          originalTotalRevenue: 0,
          cash: 0,
          electronic: 0,
          iprev: 0,
          adjustments: 0,
          revenueCat: { I: 0, II: 0, III: 0, IV: 0 }
        };
      }

      const g = groups[key];
      g.totalRevenue += item.totalRevenue || 0;
      g.originalTotalRevenue += item.originalTotalRevenue || 0;
      g.cash += item.cash || 0;
      g.electronic += item.electronic || 0;
      g.iprev += item.iprev || 0;
      g.adjustments += item.adjustments || 0;

      if (item.revenueCat) {
        g.revenueCat.I += item.revenueCat.I || 0;
        g.revenueCat.II += item.revenueCat.II || 0;
        g.revenueCat.III += item.revenueCat.III || 0;
        g.revenueCat.IV += item.revenueCat.IV || 0;
      }
    });

    return Object.values(groups).sort((a: any, b: any) => a.date.localeCompare(b.date));
  };

  const consolidatedList = consolidateRevenue(data.daily, viewMode);

  // Lógica de filtrado cruzado
  let baseTotalRevenue = 0;
  consolidatedList.forEach((d:any) => { baseTotalRevenue += d.totalRevenue; });
  const consolidatedAverage = consolidatedList.length > 0 ? Math.round(baseTotalRevenue / consolidatedList.length) : 0;

  const filteredList = consolidatedList.filter((d: any) => {
    const deviation = d.totalRevenue / consolidatedAverage;
    const statusText = deviation > 1.25 ? 'ALTO RECAUDO' : deviation < 0.75 ? 'BAJO RECAUDO' : 'RECAUDO NORMAL';
    d.statusText = statusText;
    d.badgeClass = deviation > 1.25 ? 'peaje-badge-success' : deviation < 0.75 ? 'peaje-badge-warning' : 'peaje-badge-neutral';
    
    if (statusFilter !== 'TODOS' && statusText !== statusFilter) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const dateStr = formatChartDate(d.date, viewMode).toLowerCase();
      const rawDate = d.date.toLowerCase();
      const weekday = (d.weekday || '').toLowerCase();
      
      if (!dateStr.includes(term) && !rawDate.includes(term) && !weekday.includes(term) && !statusText.toLowerCase().includes(term)) {
        return false;
      }
    }
    return true;
  });

  // Totales cálculos globales
  let totalRevenue = 0;
  let totalOriginalRevenue = 0;
  let totalCash = 0;
  let totalElec = 0;
  let totalIprev = 0;
  let totalAdjustments = 0;
  let peakRevenue = 0;
  let peakDate = '-';

  if (filteredList.length > 0) {
    filteredList.forEach((d: any) => {
      totalRevenue += d.totalRevenue;
      totalOriginalRevenue += (d.originalTotalRevenue || 0);
      totalCash += d.cash;
      totalElec += d.electronic;
      totalIprev += d.iprev;
      totalAdjustments += (d.adjustments || 0);
      if (d.totalRevenue > peakRevenue) {
        peakRevenue = d.totalRevenue;
        peakDate = d.date;
      }
    });
  }

  const filteredAverage = filteredList.length > 0 ? Math.round(totalRevenue / filteredList.length) : 0;
  const animatedTotal = useCountUp(totalRevenue);
  const animatedAverage = useCountUp(filteredAverage);

  const totalPayments = totalCash + totalElec + totalIprev;
  const cashPct = totalPayments > 0 ? ((totalCash / totalPayments) * 100).toFixed(1) : '0.0';
  const elecPct = totalPayments > 0 ? ((totalElec / totalPayments) * 100).toFixed(1) : '0.0';
  const iprevPct = totalPayments > 0 ? ((totalIprev / totalPayments) * 100).toFixed(1) : '0.0';

  const currentCategories: Record<string, number> = {};
  filteredList.forEach((d: any) => {
    if (d.revenueCat) {
      Object.entries(d.revenueCat).forEach(([cat, val]) => {
        const num = Number(val) || 0;
        if (num > 0) {
          currentCategories[cat] = (currentCategories[cat] || 0) + num;
        }
      });
    }
  });

  const periodData = selectedPeriod ? filteredList.find((d: any) => d.date === selectedPeriod) : null;
  const activeCategories = periodData ? periodData.revenueCat : currentCategories;

  const pieData = Object.entries(activeCategories || {})
    .filter(([_, val]) => Number(val) > 0)
    .map(([cat, val]) => ({
      name: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'].includes(cat) ? `Cat ${cat}` : cat,
      value: Number(val)
    }));

  const CHART_COLORS = ['#0d47a1', '#e53935', '#fbc02d', '#2e7d32'];

  let formattedChartDaily: any[] = [];
  if (viewMode === 'diario' && filteredList.length > 0) {
    const listMap = new Map(filteredList.map((d: any) => [d.date, d]));
    
    let startD: Date;
    let endD: Date;
    const period = searchParams.get('period');
    
    if (period === 'last7' || period === 'last30') {
      const days = period === 'last7' ? 6 : 29;
      const maxDateStr = filteredList[filteredList.length - 1].date;
      endD = new Date(maxDateStr + 'T12:00:00');
      startD = new Date(maxDateStr + 'T12:00:00');
      startD.setDate(startD.getDate() - days);
    } else if (startDate && endDate) {
      startD = new Date(startDate + 'T12:00:00');
      const reqEnd = new Date(endDate + 'T12:00:00');
      const maxDateStr = filteredList[filteredList.length - 1].date;
      const actualEnd = new Date(maxDateStr + 'T12:00:00');
      endD = actualEnd < reqEnd ? actualEnd : reqEnd;
    } else {
      const minDateStr = filteredList[0].date;
      const maxDateStr = filteredList[filteredList.length - 1].date;
      startD = new Date(minDateStr + 'T12:00:00');
      endD = new Date(maxDateStr + 'T12:00:00');
      
      const diffTime = Math.abs(endD.getTime() - startD.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 29) {
        startD = new Date(endD);
        startD.setDate(startD.getDate() - 29);
      }
    }

    const diffTime = Math.abs(endD.getTime() - startD.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(startD);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      
      if (listMap.has(dateStr)) {
        formattedChartDaily.push({
          ...listMap.get(dateStr),
          fecha: formatChartDate(dateStr, viewMode)
        });
      } else {
        formattedChartDaily.push({
          date: dateStr,
          fecha: formatChartDate(dateStr, viewMode),
          totalRevenue: 0,
          cash: 0,
          electronic: 0,
          iprev: 0,
          revenueCat: { I: 0, II: 0, III: 0, IV: 0 }
        });
      }
    }
  } else {
    // Preparar datos para los gráficos
    const listToUse = filteredList;
    formattedChartDaily = listToUse.map((d: any) => ({
      ...d,
      fecha: formatChartDate(d.date, viewMode)
    }));
  }

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
        <p className="text-slate-500 text-sm font-medium">Cargando datos de recaudo...</p>
      </div>
    );
  }

  const getDynamicTotalTitle = () => {
    const period = searchParams.get('period');
    const startDate = searchParams.get('startDate');
    
    if (period === 'last7') return 'Total Recaudo (Últ. 7 Días)';
    if (period === 'last30') return 'Total Recaudo (Últ. 30 Días)';
    if (startDate) return 'Total Recaudo (Rango)';
    
    if (viewMode === 'mensual') return 'Total Recaudo Mensual';
    if (viewMode === 'anual') return 'Total Recaudo Anual';
    return 'Total Recaudo Acumulado';
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
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        </div>
  
        {/* Print Metadata */}
        <div className="hidden print:block text-center text-sm font-bold text-slate-700 dark:text-slate-300 mb-4" suppressHydrationWarning>
          <p>PERÍODO VISUALIZADO: <span className="font-normal uppercase">{selectedPeriod ? formatChartDate(selectedPeriod, viewMode) : 'HISTÓRICO GLOBAL'}</span></p>
          <p>FECHA DE GENERACIÓN: <span className="font-normal">{new Date().toLocaleString('es-CO')}</span></p>
        </div>

      {hasData ? (
        <>
          {/* DASHBOARD ESTILO POWER BI */}
          <div id="pdf-section-charts" className="flex flex-col lg:flex-row gap-6 mb-6">
            
            {/* Columna Izquierda: Medios de Pago */}
            <div className="lg:w-1/4 flex flex-col gap-3">
              {[
                { title: 'Efectivo', key: 'cash', color: '#2e7d32', border: 'border-green-400' },
                { title: 'Electrónico', key: 'electronic', color: '#0d47a1', border: 'border-blue-300' },
                { title: 'Consignación / IPREV', key: 'iprev', color: '#f97316', border: 'border-orange-400' },
              ].map((config) => {
                const total = periodData ? (periodData[config.key] || 0) : filteredList.reduce((acc: number, d: any) => acc + (d[config.key] || 0), 0);
                const basePayments = periodData ? ((periodData.cash || 0) + (periodData.electronic || 0) + (periodData.iprev || 0)) : totalPayments;
                const pct = basePayments > 0 ? ((total / basePayments) * 100).toFixed(1) : '0.0';
                const sparkData = formattedChartDaily.slice(-14).map((d:any) => ({ value: d[config.key] || 0 }));
                
                return (
                  <div key={config.key} className={`rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative flex h-24`}>
                    <div className="w-1.5 absolute left-0 top-0 bottom-0 rounded-l-lg" style={{ backgroundColor: config.color }}></div>
                    <div className="flex w-full p-2 pl-4 items-center">
                      <div className="w-1/2 flex flex-col justify-center">
                        <p className="text-[10px] font-bold text-slate-500 uppercase leading-tight mb-0.5">{config.title}</p>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white leading-none whitespace-nowrap" title={formatCOP(total)}>{formatCOP(total)}</h3>
                        <div className="mt-1.5">
                          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">{pct}%</p>
                          <div className="w-[90%] bg-slate-100 dark:bg-slate-800 h-1.5 rounded-sm overflow-hidden">
                             <div className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: config.color }}></div>
                          </div>
                        </div>
                      </div>
                      <div className="w-1/2 h-16">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={sparkData}>
                            <Tooltip 
                              cursor={{fill: 'transparent'}} 
                              formatter={(val: any) => [formatCOP(val as number), 'Monto']}
                              labelStyle={{ display: 'none' }}
                              contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'var(--bg-secondary)', fontSize: '11px', fontWeight: 'bold' }}
                            />
                            <Bar dataKey="value" fill={config.color} radius={[2,2,0,0]} barSize={8} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Área Principal Derecha */}
            <div className="lg:w-3/4 flex flex-col gap-4">
              {/* ROW 2: KPIs + Callout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print-section-kpis">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col justify-center items-center text-center shadow-sm">
                      <p className="text-sm md:text-base font-extrabold text-slate-500 uppercase leading-tight mb-2">{getDynamicTotalTitle()}</p>
                      <h4 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white whitespace-nowrap" title={formatCOP(animatedTotal)}>{formatCOP(animatedTotal)}</h4>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col justify-center items-center text-center shadow-sm">
                      <p className="text-sm md:text-base font-extrabold text-slate-500 uppercase leading-tight mb-2">Promedio {viewMode}</p>
                      <h4 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white whitespace-nowrap" title={formatCOP(animatedAverage)}>{formatCOP(animatedAverage)}</h4>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 h-full flex flex-col justify-center items-center text-center shadow-sm relative overflow-hidden">
                      <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-2 relative z-10">{viewMode === 'diario' ? 'Día' : viewMode === 'mensual' ? 'Mes' : 'Año'} Pico Histórico</p>
                      <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white relative z-10" title={formatCOP(peakRevenue)}>{formatCOP(peakRevenue)}</h3>
                      <p className="text-[10px] md:text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-2 relative z-10">{peakDate !== '-' ? peakDate : 'N/A'}</p>
                  </div>
              </div>

              {/* ROW 3: GRÁFICOS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print-section-charts items-stretch">
                
                {/* 1. Gráfico de Anillo */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col shadow-sm relative lg:col-span-1 h-full">
                  {selectedPeriod && <div className="absolute inset-0 bg-indigo-50/50 dark:bg-indigo-900/10 pointer-events-none transition-opacity duration-500" />}
                  <div className="relative z-10 text-center mb-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Por Categoría</p>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                      {selectedPeriod ? `Distribución ${formatChartDate(selectedPeriod, viewMode)}` : `Distribución Global`}
                    </h4>
                  </div>
                  <div className="flex-1 relative z-10 flex flex-col justify-center">
                    <div className="w-full h-[200px]">
                      {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={pieData} layout="vertical" margin={{ top: 10, right: 35, left: -10, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} />
                            <Tooltip 
                              cursor={{ fill: 'var(--border-color)', opacity: 0.4 }}
                              contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'var(--bg-secondary)', fontSize: '11px' }}
                              formatter={(value: any) => formatCOP(value)} 
                            />
                            <Bar dataKey="value" name="Total" radius={[0, 4, 4, 0]} barSize={16}>
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
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Sin datos</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Área Chart (Tendencia Medios) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col shadow-sm lg:col-span-2">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Medios de Pago</p>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white mb-0.5">Tendencia de Recaudo ({viewMode})</h4>
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
                  {/* Unified Scroll Container for Chart and Table */}
                  <div className="overflow-x-auto custom-scrollbar pb-2 mt-2">
                    <div className="min-w-full flex flex-col">
                      
                      <div className="h-64 cursor-pointer">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={formattedChartDaily} margin={{ top: 20, right: 20, left: 0, bottom: 0 }} onClick={handleBarClick}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                            <XAxis dataKey="fecha" axisLine={false} tick={false} tickLine={false} height={10} />
                            <YAxis width={60} tickFormatter={(val) => `${val / 1000000}M`} tick={{ fontSize: 9 }} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} />
                            <Tooltip 
                              cursor={{ fill: 'var(--border-color)', opacity: 0.4 }}
                              contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'var(--bg-secondary)', fontSize: '11px' }}
                              formatter={(value: any) => formatCOP(value)} 
                            />
                            <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: '10px' }} />
                            <Bar dataKey="cash" name="Efectivo" stackId="a" fill="#2e7d32" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="electronic" name="Electrónico" stackId="a" fill="#0d47a1" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="iprev" name="Consignación / IPREV" stackId="a" fill="#f97316" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Data Grid: Aligned Table */}
                      <table className="w-full text-left border-collapse mt-1">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }} className="p-1 text-[8px] font-bold text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 bg-transparent text-right pr-2 align-bottom">Fecha</th>
                            {formattedChartDaily.map((d: any, i: number) => (
                              <th key={`h-${i}`} className="p-0 border-b border-slate-200 dark:border-slate-700 align-bottom" style={{ height: '45px' }}>
                                <div className="text-[8px] font-semibold text-slate-500 mx-auto flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', padding: '2px 1px' }}>
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

          {/* Aggregated List Table */}
          <div id="pdf-section-table" className="space-y-4 print-section-table">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
              <div>
                <h4 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                  Tabla Dinámica de Recaudo
                </h4>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Filtra y busca registros específicos ({filteredList.length} resultados)
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto print:hidden">
                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar fecha o estado..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 w-full sm:w-auto overflow-x-auto">
                  {(['TODOS', 'ALTO RECAUDO', 'RECAUDO NORMAL', 'BAJO RECAUDO'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        statusFilter === status
                          ? 'bg-blue-600 dark:bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {status === 'TODOS' && statusFilter === 'TODOS' && <Filter className="w-3 h-3" />}
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="peaje-table-container rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="peaje-table">
                <thead>
                  <tr>
                    {viewMode === 'diario' && <th>Día</th>}
                    <th>{viewMode === 'diario' ? 'Fecha de Recaudo' : viewMode === 'mensual' ? 'Mes' : 'Año'}</th>
                    <th>Ingreso en Efectivo</th>
                    <th>Ingreso Electrónico</th>
                    <th>Ingreso IPREV COLPASS</th>
                    <th>Recaudo Neto</th>
                    <th>Total + Ajustes</th>
                    <th>Medios Pago Total</th>
                    <th className="text-center">Estado del Recaudo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((d: any) => {
                    const mediosPagoTotal = d.cash + d.electronic + d.iprev;
                    const totalMasAjustes = (d.originalTotalRevenue || 0) + (d.adjustments || 0);
                    const hasMismatch = mediosPagoTotal !== totalMasAjustes;

                    return (
                      <tr key={d.date} className={`transition-colors ${hasMismatch ? 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                        {viewMode === 'diario' && <td className="capitalize font-medium text-slate-700 dark:text-slate-300">{d.weekday || '-'}</td>}
                        <td className="font-medium font-mono text-slate-600 dark:text-slate-400">
                          {viewMode === 'diario' ? formatShortDate(d.date) : formatChartDate(d.date, viewMode)}
                        </td>
                        <td>{formatCOP(d.cash)}</td>
                        <td>{formatCOP(d.electronic)}</td>
                        <td>{formatCOP(d.iprev)}</td>
                        <td className="font-bold text-indigo-600 dark:text-indigo-400">{formatCOP(d.originalTotalRevenue)}</td>
                        <td className={`font-bold ${hasMismatch ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400'}`}>{formatCOP(totalMasAjustes)}</td>
                        <td className={`font-bold ${hasMismatch ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400'}`}>{formatCOP(mediosPagoTotal)}</td>
                        <td className="text-center">
                          <span className={`peaje-badge ${d.badgeClass}`}>{d.statusText}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredList.length === 0 && (
                    <tr>
                      <td colSpan={viewMode === 'diario' ? 9 : 8} className="text-center py-6 text-slate-400">Sin coincidencias para los filtros aplicados.</td>
                    </tr>
                  )}
                </tbody>
                {filteredList.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700">
                      <td colSpan={viewMode === 'diario' ? 2 : 1} className="font-black text-slate-800 dark:text-white py-3 px-3 uppercase text-xs text-right pr-6">
                        Totales
                      </td>
                      <td className="font-bold text-slate-800 dark:text-white py-3 px-3">{formatCOP(totalCash)}</td>
                      <td className="font-bold text-slate-800 dark:text-white py-3 px-3">{formatCOP(totalElec)}</td>
                      <td className="font-bold text-slate-800 dark:text-white py-3 px-3">{formatCOP(totalIprev)}</td>
                      <td className="font-black text-indigo-600 dark:text-indigo-400 py-3 px-3">{formatCOP(totalOriginalRevenue)}</td>
                      <td className="font-bold text-slate-800 dark:text-white py-3 px-3">{formatCOP(totalOriginalRevenue + totalAdjustments)}</td>
                      <td className="font-bold text-slate-800 dark:text-white py-3 px-3">{formatCOP(totalCash + totalElec + totalIprev)}</td>
                      <td className="text-center py-3 px-3">-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="peaje-card py-12 text-center text-slate-400">
          No hay datos de recaudo registrados en el sistema.
        </div>
      )}
    </div>
  );
}

export default function PublicRecaudo() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <RecaudoContent />
    </Suspense>
  );
}
