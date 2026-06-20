'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { HistoricalBanner } from '@/components/HistoricalBanner';
import { Users, Activity, Clock, Filter, Printer, Download, Trash2, TrendingUp } from 'lucide-react';
import { exportToCSV } from '@/lib/exportCsv';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

export default function AppTransito() {
  const [data, setData] = useState<any>({ dailyBuckets: [], hourlyData: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'buckets' | 'hourly' | 'heatmap'>('buckets');
  const [viewMode, setViewMode] = useState<'diario' | 'mensual' | 'anual'>('diario');
  const [showPeakHours, setShowPeakHours] = useState(false);

  const getDefaultPeriod = () => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    let startYear = year;
    let startMonth = month;
    let endYear = year;
    let endMonth = month;

    if (day >= 21) {
      endMonth = month + 1;
      if (endMonth > 11) {
        endMonth = 0;
        endYear++;
      }
    } else {
      startMonth = month - 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear--;
      }
    }

    const start = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-21`;
    const end = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-20`;
    return { start, end };
  };

  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    const year = now.getFullYear();
    
    // Para Enero (periodo Dic 21 a Ene 20), el current inicial es en Diciembre del año anterior
    const startDatePeriod = new Date(year - 1, 11, 21); 
    // Para Diciembre (periodo Nov 21 a Dic 20), el current final es en Noviembre del año actual
    const endDatePeriod = new Date(year, 10, 21); 

    const formatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });

    let current = new Date(startDatePeriod);
    while (current <= endDatePeriod) {
      const startYear = current.getFullYear();
      const startMonth = current.getMonth();
      
      let endYear = startYear;
      let endMonth = startMonth + 1;
      if (endMonth > 11) {
        endMonth = 0;
        endYear++;
      }

      const s = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-21`;
      const e = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-20`;
      
      const nameDate = new Date(endYear, endMonth, 1);
      const name = formatter.format(nameDate);

      options.push({
        label: name.charAt(0).toUpperCase() + name.slice(1), 
        value: `${s}|${e}`, 
      });

      current.setMonth(current.getMonth() + 1);
    }
    // Return in chronological order
    return options;
  };

  const monthOptions = React.useMemo(() => generateMonthOptions(), []);

  const [defaultPeriod] = useState(getDefaultPeriod());
  
  // Filters
  const [startDate, setStartDate] = useState(defaultPeriod.start);
  const [endDate, setEndDate] = useState(defaultPeriod.end);

  const fetchTransito = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = '/api/app/transito';
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Error loading transito:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransito();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleClearFilter = () => {
    const period = getDefaultPeriod();
    setStartDate(period.start);
    setEndDate(period.end);
  };

  if (loading && data.dailyBuckets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Cargando módulo de tránsito...</p>
      </div>
    );
  }

  const hasData = data.dailyBuckets.length > 0;

  // Lógica de Consolidación
  const consolidateDailyBuckets = (list: any[], mode: 'diario' | 'mensual' | 'anual') => {
    if (mode === 'diario') return list;

    const groups: { [key: string]: any } = {};
    list.forEach(item => {
      const dateParts = item.date.split('-');
      const key = mode === 'mensual' ? `${dateParts[0]}-${dateParts[1]}` : dateParts[0];

      if (!groups[key]) {
        groups[key] = {
          date: key,
          weekday: '',
          NORMAL: 0,
          ESPECIAL: 0,
          EVASOR: 0,
          ESPECIAL_EXENTO: 0,
          EXENTO: 0,
          total: 0
        };
      }

      const g = groups[key];
      g.NORMAL += item.NORMAL || 0;
      g.ESPECIAL += item.ESPECIAL || 0;
      g.EVASOR += item.EVASOR || 0;
      g.ESPECIAL_EXENTO += item.ESPECIAL_EXENTO || 0;
      g.EXENTO += item.EXENTO || 0;
      g.total += item.total || 0;
    });

    return Object.values(groups).sort((a: any, b: any) => b.date.localeCompare(a.date));
  };

  const consolidateHourlyData = (list: any[], mode: 'diario' | 'mensual' | 'anual') => {
    if (mode === 'diario') return list;

    const groups: { [key: string]: any } = {};
    list.forEach(item => {
      const dateParts = item.date.split('-');
      const keyDate = mode === 'mensual' ? `${dateParts[0]}-${dateParts[1]}` : dateParts[0];
      const compoundKey = `${keyDate}_${item.category}`;

      if (!groups[compoundKey]) {
        groups[compoundKey] = {
          date: keyDate,
          category: item.category,
          hours: Array(24).fill(0),
          total: 0
        };
      }

      const g = groups[compoundKey];
      g.total += item.total || 0;
      if (item.hours) {
        for (let i = 0; i < 24; i++) {
          g.hours[i] += item.hours[i] || 0;
        }
      }
    });

    return Object.values(groups).sort((a: any, b: any) => b.date.localeCompare(a.date) || a.category.localeCompare(b.category));
  };

  const consolidatedBuckets = consolidateDailyBuckets(data.dailyBuckets, viewMode);
  const consolidatedList = consolidatedBuckets.slice(-30);
  const consolidatedHourly = consolidateHourlyData(data.hourlyData, viewMode);

  // Cálculos de totales e indicadores globales
  let totalTraffic = 0;
  let totalNormal = 0;
  let totalEspecial = 0;
  let totalExento = 0;
  let totalEspecialExento = 0;
  let totalEvasor = 0;

  data.dailyBuckets.forEach((d: any) => {
    totalTraffic += d.total || 0;
    totalNormal += d.NORMAL || 0;
    totalEspecial += d.ESPECIAL || 0;
    totalExento += d.EXENTO || 0;
    totalEspecialExento += d.ESPECIAL_EXENTO || 0;
    totalEvasor += d.EVASOR || 0;
  });

  const numDays = data.dailyBuckets.length;
  const dailyAvg = numDays > 0 ? Math.round(totalTraffic / numDays) : 0;
  
  const uniqueMonths = new Set(data.dailyBuckets.map((d: any) => d.date.substring(0, 7))).size;
  const monthlyAvg = uniqueMonths > 0 ? Math.round(totalTraffic / uniqueMonths) : 0;

  // --- CHART CALCULATION (Perfil Horario 7 Días) ---
  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const colors = {
    'Domingo': '#14b8a6', // Teal
    'Lunes': '#3b82f6', // Blue
    'Martes': '#ef4444', // Red
    'Miércoles': '#10b981', // Emerald
    'Jueves': '#f59e0b', // Amber
    'Viernes': '#8b5cf6', // Violet
    'Sábado': '#ec4899' // Pink
  };

  const allDates = Array.from(new Set(data.hourlyData.map((r: any) => r.date))) as string[];
  allDates.sort((a: any, b: any) => b.localeCompare(a));
  const last30Dates = new Set(allDates.slice(0, 30));

  const dateHourSums: Record<string, number> = {}; 
  const uniqueDatesByWeekday: Record<string, Set<string>> = {
    'Domingo': new Set(), 'Lunes': new Set(), 'Martes': new Set(), 'Miércoles': new Set(), 'Jueves': new Set(), 'Viernes': new Set(), 'Sábado': new Set()
  };

  data.hourlyData.forEach((row: any) => {
    if (!last30Dates.has(row.date)) return;
    const d = new Date(row.date + 'T12:00:00Z');
    const dayName = daysOfWeek[d.getDay()];
    if (dayName) {
      uniqueDatesByWeekday[dayName].add(row.date);
      for (let h = 0; h < 24; h++) {
        const key = `${row.date}|${h}`;
        dateHourSums[key] = (dateHourSums[key] || 0) + (row.hours[h] || 0);
      }
    }
  });

  const chartData = Array.from({ length: 24 }, (_, h) => {
    const obj: any = { hour: `${h.toString().padStart(2, '0')}:00` };
    daysOfWeek.forEach(day => {
      let sumForDayAndHour = 0;
      uniqueDatesByWeekday[day].forEach(dateStr => {
        sumForDayAndHour += (dateHourSums[`${dateStr}|${h}`] || 0);
      });
      const count = uniqueDatesByWeekday[day].size;
      obj[day] = count > 0 ? Math.round(sumForDayAndHour / count) : 0;
    });
    return obj;
  });

  const totalDaysProcessed = Object.values(uniqueDatesByWeekday).reduce((acc, set) => acc + set.size, 0);

  // --- HEATMAP CALCULATION (All Dates) ---
  const daysOfWeekHeatmap = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const categoriesHeatmap = ['Cat I', 'Cat II', 'Cat III', 'Cat IV'];
  const heatmapUniqueDates: Record<string, Set<string>> = {
    'Lunes': new Set(), 'Martes': new Set(), 'Miércoles': new Set(), 'Jueves': new Set(), 'Viernes': new Set(), 'Sábado': new Set(), 'Domingo': new Set()
  };

  const heatmapSums: Record<number, Record<string, Record<string, number>>> = {};
  for (let h = 0; h < 24; h++) {
    heatmapSums[h] = {
      'Lunes': { 'Cat I': 0, 'Cat II': 0, 'Cat III': 0, 'Cat IV': 0, 'TOTAL': 0 },
      'Martes': { 'Cat I': 0, 'Cat II': 0, 'Cat III': 0, 'Cat IV': 0, 'TOTAL': 0 },
      'Miércoles': { 'Cat I': 0, 'Cat II': 0, 'Cat III': 0, 'Cat IV': 0, 'TOTAL': 0 },
      'Jueves': { 'Cat I': 0, 'Cat II': 0, 'Cat III': 0, 'Cat IV': 0, 'TOTAL': 0 },
      'Viernes': { 'Cat I': 0, 'Cat II': 0, 'Cat III': 0, 'Cat IV': 0, 'TOTAL': 0 },
      'Sábado': { 'Cat I': 0, 'Cat II': 0, 'Cat III': 0, 'Cat IV': 0, 'TOTAL': 0 },
      'Domingo': { 'Cat I': 0, 'Cat II': 0, 'Cat III': 0, 'Cat IV': 0, 'TOTAL': 0 }
    };
  }

  data.hourlyData.forEach((row: any) => {
    const d = new Date(row.date + 'T12:00:00Z');
    const dayName = daysOfWeek[d.getDay()];
    if (dayName && heatmapUniqueDates[dayName]) {
      heatmapUniqueDates[dayName].add(row.date);
      for (let h = 0; h < 24; h++) {
        const qty = row.hours[h] || 0;
        if (categoriesHeatmap.includes(row.category)) {
          heatmapSums[h][dayName][row.category] += qty;
        }
        heatmapSums[h][dayName]['TOTAL'] += qty;
      }
    }
  });

  const heatmapAverages: Record<number, Record<string, Record<string, number>>> = {};
  const heatmapMinMax: Record<string, { min: number, max: number }> = {};
  [...categoriesHeatmap, 'TOTAL'].forEach(cat => {
    heatmapMinMax[cat] = { min: Infinity, max: 0 };
  });

  for (let h = 0; h < 24; h++) {
    heatmapAverages[h] = {};
    daysOfWeekHeatmap.forEach(day => {
      heatmapAverages[h][day] = {};
      const count = heatmapUniqueDates[day].size || 1;
      
      [...categoriesHeatmap, 'TOTAL'].forEach(cat => {
        const avg = heatmapSums[h][day][cat] / count;
        heatmapAverages[h][day][cat] = avg;
        if (avg < heatmapMinMax[cat].min) heatmapMinMax[cat].min = avg;
        if (avg > heatmapMinMax[cat].max) heatmapMinMax[cat].max = avg;
      });
    });
  }

  // Handle Infinity if no data
  [...categoriesHeatmap, 'TOTAL'].forEach(cat => {
    if (heatmapMinMax[cat].min === Infinity) heatmapMinMax[cat].min = 0;
  });

  const getHeatmapColor = (val: number, cat: string) => {
    const min = heatmapMinMax[cat].min;
    const max = heatmapMinMax[cat].max;
    if (max === min || val === 0) return 'transparent'; // White/transparent for zero or flat
    
    const ratio = (val - min) / (max - min);
    // Colors from the excel model: Green(rgb 90, 190, 110) -> Yellow(255, 230, 100) -> Red(245, 90, 90)
    let r, g, b;
    if (ratio < 0.5) {
      const normalized = ratio * 2;
      r = Math.round(90 + normalized * (255 - 90));
      g = Math.round(190 + normalized * (230 - 190));
      b = Math.round(110 + normalized * (100 - 110));
    } else {
      const normalized = (ratio - 0.5) * 2;
      r = Math.round(255 + normalized * (245 - 255));
      g = Math.round(230 + normalized * (90 - 230));
      b = Math.round(100 + normalized * (90 - 100));
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Grand totals for heatmap footer
  const heatmapGrandTotals: Record<string, Record<string, number>> = {};
  daysOfWeekHeatmap.forEach(day => {
    heatmapGrandTotals[day] = {};
    [...categoriesHeatmap, 'TOTAL'].forEach(cat => {
      let sum = 0;
      for (let h = 0; h < 24; h++) {
        sum += heatmapAverages[h][day][cat];
      }
      heatmapGrandTotals[day][cat] = sum;
    });
  });

  // Calculate Min/Max specifically for the Grand Totals to color them
  const heatmapGrandTotalsMinMax: Record<string, { min: number, max: number }> = {};
  [...categoriesHeatmap, 'TOTAL'].forEach(cat => {
    heatmapGrandTotalsMinMax[cat] = { min: Infinity, max: 0 };
  });

  daysOfWeekHeatmap.forEach(day => {
    [...categoriesHeatmap, 'TOTAL'].forEach(cat => {
      const val = heatmapGrandTotals[day][cat];
      if (val < heatmapGrandTotalsMinMax[cat].min) heatmapGrandTotalsMinMax[cat].min = val;
      if (val > heatmapGrandTotalsMinMax[cat].max) heatmapGrandTotalsMinMax[cat].max = val;
    });
  });

  [...categoriesHeatmap, 'TOTAL'].forEach(cat => {
    if (heatmapGrandTotalsMinMax[cat].min === Infinity) heatmapGrandTotalsMinMax[cat].min = 0;
  });

  const getHeatmapGrandTotalColor = (val: number, cat: string) => {
    const min = heatmapGrandTotalsMinMax[cat].min;
    const max = heatmapGrandTotalsMinMax[cat].max;
    if (max === min || val === 0) return 'transparent';
    
    const ratio = (val - min) / (max - min);
    let r, g, b;
    if (ratio < 0.5) {
      const normalized = ratio * 2;
      r = Math.round(90 + normalized * (255 - 90));
      g = Math.round(190 + normalized * (230 - 190));
      b = Math.round(110 + normalized * (100 - 110));
    } else {
      const normalized = (ratio - 0.5) * 2;
      r = Math.round(255 + normalized * (245 - 255));
      g = Math.round(230 + normalized * (90 - 230));
      b = Math.round(100 + normalized * (90 - 100));
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  // --- GRÁFICOS Y CONCLUSIONES ANALÍTICAS ---
  const chartAcumulado = Array.from({ length: 24 }, (_, h) => {
    const obj: any = { hour: `${h}` };
    daysOfWeekHeatmap.forEach(day => {
      obj[day] = heatmapAverages[h][day]['TOTAL'];
    });
    return obj;
  });

  const chartCategorias: any[] = [];
  categoriesHeatmap.forEach(cat => {
    let sumCat = 0;
    daysOfWeekHeatmap.forEach(day => { sumCat += heatmapGrandTotals[day][cat]; });
    chartCategorias.push({ name: cat, value: sumCat });
  });
  const COLORS_PIE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  const chartPromedioSemanal = daysOfWeekHeatmap.map(day => ({
    name: day,
    value: heatmapGrandTotals[day]['TOTAL']
  }));

  const chartFinSemana = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}`,
    'Sábado': heatmapAverages[h]['Sábado']['TOTAL'],
    'Domingo': heatmapAverages[h]['Domingo']['TOTAL']
  }));

  // Cálculos Dinámicos
  let maxPeakValue = 0;
  let peakHour = 0;
  let peakDay = '';

  daysOfWeekHeatmap.forEach(day => {
    for (let h = 0; h < 24; h++) {
      if (heatmapAverages[h][day]['TOTAL'] > maxPeakValue) {
        maxPeakValue = heatmapAverages[h][day]['TOTAL'];
        peakHour = h;
        peakDay = day;
      }
    }
  });

  // Top 5 Peak Hours
  const allHoursArray: {day: string, hour: number, val: number}[] = [];
  daysOfWeekHeatmap.forEach(day => {
    for (let h = 0; h < 24; h++) {
      allHoursArray.push({
        day,
        hour: h,
        val: heatmapAverages[h][day]['TOTAL']
      });
    }
  });
  
  const top5PeakHours = allHoursArray
    .sort((a, b) => b.val - a.val)
    .slice(0, 5);

  let sumWeekly = 0;
  daysOfWeekHeatmap.forEach(day => { sumWeekly += heatmapGrandTotals[day]['TOTAL']; });
  const avgWeekly = sumWeekly / 7;

  const incrementoDomingo = avgWeekly > 0 
    ? (((heatmapGrandTotals['Domingo']['TOTAL'] - avgWeekly) / avgWeekly) * 100)
    : 0;

  let sumDomingo3a6 = 0; // 15:00 a 18:00 (Hours 15, 16, 17)
  for (let h = 15; h < 18; h++) {
    sumDomingo3a6 += heatmapAverages[h]['Domingo']['TOTAL'];
  }

  const isNightPeak = peakHour >= 18 || peakHour <= 5;
  const periodText = isNightPeak ? 'periodo nocturno' : 'periodo diurno';
  
  const format12H = (h: number) => {
    const ampm = h >= 12 ? 'p.m.' : 'a.m.';
    let hr12 = h % 12;
    if (hr12 === 0) hr12 = 12;
    return `${hr12.toString().padStart(2, '0')}:00 ${ampm}`;
  };

  const conclusionText = `El mayor volumen de tránsito, en promedio, se presenta durante el ${periodText}, siendo para el ${peakDay.toLowerCase()} la franja entre las ${format12H(peakHour)} y las ${format12H(peakHour + 1)} la de mayor concentración vehicular del día, alcanzando un pico máximo de ${maxPeakValue.toFixed(0)} vehículos promedio por hora. Esto la identifica como la franja más crítica del periodo seleccionado.`;

  // Hourly columns list 00-24
  const hoursColumns = Array.from({ length: 24 }, (_, idx) => {
    const startStr = idx.toString().padStart(2, '0');
    const endStr = (idx + 1).toString().padStart(2, '0');
    return `${startStr}-${endStr}`;
  });

  const formatHeaderDate = (dateStr: string, mode: 'diario' | 'mensual' | 'anual') => {
    if (mode === 'anual') return dateStr;
    if (mode === 'mensual') {
      const parts = dateStr.split('-');
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${monthNames[monthIdx]} ${parts[0]}`;
    }
    return dateStr;
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-3">
          <HistoricalBanner />
        </div>
      </div>

      {/* Filter & Actions Bar */}
      <div className="peaje-card p-4 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        {/* Left Side: Date Filters */}
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="space-y-1 w-full sm:w-auto">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Mes de Operación</label>
            <select
              className="peaje-input py-2 text-sm min-w-[220px] cursor-pointer outline-none"
              value={`${startDate}|${endDate}`}
              onChange={(e) => {
                const [s, eDate] = e.target.value.split('|');
                setStartDate(s);
                setEndDate(eDate);
              }}
            >
              <option value="|">Todos los meses</option>
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button type="button" onClick={() => {
              const def = getDefaultPeriod();
              setStartDate(def.start);
              setEndDate(def.end);
            }} className="peaje-btn peaje-btn-secondary py-2 px-4 flex items-center justify-center">
              <span className="text-sm">Mes Actual</span>
            </button>
          </div>
        </div>

        {/* Right Side: Toggles & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
            {(['diario', 'mensual', 'anual'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
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

      {hasData ? (
        <>
          {/* Key Metrics cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="peaje-card flex flex-col justify-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Normales</p>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">{totalNormal.toLocaleString()}</h3>
              </div>
            </div>

            <div className="peaje-card flex flex-col justify-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Especiales</p>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">{totalEspecial.toLocaleString()}</h3>
              </div>
            </div>

            <div className="peaje-card flex flex-col justify-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Evasores</p>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">{totalEvasor.toLocaleString()}</h3>
              </div>
            </div>

            <div className="peaje-card flex flex-col justify-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Esp. Exentos</p>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">{totalEspecialExento.toLocaleString()}</h3>
              </div>
            </div>

            <div className="peaje-card flex flex-col justify-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Exentos</p>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">{totalExento.toLocaleString()}</h3>
              </div>
            </div>

            <div className="peaje-card flex flex-col justify-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tránsito Total</p>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">{totalTraffic.toLocaleString()}</h3>
              </div>
            </div>

            <div className="peaje-card flex flex-col justify-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Prom. Diario</p>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">{dailyAvg.toLocaleString()}</h3>
              </div>
            </div>

            <div className="peaje-card flex flex-col justify-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Prom. Mes</p>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">{monthlyAvg.toLocaleString()}</h3>
              </div>
            </div>
          </div>

          {/* Sub-navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('buckets')}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'buckets'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Resumen Matriz (Buckets)
            </button>
            <button
              onClick={() => setActiveTab('hourly')}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'hourly'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Tráfico por Hora (Detalle)
            </button>
            <button
              onClick={() => setActiveTab('heatmap')}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'heatmap'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Promedio Horario por Periodo
            </button>
          </div>

          {/* Table content */}
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Cargando filtros aplicados...</div>
          ) : (
            <>
              {activeTab === 'buckets' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">
                      Consolidado {viewMode === 'diario' ? 'Diario' : viewMode === 'mensual' ? 'Mensual' : 'Anual'} de Tránsito por Buckets (Hoja MATRIZ)
                    </span>
                  </div>

                  <div className="peaje-table-container">
                    <table className="peaje-table">
                      <thead>
                        <tr>
                          {viewMode === 'diario' && <th>Día</th>}
                          <th>{viewMode === 'diario' ? 'Fecha' : viewMode === 'mensual' ? 'Mes' : 'Año'}</th>
                          <th>Normales</th>
                          <th>Especiales</th>
                          <th>Evasores</th>
                          <th>Especiales Exentos</th>
                          <th>Exentos</th>
                          <th className="bg-indigo-50/50 dark:bg-indigo-950/20">Tránsito Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consolidatedBuckets.map((row: any) => (
                          <tr key={row.date}>
                            {viewMode === 'diario' && <td className="capitalize">{row.weekday}</td>}
                            <td className="font-mono font-medium">
                              {viewMode === 'diario' ? formatShortDate(row.date) : formatHeaderDate(row.date, viewMode)}
                            </td>
                            <td>{row.NORMAL.toLocaleString()}</td>
                            <td>{row.ESPECIAL.toLocaleString()}</td>
                            <td className={row.EVASOR > 0 ? 'text-rose-500 font-bold' : ''}>
                              {row.EVASOR.toLocaleString()}
                            </td>
                            <td>{row.ESPECIAL_EXENTO.toLocaleString()}</td>
                            <td>{row.EXENTO.toLocaleString()}</td>
                            <td className="font-bold bg-indigo-50/10 dark:bg-indigo-950/10">{row.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-900/50 font-bold border-t-2 text-sm" style={{ borderColor: 'var(--border-color)' }}>
                        <tr>
                          {viewMode === 'diario' && <td></td>}
                          <td className="text-right pr-4 uppercase text-xs">Total General</td>
                          <td className="text-indigo-700 dark:text-indigo-400">{totalNormal.toLocaleString()}</td>
                          <td className="text-indigo-700 dark:text-indigo-400">{totalEspecial.toLocaleString()}</td>
                          <td className="text-rose-600 dark:text-rose-400">{totalEvasor.toLocaleString()}</td>
                          <td className="text-indigo-700 dark:text-indigo-400">{totalEspecialExento.toLocaleString()}</td>
                          <td className="text-indigo-700 dark:text-indigo-400">{totalExento.toLocaleString()}</td>
                          <td className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-300">{totalTraffic.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'hourly' && (
                <div className="space-y-4">
                  {/* Perfil Horario Chart */}
                  <div className="peaje-card space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-orange-500" />
                          Trafico / Hora (7 Días)
                        </h3>
                        <p className="text-sm text-slate-500">Volumen promedio de tránsito por hora (basado en {totalDaysProcessed} días)</p>
                      </div>
                      <button 
                        onClick={() => setShowPeakHours(!showPeakHours)}
                        className={`px-4 py-1.5 font-bold text-xs rounded-lg shadow-sm border transition-colors ${
                          showPeakHours 
                            ? 'bg-orange-500 text-white border-orange-600' 
                            : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                        }`}
                      >
                        Horas Pico
                      </button>
                    </div>
                    <div className="h-80 w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
                          {daysOfWeek.map(day => (
                            <Bar 
                              key={day} 
                              dataKey={day} 
                              fill={(colors as any)[day]} 
                              radius={[2, 2, 0, 0]}
                              opacity={showPeakHours ? (day === 'Lunes' || day === 'Sábado' || day === 'Viernes' ? 1 : 0.2) : 1}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-6">
                    <span className="text-xs font-bold text-slate-500">
                      Consolidado {viewMode === 'diario' ? 'Diario' : viewMode === 'mensual' ? 'Mensual' : 'Anual'} de Tránsito Horario por Categoría 00-24 (Hoja TRAFICO HORA)
                    </span>
                  </div>

                  <div className="peaje-table-container">
                    <table className="peaje-table">
                      <thead>
                        <tr>
                          <th className="text-center">FECHA</th>
                          <th className="text-center">CAT.</th>
                          {hoursColumns.map((colName) => (
                            <th key={colName} className="text-center px-1 text-[9px]">{colName}</th>
                          ))}
                          <th className="bg-indigo-50/50 dark:bg-indigo-950/20 text-center">TOTAL<br/>CAT</th>
                          <th className="bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-center">TOTAL<br/>TRAFICO DIA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const groupedByDate: Record<string, any[]> = {};
                          consolidatedHourly.forEach((row: any) => {
                            if (!groupedByDate[row.date]) groupedByDate[row.date] = [];
                            groupedByDate[row.date].push(row);
                          });

                          return Object.entries(groupedByDate).map(([date, rows]) => {
                            const dailyTotal = rows.reduce((sum: number, r: any) => sum + r.total, 0);
                            return rows.map((row: any, i: number) => (
                              <tr key={`${date}-${row.category}`}>
                                {i === 0 && (
                                  <td rowSpan={rows.length} className="font-mono bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 align-middle text-center whitespace-nowrap px-2">
                                    {viewMode === 'diario' ? formatShortDate(date) : formatHeaderDate(date, viewMode)}
                                  </td>
                                )}
                                <td className="font-bold text-center border-r border-slate-200 dark:border-slate-800">{row.category}</td>
                                {row.hours.map((val: number, hrIdx: number) => (
                                  <td key={hrIdx} className={`text-center px-1 border-r border-slate-100 dark:border-slate-800/50 ${val === 0 ? 'text-slate-300 dark:text-slate-700' : ''}`}>
                                    {val.toLocaleString()}
                                  </td>
                                ))}
                                <td className="font-bold bg-indigo-50/10 dark:bg-indigo-950/10 text-center border-x border-slate-200 dark:border-slate-800">{row.total.toLocaleString()}</td>
                                {i === 0 && (
                                  <td rowSpan={rows.length} className="font-black bg-indigo-50 dark:bg-indigo-950/40 border-l border-slate-300 dark:border-slate-700 align-middle text-center text-indigo-700 dark:text-indigo-400 px-3">
                                    {dailyTotal.toLocaleString()}
                                  </td>
                                )}
                              </tr>
                            ));
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'heatmap' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Promedio Horario por Periodo
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-400">
                          Total días procesados: {Object.values(heatmapUniqueDates).reduce((acc: number, set: any) => acc + set.size, 0)}
                        </span>
                        <button onClick={() => window.print()} className="peaje-btn peaje-btn-secondary py-1 px-3 text-xs flex items-center">
                          <Printer className="w-3 h-3 mr-2" /> Imprimir / PDF
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      * Rango analizado: <span className="font-semibold text-slate-600 dark:text-slate-400">
                        {allDates.length > 0 ? `${formatShortDate(allDates[allDates.length - 1])} al ${formatShortDate(allDates[0])}` : 'N/A'}
                      </span>
                    </p>
                  </div>

                  {/* TABLA HEATMAP (YA EXISTENTE) */}
                  <div className="peaje-table-container">
                    <table className="heatmap-table !border-[3px] !border-indigo-800">
                      <thead>
                        <tr>
                          <th colSpan={2} className="!border-r-[3px] !border-indigo-800 border-b-2">HORARIO</th>
                          {daysOfWeekHeatmap.map(day => (
                            <th key={day} colSpan={5} className="!border-r-[3px] !border-indigo-800 border-b-2 uppercase">{day}</th>
                          ))}
                        </tr>
                        <tr>
                          <th className="bg-slate-50 border-r-0 text-xs w-[60px] whitespace-nowrap px-1">Hora Inicio</th>
                          <th className="bg-slate-50 !border-r-[3px] !border-indigo-800 text-xs w-[60px] whitespace-nowrap px-1">Hora Fin</th>
                          {daysOfWeekHeatmap.map(day => (
                            <React.Fragment key={`${day}-cols`}>
                              <th className="bg-slate-50 text-[9px] font-mono font-bold w-[30px]">CI</th>
                              <th className="bg-slate-50 text-[9px] font-mono font-bold w-[30px]">CII</th>
                              <th className="bg-slate-50 text-[9px] font-mono font-bold w-[30px]">CIII</th>
                              <th className="bg-slate-50 text-[9px] font-mono font-bold w-[30px]">CIV</th>
                              <th className="bg-slate-50 text-[9px] font-mono font-black !border-r-[3px] !border-indigo-800 w-[40px]">TOTAL</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 24 }).map((_, h) => {
                          const startStr = `${h.toString().padStart(2, '0')}:00`;
                          const endStr = `${h.toString().padStart(2, '0')}:59`;
                          
                          return (
                            <tr key={h}>
                              <td className="text-[11px] font-bold text-slate-600 border-r-0">{startStr}</td>
                              <td className="text-[11px] font-bold text-slate-600 !border-r-[3px] !border-indigo-800">{endStr}</td>
                              {daysOfWeekHeatmap.map(day => (
                                <React.Fragment key={`${h}-${day}`}>
                                  {categoriesHeatmap.map(cat => {
                                    const val = heatmapAverages[h][day][cat];
                                    return (
                                      <td 
                                        key={`${h}-${day}-${cat}`}
                                        className="heatmap-cell"
                                        style={{ backgroundColor: getHeatmapColor(val, cat) }}
                                      >
                                        {val.toFixed(0)}
                                      </td>
                                    );
                                  })}
                                  <td 
                                    className="heatmap-cell !border-r-[3px] !border-indigo-800 font-bold bg-slate-50/50"
                                    style={{ backgroundColor: getHeatmapColor(heatmapAverages[h][day]['TOTAL'], 'TOTAL') }}
                                  >
                                    {heatmapAverages[h][day]['TOTAL'].toFixed(0)}
                                  </td>
                                </React.Fragment>
                              ))}
                            </tr>
                          );
                        })}
                        {/* GRAND TOTAL ROW */}
                        <tr>
                          <td colSpan={2} className="font-black text-center !border-r-[3px] !border-indigo-800 border-t-2 text-sm">TOTAL</td>
                          {daysOfWeekHeatmap.map(day => (
                            <React.Fragment key={`total-${day}`}>
                              {categoriesHeatmap.map(cat => (
                                <td 
                                  key={`total-${day}-${cat}`} 
                                  className="border-t-2 font-bold heatmap-cell"
                                  style={{ backgroundColor: getHeatmapGrandTotalColor(heatmapGrandTotals[day][cat], cat) }}
                                >
                                  {heatmapGrandTotals[day][cat].toFixed(0)}
                                </td>
                              ))}
                              <td 
                                className="border-t-2 !border-r-[3px] !border-indigo-800 font-black heatmap-cell"
                                style={{ backgroundColor: getHeatmapGrandTotalColor(heatmapGrandTotals[day]['TOTAL'], 'TOTAL') }}
                              >
                                {heatmapGrandTotals[day]['TOTAL'].toFixed(0)}
                              </td>
                            </React.Fragment>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* --- NUEVO: DASHBOARD ANALÍTICO (4 GRÁFICOS Y CONCLUSIÓN) --- */}
                  <div className="mt-8 space-y-4">
                    {/* Fila 1 de Gráficos */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Total Acumulado */}
                      <div className="peaje-card p-4 flex flex-col items-center">
                        <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-4">Total Acumulado de Vehículos por Hora</h4>
                        <div className="w-full h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartAcumulado} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ fontSize: '10px' }} formatter={(val: any) => Math.round(Number(val)).toLocaleString()} />
                              <Legend wrapperStyle={{ fontSize: '9px' }} iconType="square" />
                              {daysOfWeekHeatmap.map((day, idx) => (
                                <Bar key={day} dataKey={day} stackId="a" fill={COLORS_PIE[idx % COLORS_PIE.length]} />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Distribución por Categorías */}
                      <div className="peaje-card p-4 flex flex-col items-center">
                        <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-4">Distribución por Categorías de Vehículo</h4>
                        <div className="w-full h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={chartCategorias}
                                cx="50%"
                                cy="50%"
                                innerRadius={0}
                                outerRadius={80}
                                dataKey="value"
                                label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                labelLine={false}
                                style={{ fontSize: '10px', fontWeight: 'bold' }}
                              >
                                {chartCategorias.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ fontSize: '10px' }} formatter={(val: any) => Math.round(Number(val)).toLocaleString()} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Fila 2 de Gráficos */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Promedio Tráfico Semanal */}
                      <div className="peaje-card p-4 flex flex-col items-center">
                        <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-4">Promedio Tráfico Semanal</h4>
                        <div className="w-full h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartPromedioSemanal} margin={{ top: 20, right: 5, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ fontSize: '10px' }} cursor={{ fill: 'transparent' }} formatter={(val: any) => Math.round(Number(val)).toLocaleString()} />
                              <Bar dataKey="value" radius={[2,2,0,0]}>
                                {chartPromedioSemanal.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Tráfico Horario del Fin de Semana */}
                      <div className="peaje-card p-4 flex flex-col items-center">
                        <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-4">Tráfico Horario del Fin de Semana</h4>
                        <div className="w-full h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartFinSemana} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ fontSize: '10px' }} formatter={(val: any) => Math.round(Number(val)).toLocaleString()} />
                              <Legend wrapperStyle={{ fontSize: '9px' }} iconType="plainline" />
                              <Line type="monotone" dataKey="Sábado" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="Domingo" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Bloque de Conclusión Dinámica */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
                      {/* Conclusión (Recuadro Amarillo) */}
                      <div className="bg-yellow-100/80 border border-yellow-200 rounded-lg p-5 flex flex-col justify-center">
                        <h4 className="text-[11px] font-black text-yellow-800 uppercase flex items-center gap-2 mb-3">
                          <span className="w-4 h-4 bg-yellow-400 rounded-sm inline-block"></span>
                          Conclusión y Recomendación:
                        </h4>
                        <p className="text-sm font-medium text-slate-800 leading-relaxed mb-4">
                          {conclusionText}
                        </p>
                        
                        <div className="border-t border-yellow-300/50 pt-3 mt-auto">
                          <span className="text-[10px] font-bold uppercase text-yellow-800 mb-2 block tracking-wider">Top 5 Franjas Críticas:</span>
                          <div className="flex flex-wrap gap-2">
                            {top5PeakHours.map((item, i) => (
                              <div key={i} className="flex items-center gap-1.5 bg-yellow-200/60 border border-yellow-300 rounded-md px-2 py-1 shadow-sm">
                                <span className="font-black text-yellow-800 text-[10px] bg-yellow-300/50 rounded-full w-4 h-4 flex items-center justify-center">{i + 1}</span>
                                <span className="text-yellow-900 text-xs font-bold uppercase">{item.day} {format12H(item.hour)}</span>
                                <span className="text-yellow-700 text-[10px] font-medium">({item.val.toFixed(0)} veh)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Métricas a la derecha */}
                      <div className="flex flex-col gap-2">
                        <div className="flex bg-slate-50 border border-slate-200 rounded-md">
                          <div className="flex-1 p-3 border-r border-slate-200 flex flex-col justify-center">
                            <span className="text-[10px] uppercase text-slate-500 font-bold">Hora Pico: <span className="text-lg font-black text-slate-800 ml-1">{format12H(peakHour)}</span></span>
                            <span className="text-xs font-bold text-slate-800">{maxPeakValue.toFixed(0)} vehículos</span>
                          </div>
                          <div className="flex-1 p-3 flex flex-col justify-center items-center text-center">
                            <span className="text-lg font-black text-emerald-500">
                              {incrementoDomingo > 0 ? '+' : ''}{incrementoDomingo.toFixed(0)}%
                            </span>
                            <span className="text-[9px] uppercase text-slate-500 font-bold leading-tight mt-1">
                              Incremento Domingo vs<br/>promedio semanal
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-center">
                          <span className="text-[10px] font-bold text-slate-500 italic block mb-1">Incremento del día DOMINGO</span>
                          <div className="flex justify-between items-center bg-white border border-slate-200 p-2 rounded">
                            <span className="text-[10px] uppercase font-bold text-slate-600 text-left w-2/3 leading-tight">
                              Total de vehículos promedio que circulan de 3pm a 6pm
                            </span>
                            <span className="text-xl font-black text-slate-800">
                              {sumDomingo3a6.toFixed(0)}
                            </span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-500 italic block mt-1">Vehículos que circulan de 3pm a 6pm DOMINGO</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="peaje-card py-12 text-center text-slate-400">
          No hay datos de tránsito para el periodo seleccionado.
        </div>
      )}
    </div>
  );
}
