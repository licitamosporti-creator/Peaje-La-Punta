'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Users, ShieldAlert, Plus, CheckCircle, AlertCircle, Clock, Edit2, Trash2, X } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

export default function AppAdmin() {
  const [adminData, setAdminData] = useState<any>({ stations: [], auditLogs: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'audit' | 'stations' | 'hourly_import' | 'hourly_excel_import' | 'banners'>('stations');
  const [isAdmin, setIsAdmin] = useState(false);

  const { success, error } = useToast();
  
  // Edit Station State
  const [editingStation, setEditingStation] = useState<any>(null);
  const [editStationName, setEditStationName] = useState('');
  const [editStationPanelName, setEditStationPanelName] = useState('');

  // Add Station State
  const [isAddingStation, setIsAddingStation] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationPanelName, setNewStationPanelName] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);



  // Hourly Import State (OCR)
  const [hourlyFile, setHourlyFile] = useState<File | null>(null);
  const [isUploadingHourly, setIsUploadingHourly] = useState(false);
  const [hourlyUploadResult, setHourlyUploadResult] = useState<any>(null);

  const handleHourlyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setHourlyFile(e.target.files[0]);
    }
  };

  const handleUploadHourly = async () => {
    if (!hourlyFile) return;
    setIsUploadingHourly(true);
    setHourlyUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', hourlyFile);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/import-hourly', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const json = await res.json();
      if (res.ok && json.success) {
        success('Perfil horario importado exitosamente');
        setHourlyUploadResult(json.data);
      } else {
        error(json.message || 'Error al importar perfil horario');
        setHourlyUploadResult({ error: json.message });
      }
    } catch (err) {
      error('Error de conexión al importar perfil horario');
    } finally {
      setIsUploadingHourly(false);
      setHourlyFile(null);
    }
  };

  // Banners State
  const [banners, setBanners] = useState<any[]>([]);
  const [newBannerText, setNewBannerText] = useState('');

  const fetchBanners = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/banners', { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setBanners(json.data);
    } catch (e) {}
  };

  const handleAddBanner = async () => {
    if (!newBannerText.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/banners', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newBannerText })
      });
      if (res.ok) {
        setNewBannerText('');
        fetchBanners();
        success('Banner agregado');
      }
    } catch (e) {}
  };

  const toggleBanner = async (id: string, currentActive: boolean) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/app/banners/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive })
      });
      fetchBanners();
    } catch (e) {}
  };

  const deleteBanner = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/app/banners/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchBanners();
      success('Banner eliminado');
    } catch (e) {}
  };

  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/admin', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setAdminData(json.data);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.role === 'ADMIN') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch {}
    }
    fetchAdminData();
    fetchBanners();
  }, []);

  const handleEditStationClick = (st: any) => {
    setEditingStation(st);
    setEditStationName(st.name);
    setEditStationPanelName(st.panel_name || '');
  };

  const handleUpdateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/app/admin/stations/${editingStation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: editStationName, panel_name: editStationPanelName })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        success('Estación actualizada exitosamente');
        setEditingStation(null);
        fetchAdminData();
        // Option to reload the page to update the layout name, or user will see it on next load
      } else {
        error(json.message || 'Error al actualizar la estación');
      }
    } catch (err) {
      error('Error al conectar con el servidor');
    }
  };

  const handleAddStation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/app/admin/stations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newStationName, panel_name: newStationPanelName })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        success('Estación creada exitosamente');
        setIsAddingStation(false);
        setNewStationName('');
        setNewStationPanelName('');
        fetchAdminData();
      } else {
        error(json.message || 'Error al crear la estación');
      }
    } catch (err) {
      error('Error al conectar con el servidor');
    }
  };

  const handleDeleteStation = async (st: any) => {
    if (!confirm(`¿Estás seguro de eliminar la estación ${st.name}? Esta acción eliminará permanentemente todos sus registros de tráfico, recaudo y reportes vinculados. NO SE PUEDE DESHACER.`)) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/app/admin/stations/${st.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        success('Estación eliminada exitosamente');
        fetchAdminData();
      } else {
        error(json.message || 'Error al eliminar la estación');
      }
    } catch (err) {
      error('Error al conectar con el servidor');
    }
  };

  // If user is not admin, show Access Denied
  if (!isAdmin && !loading) {
    return (
      <div className="peaje-card py-16 text-center max-w-lg mx-auto space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
        <h2 className="text-lg font-black text-slate-800 dark:text-white">Acceso Restringido</h2>
        <p className="text-xs text-slate-500">Esta sección es de acceso exclusivo para administradores de interventoría. Su rol actual no posee los privilegios necesarios.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Cargando consola de administración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-slate-800 dark:text-white">Consola de Administración</h1>
      </div>

      {/* Sub tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('audit')}
          className="px-4 py-2 text-xs font-bold uppercase border-b-2 cursor-pointer transition-colors"
          style={{
            borderColor: activeTab === 'audit' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'audit' ? 'var(--primary)' : 'var(--text-secondary)'
          }}
        >
          Bitácora de Auditoría
        </button>
        <button
          onClick={() => setActiveTab('stations')}
          className="px-4 py-2 text-xs font-bold uppercase border-b-2 cursor-pointer transition-colors"
          style={{
            borderColor: activeTab === 'stations' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'stations' ? 'var(--primary)' : 'var(--text-secondary)'
          }}
        >
          Estaciones
        </button>
      </div>

      {/* Tab content */}

      {/* Audit Logs tab */}
      {activeTab === 'audit' && (
        <div className="peaje-card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Historial de Auditoría General (Audit Logs)
          </h3>
          <p className="text-[11px] text-slate-500">Historial completo e inmutable de cambios del sistema peajes (Obligatorio Interventoría).</p>
          <hr style={{ borderColor: 'var(--border-color)' }} />

          <div className="peaje-table-container max-h-[500px] overflow-y-auto">
            <table className="peaje-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Usuario</th>
                  <th>Acción Ejecutada</th>
                  <th>Entidad Afectada</th>
                  <th>ID Afectado</th>
                  <th>Detalles del Cambio</th>
                </tr>
              </thead>
              <tbody>
                {adminData.auditLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="font-semibold text-slate-700 dark:text-slate-300">{log.user_username || 'Sistema'}</td>
                    <td>
                      <span className="peaje-badge peaje-badge-neutral text-[8px] font-bold">{log.action}</span>
                    </td>
                    <td className="text-xs text-slate-500 font-bold">{log.entity_type}</td>
                    <td className="font-mono text-[9px] text-slate-400">{log.entity_id ? log.entity_id.substring(0, 8) : '-'}</td>
                    <td className="text-[10px] text-slate-500 font-mono max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
                {adminData.auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400">No hay logs registrados en el sistema.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stations tab */}
      {activeTab === 'stations' && (
        <div className="peaje-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Estaciones de Peaje Configuradas</h3>
            <button
              onClick={() => setIsAddingStation(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors flex items-center gap-2"
            >
              + Nueva Estación
            </button>
          </div>
          <hr style={{ borderColor: 'var(--border-color)' }} />
          
          <div className="peaje-table-container w-full">
            <table className="peaje-table w-full">
              <thead>
                <tr>
                  <th>ID Estación</th>
                  <th>Nombre Oficial</th>
                  <th>Nombre en Panel</th>
                  <th>Fecha de Adición</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {adminData.stations.map((st: any) => (
                  <tr key={st.id}>
                    <td className="font-mono text-xs text-slate-400">{st.id.substring(0, 8)}</td>
                    <td className="font-bold text-slate-700 dark:text-slate-300">{st.name}</td>
                    <td className="font-semibold text-slate-600 dark:text-slate-400">{st.panel_name || '-'}</td>
                    <td className="text-xs text-slate-500">{st.created_at ? new Date(st.created_at).toLocaleDateString() : '-'}</td>
                    <td className="flex gap-2">
                      <button onClick={() => handleEditStationClick(st)} className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded" title="Editar Estación">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteStation(st)} className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900 rounded" title="Eliminar Estación">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {adminData.stations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 text-sm">No hay estaciones configuradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {/* Edit Station Modal */}
      {editingStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="peaje-card w-full max-w-sm space-y-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Editar Datos del Peaje</h3>
              <button onClick={() => setEditingStation(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <hr style={{ borderColor: 'var(--border-color)' }} />
            
            <form onSubmit={handleUpdateStation} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-500">ID Estación</label>
                <input type="text" className="peaje-input bg-slate-100 dark:bg-slate-800 cursor-not-allowed" value={editingStation.id} disabled />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500">Nombre Oficial del Peaje</label>
                <input type="text" className="peaje-input" value={editStationName} onChange={(e) => setEditStationName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500">Nombre en Panel Superior (Opcional)</label>
                <input type="text" className="peaje-input" value={editStationPanelName} onChange={(e) => setEditStationPanelName(e.target.value)} placeholder="Dejar vacío para usar nombre oficial" />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingStation(null)} className="peaje-btn peaje-btn-secondary py-2">
                  Cancelar
                </button>
                <button type="submit" className="peaje-btn peaje-btn-primary py-2 px-5">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Station Modal */}
      {isAddingStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                Nueva Estación de Peaje
              </h3>
              <button onClick={() => setIsAddingStation(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddStation} className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre Oficial (Reportes)</label>
                  <input
                    type="text"
                    value={newStationName}
                    onChange={e => setNewStationName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50"
                    placeholder="Ej: LA PUNTA"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre en Panel Superior</label>
                  <input
                    type="text"
                    value={newStationPanelName}
                    onChange={e => setNewStationPanelName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50"
                    placeholder="Ej: LA PUNTA (Opcional)"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Si se deja vacío, se mostrará el nombre oficial en la barra superior.</p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingStation(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-md transition-colors"
                >
                  Guardar Estación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
