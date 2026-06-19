'use client';
 
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, TrendingUp, DollarSign, AlertCircle, LayoutDashboard, User, Clock, Phone, MessageCircle, Mail, MapPin, FolderOpen, Calendar, Menu, X } from 'lucide-react';
import HeaderFilters from './HeaderFilters';
import { ThemeToggle } from '@/components/ThemeToggle';
 
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [kpis, setKpis] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, string>>({
    email_atencion: 'peajelapunta@santander.gov.co',
    tel_emergencia: '(+57) 317 513 2240',
    tel_whatsapp: '573175132240',
    nombre_peaje: 'Peaje La Punta'
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch KPIs to show live stats in the sliding banner
  useEffect(() => {
    async function fetchKpis() {
      try {
        const [kpiRes, settingsRes] = await Promise.all([
          fetch('/api/public/kpis'),
          fetch('/api/public/settings')
        ]);
        
        const kpiJson = await kpiRes.json();
        if (kpiJson.success) {
          setKpis(kpiJson.data);
        }

        const settingsJson = await settingsRes.json();
        if (settingsJson.success) {
          setSettings(prev => ({ ...prev, ...settingsJson.data }));
        }
      } catch (err) {
        console.error('Error fetching layout data:', err);
      }
    }
    fetchKpis();
  }, []);

  // Format currency helper
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };



  const navItems = [
    { name: 'Inicio', href: '/public/inicio', icon: LayoutDashboard },
    { name: 'Recaudo', href: '/public/recaudo', icon: DollarSign },
    { name: 'Tráfico', href: '/public/transito', icon: TrendingUp },
    { name: 'Servicios Disponibles', href: '/public/servicios', icon: AlertCircle },
    { name: 'Novedades Vía', href: '/public/novedades', icon: AlertCircle },
    { name: 'Soporte Documental', href: '/public/documentos', icon: FolderOpen }
  ];
 
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Top Info Bar (above nav) */}
      <div className="w-full bg-white border-b border-gray-200 py-2 sm:py-2.5 no-print">
        <div className="w-full mx-auto px-2 sm:px-4 lg:px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo Section */}
          <div className="flex items-center shrink-0 gap-4">
            <img 
              src={settings.logo_base64 || "/logo-gobernacion.png"} 
              alt="Logo Institucional" 
              className="h-20 sm:h-24 w-auto object-contain" 
            />
          </div>
          
          {/* Emergency Info Section */}
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            
            {/* Email / Support */}
            <div className="flex items-center gap-3.5">
               <Mail className="w-8 h-8 text-red-500 stroke-[1.5]" />
               <div className="flex flex-col">
                 <span className="text-slate-800 font-bold text-base">Atención al usuario</span>
                 <a href={`mailto:${settings.email_atencion}`} className="text-slate-500 text-sm hover:text-red-600 transition-colors">{settings.email_atencion}</a>
               </div>
            </div>

            {/* Vertical Divider (Desktop only) */}
            <div className="hidden sm:block w-px h-11 bg-gray-200"></div>

            {/* Phone / Emergency */}
            <div className="flex items-center gap-3.5">
               <Phone className="w-8 h-8 text-red-500 stroke-[1.5]" />
               <div className="flex flex-col">
                 <span className="text-slate-800 font-bold text-base">Línea de Emergencia 24/7</span>
                 <div className="flex items-center gap-2 text-slate-500 text-sm mt-0.5">
                   <a href={`tel:${settings.tel_emergencia.replace(/[^0-9+]/g, '')}`} className="hover:text-red-600 transition-colors font-medium">{settings.tel_emergencia}</a>
                   <span className="text-gray-300">|</span>
                   <a href={`https://wa.me/${settings.tel_whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-green-600 transition-colors flex items-center gap-1.5 font-medium">
                     <MessageCircle className="w-4 h-4" /> WhatsApp
                   </a>
                 </div>
               </div>
            </div>

          </div>
        </div>
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full no-print" style={{ backgroundColor: '#1e3a8a', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div className="w-full mx-auto px-2 sm:px-4 lg:px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-4 xl:gap-8 shrink-0">
            <Link href="/public/inicio" className="flex items-center gap-2 font-bold text-lg text-white">
              <span className="tracking-tight">{settings.nombre_peaje || 'Peaje La Punta'}</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-white"
                    style={{ 
                      color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
                      borderBottom: isActive ? '2px solid #ffffff' : 'none',
                      paddingBottom: isActive ? '4px' : '0'
                    }}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <HeaderFilters settings={settings} />
            <ThemeToggle />
            <Link href="/login" className="hidden sm:flex shrink-0 whitespace-nowrap bg-white text-indigo-600 hover:bg-indigo-50 items-center gap-1.5 py-1.5 px-3 rounded-md shadow-sm font-bold text-xs transition-all print:hidden">
              <User className="w-3.5 h-3.5" />
              <span>Acceso Interno</span>
            </Link>
            {/* Mobile menu toggle */}
            <button 
              className="md:hidden p-2 text-white hover:bg-blue-800 rounded-lg shrink-0 ml-1"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t shadow-inner" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <nav className="flex flex-col py-2 px-4 space-y-1 max-h-[60vh] overflow-y-auto">
              {navItems.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    style={{ 
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'rgba(79, 70, 229, 0.05)' : 'transparent'
                    }}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              <div className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                >
                  <User className="w-5 h-5 shrink-0" />
                  <span>Acceso Interno</span>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>
 


      {/* Main Content */}
      <main className="flex-grow w-full mx-auto px-2 sm:px-4 lg:px-4 pt-2 pb-8 relative">
        
        {/* Print Only Header */}
        <div className="hidden print:flex items-center justify-between mb-8 border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <img 
              src={settings.logo_base64 || "/logo-gobernacion.png"} 
              alt="Logo Institucional" 
              className="h-16 w-auto object-contain" 
            />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black uppercase tracking-widest text-black mt-1">{settings.nombre_peaje ? `ESTACIÓN ${settings.nombre_peaje}` : 'ESTACIÓN PEAJE LA PUNTA'}</h2>
            <p className="text-sm font-semibold text-slate-600">Reporte Estadístico y de Novedades</p>
          </div>
          <div className="flex flex-col text-right text-xs">
            <span className="font-bold text-black">Atención al usuario:</span>
            <span className="text-slate-700">{settings.email_atencion}</span>
            <span className="font-bold text-black mt-1">Línea de Emergencia 24/7:</span>
            <span className="text-slate-700">{settings.tel_emergencia}</span>
          </div>
        </div>
        {children}
      </main>


      {/* Footer */}
      <footer className="border-t py-6 mt-12" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <div className="w-full mx-auto px-2 sm:px-4 lg:px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            &copy; {new Date().getFullYear()} Todos los derechos reservados. ESTACIÓN {settings.nombre_peaje || 'PEAJE LA PUNTA'}.
          </p>
          <div className="flex gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Portal Público Agregado</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
