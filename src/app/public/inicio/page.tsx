'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LabelList } from 'recharts';
import { Activity, CreditCard, DollarSign, Users, AlertCircle, Calendar, Car, Printer, Phone, MessageCircle, Mail } from 'lucide-react';
import { HistoricalBanner } from '@/components/HistoricalBanner';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function PublicInicioContent() {
  const searchParams = useSearchParams();
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const week = searchParams.get('week');
  const period = searchParams.get('period') || (startDate || week === 'todas' ? '' : 'last7');

  const [kpiData, setKpiData] = useState<any>(null);
  const [chartsData, setChartsData] = useState<any>({ traffic: [], revenue: [] });
  const [monthlyData, setMonthlyData] = useState<any>({ traffic: [], revenue: [] });
  const [categoryData, setCategoryData] = useState<any>({ distribution: [], compare: [], stackedDaily: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (period) params.append('period', period);
        const qs = params.toString() ? `?${params.toString()}` : '';

        // 1. Fetch public KPIs
        const kpiRes = await fetch('/api/public/kpis' + qs);
        const kpiJson = await kpiRes.json();

        // 2. Fetch public recaudo & transito trends
        const recRes = await fetch('/api/public/recaudo' + qs);
        const recJson = await recRes.json();
        
        const traRes = await fetch('/api/public/transito' + qs);
        const traJson = await traRes.json();

        if (kpiJson.success) {
          setKpiData(kpiJson.data);
        }
        
        if (recJson.success && traJson.success) {
          // Format date string for charts
          const formatChartDate = (dateStr: string) => {
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
            return dateStr;
          };

          const buildContiguousDays = (dailyArray: any[], mapFn: (item: any) => any, emptyFn: (dateStr: string) => any) => {
            let result: any[] = [];
            if (dailyArray.length > 0) {
              const maxDateStr = dailyArray[dailyArray.length - 1].date;
              const maxDate = new Date(maxDateStr + 'T12:00:00');
              const dataMap = new Map(dailyArray.map((d: any) => [d.date, d]));
              
              let totalDays = 29; // default 30 days
              if (period === 'last7') totalDays = 6;
              else if (startDate && endDate) {
                const start = new Date(startDate + 'T12:00:00');
                const end = new Date(endDate + 'T12:00:00');
                totalDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
              }

              for (let i = totalDays; i >= 0; i--) {
                const d = new Date(maxDate);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                if (dataMap.has(dateStr)) {
                  result.push(mapFn(dataMap.get(dateStr)));
                } else {
                  result.push(emptyFn(dateStr));
                }
              }
            }
            return result;
          };

          const formattedRevenue = buildContiguousDays(
            recJson.data.daily || [],
            (d: any) => ({
              fecha: formatChartDate(d.date),
              recaudo: d.totalRevenue,
              efectivo: d.cash,
              electronico: d.electronic
            }),
            (dateStr: string) => ({
              fecha: formatChartDate(dateStr),
              recaudo: 0,
              efectivo: 0,
              electronico: 0
            })
          );

          const formattedTraffic = buildContiguousDays(
            traJson.data.daily || [],
            (d: any) => ({
              fecha: formatChartDate(d.date),
              vehiculos: d.quantity
            }),
            (dateStr: string) => ({
              fecha: formatChartDate(dateStr),
              vehiculos: 0
            })
          );

          setChartsData({
            revenue: formattedRevenue,
            traffic: formattedTraffic
          });

          // ---- Monthly Data Formatting ----
          const getCalendarMonthLabel = (dateStr: string) => {
            const parts = dateStr.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            
            const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const monthName = monthNames[month - 1] + '.';
            const fullMonthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const periodStr = `${fullMonthNames[month - 1]} ${year}`;
            
            return {
              key: `${year}-${month.toString().padStart(2, '0')}`,
              name: monthName,
              period: periodStr
            };
          };

          let minYear = new Date().getFullYear();
          let maxYear = minYear;
          if (traJson.data.daily && traJson.data.daily.length > 0) {
             minYear = parseInt(traJson.data.daily[0].date.split('-')[0], 10);
             maxYear = parseInt(traJson.data.daily[traJson.data.daily.length - 1].date.split('-')[0], 10);
          }
          
          const trafficMonthlyMap: Record<string, any> = {};
          const revenueMonthlyMap: Record<string, any> = {};
          
          for (let y = minYear; y <= maxYear; y++) {
            for (let m = 1; m <= 12; m++) {
              if (y === 2026 && m < 3) continue; // Skip Ene & Feb of 2026
              
              const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
              const fullMonthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
              
              const monthName = monthNames[m - 1] + '.';
              const periodStr = `${fullMonthNames[m - 1]} ${y}`;
              const key = `${y}-${m.toString().padStart(2, '0')}`;
              
              trafficMonthlyMap[key] = { name: monthName, period: periodStr, total: 0 };
              revenueMonthlyMap[key] = { name: monthName, period: periodStr, total: 0 };
            }
          }

          (traJson.data.daily || []).forEach((d: any) => {
            const { key, name, period } = getCalendarMonthLabel(d.date);
            if (!trafficMonthlyMap[key]) {
              trafficMonthlyMap[key] = { name, period, total: 0 };
            }
            trafficMonthlyMap[key].total += d.quantity;
          });
          const monthlyTraffic = Object.keys(trafficMonthlyMap).sort().map(k => trafficMonthlyMap[k]);

          (recJson.data.daily || []).forEach((d: any) => {
            const { key, name, period } = getCalendarMonthLabel(d.date);
            if (!revenueMonthlyMap[key]) {
              revenueMonthlyMap[key] = { name, period, total: 0 };
            }
            revenueMonthlyMap[key].total += d.totalRevenue;
          });
          const monthlyRevenue = Object.keys(revenueMonthlyMap).sort().map(k => revenueMonthlyMap[k]);

          setMonthlyData({
            revenue: monthlyRevenue,
            traffic: monthlyTraffic
          });

          // ---- Category Charts Data Formatting ----
          const catsTra = traJson.data.categories || [];
          const catsRec = recJson.data.categories || [];

          // 1. Distribution (Doughnut / Radar)
          const distribution = catsTra.map((c: any) => ({
            name: `Cat ${c.category}`,
            value: c.quantity
          }));

          // 2. Compare (Recaudo vs Volumen)
          const compareMap = new Map<string, { volumen: number; recaudo: number }>();
          catsTra.forEach((c: any) => {
            compareMap.set(c.category, { volumen: c.quantity, recaudo: 0 });
          });
          catsRec.forEach((c: any) => {
            if (compareMap.has(c.category)) {
              compareMap.get(c.category)!.recaudo = c.amount;
            } else {
              compareMap.set(c.category, { volumen: 0, recaudo: c.amount });
            }
          });
          const compare = Array.from(compareMap.entries()).map(([cat, val]) => ({
            category: `Cat ${cat}`,
            volumen: val.volumen,
            recaudo: val.recaudo
          }));

          // 3. Stacked Daily
          const stackedDaily = buildContiguousDays(
            traJson.data.daily || [],
            (d: any) => {
              const row: any = { fecha: formatChartDate(d.date) };
              if (d.categories) {
                row['Categoría I'] = d.categories['I'] || 0;
                row['Categoría II'] = d.categories['II'] || 0;
                row['Categoría III'] = d.categories['III'] || 0;
                row['Categoría IV'] = d.categories['IV'] || 0;
              }
              return row;
            },
            (dateStr: string) => ({
              fecha: formatChartDate(dateStr),
              'Categoría I': 0,
              'Categoría II': 0,
              'Categoría III': 0,
              'Categoría IV': 0
            })
          );

          setCategoryData({
            distribution,
            compare,
            stackedDaily
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard public data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [startDate, endDate, period]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Cargando tablero público...</p>
      </div>
    );
  }

  // Format currency
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const hasData = chartsData.traffic.length > 0;

  // Computed Insights
  let avgDailyTraffic = 0;
  let busiestDay = '-';
  let peakHour = '-';
  let topCategory = '-';

  if (hasData) {
    // Avg Daily Traffic
    const totalTra = chartsData.traffic.reduce((sum: number, d: any) => sum + d.vehiculos, 0);
    avgDailyTraffic = Math.round(totalTra / chartsData.traffic.length);

    // Top Category
    if (categoryData.distribution.length > 0) {
      const maxCat = categoryData.distribution.reduce((prev: any, current: any) => (prev.value > current.value) ? prev : current);
      topCategory = maxCat.name;
    }
  }

  // Dynamic Color Gradient for Monthly Revenue (Corporate Slate to Navy)
  const getGradientColor = (value: number, min: number, max: number) => {
    if (max === min) return '#0d47a1'; // Navy if all values are equal
    const ratio = (value - min) / (max - min); 
    // Min (Slate): rgb(100, 116, 139)
    // Max (Navy): rgb(30, 58, 138)
    const r = Math.round(100 + ratio * (30 - 100));
    const g = Math.round(116 + ratio * (58 - 116));
    const b = Math.round(139 + ratio * (138 - 139));
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Growth Calculation for the PREVIOUS completed month
  let prevMonthRevenue: any = null;
  let revenueGrowth: number | null = null;
  if (monthlyData.revenue && monthlyData.revenue.length > 0) {
    const activeRev = monthlyData.revenue.filter((m: any) => m.total > 0);
    if (activeRev.length >= 2) {
      prevMonthRevenue = activeRev[activeRev.length - 2]; // Last completed month
      if (activeRev.length >= 3) {
        const prev = activeRev[activeRev.length - 3].total; // Month before that
        if (prev > 0) revenueGrowth = ((prevMonthRevenue.total - prev) / prev) * 100;
      }
    }
  }

  let prevMonthTraffic: any = null;
  let trafficGrowth: number | null = null;
  if (monthlyData.traffic && monthlyData.traffic.length > 0) {
    const activeTra = monthlyData.traffic.filter((m: any) => m.total > 0);
    if (activeTra.length >= 2) {
      prevMonthTraffic = activeTra[activeTra.length - 2];
      if (activeTra.length >= 3) {
        const prev = activeTra[activeTra.length - 3].total;
        if (prev > 0) trafficGrowth = ((prevMonthTraffic.total - prev) / prev) * 100;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end lg:justify-start">
        <HistoricalBanner />
      </div>

      {/* KPI Cards Grid */}
      <div id="pdf-section-kpis" className="peaje-grid-2">
        {/* Card 1: Revenue (Moved to left) */}
        <div className="peaje-card flex items-center justify-between">
          <div className="space-y-1.5 flex-1 pr-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Recaudo</p>
            <div className="flex flex-col gap-1.5 mt-1.5">
              {/* Consolidado */}
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-xl font-extrabold text-slate-800 dark:text-white">
                  {formatCOP(kpiData?.totalRevenue || 0)}
                </span>
                <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  {period === 'last7' ? 'Últimos 7 días' : period === 'last30' ? 'Últimos 30 días' : startDate ? 'Filtrado' : 'Consolidado'}
                </span>
              </div>
              {/* Mes Actual */}
              <div className="flex items-baseline justify-between gap-4 pt-1.5 border-t border-dashed" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {formatCOP(kpiData?.monthRevenue || 0)}
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[140px]" title={kpiData?.periodMonthName || 'Mes actual'}>
                  {kpiData?.periodMonthName ? `${kpiData.periodMonthName} (En curso)` : 'Mes actual'}
                </span>
              </div>
              {/* Mes Anterior (Completed) */}
              {prevMonthRevenue && (
                <div className="flex items-baseline justify-between gap-4 pt-1.5 border-t border-dashed" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {formatCOP(prevMonthRevenue.total)}
                    </span>
                    {revenueGrowth !== null && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${revenueGrowth >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'}`} title="Crecimiento vs mes anterior">
                        {revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(revenueGrowth).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[140px]" title={prevMonthRevenue.period}>
                    {prevMonthRevenue.period}
                  </span>
                </div>
              )}

            </div>
          </div>
          <div className="h-20 w-32 shrink-0 ml-2 self-end mb-1">
            {chartsData.revenue.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.revenue.slice(-14)}>
                  <Tooltip 
                    cursor={{ fill: 'rgba(15, 118, 110, 0.05)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-slate-800 p-1.5 shadow-md rounded border border-slate-100 dark:border-slate-700 text-xs font-bold text-teal-700 dark:text-teal-400">
                            {formatCOP(payload[0].value as number)}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="recaudo" fill="#2e7d32" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Card 2: Traffic (Moved to right) */}
        <div className="peaje-card flex items-center justify-between">
          <div className="space-y-1.5 flex-1 pr-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Tránsito</p>
            <div className="flex flex-col gap-1.5 mt-1.5">
              {/* Consolidado */}
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-xl font-extrabold text-slate-800 dark:text-white">
                  {kpiData?.totalTraffic?.toLocaleString() || 0}
                </span>
                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  {period === 'last7' ? 'Últimos 7 días' : period === 'last30' ? 'Últimos 30 días' : startDate ? 'Filtrado' : 'Consolidado'}
                </span>
              </div>
              {/* Mes Actual */}
              <div className="flex items-baseline justify-between gap-4 pt-1.5 border-t border-dashed" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {kpiData?.monthTraffic?.toLocaleString() || 0}
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[140px]" title={kpiData?.periodMonthName || 'Mes actual'}>
                  {kpiData?.periodMonthName ? `${kpiData.periodMonthName} (En curso)` : 'Mes actual'}
                </span>
              </div>
              {/* Mes Anterior (Completed) */}
              {prevMonthTraffic && (
                <div className="flex items-baseline justify-between gap-4 pt-1.5 border-t border-dashed" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {prevMonthTraffic.total.toLocaleString()}
                    </span>
                    {trafficGrowth !== null && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${trafficGrowth >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'}`} title="Crecimiento vs mes anterior">
                        {trafficGrowth >= 0 ? '↑' : '↓'} {Math.abs(trafficGrowth).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[140px]" title={prevMonthTraffic.period}>
                    {prevMonthTraffic.period}
                  </span>
                </div>
              )}

            </div>
          </div>
          <div className="h-20 w-32 shrink-0 ml-2 self-end mb-1">
            {chartsData.traffic.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.traffic.slice(-14)}>
                  <Tooltip 
                    cursor={{ fill: 'rgba(30, 58, 138, 0.05)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-slate-800 p-1.5 shadow-md rounded border border-slate-100 dark:border-slate-700 text-xs font-bold text-blue-900 dark:text-blue-400">
                            {(payload[0].value as number).toLocaleString()}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="vehiculos" fill="#0d47a1" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Unified Charts Grid */}
      {hasData ? (
        <div id="pdf-section-charts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-6 print:gap-4">
            {/* Revenue Chart */}
            <div className="peaje-card space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xl font-extrabold text-slate-800 dark:text-white">Recaudo Diario</h4>
                  {chartsData.revenue.length > 0 && (
                    <p className="text-sm font-medium text-slate-500 mt-0.5">
                      {period === 'last7' ? 'Últimos 7 días' : period === 'last30' ? 'Últimos 30 días' : 'Rango Seleccionado'} ({chartsData.revenue.slice(period === 'last7' ? -7 : period === 'last30' ? -30 : -chartsData.revenue.length)[0]?.fecha} - {chartsData.revenue.slice(-1)[0]?.fecha})
                    </p>
                  )}
                </div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-md">COP ($)</span>
              </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.revenue.slice(-30)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap="10%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tickMargin={8} />
                  <YAxis tickFormatter={(val) => `${val / 1000000}M`} tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tickMargin={8} />
                  <Tooltip 
                    formatter={(value: any, name: any) => [formatCOP(value), String(name)]} 
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '4px' }} 
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', background: 'var(--bg-secondary)' }}
                    cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="efectivo" name="Efectivo" stackId="a" fill="#2e7d32" maxBarSize={80} />
                  <Bar dataKey="electronico" name="Electrónico" stackId="a" fill="#0d47a1" radius={[4, 4, 0, 0]} maxBarSize={80} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Traffic Chart (Stacked by Category) */}
          <div className="peaje-card space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xl font-extrabold text-slate-800 dark:text-white">Tránsito Diario por Categoría</h4>
                {categoryData.stackedDaily.length > 0 && (
                  <p className="text-sm font-medium text-slate-500 mt-0.5">
                    {period === 'last7' ? 'Últimos 7 días' : period === 'last30' ? 'Últimos 30 días' : 'Rango Seleccionado'} ({categoryData.stackedDaily.slice(period === 'last7' ? -7 : period === 'last30' ? -30 : -categoryData.stackedDaily.length)[0]?.fecha} - {categoryData.stackedDaily.slice(-1)[0]?.fecha})
                  </p>
                )}
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md">Cantidad</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData.stackedDaily.slice(-30)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap="10%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tickMargin={8} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tickMargin={8} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', background: 'var(--bg-secondary)' }} labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '4px' }} cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Categoría I" stackId="a" fill="#0d47a1" maxBarSize={80} />
                  <Bar dataKey="Categoría II" stackId="a" fill="#e53935" maxBarSize={80} />
                  <Bar dataKey="Categoría III" stackId="a" fill="#fbc02d" maxBarSize={80} />
                  <Bar dataKey="Categoría IV" stackId="a" fill="#2e7d32" radius={[4, 4, 0, 0]} maxBarSize={80} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Revenue Chart */}
          <div className="peaje-card flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white">Recaudo Mensual</h4>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-md">COP ($)</span>
            </div>
            <div className="h-40 w-full shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData.revenue} margin={{ top: 25, right: 0, left: 0, bottom: 0 }} barCategoryGap="15%">
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#0f172a' }} dy={10} interval={0} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-slate-800 p-2.5 shadow-lg rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col">
                            <p className="text-xs font-bold text-slate-800 dark:text-white">{label}</p>
                            <p className="text-[11px] text-slate-500 font-medium mb-1.5">{payload[0].payload.period}</p>
                            <p className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                              {formatCOP(payload[0].value as number)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="total" maxBarSize={120} radius={[4, 4, 0, 0]}>
                    {monthlyData.revenue.map((entry: any, index: number) => {
                      const maxVal = Math.max(...monthlyData.revenue.map((d: any) => d.total));
                      const minVal = Math.min(...monthlyData.revenue.map((d: any) => d.total));
                      return <Cell key={`cell-${index}`} fill={getGradientColor(entry.total, minVal, maxVal)} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center text-center shrink-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Acumulado</p>
              <p className="text-2xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">
                {formatCOP(monthlyData.revenue.reduce((sum: number, d: any) => sum + d.total, 0))}
              </p>
            </div>
          </div>

          {/* Monthly Traffic Chart */}
          <div className="peaje-card flex flex-col justify-between print:break-before-page">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white">Tránsito Mensual</h4>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md">Cantidad</span>
            </div>
            <div className="h-40 w-full shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData.traffic} margin={{ top: 25, right: 0, left: 0, bottom: 0 }} barCategoryGap="15%">
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#0f172a' }} dy={10} interval={0} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-slate-800 p-2.5 shadow-lg rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col">
                            <p className="text-xs font-bold text-slate-800 dark:text-white">{label}</p>
                            <p className="text-[11px] text-slate-500 font-medium mb-1.5">{payload[0].payload.period}</p>
                            <p className="text-sm font-extrabold text-blue-700 dark:text-blue-500">
                              {(payload[0].value as number).toLocaleString()} <span className="text-xs font-medium text-slate-400">vehículos</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="total" fill="#0d47a1" maxBarSize={120} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center text-center shrink-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Acumulado</p>
              <p className="text-2xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">
                {monthlyData.traffic.reduce((sum: number, d: any) => sum + d.total, 0).toLocaleString()} <span className="text-sm font-semibold text-slate-400">vehículos</span>
              </p>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div className="peaje-card py-12 text-center text-slate-400">
          No hay datos cargados en el sistema actualmente. Solicite al operador subir el histórico Excel.
        </div>
      )}

    </div>
  );
}

export default function PublicInicio() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Cargando tablero público...</p>
      </div>
    }>
      <PublicInicioContent />
    </Suspense>
  );
}
