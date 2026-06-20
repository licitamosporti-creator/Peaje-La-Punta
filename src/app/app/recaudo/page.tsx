'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { HistoricalBanner } from '@/components/HistoricalBanner';
import { DollarSign, Landmark, Coins, CreditCard, Filter, Printer, Download, Trash2 } from 'lucide-react';
import { formatCOP, formatHeaderDate } from '@/lib/formatters';
import { exportToCSV } from '@/lib/exportCsv';

export default function AppRecaudo() {
  const [data, setData] = useState<any>({ matrix: [], ticketDetails: [], adjustments: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matrix' | 'adjustments'>('matrix');
  const [viewMode, setViewMode] = useState<'diario' | 'mensual' | 'anual'>('diario');

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
      startMonth = month;
      endMonth = month + 1;
      if (endMonth > 11) {
        endMonth = 0;
        endYear++;
      }
    } else {
      endMonth = month;
      startMonth = month - 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear--;
      }
    }

    const format = (y: number, m: number, d: number) => 
      `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    return {
      start: format(startYear, startMonth, 21),
      end: format(endYear, endMonth, 20)
    };
  };

  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    // System data starts around March 2026. The period for March 2026 is Feb 21 to Mar 20.
    const startDatePeriod = new Date(2026, 1, 21); 
    const endDatePeriod = new Date(now.getFullYear(), now.getMonth() + 2, 21); 

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

  // Filters
  const [startDate, setStartDate] = useState(getDefaultPeriod().start);
  const [endDate, setEndDate] = useState(getDefaultPeriod().end);

  const fetchRecaudo = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = '/api/app/recaudo';
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
      console.error('Error loading recaudo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecaudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecaudo();
  };

  const handleClearFilter = () => {
    const period = getDefaultPeriod();
    setStartDate(period.start);
    setEndDate(period.end);
    
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch(`/api/app/recaudo?startDate=${period.start}&endDate=${period.end}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) setData(json.data);
      setLoading(false);
    })
    .catch(() => setLoading(false));
  };

  if (loading && data.matrix.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Cargando módulo de recaudo...</p>
      </div>
    );
  }


  const hasData = data.matrix.length > 0;

  // Lógica de consolidación
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

  const consolidateMatrix = (list: any[], mode: 'diario' | 'mensual' | 'anual') => {
    if (mode === 'diario') return list;

    const groups: { [key: string]: any } = {};
    list.forEach(item => {
      const dateParts = item.date.split('-');
      const key = mode === 'mensual' ? `${dateParts[0]}-${dateParts[1]}` : dateParts[0];

      if (!groups[key]) {
        groups[key] = {
          date: key,
          weekday: '',
          revenueCat: { I: 0, II: 0, III: 0, IV: 0 },
          totalRevenue: 0,
          adjustments: { SOBRANTE: 0, SOBRANTE_EQUIPO: 0, AJUSTE_DATAFONO: 0, total: 0 },
          totalRevenueWithAdjustments: 0,
          payments: { EFECTIVO: 0, ELECTRONICO: 0, IPREV_COLPASS: 0, total: 0 }
        };
      }

      const g = groups[key];
      g.totalRevenue += item.totalRevenue || 0;
      g.totalRevenueWithAdjustments += item.totalRevenueWithAdjustments || 0;

      if (item.revenueCat) {
        g.revenueCat.I += item.revenueCat.I || 0;
        g.revenueCat.II += item.revenueCat.II || 0;
        g.revenueCat.III += item.revenueCat.III || 0;
        g.revenueCat.IV += item.revenueCat.IV || 0;
      }

      if (item.adjustments) {
        g.adjustments.SOBRANTE += item.adjustments.SOBRANTE || 0;
        g.adjustments.SOBRANTE_EQUIPO += item.adjustments.SOBRANTE_EQUIPO || 0;
        g.adjustments.AJUSTE_DATAFONO += item.adjustments.AJUSTE_DATAFONO || 0;
        g.adjustments.total += item.adjustments.total || 0;
      }

      if (item.payments) {
        g.payments.EFECTIVO += item.payments.EFECTIVO || 0;
        g.payments.ELECTRONICO += item.payments.ELECTRONICO || 0;
        g.payments.IPREV_COLPASS += item.payments.IPREV_COLPASS || 0;
        g.payments.total += item.payments.total || 0;
      }
    });

    return Object.values(groups).sort((a: any, b: any) => b.date.localeCompare(a.date));
  };

  const consolidateTickets = (list: any[], mode: 'diario' | 'mensual' | 'anual') => {
    if (mode === 'diario') return list;

    const groups: { [key: string]: any } = {};
    list.forEach(item => {
      const dateParts = item.date.split('-');
      const keyDate = mode === 'mensual' ? `${dateParts[0]}-${dateParts[1]}` : dateParts[0];
      const compoundKey = `${keyDate}_${item.caja}_${item.ticket_category}_${item.tariff}`;

      if (!groups[compoundKey]) {
        groups[compoundKey] = {
          id: compoundKey,
          date: keyDate,
          caja: item.caja,
          ticket_category: item.ticket_category,
          tariff: item.tariff,
          ticket_start: 'Consolidado',
          ticket_end: 'Consolidado',
          quantity: 0,
          amount: 0
        };
      }

      const g = groups[compoundKey];
      g.quantity += item.quantity || 0;
      g.amount += item.amount || 0;
    });

    return Object.values(groups).sort((a: any, b: any) => b.date.localeCompare(a.date) || a.caja.localeCompare(b.caja));
  };

  const consolidateAdjustments = (list: any[], mode: 'diario' | 'mensual' | 'anual') => {
    if (mode === 'diario') return list;

    const groups: { [key: string]: any } = {};
    list.forEach(item => {
      const dateParts = item.date.split('-');
      const keyDate = mode === 'mensual' ? `${dateParts[0]}-${dateParts[1]}` : dateParts[0];
      const compoundKey = `${keyDate}_${item.type}`;

      if (!groups[compoundKey]) {
        groups[compoundKey] = {
          date: keyDate,
          type: item.type,
          amount: 0
        };
      }

      const g = groups[compoundKey];
      g.amount += item.amount || 0;
    });

    return Object.values(groups).sort((a: any, b: any) => b.date.localeCompare(a.date));
  };

  const consolidatedMatrix = consolidateMatrix(data.matrix, viewMode);
  const consolidatedTickets = consolidateTickets(data.ticketDetails, viewMode);
  const consolidatedAdjustments = consolidateAdjustments(data.adjustments, viewMode);

  // Calcular totales
  let totalRecaudo = 0;
  let totalEfectivo = 0;
  let totalElectronico = 0;
  let totalIprev = 0;
  let totalAjustes = 0;

  data.matrix.forEach((d: any) => {
    totalRecaudo += d.totalRevenue;
    totalEfectivo += d.payments.EFECTIVO || 0;
    totalElectronico += d.payments.ELECTRONICO || 0;
    totalIprev += d.payments.IPREV_COLPASS || 0;
    totalAjustes += d.adjustments.total || 0;
  });

  const handleExportCSV = () => {
    if (activeTab === 'matrix') {
      const headers = [
        viewMode === 'diario' ? 'Día' : '',
        'Fecha',
        'Recaudo Cat I',
        'Recaudo Cat II',
        'Recaudo Cat III',
        'Recaudo Cat IV',
        'Total Recaudo',
        'Sobrante',
        'Sobrante Equipo',
        'Ajuste Datáfono',
        'Total + Ajustes',
        'Efectivo',
        'Electrónico',
        'IPREV',
        'Medios Pago Total'
      ].filter(Boolean);
      const rows = consolidatedMatrix.map((r: any) => {
        const base = [
          viewMode === 'diario' ? r.weekday : '',
          viewMode === 'diario' ? formatShortDate(r.date) : formatHeaderDate(r.date, viewMode),
          r.revenueCat.I,
          r.revenueCat.II,
          r.revenueCat.III,
          r.revenueCat.IV,
          r.totalRevenue,
          r.adjustments.SOBRANTE,
          r.adjustments.SOBRANTE_EQUIPO,
          r.adjustments.AJUSTE_DATAFONO,
          r.totalRevenueWithAdjustments,
          r.payments.EFECTIVO,
          r.payments.ELECTRONICO,
          r.payments.IPREV_COLPASS,
          r.payments.total
        ];
        return viewMode === 'diario' ? base : base.filter((_, i) => i !== 0);
      });
      exportToCSV(`recaudo_matriz_${viewMode}.csv`, headers, rows);
    } else if (activeTab === 'adjustments') {
      const headers = ['Fecha', 'Tipo de Ajuste', 'Monto Declarado'];
      const rows = consolidatedAdjustments.map((r: any) => [
        viewMode === 'diario' ? formatShortDate(r.date) : formatHeaderDate(r.date, viewMode),
        r.type,
        r.amount
      ]);
      exportToCSV(`recaudo_ajustes_${viewMode}.csv`, headers, rows);
    }
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
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
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

      {/* Top Bar: Filters & Actions */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        {/* Date Filter Bar */}
        <div className="peaje-card flex flex-wrap items-end gap-3 py-3 px-4 w-full xl:w-auto">
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
      </div>

      {hasData ? (
        <>
          {/* Sub-navigation tabs */}
          <div className="flex border-b" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={() => setActiveTab('matrix')}
              className="px-4 py-2 text-xs font-bold uppercase border-b-2 cursor-pointer transition-colors"
              style={{
                borderColor: activeTab === 'matrix' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'matrix' ? 'var(--primary)' : 'var(--text-secondary)'
              }}
            >
              Tabla Dinámica de Recaudo
            </button>

          </div>

          {/* Table contents based on active tab */}
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Cargando filtros aplicados...</div>
          ) : (
            <>
              {activeTab === 'matrix' && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800 dark:text-white">
                        Tabla Dinámica de Recaudo
                      </h4>
                      <p className="text-xs text-slate-500">
                        Filtra y busca registros específicos ({consolidatedMatrix.length} resultados)
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Montos en COP ($)</span>
                  </div>

                  <div className="peaje-table-container">
                    <table className="peaje-table">
                      <thead>
                        <tr>
                          {viewMode === 'diario' && <th>Día</th>}
                          <th>{viewMode === 'diario' ? 'Fecha' : viewMode === 'mensual' ? 'Mes' : 'Año'}</th>
                          <th>Recaudo<br/>Cat I</th>
                          <th>Recaudo<br/>Cat II</th>
                          <th>Recaudo<br/>Cat III</th>
                          <th>Recaudo<br/>Cat IV</th>
                          <th className="bg-indigo-50/50 dark:bg-indigo-950/20">Total<br/>Recaudo</th>
                          <th>Sobrante</th>
                          <th>Sobrante<br/>Equipo</th>
                          <th>Ajuste<br/>Datáfono</th>
                          <th className="bg-emerald-50/50 dark:bg-emerald-950/20">Total +<br/>Ajustes</th>
                          <th>Efectivo</th>
                          <th>Electrónico</th>
                          <th>IPREV</th>
                          <th>Medios Pago<br/>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                          {consolidatedMatrix.map((row: any) => {
                            const hasMismatch = row.totalRevenueWithAdjustments !== row.payments.total;
                            return (
                            <tr key={row.date} className={hasMismatch ? 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors'}>
                              {viewMode === 'diario' && <td className="capitalize text-slate-500">{row.weekday}</td>}
                              <td className="font-mono font-medium">
                                {viewMode === 'diario' ? formatShortDate(row.date) : formatHeaderDate(row.date, viewMode)}
                              </td>
                              <td>{formatCOP(row.revenueCat.I)}</td>
                              <td>{formatCOP(row.revenueCat.II)}</td>
                              <td>{formatCOP(row.revenueCat.III)}</td>
                              <td>{formatCOP(row.revenueCat.IV)}</td>
                              <td className="font-bold bg-indigo-50/10 dark:bg-indigo-950/10">{formatCOP(row.totalRevenue)}</td>
                              <td className={row.adjustments.SOBRANTE > 0 ? 'text-emerald-600' : ''}>
                                {formatCOP(row.adjustments.SOBRANTE)}
                              </td>
                              <td>{formatCOP(row.adjustments.SOBRANTE_EQUIPO)}</td>
                              <td>{formatCOP(row.adjustments.AJUSTE_DATAFONO)}</td>
                              <td className={`font-bold ${hasMismatch ? 'text-orange-600 dark:text-orange-400 bg-orange-100/50 dark:bg-orange-900/30' : 'bg-emerald-50/10 dark:bg-emerald-950/10'}`}>{formatCOP(row.totalRevenueWithAdjustments)}</td>
                              <td>{formatCOP(row.payments.EFECTIVO)}</td>
                              <td>{formatCOP(row.payments.ELECTRONICO)}</td>
                              <td>{formatCOP(row.payments.IPREV_COLPASS)}</td>
                              <td className={`font-bold ${hasMismatch ? 'text-orange-600 dark:text-orange-400 bg-orange-100/50 dark:bg-orange-900/30' : ''}`}>{formatCOP(row.payments.total)}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-slate-900/50 font-bold border-t-2 text-sm" style={{ borderColor: 'var(--border-color)' }}>
                          <tr>
                            {viewMode === 'diario' && <td></td>}
                            <td className="text-right pr-4 uppercase text-xs">Total General</td>
                            <td>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.revenueCat.I, 0))}</td>
                            <td>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.revenueCat.II, 0))}</td>
                            <td>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.revenueCat.III, 0))}</td>
                            <td>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.revenueCat.IV, 0))}</td>
                            <td className="bg-indigo-50/20 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400">{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.totalRevenue, 0))}</td>
                            <td className={consolidatedMatrix.some((r: any) => r.adjustments.SOBRANTE > 0) ? 'text-emerald-600' : ''}>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.adjustments.SOBRANTE, 0))}</td>
                            <td>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.adjustments.SOBRANTE_EQUIPO, 0))}</td>
                            <td>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.adjustments.AJUSTE_DATAFONO, 0))}</td>
                            <td className="bg-emerald-50/20 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.totalRevenueWithAdjustments, 0))}</td>
                            <td>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.payments.EFECTIVO, 0))}</td>
                            <td>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.payments.ELECTRONICO, 0))}</td>
                            <td>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.payments.IPREV_COLPASS, 0))}</td>
                            <td>{formatCOP(consolidatedMatrix.reduce((sum: number, row: any) => sum + row.payments.total, 0))}</td>
                          </tr>
                        </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="peaje-card py-12 text-center text-slate-400">
          No hay datos de recaudo para el periodo filtrado.
        </div>
      )}
    </div>
  );
}
