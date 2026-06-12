import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

// Helper: Convierte número serial de Excel a "YYYY-MM-DD"
function excelSerialToDate(serial: number): string {
  const excelEpoch = new Date(1899, 11, 30);
  const dateInMs = serial * 86400000;
  const jsDate = new Date(excelEpoch.getTime() + dateInMs);
  return jsDate.toISOString().split('T')[0];
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const stationId = formData.get('stationId') as string || 'ST-DEFAULT-01';

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    let hourlySheetName = '';
    let hourlyHeadersRow = -1;
    let firstHourCol = -1;
    let catCol = -1;
    let hDateCol = -1;
    
    let format: 'horizontal_hours' | 'vertical_hours' = 'horizontal_hours';
    let firstHourRow = -1;

    for (const sheetName of workbook.SheetNames) {
      if (sheetName.toUpperCase().includes('TRAFICO HORA')) {
        hourlySheetName = sheetName;
        break;
      }
    }

    if (!hourlySheetName) {
      hourlySheetName = workbook.SheetNames[0]; // fallback
    }

    const hSheet = workbook.Sheets[hourlySheetName];
    const hData = XLSX.utils.sheet_to_json<any[]>(hSheet, { defval: null, header: 1 });

    // Check for vertical hours (new format)
    for (let r = 0; r < Math.min(hData.length, 50); r++) {
       const cell0 = String(hData[r][0] || '').toLowerCase().trim();
       if (cell0.includes('00-01') || cell0.match(/^0?\d\s*a\s*\d\d?$/) || cell0.match(/^0?\d:\d\d/)) {
         format = 'vertical_hours';
         firstHourRow = r;
         break;
       }
    }

    // Helper Date parser
    const parseDateStr = (dateVal: any) => {
      if (!dateVal) return '';
      if (typeof dateVal === 'number') {
        try { return excelSerialToDate(dateVal); } catch { return ''; }
      }
      let normalized = String(dateVal).toLowerCase().trim();
      normalized = normalized.replace(/[\.\/\s]/g, '-');
      normalized = normalized.replace(/-+/g, '-');
      const months: Record<string, string> = { 'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12' };
      for (const [name, num] of Object.entries(months)) {
        normalized = normalized.replace(`-${name}-`, `-${num}-`);
      }
      const parts = normalized.split('-');
      if (parts.length === 3) {
        if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        else if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        else return `20${parts[2].slice(-2)}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else {
        const parsed = new Date(dateVal);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
      }
      return '';
    };

    const normalizeCat = (cat: any) => {
       if (!cat) return '';
       let catName = String(cat).trim().toUpperCase();
       if (catName === 'I' || catName === '1') return 'Cat I';
       if (catName === 'II' || catName === '2') return 'Cat II';
       if (catName === 'III' || catName === '3') return 'Cat III';
       if (catName === 'IV' || catName === '4') return 'Cat IV';
       if (catName === 'V' || catName === '5') return 'Cat V';
       if (catName.includes('CAT')) return catName.replace('CAT.', 'Cat ').replace('CAT', 'Cat ').trim();
       return catName;
    };

    const hourlyInserts: any[] = [];
    const processedDates = new Set<string>();

    if (format === 'vertical_hours') {
       // --- NEW TRANSPOSED FORMAT ---
       const datesRow = firstHourRow - 2;
       const catsRow = firstHourRow - 1;

       if (datesRow < 0 || catsRow < 0) {
         return NextResponse.json({ error: 'Formato vertical inválido: Faltan filas de Fecha y Categoría' }, { status: 400 });
       }

       let currentDateStr = '';
       const colDefs: { col: number, dateStr: string, catName: string }[] = [];
       const maxCols = hData[catsRow].length;

       for (let c = 1; c < maxCols; c++) {
          const dateCell = hData[datesRow][c];
          if (dateCell !== null && dateCell !== undefined && String(dateCell).trim() !== '') {
             currentDateStr = parseDateStr(dateCell);
          }
          const catCell = hData[catsRow][c];
          const catName = normalizeCat(catCell);
          
          if (currentDateStr && catName.startsWith('Cat ')) {
             colDefs.push({ col: c, dateStr: currentDateStr, catName });
             processedDates.add(currentDateStr);
          }
       }

       for (let hr = 0; hr < 24; hr++) {
          const r = firstHourRow + hr;
          if (r >= hData.length) break;
          const row = hData[r];
          if (!row) continue;

          for (const def of colDefs) {
             const qty = parseInt(row[def.col] || '0', 10);
             if (qty > 0) {
                hourlyInserts.push({
                   id: crypto.randomUUID(),
                   station_id: stationId,
                   date: def.dateStr,
                   category: def.catName,
                   hour: hr,
                   quantity: qty
                });
             }
          }
       }

    } else {
       // --- OLD HORIZONTAL FORMAT ---
       for (let i = 0; i < Math.min(hData.length, 50); i++) {
         const row = hData[i];
         if (!row || !Array.isArray(row)) continue;
         const strRow = row.map(cell => cell ? String(cell).toLowerCase().trim() : '');
         
         const hasHours = strRow.filter(h => h.includes('00-01') || h.includes('01-02') || h.match(/^0?\d\s*a\s*\d\d?$/) || h.match(/^0?\d:\d\d/)).length;
         if (hasHours >= 12) {
            hourlyHeadersRow = i;
            for (let c = 0; c < strRow.length; c++) {
              if (firstHourCol === -1 && (strRow[c].includes('00-01') || strRow[c].match(/^0?\d\s*a\s*\d\d?$/) || strRow[c].match(/^0?\d:\d\d/))) firstHourCol = c;
              if (strRow[c].includes('cat') || strRow[c] === 'categoria' || strRow[c] === 'c.') catCol = c;
              if (strRow[c].includes('fecha') || strRow[c].includes('date') || strRow[c].includes('dia')) hDateCol = c;
            }
            break;
         }
       }

       if (firstHourCol === -1) {
         return NextResponse.json({ error: 'No se detectaron columnas u horas válidas en el formato.' }, { status: 400 });
       }

       if (catCol === -1) catCol = firstHourCol - 1;
       if (hDateCol === -1) hDateCol = 0;

       let currentActiveDateStr = '';
       
       for (let i = hourlyHeadersRow + 1; i < hData.length; i++) {
          const row = hData[i];
          if (!row) continue;
          
          const dateVal = row[hDateCol];
          if (dateVal !== null && dateVal !== undefined && String(dateVal).trim() !== '') {
            currentActiveDateStr = parseDateStr(dateVal);
          }

          if (!currentActiveDateStr) continue;

          const catName = normalizeCat(row[catCol]);
          if (!catName.startsWith('Cat ')) continue;

          processedDates.add(currentActiveDateStr);

          for (let hr = 0; hr < 24; hr++) {
            const qty = parseInt(row[firstHourCol + hr] || '0', 10);
            if (qty > 0) {
              hourlyInserts.push({
                id: crypto.randomUUID(),
                station_id: stationId,
                date: currentActiveDateStr,
                category: catName,
                hour: hr,
                quantity: qty
              });
            }
          }
       }
    }

    if (hourlyInserts.length === 0) {
      return NextResponse.json({ error: 'No se encontraron datos de tráfico válidos en la hoja.' }, { status: 400 });
    }

    const db = await getDb();
    
    // Begin transaction
    await db.transaction(async (tx) => {
       const dateList = Array.from(processedDates);
       await tx('hourly_traffic').where('station_id', stationId).whereIn('date', dateList).delete();
       
       const chunkSize = 500;
       for (let offset = 0; offset < hourlyInserts.length; offset += chunkSize) {
         const chunk = hourlyInserts.slice(offset, offset + chunkSize);
         await tx('hourly_traffic').insert(chunk);
       }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Se importaron exitosamente ${hourlyInserts.length} registros horarios para ${processedDates.size} fechas desde la hoja "${hourlySheetName}".`,
      importedRows: hourlyInserts.length
    });

  } catch (error: any) {
    console.error('Hourly Excel Import Error:', error);
    return NextResponse.json({ error: `Error procesando el archivo: ${error.message}` }, { status: 500 });
  }
}
