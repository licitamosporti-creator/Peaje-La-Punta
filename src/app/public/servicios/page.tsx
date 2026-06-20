'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Search, Filter, ShieldAlert, Calendar, Clock, CheckCircle2, Info, Tractor, CarFront, Ambulance, Route, MoreHorizontal } from 'lucide-react';
import { HistoricalBanner } from '@/components/HistoricalBanner';

export default function PublicServicios() {
  const [novedades, setNovedades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');

  // Custom Tow Truck Icon to match the user's request
  const TowTruckIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Truck cab */}
      <path d="M15 8h3.5l3.5 4v5h-2.5" />
      <path d="M15 17h-1" />
      <path d="M15 8v9" />
      {/* Flat bed */}
      <path d="M15 13H2.5l-1.5 4h3" />
      {/* Truck wheels */}
      <circle cx="6" cy="17" r="2" />
      <circle cx="17.5" cy="17" r="2" />
      {/* Car on bed */}
      <path d="M4 11V9.5l1.5-1.5h4l1.5 1.5V11" />
      <path d="M3 11h9" />
      {/* Car wheels */}
      <circle cx="5.5" cy="11" r="1" />
      <circle cx="9.5" cy="11" r="1" />
    </svg>
  );

  // Custom Winding Road Icon with perspective matching the user's image
  const WindingRoadIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Left edge of the road */}
      <path d="M 3 22 C 3 17 1 17 1 12 C 1 7 12 7 12 2" />
      {/* Right edge of the road */}
      <path d="M 21 22 C 21 17 11 17 11 12 C 11 7 16 7 16 2" />
      {/* Dashed center line */}
      <path d="M 12 22 C 12 17 6 17 6 12 C 6 7 14 7 14 2" strokeDasharray="4 4" />
    </svg>
  );

  const [severityFilter, setSeverityFilter] = useState('ALL');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/public/novedades');
        const json = await res.json();
        if (json.success) {
          setNovedades(json.data);
        }
      } catch (err) {
        console.error('Error fetching novedades:', err);
      } finally {
        setLoading(false);
      }
    }
      fetchData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Cargando bitácora de novedades...</p>
      </div>
    );
  }

  const types = ['ALL', 'Grúa', 'Ambulancia'];
  const severities = ['ALL', 'BAJA', 'MEDIA', 'ALTA', 'CRITICA'];

  // Apply filters
  const filtered = novedades.filter((nov: any) => {
    const matchesSearch = nov.description.toLowerCase().includes(search.toLowerCase()) || 
      (nov.lane_box && nov.lane_box.toLowerCase().includes(search.toLowerCase())) ||
      nov.type.toLowerCase().includes(search.toLowerCase());
      
    const matchesType = typeFilter === 'ALL' || nov.type === typeFilter;
    const matchesSeverity = severityFilter === 'ALL' || nov.severity === severityFilter;

    let matchesMonth = true;
    let matchesYear = true;
    if (nov.start_time) {
      const novDate = new Date(nov.start_time);
      if (!isNaN(novDate.getTime())) {
        matchesMonth = monthFilter === 'ALL' || (novDate.getMonth() + 1).toString() === monthFilter;
        matchesYear = yearFilter === 'ALL' || novDate.getFullYear().toString() === yearFilter;
      }
    }

    return matchesSearch && matchesType && matchesSeverity && matchesMonth && matchesYear;
  });

  const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  return (
    <div className="space-y-8">
      {/* Header and Filters Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Page Header */}
        <div className="shrink-0 flex items-center gap-3">
          <HistoricalBanner />
        </div>

        {/* Filter and Search Bar */}
        <div className="peaje-card !p-2 flex flex-col sm:flex-row gap-3 items-center flex-1 lg:max-w-2xl justify-end">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Buscar por descripción, carril o tipo..."
              className="peaje-input pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              className="peaje-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">Todos los tipos</option>
              {types.filter(t => t !== 'ALL').map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              className="peaje-select"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            >
              <option value="ALL">Mes (Todos)</option>
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              className="peaje-select"
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
      </div>



      {/* Novedades Kanban / Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {['Grúa', 'Ambulancia'].map(category => {
          const categoryNovedades = filtered.filter((n: any) => n.type === category);
          
          let CategoryIcon: React.ElementType = MoreHorizontal;
          if (category === 'Grúa') CategoryIcon = TowTruckIcon;
          if (category === 'Ambulancia') CategoryIcon = Ambulance;
          if (category === 'Vías') CategoryIcon = WindingRoadIcon;

          return (
            <div key={category} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-3 border-b-2 border-slate-200 dark:border-slate-700">
                <CategoryIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <h2 className="font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide text-sm">{category}</h2>
                <span className="ml-auto bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs px-2 py-0.5 rounded-full font-bold">
                  {categoryNovedades.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {categoryNovedades.length > 0 ? (
                  categoryNovedades.map((nov: any) => {
                    const isClosed = nov.status === 'CERRADO';
                    let statusColor = 'bg-rose-50/80 border-rose-200 dark:bg-rose-900/20';
                    let StatusIcon = ShieldAlert;
                    if (nov.status === 'EN_PROCESO') {
                      statusColor = 'bg-amber-50/80 border-amber-200 dark:bg-amber-900/20';
                      StatusIcon = Clock;
                    } else if (isClosed) {
                      statusColor = 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-900/20';
                      StatusIcon = CheckCircle2;
                    }

                    return (
                      <div key={nov.id} className={`peaje-card !p-4 flex flex-col sm:flex-row gap-4 justify-between border shadow-sm hover:shadow-md transition-shadow ${statusColor}`}>
                        
                        <div className="flex flex-col flex-1">
                          <div className="flex justify-start items-start gap-2 mb-3">
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isClosed ? 'bg-emerald-200/50 text-emerald-700 dark:text-emerald-400' :
                              nov.status === 'EN_PROCESO' ? 'bg-amber-200/50 text-amber-700 dark:text-amber-400' :
                              'bg-rose-200/50 text-rose-700 dark:text-rose-400'
                            }`}>
                              <StatusIcon className="w-3 h-3" />
                              {nov.status}
                            </span>
                          </div>

                          <div className="border-t border-slate-200 dark:border-slate-700/50 pt-3">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                              {nov.description}
                            </p>
                            {nov.evidences && (
                              <div className="mt-3 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 max-w-xs">
                                <img src={nov.evidences} alt="Evidencia" className="w-full h-32 object-cover" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium sm:min-w-[200px] shrink-0 pt-1">
                          {nov.lane_box && <span>Lugar del evento: {nov.lane_box}</span>}
                          <span>Hora de recogida: {new Date(nov.start_time).toLocaleString()}</span>
                          {nov.end_time && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Hora de entrega: {new Date(nov.end_time).toLocaleString()}</span>}
                        </div>
                        
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium">Sin novedades activas</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
