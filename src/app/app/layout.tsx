'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, DollarSign, TrendingUp, AlertCircle, 
  FileText, Bell, Settings, LogOut, ShieldAlert, ShieldCheck, 
  Menu, X, ChevronDown, MoreHorizontal, Truck, FolderOpen, Calendar
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [alertsCount, setAlertsCount] = useState(0);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      router.push('/login');
      return;
    }

    try {
      const decodedUser = JSON.parse(storedUser);
      setUser(decodedUser);
    } catch {
      localStorage.clear();
      router.push('/login');
      return;
    }

    async function fetchLayoutData() {
      try {
        const [alertsRes, settingsRes] = await Promise.all([
          fetch('/api/app/alerts', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/public/settings')
        ]);
        
        const alertsJson = await alertsRes.json();
        if (alertsJson.success) {
          setAlertsCount(alertsJson.data.length);
        }
        
        const settingsJson = await settingsRes.json();
        if (settingsJson.success) {
          setSettings(settingsJson.data);
        }
      } catch (err) {
        console.error('Failed to load layout data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLayoutData();
  }, [router]);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push('/public/inicio');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Cargando consola interna...</p>
      </div>
    );
  }

  // Navigation items
  const navItems = [
    { name: 'Tablero Principal', href: '/app/inicio', icon: LayoutDashboard, roles: ['ADMIN', 'OPERADOR', 'INTERVENTOR'] },
    { name: 'Recaudo & Auditoría', href: '/app/recaudo', icon: DollarSign, roles: ['ADMIN', 'OPERADOR', 'INTERVENTOR'] },
    { name: 'Tráfico', href: '/app/transito', icon: TrendingUp, roles: ['ADMIN', 'OPERADOR', 'INTERVENTOR'] },
    { name: 'Servicios Disponibles', href: '/app/servicios', icon: Truck, roles: ['ADMIN', 'OPERADOR', 'INTERVENTOR'] },
    { name: 'Novedades Vía', href: '/app/novedades', icon: AlertCircle, roles: ['ADMIN', 'OPERADOR', 'INTERVENTOR'] },
    { name: 'Soporte Documental', href: '/app/documentos', icon: FolderOpen, roles: ['ADMIN', 'OPERADOR', 'INTERVENTOR'] },
    { name: 'Alertas y Alarmas', href: '/app/alertas', icon: Bell, roles: ['ADMIN', 'OPERADOR', 'INTERVENTOR'], badge: alertsCount },
    { name: 'Configuración', href: '/app/configuracion', icon: Settings, roles: ['ADMIN'] },
    { name: 'Administración', href: '/app/admin', icon: ShieldCheck, roles: ['ADMIN'] }
  ];

  const allowedItems = navItems.filter(item => user && item.roles.includes(user.role));

  const MAX_MAIN_ITEMS = 5;
  const mainItems = allowedItems.slice(0, MAX_MAIN_ITEMS);
  const dropdownItems = allowedItems.slice(MAX_MAIN_ITEMS);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Top Header Row */}
      <header className="shrink-0 relative z-30 shadow-md" style={{ backgroundColor: '#1e3a8a' }}>
        <div className="px-4 md:px-6 h-16 flex items-center justify-between">
          
          {/* Left: Brand & Desktop Navigation Container */}
          <div className="flex items-center h-full w-full">
            
            {/* Brand */}
            <div className="flex items-center gap-3 text-white shrink-0 mr-8">
              <div className="hidden sm:flex items-center justify-center bg-white rounded-md p-1.5 h-11 shadow-sm">
                <img 
                  src={settings?.logo_base64 || "/logo-gobernacion.png"} 
                  alt="Logo" 
                  className="h-full w-auto object-contain" 
                />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight truncate uppercase" title={settings?.nombre_peaje || 'PEAJE LA PUNTA'}>
                  {settings?.nombre_peaje || 'PEAJE LA PUNTA'}
                </span>
              </div>
            </div>

            {/* Desktop Navigation Row (Center/Left) */}
            <div className="hidden lg:flex items-center h-full gap-1">
              {mainItems.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 xl:px-4 h-16 text-[10px] xl:text-[11px] uppercase font-bold tracking-wider transition-all border-b-4 ${
                      isActive 
                        ? 'text-white border-white bg-white/10' 
                        : 'text-blue-100 border-transparent hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="peaje-badge peaje-badge-danger text-[9px] px-1 py-0">{item.badge}</span>
                    )}
                  </Link>
                );
              })}

              {/* Dropdown for overflow items */}
              {dropdownItems.length > 0 && (
                <div className="relative h-full flex items-center" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`flex items-center gap-2 px-3 xl:px-4 h-16 text-[10px] xl:text-[11px] uppercase font-bold tracking-wider transition-all border-b-4 cursor-pointer ${
                      dropdownItems.some(i => pathname === i.href) || isDropdownOpen
                        ? 'text-white border-white bg-white/10' 
                        : 'text-blue-100 border-transparent hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span>Más Opciones</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute top-16 left-0 w-64 rounded-b-xl shadow-lg border-x border-b overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                      {dropdownItems.map(item => {
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsDropdownOpen(false)}
                            className="flex items-center justify-between px-4 py-3 text-[11px] uppercase tracking-wider font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80"
                            style={{ color: isActive ? 'var(--primary)' : 'var(--text-secondary)' }}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon className="w-4 h-4" />
                              <span>{item.name}</span>
                            </div>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className="peaje-badge peaje-badge-danger text-[9px] px-1 py-0">{item.badge}</span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: User / Alerts / Controls */}
          <div className="flex items-center gap-3 md:gap-4 text-white shrink-0 ml-4">
            {alertsCount > 0 && (
              <Link href="/app/alertas" className="hidden md:flex items-center gap-1.5 text-xs font-bold text-rose-300 hover:text-rose-100 hover:underline">
                <ShieldAlert className="w-4.5 h-4.5 animate-pulse" />
                <span>{alertsCount} Alertas</span>
              </Link>
            )}
            
            <ThemeToggle />
            
            <div className="hidden sm:flex items-center gap-2 border-l pl-3 ml-1 md:pl-4 md:ml-2" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-white leading-tight">{user?.name}</span>
                <span className="text-[9px] text-blue-200 uppercase">{user?.role}</span>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-[#1e3a8a] font-bold uppercase text-xs shrink-0">
                {user?.username?.substring(0, 2)}
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="hidden sm:flex p-2 text-rose-300 hover:bg-rose-900/50 hover:text-rose-100 rounded-lg cursor-pointer transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>

            {/* Mobile menu toggle */}
            <button 
              className="lg:hidden p-2 text-white hover:bg-blue-800 rounded-lg"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t shadow-inner" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <nav className="flex flex-col py-2 px-4 space-y-1 max-h-[60vh] overflow-y-auto">
              {allowedItems.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold transition-all hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    style={{ 
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'rgba(79, 70, 229, 0.05)' : 'transparent'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="peaje-badge peaje-badge-danger text-[9px] px-1.5 py-0.5">{item.badge}</span>
                    )}
                  </Link>
                );
              })}
              <div className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Panel Content Area */}
      <main className="flex-grow overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-900/20 relative">
        {children}
      </main>
    </div>
  );
}
