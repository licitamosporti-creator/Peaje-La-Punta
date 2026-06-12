import * as XLSX from 'xlsx';
import crypto from 'crypto';
import { Knex } from 'knex';
import { excelSerialToDate } from './excelParser';

export interface ParseResult {
  importedRows: number;
  dates: string[];
  errors: string[];
  warnings: string[];
}

function normalizeHeader(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex(h => {
    const norm = normalizeHeader(h);
    return aliases.some(alias => norm.includes(alias));
  });
}

export async function parseDynamicExcel(
  filePathOrBuffer: string | Buffer,
  stationId: string,
  userId: string,
  filename: string,
  tx: Knex
): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let importedRows = 0;
  const processedDates = new Set<string>();

  const workbook = typeof filePathOrBuffer === 'string'
    ? XLSX.readFile(filePathOrBuffer)
    : XLSX.read(filePathOrBuffer, { type: 'buffer' });

  // Find the most promising sheet (the one with the most columns matching our aliases)
  let bestSheetName = '';
  let bestScore = -1;
  let bestHeaders: string[] = [];
  let bestData: any[] = [];
  let headerRowIndex = 0;

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.toUpperCase().includes('TRAFICO HORA')) continue; // Skip hourly sheets!
    
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { defval: null, header: 1 });
    
    // Scan the first 10 rows to find headers
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;
      
      const strRow = row.map(cell => cell ? String(cell) : '');
      let score = 0;
      
      if (findColumnIndex(strRow, ['fecha', 'date', 'dia']) !== -1) score += 5; // Date is crucial
      if (findColumnIndex(strRow, ['cat 1', 'cat i', 'c1']) !== -1) score += 1;
      if (findColumnIndex(strRow, ['cat 2', 'cat ii', 'c2']) !== -1) score += 1;
      if (findColumnIndex(strRow, ['efectivo', 'cash']) !== -1) score += 1;
      if (findColumnIndex(strRow, ['electronico', 'telepeaje']) !== -1) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestSheetName = sheetName;
        bestHeaders = strRow;
        bestData = data;
        headerRowIndex = i;
      }
    }
  }

  if (bestScore < 5) {
    throw new Error('No se pudo detectar una estructura válida en ninguna hoja (se requiere al menos una columna de Fecha).');
  }

  warnings.push(`Se usó heurística avanzada en la hoja "${bestSheetName}".`);

  // Map the columns
  const dateCol = findColumnIndex(bestHeaders, ['fecha', 'date', 'dia']);
  
  // Traffic columns (First occurrences)
  const cat1Col = findColumnIndex(bestHeaders, ['cat 1', 'cat i', 'c1', 'categoria 1', 'categoria i']);
  const cat2Col = findColumnIndex(bestHeaders, ['cat 2', 'cat ii', 'c2', 'categoria 2', 'categoria ii']);
  const cat3Col = findColumnIndex(bestHeaders, ['cat 3', 'cat iii', 'c3', 'categoria 3', 'categoria iii']);
  const cat4Col = findColumnIndex(bestHeaders, ['cat 4', 'cat iv', 'c4', 'categoria 4', 'categoria iv']);
  const cat5Col = findColumnIndex(bestHeaders, ['cat 5', 'cat v', 'c5', 'categoria 5', 'categoria v']);

  // Find 'TOTAL RECAUDO DIARIO' in the first 10 rows to locate revenue columns per category
  let revenueStartCol = -1;
  for (let i = 0; i < Math.min(bestData.length, 10); i++) {
    const row = bestData[i];
    if (!row || !Array.isArray(row)) continue;
    const strRow = row.map(cell => cell ? String(cell).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '');
    const recIndex = strRow.findIndex(s => s.includes('total recaudo diario') || s.includes('recaudo diario') || (s.includes('total') && s.includes('recaudo')));
    if (recIndex !== -1) {
      revenueStartCol = recIndex;
      break;
    }
  }

  // Revenue columns (Payment Methods)
  const cashCol = findColumnIndex(bestHeaders, ['efectivo', 'cash', 'dinero']);
  const elecCol = findColumnIndex(bestHeaders, ['electronico', 'telepeaje', 'tarjeta']);
  const iprevCol = findColumnIndex(bestHeaders, ['colpass', 'iprev', 'tag', 'flypass', 'facilpass', 'copiloto', 'gopass']);

  const datesToProcess: { serialOrStr: any; dateStr: string; rowIndex: number }[] = [];

  // Extract dates
  for (let i = headerRowIndex + 1; i < bestData.length; i++) {
    const row = bestData[i];
    if (!row || !row[dateCol]) continue;
    
    const dateVal = row[dateCol];
    let dateStr = '';
    
    if (typeof dateVal === 'number') {
      try {
        dateStr = excelSerialToDate(dateVal);
      } catch (err: any) {
        errors.push(`Error en fecha (fila ${i + 1}): ${err.message}`);
        continue;
      }
    } else if (typeof dateVal === 'string') {
      // Basic string parsing
      let normalized = dateVal.toLowerCase().split(' ').join('').split('.').join('-').split('/').join('-');
      
      const months: Record<string, string> = { 'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12' };
      for (const [name, num] of Object.entries(months)) {
        normalized = normalized.replace(`-${name}-`, `-${num}-`);
      }

      const parts = normalized.split('-');
      if (parts.length === 3) {
        // e.g. 31-12-2024 or 2024-12-31
        if (parts[2].length === 4) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (parts[0].length === 4) {
          dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 2) {
          // Assume 20xx
          dateStr = `20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } else {
        // Fallback to JS Date parser if format is different
        const parsed = new Date(dateVal);
        if (!isNaN(parsed.getTime())) {
          dateStr = parsed.toISOString().split('T')[0];
        }
      }
    }

    if (dateStr && dateStr.length === 10 && (dateStr.startsWith('20') || dateStr.startsWith('19'))) {
      datesToProcess.push({ serialOrStr: dateVal, dateStr, rowIndex: i });
      processedDates.add(dateStr);
    } else {
      errors.push(`Fila ${i + 1}: Valor en columna fecha '${dateVal}' no es válido.`);
    }
  }

  if (datesToProcess.length === 0) {
    const errorPreview = errors.length > 0 ? ` Detalles: ${errors.slice(0, 3).join(' | ')}` : '';
    throw new Error(`No se encontraron registros de fechas válidas en la hoja detectada.${errorPreview}`);
  }

  const dateList = Array.from(processedDates);

  // Idempotency
  await tx('daily_traffic').where('station_id', stationId).whereIn('date', dateList).delete();
  await tx('daily_revenue').where('station_id', stationId).whereIn('date', dateList).delete();
  await tx('daily_payments_summary').where('station_id', stationId).whereIn('date', dateList).delete();

  const trafficInserts: any[] = [];
  const revenueInserts: any[] = [];
  const paymentsInserts: any[] = [];

  const dias = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

  for (const item of datesToProcess) {
    const row = bestData[item.rowIndex];
    const dateStr = item.dateStr;
    const d = new Date(`${dateStr}T12:00:00Z`);
    const computedWeekday = dias[d.getUTCDay()];

    // Traffic Inserts
    const mapTraffic = (catName: string, colIdx: number) => {
      if (colIdx === -1) return;
      const qty = parseInt(row[colIdx] || '0', 10);
      if (qty > 0) {
        trafficInserts.push({
          id: crypto.randomUUID(),
          station_id: stationId,
          date: dateStr,
          weekday: computedWeekday,
          category: catName,
          bucket: 'NORMAL',
          payment_method: 'EFECTIVO', // Fallback, heuristics can't perfectly map bucket+method
          quantity: qty
        });
      }
    };

    mapTraffic('Cat I', cat1Col);
    mapTraffic('Cat II', cat2Col);
    mapTraffic('Cat III', cat3Col);
    mapTraffic('Cat IV', cat4Col);
    mapTraffic('Cat V', cat5Col);

    // Revenue / Payments Inserts
    const cashAmt = Math.round(parseFloat(row[cashCol] || '0'));
    const elecAmt = Math.round(parseFloat(row[elecCol] || '0'));
    const iprevAmt = Math.round(parseFloat(row[iprevCol] || '0'));
    const totalRev = cashAmt + elecAmt + iprevAmt;

    let parsedRevenueByCategory = false;
    if (revenueStartCol !== -1) {
      const revCategories = ['Cat I', 'Cat II', 'Cat III', 'Cat IV'];
      revCategories.forEach((catName, idx) => {
        const colIdx = revenueStartCol + idx;
        const amount = Math.round(parseFloat(row[colIdx] || '0'));
        if (amount > 0) {
          parsedRevenueByCategory = true;
          revenueInserts.push({
            id: crypto.randomUUID(),
            station_id: stationId,
            date: dateStr,
            category: catName,
            amount: amount
          });
        }
      });
    }

    if (!parsedRevenueByCategory && totalRev > 0) {
      revenueInserts.push({
        id: crypto.randomUUID(),
        station_id: stationId,
        date: dateStr,
        category: 'MIXTO', // Fallback
        amount: totalRev
      });
    }

    if (cashAmt > 0) paymentsInserts.push({ id: crypto.randomUUID(), station_id: stationId, date: dateStr, payment_method: 'EFECTIVO', amount: cashAmt });
    if (elecAmt > 0) paymentsInserts.push({ id: crypto.randomUUID(), station_id: stationId, date: dateStr, payment_method: 'ELECTRONICO', amount: elecAmt });
    if (iprevAmt > 0) paymentsInserts.push({ id: crypto.randomUUID(), station_id: stationId, date: dateStr, payment_method: 'IPREV_COLPASS', amount: iprevAmt });
  }

  if (trafficInserts.length > 0) {
    await tx('daily_traffic').insert(trafficInserts);
    importedRows += trafficInserts.length;
  }
  if (revenueInserts.length > 0) {
    await tx('daily_revenue').insert(revenueInserts);
    importedRows += revenueInserts.length;
  }
  if (paymentsInserts.length > 0) {
    await tx('daily_payments_summary').insert(paymentsInserts);
    importedRows += paymentsInserts.length;
  }

  // --- BUSCAR HOJA DE TRÁFICO HORARIO ---
  let hourlySheetName = '';
  let hourlyHeadersRow = -1;
  let firstHourCol = -1;
  let catCol = -1;
  let hDateCol = -1;
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { defval: null, header: 1 });
    
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;
      const strRow = row.map(cell => cell ? String(cell).toLowerCase().trim() : '');
      
      const hasHours = strRow.filter(h => h.includes('00-01') || h.includes('01-02') || h.match(/^0?\d\s*a\s*\d\d?$/) || h.match(/^0?\d:\d\d/)).length;
      if (hasHours >= 12) {
         hourlySheetName = sheetName;
         hourlyHeadersRow = i;
         
         // Find cols
         for (let c = 0; c < strRow.length; c++) {
           if (firstHourCol === -1 && (strRow[c].includes('00-01') || strRow[c].match(/^0?\d\s*a\s*\d\d?$/) || strRow[c].match(/^0?\d:\d\d/))) {
             firstHourCol = c;
           }
           if (strRow[c].includes('cat') || strRow[c] === 'categoria' || strRow[c] === 'c.') {
             catCol = c;
           }
           if (strRow[c].includes('fecha') || strRow[c].includes('date') || strRow[c].includes('dia')) {
             hDateCol = c;
           }
         }
         break;
      }
    }
    if (hourlySheetName) break;
  }

  if (hourlySheetName && firstHourCol !== -1) {
    warnings.push(`Se detectó tráfico horario en la hoja "${hourlySheetName}".`);
    const hSheet = workbook.Sheets[hourlySheetName];
    const hData = XLSX.utils.sheet_to_json<any[]>(hSheet, { defval: null, header: 1 });
    
    if (catCol === -1) catCol = firstHourCol - 1;
    if (hDateCol === -1) hDateCol = 0;

    let currentActiveDateStr = '';
    const hourlyInserts: any[] = [];
    
    for (let i = hourlyHeadersRow + 1; i < hData.length; i++) {
       const row = hData[i];
       if (!row) continue;
       
       const dateVal = row[hDateCol];
       if (dateVal && typeof dateVal === 'number') {
         try { currentActiveDateStr = excelSerialToDate(dateVal); } catch {}
       } else if (dateVal && typeof dateVal === 'string') {
         let normalized = dateVal.toLowerCase().split(' ').join('').split('.').join('-').split('/').join('-');
         
         // Fix for Spanish month abbreviations like "21-abr-2026"
         const months: Record<string, string> = { 'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12' };
         for (const [name, num] of Object.entries(months)) {
           normalized = normalized.replace(`-${name}-`, `-${num}-`);
         }

         const parts = normalized.split('-');
         if (parts.length === 3) {
           if (parts[2].length === 4) currentActiveDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
           else if (parts[0].length === 4) currentActiveDateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
           else currentActiveDateStr = `20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
         } else {
           const parsed = new Date(dateVal);
           if (!isNaN(parsed.getTime())) currentActiveDateStr = parsed.toISOString().split('T')[0];
         }
       }

       if (!currentActiveDateStr || !processedDates.has(currentActiveDateStr)) continue;

       const cat = row[catCol];
       if (!cat) continue;
       
       let catName = cat.toString().trim().toUpperCase();
       if (catName === 'I' || catName === '1') catName = 'Cat I';
       else if (catName === 'II' || catName === '2') catName = 'Cat II';
       else if (catName === 'III' || catName === '3') catName = 'Cat III';
       else if (catName === 'IV' || catName === '4') catName = 'Cat IV';
       else if (catName === 'V' || catName === '5') catName = 'Cat V';
       else if (catName === 'VI' || catName === '6') catName = 'Cat VI';
       else if (catName === 'VII' || catName === '7') catName = 'Cat VII';
       else if (catName.includes('CAT')) catName = catName.replace('CAT.', 'Cat ').replace('CAT', 'Cat ').trim();

       if (!catName || catName.includes('TOTAL') || catName.includes('PROMEDIO') || catName.includes('FECHA')) {
         continue;
       }

       for (let hr = 0; hr < 24; hr++) {
         const val = row[firstHourCol + hr];
         const qty = parseInt(val || '0', 10);
         if (!isNaN(qty) && qty > 0) {
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

    if (hourlyInserts.length > 0) {
       await tx('hourly_traffic').where('station_id', stationId).whereIn('date', dateList).delete();
       const chunkSize = 500;
       for (let offset = 0; offset < hourlyInserts.length; offset += chunkSize) {
         const chunk = hourlyInserts.slice(offset, offset + chunkSize);
         await tx('hourly_traffic').insert(chunk);
         importedRows += chunk.length;
       }
    }
  }

  if (importedRows === 0) {
    warnings.push('El archivo fue procesado pero no se detectaron valores numéricos de tránsito o recaudo válidos.');
  } else {
    warnings.push(`Mapeo Automático: Fecha (Col ${dateCol}), Efectivo (Col ${cashCol}), Electrónico (Col ${elecCol}), Cat I (Col ${cat1Col})`);
  }

  return { importedRows, dates: dateList, errors, warnings };
}
