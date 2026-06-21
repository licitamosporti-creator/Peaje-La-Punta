'use client';

import React, { useEffect, useState } from 'react';
import { 
  Plus, Search, ShieldAlert, X, FileText, Check, Trash2, Image as ImageIcon,
  AlertCircle, Clock, CheckCircle, Kanban, List 
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

export default function AppServicios() {
  const [novedades, setNovedades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { success, error } = useToast();

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedNovedad, setSelectedNovedad] = useState<any>(null);

  // Create form state
  const [newNovedad, setNewNovedad] = useState({
    type: 'Grúa',
    severity: 'MEDIA',
    lane_box: '',
    description: '',
    impact: 'AMBOS',
    is_public: false,
    start_time: '',
    end_time: '',
    actions: '',
    evidences: ''
  });

  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const json = await res.json();
      if (json.success) {
        if (isEdit) {
          setEditNovedad({ ...editNovedad, evidences: json.url });
        } else {
          setNewNovedad({ ...newNovedad, evidences: json.url });
        }
        success('Imagen subida exitosamente');
      } else {
        error(json.message || 'Error al subir imagen');
      }
    } catch (err) {
      error('Error al subir imagen');
    } finally {
      setUploadingImage(false);
    }
  };

  // Edit form state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNovedad, setEditNovedad] = useState<any>(null);

  // Close form state
  const [rootCause, setRootCause] = useState('');
  const [closeActions, setCloseActions] = useState('');

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');

  const fetchNovedades = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/novedades', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setNovedades(json.data.filter((n: any) => n.type === 'Grúa' || n.type === 'Ambulancia'));
      }
    } catch (err) {
      console.error('Failed to fetch novedades:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch {}
    }
    fetchNovedades();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/app/novedades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newNovedad,
          start_time: newNovedad.start_time || new Date().toISOString(),
          is_public: !!newNovedad.is_public
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setShowCreateModal(false);
        setNewNovedad({
          type: 'Grúa',
          severity: 'MEDIA',
          lane_box: '',
          description: '',
          impact: 'AMBOS',
          is_public: false,
          start_time: '',
          end_time: '',
          actions: '',
          evidences: ''
        });
        fetchNovedades();
        success('Novedad registrada exitosamente');
      } else {
        error(json.message || 'Error al guardar novedad');
      }
    } catch (err) {
      error('Error en el servidor al crear novedad');
    }
  };

  const handleOpenEditModal = (nov: any) => {
    setEditNovedad({
      ...nov,
      start_time: nov.start_time ? new Date(nov.start_time).toISOString().slice(0, 16) : '',
      end_time: nov.end_time ? new Date(nov.end_time).toISOString().slice(0, 16) : '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNovedad) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/app/novedades/${editNovedad.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editNovedad)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowEditModal(false);
        setEditNovedad(null);
        fetchNovedades();
        success('Novedad actualizada exitosamente');
      } else {
        error(json.message || 'Error al actualizar novedad');
      }
    } catch (err) {
      error('Error en el servidor al actualizar novedad');
    }
  };

  const handleOpenCloseModal = (nov: any) => {
    setSelectedNovedad(nov);
    setRootCause(nov.root_cause || '');
    setCloseActions(nov.actions || '');
    setShowCloseModal(true);
  };

  const handleCloseNovedad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootCause.trim()) {
      error('La causa raíz es requerida para cerrar la novedad.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/app/novedades/${selectedNovedad.id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          root_cause: rootCause,
          actions: closeActions,
          end_time: new Date().toISOString()
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setShowCloseModal(false);
        setSelectedNovedad(null);
        setRootCause('');
        setCloseActions('');
        fetchNovedades();
        success('Novedad cerrada y conciliada con éxito');
      } else {
        error(json.message || 'Error al cerrar novedad');
      }
    } catch (err) {
      error('Error en el servidor al cerrar novedad');
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    if (newStatus === 'CERRADO') {
      const nov = novedades.find(n => n.id === id);
      handleOpenCloseModal(nov);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/app/novedades/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchNovedades();
        success(`Estado actualizado a ${newStatus}`);
      } else {
        error(json.message || 'Error al actualizar estado');
      }
    } catch (err) {
      error('Error al actualizar estado');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar esta novedad de forma permanente?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/app/novedades/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchNovedades();
        success('Novedad eliminada permanentemente');
      } else {
        error(json.message || 'Error al eliminar novedad');
      }
    } catch (err) {
      error('Error al eliminar novedad');
    }
  };

  // MTTR calculation
  // Filter novedades that are closed and have start_time and end_time
  const closedNovedades = novedades.filter(n => n.status === 'CERRADO' && n.start_time && n.end_time);
  let mttrHours = 0;
  if (closedNovedades.length > 0) {
    let totalMs = 0;
    closedNovedades.forEach(n => {
      const start = new Date(n.start_time).getTime();
      const end = new Date(n.end_time).getTime();
      totalMs += (end - start);
    });
    const avgMs = totalMs / closedNovedades.length;
    mttrHours = avgMs / (1000 * 60 * 60); // convert ms to hours
  }

  // Filter list
  const filtered = novedades.filter(n => {
    const matchesSearch = n.description.toLowerCase().includes(search.toLowerCase()) || 
      n.type.toLowerCase().includes(search.toLowerCase()) ||
      (n.lane_box && n.lane_box.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || n.status === statusFilter;

    let matchesMonth = true;
    let matchesYear = true;
    if (n.start_time) {
      const novDate = new Date(n.start_time);
      if (!isNaN(novDate.getTime())) {
        matchesMonth = monthFilter === 'ALL' || (novDate.getMonth() + 1).toString() === monthFilter;
        matchesYear = yearFilter === 'ALL' || novDate.getFullYear().toString() === yearFilter;
      }
    }

    return matchesSearch && matchesStatus && matchesMonth && matchesYear;
  });

  const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const columns = {
    ABIERTO: filtered.filter(n => n.status === 'ABIERTO'),
    EN_PROCESO: filtered.filter(n => n.status === 'EN_PROCESO'),
    CERRADO: filtered.filter(n => n.status === 'CERRADO')
  };

  const isInterventorOrAdmin = true;
  const isAdmin = true;

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white">Servicios Disponibles</h1>
          <p className="text-xs text-slate-400">Control y registro de servicios de Grúa y Ambulancia.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="peaje-btn peaje-btn-primary py-2 px-4 rounded-lg">
          <Plus className="w-4 h-4" />
          <span>Reportar Novedad</span>
        </button>
      </div>



      {/* Filter and View Modes Bar */}
      <div className="peaje-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row gap-3 flex-grow max-w-xl">
          {/* Search */}
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Buscar novedades..."
              className="peaje-input pl-9 py-1.5"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          </div>



          {/* Month Filter */}
          <select
            className="peaje-select py-1.5 w-full md:w-32"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="ALL">Mes (Todos)</option>
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* Year Filter */}
          <select
            className="peaje-select py-1.5 w-full md:w-32"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="ALL">Año (Todos)</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reported Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(nov => (
          <div key={nov.id} className="peaje-card p-4 space-y-3" style={{ borderLeft: '3px solid #6366f1' }}>
            <div className="flex justify-between items-start">
              <span className="peaje-badge peaje-badge-info text-[9px]">{nov.severity}</span>
              <span className="text-[10px] text-slate-400 font-mono">{nov.date || (nov.start_time ? new Date(nov.start_time).toISOString().split('T')[0] : '')}</span>
            </div>
            {nov.evidences && (
              <div className="mt-2 rounded-md overflow-hidden border border-slate-200">
                <img src={nov.evidences} alt="Evidencia" className="w-full h-32 object-cover" />
              </div>
            )}
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{nov.type}</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed truncate">{nov.description}</p>
            <hr style={{ borderColor: 'var(--border-color)' }} />
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-1">
                <button onClick={() => handleOpenEditModal(nov)} className="text-slate-400 hover:text-indigo-600 p-1" title="Editar">
                  <FileText className="w-3.5 h-3.5" />
                </button>
                {isAdmin && (
                  <button onClick={() => handleDelete(nov.id)} className="text-rose-500 hover:text-rose-700 p-1" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-slate-400">
            No se encontraron novedades reportadas.
          </div>
        )}
      </div>

      {/* CREATE NOVEDAD MODAL OVERLAY */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="peaje-card w-full max-w-lg space-y-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Reportar Novedad</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <hr style={{ borderColor: 'var(--border-color)' }} />
            
            <form onSubmit={handleCreate} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-500">Tipo de Novedad</label>
                <select
                  className="peaje-select"
                  value={newNovedad.type}
                  onChange={(e) => setNewNovedad({ ...newNovedad, type: e.target.value })}
                >
                  <option value="Grúa">Grúa</option>
                  <option value="Ambulancia">Ambulancia</option>
                </select>
              </div>



              <div className="space-y-1">
                <label className="text-slate-500">Descripción del Suceso</label>
                <textarea
                  rows={3}
                  className="peaje-textarea"
                  placeholder="Describa en detalle la falla, incidente, accidente o inconsistencia detectada..."
                  value={newNovedad.description}
                  onChange={(e) => setNewNovedad({ ...newNovedad, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500">Fecha y Hora del Evento</label>
                  <input
                    type="datetime-local"
                    className="peaje-input"
                    value={newNovedad.start_time}
                    onChange={(e) => setNewNovedad({ ...newNovedad, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500">Lugar del Evento</label>
                  <input
                    type="text"
                    className="peaje-input"
                    placeholder="Ej. PR 15+200, Peaje, etc."
                    value={newNovedad.lane_box}
                    onChange={(e) => setNewNovedad({ ...newNovedad, lane_box: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Observaciones</label>
                <textarea
                  rows={2}
                  className="peaje-textarea"
                  placeholder="Detalles adicionales..."
                  value={newNovedad.actions || ''}
                  onChange={(e) => setNewNovedad({ ...newNovedad, actions: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Evidencia Fotográfica (Opcional)</label>
                <div className="flex items-center gap-4">
                  <label className="peaje-btn peaje-btn-secondary cursor-pointer py-1 px-3 text-xs flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    {uploadingImage ? 'Subiendo...' : 'Seleccionar Imagen'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleImageUpload(e, false)}
                      disabled={uploadingImage}
                    />
                  </label>
                  {newNovedad.evidences && (
                    <div className="h-10 w-10 rounded overflow-hidden border border-slate-200">
                      <img src={newNovedad.evidences} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={newNovedad.is_public}
                  onChange={(e) => setNewNovedad({ ...newNovedad, is_public: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="is_public" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  Publicar en Portal Público (Se publicará versión sanitizada sin nombres ni IDs)
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="peaje-btn peaje-btn-secondary py-2">
                  Cancelar
                </button>
                <button type="submit" className="peaje-btn peaje-btn-primary py-2 px-5">
                  Registrar Novedad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT NOVEDAD MODAL OVERLAY */}
      {showEditModal && editNovedad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="peaje-card w-full max-w-lg space-y-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Editar Novedad</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <hr style={{ borderColor: 'var(--border-color)' }} />
            
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-500">Tipo de Novedad</label>
                <select
                  className="peaje-select"
                  value={editNovedad.type}
                  onChange={(e) => setEditNovedad({ ...editNovedad, type: e.target.value })}
                >
                  <option value="Grúa">Grúa</option>
                  <option value="Ambulancia">Ambulancia</option>
                </select>
              </div>



              <div className="space-y-1">
                <label className="text-slate-500">Descripción del Suceso</label>
                <textarea
                  rows={3}
                  className="peaje-textarea"
                  value={editNovedad.description}
                  onChange={(e) => setEditNovedad({ ...editNovedad, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500">Fecha y Hora del Evento</label>
                  <input
                    type="datetime-local"
                    className="peaje-input"
                    value={editNovedad.start_time}
                    onChange={(e) => setEditNovedad({ ...editNovedad, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500">Lugar del Evento</label>
                  <input
                    type="text"
                    className="peaje-input"
                    placeholder="Ej. PR 15+200, Peaje, etc."
                    value={editNovedad.lane_box || ''}
                    onChange={(e) => setEditNovedad({ ...editNovedad, lane_box: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Observaciones</label>
                <textarea
                  rows={2}
                  className="peaje-textarea"
                  placeholder="Detalles adicionales..."
                  value={editNovedad.actions || ''}
                  onChange={(e) => setEditNovedad({ ...editNovedad, actions: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500">Evidencia Fotográfica (Opcional)</label>
                <div className="flex items-center gap-4">
                  <label className="peaje-btn peaje-btn-secondary cursor-pointer py-1 px-3 text-xs flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    {uploadingImage ? 'Subiendo...' : 'Actualizar Imagen'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleImageUpload(e, true)}
                      disabled={uploadingImage}
                    />
                  </label>
                  {editNovedad.evidences && (
                    <div className="h-10 w-10 rounded overflow-hidden border border-slate-200">
                      <img src={editNovedad.evidences} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="edit_is_public"
                  checked={editNovedad.is_public}
                  onChange={(e) => setEditNovedad({ ...editNovedad, is_public: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="edit_is_public" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  Publicar en Portal Público
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="peaje-btn peaje-btn-secondary py-2">
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

      {/* CLOSE NOVEDAD MODAL OVERLAY (Enforces causa raíz) */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="peaje-card w-full max-w-md space-y-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-500" />
                Cerrar Novedad y Conciliar Caso
              </h3>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <hr style={{ borderColor: 'var(--border-color)' }} />
            
            <div className="text-xs text-slate-500 space-y-2">
              <p><strong>Novedad:</strong> {selectedNovedad?.type} en {selectedNovedad?.lane_box || 'Vía'}</p>
              <p className="italic">"{selectedNovedad?.description}"</p>
            </div>

            <form onSubmit={handleCloseNovedad} className="space-y-4 text-xs font-semibold">
              {/* OBLIGATORY CAUSA RAIZ */}
              <div className="space-y-1">
                <label className="text-slate-700 dark:text-slate-300">
                  Observación <span className="text-rose-500">* (Obligatorio)</span>
                </label>
                <textarea
                  rows={4}
                  className="peaje-textarea border-rose-200 focus:border-rose-500"
                  placeholder="Detalles de la resolución o cierre del evento..."
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCloseModal(false)} className="peaje-btn peaje-btn-secondary py-2">
                  Cancelar
                </button>
                <button type="submit" className="peaje-btn peaje-btn-primary py-2 px-5 bg-emerald-600 hover:bg-emerald-700">
                  Resolver e Cerrar Caso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
