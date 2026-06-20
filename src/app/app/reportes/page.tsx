'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Download, Calendar, Filter, History, CheckCircle } from 'lucide-react';
import { HistoricalBanner } from '@/components/HistoricalBanner';

export default function AppReportes() {
  const [exportLogs, setExportLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Form parameters
  const [reportType, setReportType] = useState('DIARIO');
  const [format, setFormat] = useState('CSV');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchExportLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setExportLogs(json.data);
      }
    } catch (err) {
      console.error('Error fetching export logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExportLogs();
  }, []);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      alert('Por favor ingrese las fechas de rango');
      return;
    }

    setDownloading(true);
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('token');
      
      // 1. Log the export event in the database (mandatory audit step!)
      const logRes = await fetch('/api/app/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          report_type: reportType,
          format: format,
          filters: { startDate, endDate }
        })
      });

      // 2. Fetch the actual data from app recaudo endpoint to build the CSV client-side
      const recRes = await fetch(`/api/app/recaudo?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const recJson = await recRes.json();

      if (recRes.ok && recJson.success) {
        const matrixData = recJson.data.matrix || [];

        if (format === 'CSV') {
          // Generate CSV
          let csvContent = '\uFEFF'; // UTF-8 BOM
          csvContent += 'Fecha,Día,Recaudo Cat I,Recaudo Cat II,Recaudo Cat III,Recaudo Cat IV,Recaudo Total,Sobrantes,Sobrante Equipo,Ajuste Datáfonos,Recaudo + Ajustes,Medio Efectivo,Medio Electrónico,Medio Colpass,Medios Pago Total\n';
          
          matrixData.forEach((row: any) => {
            csvContent += `${row.date},${row.weekday},${row.revenueCat.I},${row.revenueCat.II},${row.revenueCat.III},${row.revenueCat.IV},${row.totalRevenue},${row.adjustments.SOBRANTE},${row.adjustments.SOBRANTE_EQUIPO},${row.adjustments.AJUSTE_DATAFONO},${row.totalRevenueWithAdjustments},${row.payments.EFECTIVO},${row.payments.ELECTRONICO},${row.payments.IPREV_COLPASS},${row.payments.total}\n`;
          });

          // Download trigger
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', `Reporte_${reportType}_${startDate}_a_${endDate}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          // Mock PDF/Print Trigger
          window.print();
        }

        setSuccessMsg('Reporte generado y descargado con éxito. Exportación registrada en bitácora.');
        fetchExportLogs(); // Reload logs list!
      } else {
        alert('No se encontraron registros de recaudo para el periodo seleccionado.');
      }

    } catch (err) {
      console.error('Error generating report:', err);
      alert('Error al generar el reporte.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-3">
          <HistoricalBanner />
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-800 dark:text-white">Generador de Reportes e Informes</h1>
            <p className="text-xs text-slate-400">Exportar informes consolidados en formatos PDF o CSV con registro de auditoría obligatoria.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration Box */}
        <div className="peaje-card space-y-4 lg:col-span-1 h-fit">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Configurar Exportación
          </h3>
          <hr style={{ borderColor: 'var(--border-color)' }} />

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded-lg flex items-start gap-2.5 text-xs font-semibold">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleExport} className="space-y-4 text-xs font-semibold">
            {/* Report Type */}
            <div className="space-y-1">
              <label className="text-slate-500">Tipo de Reporte</label>
              <select
                className="peaje-select"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="DIARIO">DIARIO (Consolidado por Fechas)</option>
                <option value="SEMANAL">SEMANAL (Intervalos semanales)</option>
                <option value="MENSUAL">MENSUAL (Cierre mensual)</option>
              </select>
            </div>

            {/* Format Selection */}
            <div className="space-y-1">
              <label className="text-slate-500">Formato de Salida</label>
              <select
                className="peaje-select"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="CSV">Excel / CSV (Valores separados por comas)</option>
                <option value="PDF">PDF / Documento Impreso (Diseño de Interventoría)</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="space-y-1">
              <label className="text-slate-500">Fecha Inicial</label>
              <input
                type="date"
                className="peaje-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-500">Fecha Final</label>
              <input
                type="date"
                className="peaje-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="peaje-btn peaje-btn-primary w-full py-2.5"
                disabled={downloading}
              >
                {downloading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Descargar Reporte</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: History Log */}
        <div className="peaje-card lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Historial de Descargas y Exportaciones (Auditoría)
          </h3>
          <p className="text-[11px] text-slate-500">Listado de descargas realizadas con fecha, usuario y filtros aplicados (Obligatorio Interventoría).</p>
          <hr style={{ borderColor: 'var(--border-color)' }} />

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-xs">Cargando historial de descargas...</div>
          ) : (
            <div className="peaje-table-container max-h-[360px] overflow-y-auto">
              <table className="peaje-table">
                <thead>
                  <tr>
                    <th>Fecha Exportación</th>
                    <th>Usuario</th>
                    <th>Tipo</th>
                    <th>Formato</th>
                    <th>Filtros Aplicados</th>
                  </tr>
                </thead>
                <tbody>
                  {exportLogs.map((log) => {
                    const filters = JSON.parse(log.filters || '{}');
                    return (
                      <tr key={log.id}>
                        <td className="font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="font-semibold">{log.user_username}</td>
                        <td>
                          <span className="peaje-badge peaje-badge-info text-[8px]">{log.report_type}</span>
                        </td>
                        <td>
                          <span className={`peaje-badge text-[8px] ${log.format === 'PDF' ? 'peaje-badge-warning' : 'peaje-badge-success'}`}>
                            {log.format}
                          </span>
                        </td>
                        <td className="font-mono text-[10px] text-slate-500">
                          {filters.startDate ? `Del ${filters.startDate} al ${filters.endDate}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {exportLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400">No hay descargas registradas en la bitácora.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
