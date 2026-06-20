'use client';

import { useState, useEffect } from 'react';
import { FileText, Upload, Trash2, Download, Search, FileDown, Plus } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  category: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

export default function DocumentosPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Resoluciones');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const categories = ['Resoluciones', 'Certificaciones', 'Tarifas', 'Otros'];

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/app/documents');
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle || !uploadCategory || !uploadFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', uploadTitle);
      formData.append('category', uploadCategory);
      formData.append('file', uploadFile);

      const res = await fetch('/api/app/documents', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setUploadTitle('');
        setUploadFile(null);
        setShowUploadModal(false);
        fetchDocuments();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Error al subir el documento: ${errData.error || 'Desconocido'}`);
      }
    } catch (error) {
      console.error('Error uploading:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento? Esta acción no se puede deshacer.')) return;
    
    try {
      const res = await fetch(`/api/app/documents?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDocuments(docs => docs.filter(d => d.id !== id));
      } else {
        alert('Error al eliminar el documento');
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'Todas' || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm w-full sm:w-auto shrink-0"
        >
          <Upload className="w-5 h-5" />
          Subir Documento
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none min-w-[200px]"
        >
          <option value="Todas">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Document List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Cargando documentos...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            No se encontraron documentos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Documento</th>
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Categoría</th>
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Tamaño</th>
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Fecha de Subida</th>
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map(doc => (
                  <tr key={doc.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                          <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{doc.title}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
                        {doc.category}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 text-sm">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 text-sm">
                      {new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(doc.created_at))}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={doc.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                          title="Descargar"
                        >
                          <Download className="w-5 h-5" />
                        </a>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <form onSubmit={handleUpload}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-500" />
                  Subir Nuevo Documento
                </h2>
              </div>
              
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Título del Documento
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    placeholder="Ej. Resolución Tarifas 2024"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={e => setUploadCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Archivo (PDF, Imagen, Word)
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <FileDown className="mx-auto h-10 w-10 text-slate-400" />
                      <div className="flex text-sm text-slate-600 dark:text-slate-400">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none">
                          <span>Seleccionar archivo</span>
                          <input 
                            id="file-upload" 
                            name="file-upload" 
                            type="file" 
                            className="sr-only"
                            required
                            onChange={e => setUploadFile(e.target.files?.[0] || null)}
                          />
                        </label>
                        <p className="pl-1">o arrastrar y soltar</p>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {uploadFile ? uploadFile.name : 'Máx 10MB'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isUploading ? 'Subiendo...' : 'Guardar Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
