'use client';

import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle, ShieldCheck, Settings, CheckCircle, HelpCircle } from 'lucide-react';

export default function AppAlertas() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Configuration thresholds states
  const [trafficDropPct, setTrafficDropPct] = useState('30');
  const [reconDiffThreshold, setReconDiffThreshold] = useState('0');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/alerts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setAlerts(json.data);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load local storage thresholds if set
    const storedDrop = localStorage.getItem('ALERT_TRAFFIC_DROP_PCT');
    const storedRecon = localStorage.getItem('ALERT_RECON_THRESHOLD');
    if (storedDrop) setTrafficDropPct(storedDrop);
    if (storedRecon) setReconDiffThreshold(storedRecon);

    fetchAlerts();
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ALERT_TRAFFIC_DROP_PCT', trafficDropPct);
    localStorage.setItem('ALERT_RECON_THRESHOLD', reconDiffThreshold);
    setSaveSuccess(true);

    // Save in document cookies so API route handlers can read them!
    document.cookie = `ALERT_TRAFFIC_DROP_PCT=${trafficDropPct}; path=/; max-age=31536000;`;
    document.cookie = `ALERT_RECON_THRESHOLD=${reconDiffThreshold}; path=/; max-age=31536000;`;

    setTimeout(() => {
      setSaveSuccess(false);
      setLoading(true);
      fetchAlerts(); // Re-evaluate alerts dynamically!
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-slate-800 dark:text-white">Panel de Alertas y Configuración de Umbrales</h1>
        <p className="text-xs text-slate-400">Controladores de umbral de caídas de tráfico e inconsistencias contables de conciliación.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Alerts Panel */}
        <div className="peaje-card lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Bell className="w-5 h-5 text-rose-500 animate-bounce" />
            Alertas Críticas Activas
          </h3>
          <p className="text-[11px] text-slate-500">Listado de alarmas operativas detectadas automáticamente a partir de los datos.</p>
          <hr style={{ borderColor: 'var(--border-color)' }} />

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-xs">Evaluando reglas de negocio...</div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {alerts.length > 0 ? (
                alerts.map((al: any, idx: number) => {
                  let border = '3px solid #6b7280';
                  let badge = 'peaje-badge-neutral';
                  
                  if (al.severity === 'CRITICA') {
                    border = '3px solid #ef4444';
                    badge = 'peaje-badge-danger';
                  } else if (al.severity === 'ALTA') {
                    border = '3px solid #f59e0b';
                    badge = 'peaje-badge-warning';
                  } else if (al.severity === 'MEDIA') {
                    border = '3px solid #3b82f6';
                    badge = 'peaje-badge-info';
                  }

                  return (
                    <div key={idx} className="peaje-card p-4 space-y-2" style={{ borderLeft: border }}>
                      <div className="flex justify-between items-center">
                        <span className={`peaje-badge ${badge}`}>{al.severity}</span>
                        <span className="font-mono text-xs text-slate-500">{al.date}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">{al.title}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">{al.description}</p>
                      
                      {al.details && (
                        <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 font-mono space-y-1">
                          <span className="font-bold block text-slate-700 dark:text-slate-300">Detalles técnicos:</span>
                          {al.type === 'RECONCILIATION_MISMATCH' && (
                            <>
                              <p>Monto Medios de Pago: ${al.details.totalPayments?.toLocaleString()}</p>
                              <p>Monto Recaudo + Ajustes: ${al.details.totalRevenuePlusSobrantes?.toLocaleString()}</p>
                              <p className="text-rose-500 font-bold">Diferencia Descalzada: ${al.details.difference?.toLocaleString()}</p>
                            </>
                          )}
                          {al.type === 'TRAFFIC_DROP' && (
                            <>
                              <p>Tránsito del Día: {al.details.traffic} veh</p>
                              <p>Promedio Histórico: {al.details.average} veh</p>
                              <p className="text-rose-500 font-bold">Variación Porcentual: -{al.details.pct?.toFixed(1)}%</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-bold text-slate-800 dark:text-white">Operación Integrada con Éxito</p>
                  <p className="text-xs mt-1">Todos los datos registrados están conciliados y cumplen con los umbrales operativos configurados.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Umbrales Settings Panel */}
        <div className="space-y-6 lg:col-span-1">
          <div className="peaje-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              Editar Umbrales de Alarma
            </h3>
            <hr style={{ borderColor: 'var(--border-color)' }} />

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded-lg flex items-center gap-2 text-xs font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Umbrales actualizados y reevaluando...</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-semibold">
              {/* Traffic drop threshold */}
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Umbral Caída Tránsito (%)
                  <span title="Dispara alarma si el tránsito diario cae por debajo de este porcentaje del promedio.">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="peaje-input pr-8"
                    min="1"
                    max="99"
                    value={trafficDropPct}
                    onChange={(e) => setTrafficDropPct(e.target.value)}
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400">%</span>
                </div>
              </div>

              {/* Reconciliation mismatch threshold */}
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Tolerancia de Conciliación ($)
                  <span title="Diferencia máxima permitida entre medios de pago y recaudo antes de emitir alerta.">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="peaje-input pr-10"
                    min="0"
                    value={reconDiffThreshold}
                    onChange={(e) => setReconDiffThreshold(e.target.value)}
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400">COP</span>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" className="peaje-btn peaje-btn-primary w-full py-2">
                  Guardar y Reevaluar
                </button>
              </div>
            </form>
          </div>

          {/* Rules notes */}
          <div className="peaje-card space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Reglas del Sistema Evaluadas:</h4>
            <ul className="list-decimal list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
              <li><strong>Tránsito &gt; 0 &amp; Recaudo = 0:</strong> Alerta crítica si hay afluencia vehicular pero no ingresó dinero a cajas.</li>
              <li><strong>Diferencia de Cuadre:</strong> Alerta de auditoría cuando <code>Efectivo + Electrónico + Colpass != Recaudo + Ajustes</code>.</li>
              <li><strong>Días sin Carga:</strong> Alerta de cobertura si transcurren días del periodo activo sin importación de datos.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
