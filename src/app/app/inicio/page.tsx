'use client';

import React, { useEffect, useState } from 'react';
import { 
  DollarSign, Users, Activity, CreditCard, 
  UploadCloud, AlertTriangle, CheckCircle, FileSpreadsheet, Calendar
} from 'lucide-react';
import { HistoricalBanner } from '@/components/HistoricalBanner';
import { formatCOP } from '@/lib/formatters';
import { DashboardSkeleton } from '@/components/Skeleton';

export default function AppInicio() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Live clock
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [userRole, setUserRole] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState('');

  // Hourly Excel Import State
  const [hourlyExcelFile, setHourlyExcelFile] = useState<File | null>(null);
  const [isUploadingHourlyExcel, setIsUploadingHourlyExcel] = useState(false);
  const [hourlyExcelResult, setHourlyExcelResult] = useState<any>(null);

  const handleHourlyExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setHourlyExcelFile(e.target.files[0]);
    }
  };

  const handleUploadHourlyExcel = async () => {
    if (!hourlyExcelFile) return;
    setIsUploadingHourlyExcel(true);
    setHourlyExcelResult(null);
    try {
      const formData = new FormData();
      formData.append('file', hourlyExcelFile);
      // stationId will be inferred server-side by default
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/import-hourly-excel', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setHourlyExcelResult({ success: true, message: json.message });
      } else {
        setHourlyExcelResult({ error: json.error || 'Error al importar matriz horaria' });
      }
    } catch (err) {
      setHourlyExcelResult({ error: 'Error de conexión al importar Excel' });
    } finally {
      setIsUploadingHourlyExcel(false);
      setHourlyExcelFile(null);
    }
  };

  const fetchKpis = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/kpis', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setUserRole(u.role);
      } catch {}
    }
    fetchKpis();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploading(true);
    setUploadResult(null);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setUploadResult(json.data);
        fetchKpis(); // Reload dashboard numbers!
      } else {
        setUploadError(json.message || 'Error al procesar el archivo Excel. Asegúrese de que coincida con la estructura requerida.');
      }
    } catch (err) {
      setUploadError('Ocurrió un error en el servidor al cargar el archivo.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }


  const hasData = data && data.totalTraffic > 0;
  const isOperatorOrAdmin = true;

  // Build array of dates to render the coverage grid
  // We represent the coverage as a calendar grid
  const renderCoverageGrid = () => {
    if (!data || !data.coverage || data.coverage.totalDays === 0) return null;
    
    const { totalDays, activeDays, activeDates, minDate, maxDate } = data.coverage;
    const blocks = [];

    if (activeDates && minDate && maxDate) {
      const start = new Date(`${minDate}T00:00:00`);
      const end = new Date(`${maxDate}T00:00:00`);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        blocks.push({
          date: dateStr,
          isUploaded: activeDates.includes(dateStr)
        });
      }
    } else {
      // Fallback
      for (let i = 0; i < totalDays; i++) {
        blocks.push({ date: `Día ${i + 1}`, isUploaded: i < activeDays });
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            Matriz de Cobertura de Datos
          </h4>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full">
            {data.coverage.percentage}% Completado
          </span>
        </div>
        <p className="text-[11px] text-slate-500">Cada bloque representa un día de operación del periodo activo (Verde = Datos Cargados, Gris = Pendiente).</p>
        
        {/* Coverage grid blocks */}
        <div className="flex flex-wrap gap-1.5 p-4 rounded-xl border max-h-[140px] overflow-y-auto" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
          {blocks.map((block, idx) => (
            <div
              key={idx}
              className="w-5 h-5 rounded-md transition-all duration-300 hover:scale-110"
              style={{
                backgroundColor: block.isUploaded ? 'var(--success)' : 'var(--border-color)',
                boxShadow: block.isUploaded ? '0 0 6px rgba(16, 185, 129, 0.4)' : 'none'
              }}
              title={`${block.date}: ${block.isUploaded ? 'Cargado' : 'Pendiente'}`}
            />
          ))}
        </div>
        <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span>{activeDays} Días con Datos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--border-color)' }} />
            <span>{totalDays - activeDays} Días Pendientes</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Welcome banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
        <HistoricalBanner />
        <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 border px-3 py-1.5 rounded-lg font-mono flex items-center gap-2">
          {currentTime ? (
            <>
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>{currentTime.toLocaleDateString('es-CO')}</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{currentTime.toLocaleTimeString('es-CO', { hour12: true })}</span>
            </>
          ) : (
            <span className="opacity-0">Cargando...</span>
          )}
        </div>
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Upload console & Coverage */}
        <div className="lg:col-span-2 space-y-6">
          {/* File Upload Box (restricted to OPERADOR and ADMIN) */}
          {isOperatorOrAdmin && (
            <div className="peaje-card space-y-4">
              <h4 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                Módulo Importar Histórico Excel
              </h4>
              <p className="text-xs text-slate-500">Cargar hoja histórica de operaciones (.xlsx, .xlsm). El sistema mapeará automáticamente recaudo, tránsito y personal de apoyo.</p>
              <hr style={{ borderColor: 'var(--border-color)' }} />

              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors relative cursor-pointer" style={{ borderColor: 'var(--border-color)' }}>
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.xls,.xlsb,.csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <UploadCloud className="w-10 h-10 text-indigo-500 mb-2 animate-bounce" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Arrastre o seleccione archivo Excel</span>
                <span className="text-[10px] text-slate-400 mt-1">Formato admitido: .xlsx, .xlsm, .xls, .xlsb de peaje {data?.stationName || 'LA PUNTA'}</span>
              </div>

              {uploading && (
                <div className="p-3 bg-indigo-50/40 text-indigo-600 rounded-lg flex items-center gap-3 text-xs">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Procesando archivo Excel, por favor espere...</span>
                </div>
              )}

              {uploadResult && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span>Importación Completada con Éxito</span>
                  </div>
                  <p><strong>Archivo:</strong> {uploadResult.filename}</p>
                  <p><strong>Registros Importados:</strong> {uploadResult.importedRows.toLocaleString()} celdas/filas mapeadas en la base de datos.</p>
                  <p><strong>Fechas Procesadas ({uploadResult.dates.length}):</strong> {uploadResult.dates.slice(0, 10).join(', ')} ...</p>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-2 text-rose-600 dark:text-rose-400">
                      <strong>Errores:</strong>
                      <ul className="list-disc list-inside mt-1 max-h-[80px] overflow-y-auto">
                        {uploadResult.errors.map((err: string, idx: number) => <li key={idx}>{err}</li>)}
                      </ul>
                    </div>
                  )}
                  {uploadResult.warnings && uploadResult.warnings.length > 0 && (
                    <div className="mt-2 text-amber-600 dark:text-amber-400">
                      <strong>Aviso del Sistema Avanzado:</strong>
                      <ul className="list-disc list-inside mt-1 max-h-[80px] overflow-y-auto">
                        {uploadResult.warnings.map((warn: string, idx: number) => <li key={idx}>{warn}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 rounded-xl flex items-start gap-2.5 text-xs font-semibold">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                  <div>
                    <span className="font-bold text-sm block mb-1">Fallo de Importación</span>
                    <span>{uploadError}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hourly Excel Import Box */}
          {isOperatorOrAdmin && (
            <div className="peaje-card space-y-4">
              <h4 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Importar Matriz Horaria (Excel)
              </h4>
              <p className="text-xs text-slate-500">Sube únicamente el archivo Excel (.xlsx) que contiene la hoja "TRAFICO HORA" para procesar directamente la tabla de horas de 00-01 a 23-24.</p>
              <hr style={{ borderColor: 'var(--border-color)' }} />
              
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors relative cursor-pointer" style={{ borderColor: 'var(--border-color)' }}>
                  <input
                    type="file"
                    accept=".xlsx,.xlsm,.xls"
                    onChange={handleHourlyExcelFileChange}
                    className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploadingHourlyExcel}
                  />
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {hourlyExcelFile ? hourlyExcelFile.name : 'Arrastre o seleccione Archivo Excel Horario'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">Formato admitido: .xlsx, .xlsm, .xls</span>
                </div>
                
                <button 
                  onClick={handleUploadHourlyExcel}
                  disabled={!hourlyExcelFile || isUploadingHourlyExcel}
                  className="peaje-btn peaje-btn-primary w-full md:w-auto self-end py-2 px-6"
                  style={{ backgroundColor: 'var(--success)' }}
                >
                  {isUploadingHourlyExcel ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
                      Procesando...
                    </>
                  ) : (
                    'Importar Tráfico Horario'
                  )}
                </button>

                {hourlyExcelResult && hourlyExcelResult.success && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <CheckCircle className="w-4 h-4" /> Importación Exitosa
                    </div>
                    <p>{hourlyExcelResult.message}</p>
                  </div>
                )}
                
                {hourlyExcelResult && hourlyExcelResult.error && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <AlertTriangle className="w-4 h-4" /> Error en Importación
                    </div>
                    <p>{hourlyExcelResult.error}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coverage Grid Card */}
          {hasData && (
            <div className="peaje-card">
              {renderCoverageGrid()}
            </div>
          )}
        </div>

        {/* Right Side: Active System Alerts */}
        <div className="space-y-6">
          <div className="peaje-card space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                Alertas de Operación Activas
              </h4>
              {data?.alerts?.length > 0 && (
                <span className="peaje-badge peaje-badge-danger text-[9px]">
                  {data.alerts.length} Críticas
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">Inconsistencias financieras o anomalías del tránsito evaluadas en tiempo real.</p>
            <hr style={{ borderColor: 'var(--border-color)' }} />

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {data?.alerts?.length > 0 ? (
                data.alerts.map((al: any, idx: number) => {
                  let badge = 'peaje-badge-neutral';
                  if (al.severity === 'CRITICA') badge = 'peaje-badge-danger';
                  else if (al.severity === 'ALTA') badge = 'peaje-badge-warning';
                  else if (al.severity === 'MEDIA') badge = 'peaje-badge-info';

                  return (
                    <div key={idx} className="p-3 border rounded-xl space-y-1.5" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                      <div className="flex items-center justify-between gap-4">
                        <span className={`peaje-badge ${badge} text-[8px]`}>{al.severity}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">{al.date}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{al.title}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">{al.description}</p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  No hay alertas activas. Operación conciliada y fluida.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
