'use client';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Calendar, Printer, ChevronDown, Loader2, X } from 'lucide-react';
import React, { Suspense, useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function Filters({ settings }: { settings?: Record<string, string> }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const pdfMenuRef = useRef<HTMLDivElement>(null);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(event.target as Node)) {
        setShowPdfMenu(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrint = async (mode: string) => {
    setShowPdfMenu(false);
    setGeneratingPdf(true);
    document.body.classList.add('pdf-generating');

    try {
      // Pre-load logo image as base64
      let logoBase64 = (settings?.logo_base64 && settings.logo_base64.startsWith('data:image/')) ? settings.logo_base64 : '';
      if (!logoBase64) {
        try {
          const r = await fetch('/logo-gobernacion.png');
          if (r.ok) {
            const logoBlob = await r.blob();
            logoBase64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(logoBlob);
            });
          }
        } catch (e) {
          console.warn('Could not load fallback logo for PDF', e);
        }
      }

      // Legal landscape: 355.6mm x 215.9mm
      const pageW = 355.6;
      const pageH = 215.9;
      const margin = 8;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;
      const headerH = 22; // Increased for taller header

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [215.9, 355.6] });

      const addHeader = (doc: InstanceType<typeof jsPDF>) => {
        // Logo Left
        if (logoBase64 && logoBase64.startsWith('data:image')) {
          try {
            // Adjust width/height preserving roughly the aspect ratio of the logo
            doc.addImage(logoBase64, 'PNG', margin, margin, 45, 16);
          } catch(err) {
            console.warn('Failed to add logo to PDF', err);
          }
        }

        // Title Center
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(settings?.nombre_peaje ? `ESTACIÓN ${settings.nombre_peaje}` : 'ESTACIÓN PEAJE LA PUNTA', pageW / 2, margin + 8, { align: 'center' });
        // Removed subtitle per user request
        // doc.text('Reporte Estadístico y de Novedades', pageW / 2, margin + 14, { align: 'center' });
        
        // Dynamic Metadata
        doc.setFontSize(8);
        const urlParams = new URLSearchParams(window.location.search);
        const sd = urlParams.get('startDate');
        const ed = urlParams.get('endDate');
        const wk = urlParams.get('week') || 'todas';
        const periodoStr = sd && ed ? `${sd} al ${ed}` : (wk !== 'todas' ? `Semana ${wk}` : 'Histórico Global');
        doc.text(`Período Visualizado: ${periodoStr}   |   Fecha de Generación: ${new Date().toLocaleString('es-CO')}`, pageW / 2, margin + 19, { align: 'center' });

        // Emergency Right
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Atención al usuario:', pageW - margin, margin + 4, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(settings?.email_atencion || 'peajelapunta@santander.gov.co', pageW - margin, margin + 8, { align: 'right' });
        
        doc.setFont('helvetica', 'bold');
        doc.text('Línea de Emergencia 24/7:', pageW - margin, margin + 13, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(settings?.tel_emergencia || '(+57) 317 513 2240', pageW - margin, margin + 17, { align: 'right' });
      };

      const captureElement = async (el: HTMLElement): Promise<string> => {
        el.classList.add('pdf-generating-element');
        const dataUrl = await toPng(el, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
          filter: (node: HTMLElement) => {
            if (node.tagName === 'BUTTON') return false;
            if (node.classList?.contains('no-print')) return false;
            return true;
          },
        });
        el.classList.remove('pdf-generating-element');
        return dataUrl;
      };

      const addImageToPage = (doc: InstanceType<typeof jsPDF>, dataUrl: string, el: HTMLElement, startY: number, maxH: number) => {
        const ratio = el.offsetHeight / el.offsetWidth;
        const imgW = usableW;
        const imgH = ratio * imgW;
        const finalH = Math.min(imgH, maxH);
        const finalW = (finalH / imgH) * imgW;
        const x = margin + (usableW - finalW) / 2;
        doc.addImage(dataUrl, 'PNG', x, startY, finalW, finalH);
        return finalH;
      };

      const addVectorTableToPdf = (doc: InstanceType<typeof jsPDF>, startY: number) => {
        const tableEl = document.querySelector('#pdf-section-table table');
        if (!tableEl) return;
        
        autoTable(doc, {
          html: '#pdf-section-table table',
          startY: startY,
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 2,
            font: 'helvetica',
            textColor: [40, 40, 40], // Slate-800
          },
          headStyles: {
            fillColor: [248, 250, 252], // bg-slate-50
            textColor: [71, 85, 105], // text-slate-500
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
          },
          columnStyles: {
            0: { halign: 'center' }, // Fecha / Día
            1: { halign: 'center', fontStyle: 'bold' },
            2: { halign: 'center', fontStyle: 'bold' },
            3: { halign: 'center', fontStyle: 'bold' },
            4: { halign: 'center', fontStyle: 'bold' },
            5: { halign: 'center', fontStyle: 'bold' },
            6: { halign: 'center', fontStyle: 'bold', textColor: [79, 70, 229] }, // Total
            7: { halign: 'center' }, // Estado
            8: { halign: 'center' }, // Estado if 'diario'
          },
          didParseCell: function(data) {
            // Apply custom styling based on content for the badge column
            if (data.section === 'body') {
              const text = data.cell.text[0];
              if (text && (text.includes('ALTO FLUJO') || text.includes('BAJO FLUJO') || text.includes('FLUJO NORMAL'))) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fontSize = 7;
                if (text.includes('ALTO FLUJO')) {
                  data.cell.styles.textColor = [22, 163, 74]; // text-green-600
                  data.cell.styles.fillColor = [220, 252, 231]; // bg-green-100
                } else if (text.includes('BAJO FLUJO')) {
                  data.cell.styles.textColor = [202, 138, 4]; // text-yellow-600
                  data.cell.styles.fillColor = [254, 249, 195]; // bg-yellow-100
                } else {
                  data.cell.styles.textColor = [100, 116, 139]; // text-slate-500
                  data.cell.styles.fillColor = [241, 245, 249]; // bg-slate-100
                }
              }
            }
          }
        });
      };

      if (mode === 'table') {
        addHeader(pdf);
        addVectorTableToPdf(pdf, margin + headerH);
      } else if (mode === 'charts' || mode === 'all') {
        const kpisEl = document.getElementById('pdf-section-kpis');
        const bucketsEl = document.getElementById('pdf-section-buckets');
        const chartsEl = document.getElementById('pdf-section-charts');
        const hourlyEl = document.getElementById('pdf-section-hourly');
        
        // Wait for Recharts animations to finish (usually 1s) and layout to stabilize
        await new Promise(resolve => setTimeout(resolve, 1500));

        addHeader(pdf);
        let y = margin + headerH;
        let hasPage1Content = false;
        
        if (kpisEl) {
          const img = await captureElement(kpisEl);
          const h = addImageToPage(pdf, img, kpisEl, y, (usableH - headerH) * 0.45);
          y += h + 4;
          hasPage1Content = true;
        }
        if (bucketsEl) {
          const img = await captureElement(bucketsEl);
          addImageToPage(pdf, img, bucketsEl, y, (usableH - headerH) * 0.45);
          hasPage1Content = true;
        }

        if (chartsEl || hourlyEl) {
          // If we used more than 50% of the page, add a new one
          if (y > pageH * 0.5) {
            pdf.addPage([215.9, 355.6], 'landscape');
            addHeader(pdf);
            y = margin + headerH;
          }
          
          if (chartsEl) {
            const img = await captureElement(chartsEl);
            const remainingH = (margin + usableH) - y;
            const h = addImageToPage(pdf, img, chartsEl, y, remainingH);
            y += h + 4;
          }
          if (hourlyEl) {
            const img = await captureElement(hourlyEl);
            let remainingH = (margin + usableH) - y;
            if (remainingH < 50) {
              pdf.addPage([215.9, 355.6], 'landscape');
              addHeader(pdf);
              y = margin + headerH;
              remainingH = usableH - headerH;
            }
            addImageToPage(pdf, img, hourlyEl, y, remainingH);
          }
        }

        if (mode === 'all') {
          pdf.addPage([215.9, 355.6], 'landscape');
          addHeader(pdf);
          addVectorTableToPdf(pdf, margin + headerH);
        }
      }

      // Add Page Numbers
      const totalPages = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
      }

      const reportName = pathname.includes('recaudo') ? 'Recaudo' : 'Transito';
      pdf.save(`Reporte_${reportName}_Peaje_La_Punta.pdf`);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      alert(`Hubo un error al generar el PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setGeneratingPdf(false);
      document.body.classList.remove('pdf-generating');
    }
  };

  const selectedWeek = searchParams.get('week') || 'todas';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  const handleWeekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set('week', val);
    if (val === 'last7') {
      params.delete('startDate');
      params.delete('endDate');
      params.set('period', 'last7');
    } else if (val === 'last30') {
      params.delete('startDate');
      params.delete('endDate');
      params.set('period', 'last30');
    } else if (val === 'todas') {
      params.delete('startDate');
      params.delete('endDate');
      params.delete('period');
    } else if (val === 'custom') {
      params.delete('period');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDateChange = (field: 'startDate' | 'endDate', val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(field, val);
    params.set('week', 'custom');
    params.delete('period');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-nowrap items-center gap-2">
      {/* Compact Filters Popover */}
      <div className="relative print:hidden" ref={datePickerRef}>
        <button 
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="flex flex-nowrap items-center gap-2 bg-[#1f5699] hover:bg-[#1a4b85] transition-colors p-1.5 px-3 rounded-lg text-white shadow-sm border border-[#2b6cb0] shrink-0"
        >
          <Calendar className="w-4 h-4 text-[#9fc1e8]" />
          <span className="text-sm font-semibold">
            {selectedWeek === 'todas' ? 'Fechas: Todas' : selectedWeek === 'last7' ? 'Últimos 7 días' : selectedWeek === 'last30' ? 'Últimos 30 días' : `${startDate || 'Inicio'} - ${endDate || 'Fin'}`}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
        </button>

        {showDatePicker && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Rango Predefinido</label>
              <select 
                value={selectedWeek}
                onChange={(e) => {
                  handleWeekChange(e);
                  if(e.target.value !== 'custom') setShowDatePicker(false);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold p-2 rounded border border-slate-200 dark:border-slate-700 outline-none cursor-pointer"
              >
                <option value="todas">Fechas: Todas</option>
                <option value="last7">Últimos 7 días</option>
                <option value="last30">Últimos 30 días</option>
                <option value="custom" disabled>Rango Específico</option>
              </select>
            </div>
            
            <div className="h-px w-full bg-slate-200 dark:bg-slate-700"></div>
            
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Rango Específico</label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-12">Desde:</span>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold p-1.5 rounded border border-slate-200 dark:border-slate-700 outline-none cursor-pointer" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-12">Hasta:</span>
                  <div className="flex-1 flex gap-1 items-center relative">
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => handleDateChange('endDate', e.target.value)}
                      className="flex-1 w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold p-1.5 rounded border border-slate-200 dark:border-slate-700 outline-none cursor-pointer" 
                    />
                  </div>
                </div>
                {(startDate || endDate) && selectedWeek === 'custom' && (
                  <button 
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.delete('startDate');
                      params.delete('endDate');
                      params.delete('period');
                      params.set('week', 'todas');
                      router.push(`${pathname}?${params.toString()}`);
                      setShowDatePicker(false);
                    }}
                    className="mt-1 flex items-center justify-center gap-1 w-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors text-[11px] font-bold py-1.5 rounded border border-rose-200 dark:border-rose-800/50"
                  >
                    <X className="w-3 h-3" />
                    Borrar Filtro
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PDF Button */}
      <div className="relative" ref={pdfMenuRef}>
        <button 
          onClick={() => !generatingPdf && setShowPdfMenu(!showPdfMenu)}
          disabled={generatingPdf}
          className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 text-white px-3 py-1.5 rounded-md font-bold text-xs transition-all border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] print:hidden ${generatingPdf ? 'bg-gray-400 cursor-wait' : 'bg-[#5b50ff] hover:bg-[#4a40e0]'}`}
        >
          {generatingPdf ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generando...</span>
            </>
          ) : (
            <>
              <Printer className="w-3.5 h-3.5" />
              <span>PDF</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPdfMenu ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>

        {showPdfMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 print:hidden">
            <button 
              onClick={() => handlePrint('all')}
              className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
            >
              Todo el Reporte
            </button>
            <button 
              onClick={() => handlePrint('charts')}
              className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
            >
              Solo Indicadores y Gráficos
            </button>
            <button 
              onClick={() => handlePrint('table')}
              className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
            >
              Solo Tabla Dinámica
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HeaderFilters({ settings }: { settings?: Record<string, string> }) {
  return (
    <Suspense fallback={<div className="w-64 h-10 bg-indigo-500/20 rounded animate-pulse" />}>
      <Filters settings={settings} />
    </Suspense>
  );
}
