import * as XLSX from 'xlsx';
import crypto from 'crypto';
import { Knex } from 'knex';

// Helper to convert Excel date serial to ISO date string (YYYY-MM-DD)
export function excelSerialToDate(serial: any): string {
  if (typeof serial !== 'number') {
    throw new Error('Excel serial date must be a number');
  }
  // Adjust for Excel leap year bug (1900 is treated as leap year)
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

export function parseFlexibleDate(dateVal: any): string {
  if (!dateVal && dateVal !== 0) return '';
  if (typeof dateVal === 'number') {
    return excelSerialToDate(dateVal);
  }
  if (typeof dateVal === 'string') {
    let normalized = dateVal.toLowerCase().trim();
    if (!normalized) return '';
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
    }
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }
  throw new Error(`Unparseable date: ${dateVal}`);
}

// Helper to format Excel time fraction (e.g. 0.33333 -> "08:00")
export function excelSerialToTime(val: any): string {
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    return val.trim();
  }
  return '';
}

export interface ParseResult {
  importedRows: number;
  dates: string[];
  errors: string[];
}

export async function parseAndSaveExcel(
  filePathOrBuffer: string | Buffer,
  stationId: string,
  userId: string,
  filename: string,
  tx: Knex
): Promise<ParseResult> {
  const errors: string[] = [];
  let importedRows = 0;
  const processedDates = new Set<string>();

  // 1. Read workbook
  const workbook = typeof filePathOrBuffer === 'string'
    ? XLSX.readFile(filePathOrBuffer)
    : XLSX.read(filePathOrBuffer, { type: 'buffer' });

  // 2. Check required sheets
  const requiredSheets = ['MATRIZ'];
  for (const sheet of requiredSheets) {
    if (!workbook.SheetNames.includes(sheet)) {
      throw new Error(`Falta la hoja requerida: "${sheet}" en el archivo Excel.`);
    }
  }

  // Find the traffic sheet (can be named differently)
  let trafficSheetName = '';
  const possibleTrafficNames = ['TRAFICO HORA', 'TRAFICO MES', 'TRAFICO MES2', 'MATRIZ DE TRÁFICO MENSUAL - RESUMEN DIARIO', 'TRAFICO'];
  for (const name of possibleTrafficNames) {
    if (workbook.SheetNames.includes(name)) {
      trafficSheetName = name;
      break;
    }
  }
  if (!trafficSheetName) {
    console.log(`No se encontró la hoja de tráfico horario. Se omitirá el procesamiento horario.`);
  }

  // 3. Extract data from MATRIZ sheet to find the dates first
  const matrizSheet = workbook.Sheets['MATRIZ'];
  const matrizData = XLSX.utils.sheet_to_json<any[]>(matrizSheet, { defval: null, header: 1 });
  
  const datesToProcess: { serial: number; dateStr: string; rowIndex: number }[] = [];
  
  // Row 4 is index 3 (first data row)
  for (let i = 3; i < matrizData.length; i++) {
    const row = matrizData[i];
    let dateSerial = row[0];
    let weekdayIndex = 1;
    // Soporte para ambos formatos (A=Fecha, B=Día o A=Día, B=Fecha)
    if (typeof dateSerial === 'string' && typeof row[1] === 'number') {
      dateSerial = row[1];
      weekdayIndex = 0;
    }

    if (!row || dateSerial === null || dateSerial === undefined || dateSerial === '') {
      continue;
    }
    try {
      const dateStr = parseFlexibleDate(dateSerial);
      datesToProcess.push({ serial: dateSerial, dateStr, rowIndex: i });
      processedDates.add(dateStr);
    } catch (err: any) {
      errors.push(`Error al convertir fecha ${dateSerial} en la fila ${i + 1} de MATRIZ: ${err.message}`);
    }
  }

  if (datesToProcess.length === 0) {
    throw new Error('No se encontraron registros de fechas válidas en la hoja MATRIZ.');
  }

  const dateList = Array.from(processedDates);

  // 4. Ensure Idempotency: Delete previous records for the dates we are importing
  console.log(`Borrando registros existentes para ${dateList.length} fechas para asegurar idempotencia...`);
  await tx('daily_traffic').where('station_id', stationId).whereIn('date', dateList).delete();
  await tx('daily_revenue').where('station_id', stationId).whereIn('date', dateList).delete();
  await tx('daily_adjustments').where('station_id', stationId).whereIn('date', dateList).delete();
  await tx('daily_payments_summary').where('station_id', stationId).whereIn('date', dateList).delete();
  await tx('ticket_details').where('station_id', stationId).whereIn('date', dateList).delete();
  await tx('support_staff').where('station_id', stationId).whereIn('date', dateList).delete();
  await tx('hourly_traffic').where('station_id', stationId).whereIn('date', dateList).delete();

  // 5. Parse and save MATRIZ records
  console.log('Procesando hoja MATRIZ...');
  const categories = ['Cat I', 'Cat II', 'Cat III', 'Cat IV'];
  
  for (const item of datesToProcess) {
    const row = matrizData[item.rowIndex];
    const dateStr = item.dateStr;
    let weekdayIndex = 1;
    if (typeof row[0] === 'string' && typeof row[1] === 'number') {
      weekdayIndex = 0; // Old format
    }
    const weekday = (row[weekdayIndex] || '').toString();

    // Map traffic (Columns 2 to 46)
    // Map: NORMAL (Efectivo/Electronico/Colpass), ESPECIAL (Efectivo/Electronico/Colpass), EVASOR, ESPECIAL_EXENTO, EXENTO
    const trafficInserts: any[] = [];
    const revenueInserts: any[] = [];
    const adjustmentInserts: any[] = [];
    const paymentsInserts: any[] = [];

    const mapTraffic = (bucket: string, method: string, startCol: number) => {
      categories.forEach((cat, offset) => {
        const qty = parseInt(row[startCol + offset] || '0', 10);
        if (qty > 0) {
          trafficInserts.push({
            id: crypto.randomUUID(),
            station_id: stationId,
            date: dateStr,
            weekday,
            category: cat,
            bucket,
            payment_method: method,
            quantity: qty
          });
        }
      });
    };

      // NORMAL (EFECTIVO): Cols 2-5 (C-F), Total is G(6)
      mapTraffic('NORMAL', 'EFECTIVO', 2);
      // NORMAL (PAGO ELECTRONICO): Cols 7-10 (H-K), Total is L(11)
      mapTraffic('NORMAL', 'ELECTRONICO', 7);
      // NORMAL (IPREV COLPASS): Cols 12-15 (M-P), Total is Q(16)
      mapTraffic('NORMAL', 'IPREV_COLPASS', 12);
      
      // ESPECIAL (EFECTIVO): Cols 17-20 (R-U), Total is V(21)
      mapTraffic('ESPECIAL', 'EFECTIVO', 17);
      // ESPECIAL (PAGO ELECTRONICO): Cols 22-25 (W-Z), Total is AA(26)
      mapTraffic('ESPECIAL', 'ELECTRONICO', 22);
      // ESPECIAL (IPREV COLPASS): Cols 27-30 (AB-AE), Total is AF(31)
      mapTraffic('ESPECIAL', 'IPREV_COLPASS', 27);
      
      // EVASOR: Cat I starts at AG (32). Total is AK (36)
      mapTraffic('EVASOR', 'IPREV_COLPASS', 32);
      // ESPECIAL EXENTO: Cat I starts at AL (37). Total is AP (41)
      mapTraffic('ESPECIAL_EXENTO', 'IPREV_COLPASS', 37);
      // EXENTO: Cat I starts at AQ (42). Total is AU (46)
      mapTraffic('EXENTO', 'IPREV_COLPASS', 42);

    if (trafficInserts.length > 0) {
      await tx('daily_traffic').insert(trafficInserts);
      importedRows += trafficInserts.length;
    }

    // Map Revenue (Columns AW to AZ -> 48 to 51)
    categories.forEach((cat, idx) => {
      const colIdx = 48 + idx;
      const amount = Math.round(parseFloat(row[colIdx] || '0'));
      if (amount > 0) {
        revenueInserts.push({
          id: crypto.randomUUID(),
          station_id: stationId,
          date: dateStr,
          category: cat,
          amount
        });
      }
    });

    if (revenueInserts.length > 0) {
      await tx('daily_revenue').insert(revenueInserts);
      importedRows += revenueInserts.length;
    }

    // Map Adjustments (Columns BB, BC, BD -> 53, 54, 55)
    const sobrante = Math.round(parseFloat(row[53] || '0'));
    const sobEquipo = Math.round(parseFloat(row[54] || '0'));
    const ajusteDatafono = Math.round(parseFloat(row[55] || '0'));

    if (sobrante !== 0) {
      adjustmentInserts.push({
        id: crypto.randomUUID(),
        station_id: stationId,
        date: dateStr,
        adjustment_type: 'SOBRANTE',
        amount: sobrante
      });
    }
    if (sobEquipo !== 0) {
      adjustmentInserts.push({
        id: crypto.randomUUID(),
        station_id: stationId,
        date: dateStr,
        adjustment_type: 'SOBRANTE_EQUIPO',
        amount: sobEquipo
      });
    }
    if (ajusteDatafono !== 0) {
      adjustmentInserts.push({
        id: crypto.randomUUID(),
        station_id: stationId,
        date: dateStr,
        adjustment_type: 'AJUSTE_DATAFONO',
        amount: ajusteDatafono
      });
    }

    if (adjustmentInserts.length > 0) {
      await tx('daily_adjustments').insert(adjustmentInserts);
      importedRows += adjustmentInserts.length;
    }

    // Map Payment Summary (Columns BF, BG, BH -> 57, 58, 59)
    const summaryInserts: any[] = [];
    const efec = Math.round(parseFloat(row[57] || '0'));
    const elec = Math.round(parseFloat(row[58] || '0'));
    const iprev = Math.round(parseFloat(row[59] || '0'));

    if (efec > 0) {
      paymentsInserts.push({ id: crypto.randomUUID(), station_id: stationId, date: dateStr, payment_method: 'EFECTIVO', amount: efec });
    }
    if (elec > 0) {
      paymentsInserts.push({ id: crypto.randomUUID(), station_id: stationId, date: dateStr, payment_method: 'ELECTRONICO', amount: elec });
    }
    if (iprev > 0) {
      paymentsInserts.push({ id: crypto.randomUUID(), station_id: stationId, date: dateStr, payment_method: 'IPREV_COLPASS', amount: iprev });
    }

    if (paymentsInserts.length > 0) {
      await tx('daily_payments_summary').insert(paymentsInserts);
      importedRows += paymentsInserts.length;
    }
  }

  // 6. Parse and save PERSONAL records (if sheet exists)
  const personalSheetName = workbook.SheetNames.find(s => s.toUpperCase().includes('PERSONAL'));
  if (personalSheetName) {
    console.log('Procesando hoja PERSONAL...');
    const personalSheet = workbook.Sheets[personalSheetName];
    const personalData = XLSX.utils.sheet_to_json<any[]>(personalSheet, { defval: null, header: 1 });
    
    let currentActiveDateStr = '';
    for (let i = 2; i < personalData.length; i++) {
      const row = personalData[i];
      if (!row) continue;

      // Col 0 is date serial (merged, so fill-down)
      const dateSerial = row[0];
      if (dateSerial) {
        try {
          currentActiveDateStr = parseFlexibleDate(dateSerial);
        } catch {
          currentActiveDateStr = '';
        }
      }

      if (!currentActiveDateStr || !processedDates.has(currentActiveDateStr)) {
        continue;
      }

      // Up to 11 groups of support staff side-by-side
      const staffInserts: any[] = [];
      for (let k = 0; k < 11; k++) {
        const colBase = 3 + 5 * k;
        if (colBase >= row.length) break;

        const cargo = row[colBase];
        const nombre = row[colBase + 1];
        const startVal = row[colBase + 2];
        const endVal = row[colBase + 3];
        const totalHrs = parseFloat(row[colBase + 4] || '0');

        if (cargo || nombre || startVal || endVal || totalHrs > 0) {
          staffInserts.push({
            id: crypto.randomUUID(),
            station_id: stationId,
            date: currentActiveDateStr,
            role: (cargo || 'Controlador de Tráfico').toString(),
            name: nombre ? nombre.toString() : null,
            start_time: startVal ? startVal.toString() : null,
            end_time: endVal ? endVal.toString() : null,
            total_hours: totalHrs
          });
        }
      }

      if (staffInserts.length > 0) {
        await tx('support_staff').insert(staffInserts);
        importedRows += staffInserts.length;
      }
    }
  }

  // 7. Parse and save Hourly Matrix records (if sheet exists)
  if (trafficSheetName) {
    console.log(`Procesando hoja ${trafficSheetName}...`);
    const traficoSheet = workbook.Sheets[trafficSheetName];
    const traficoData = XLSX.utils.sheet_to_json<any[]>(traficoSheet, { defval: null, header: 1 });

    let currentActiveDateStr = '';
    for (let i = 2; i < traficoData.length; i++) {
      const row = traficoData[i];
      if (!row) continue;

      // Col 0 is date serial (merged, so fill-down)
      const dateSerial = row[0];
      if (dateSerial !== null && dateSerial !== undefined && dateSerial !== '') {
        try {
          const parsedDate = parseFlexibleDate(dateSerial);
          if (parsedDate) {
            currentActiveDateStr = parsedDate;
          }
        } catch {
          // If parsing fails, do not wipe out currentActiveDateStr (robust fill-down)
        }
      }

      if (!currentActiveDateStr || !processedDates.has(currentActiveDateStr)) {
        continue;
      }

      const rawCat = row[1];
      if (!rawCat) continue;
      
      let catName = rawCat.toString().trim().toUpperCase();
      if (catName === 'I' || catName === '1') catName = 'Cat I';
      else if (catName === 'II' || catName === '2') catName = 'Cat II';
      else if (catName === 'III' || catName === '3') catName = 'Cat III';
      else if (catName === 'IV' || catName === '4') catName = 'Cat IV';
      else if (catName === 'V' || catName === '5') catName = 'Cat V';
      else if (catName === 'VI' || catName === '6') catName = 'Cat VI';
      else if (catName === 'VII' || catName === '7') catName = 'Cat VII';
      else if (catName.includes('CAT')) catName = catName.replace('CAT.', 'Cat ').replace('CAT', 'Cat ').trim();

      // Skip totals, averages, or blank rows. Accept other categories like EA, EG, Exento, etc.
      if (!catName || catName.includes('TOTAL') || catName.includes('PROMEDIO') || catName.includes('FECHA')) {
        continue;
      }

      // Read 24 hours of data
      const hourlyInserts: any[] = [];
      for (let hr = 0; hr < 24; hr++) {
        const val = row[2 + hr];
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
      if (hourlyInserts.length > 0) {
        await tx('hourly_traffic').insert(hourlyInserts);
        importedRows += hourlyInserts.length;
      }
    }
  }

  // 8. Parse and save DETALLE records (if sheet exists)
  const detalleSheetName = workbook.SheetNames.find(s => s.toUpperCase().includes('DETALLE'));
  if (detalleSheetName) {
    console.log(`Procesando hoja ${detalleSheetName}...`);
    const detalleSheet = workbook.Sheets[detalleSheetName];
    const detalleData = XLSX.utils.sheet_to_json<any[]>(detalleSheet, { defval: null, header: 1 });
    const detailInserts: any[] = [];
    for (let i = 3; i < detalleData.length; i++) {
      const row = detalleData[i];
      if (!row || row[0] === null || row[0] === undefined || row[0] === '') {
        continue;
      }

      const dateSerial = row[0];
      let dateStr = '';
      try {
        dateStr = parseFlexibleDate(dateSerial);
      } catch {
        continue;
      }

      if (!processedDates.has(dateStr)) continue;

      const caja = row[1] ? row[1].toString().trim() : 'Caja 1';
      const category = row[2] ? row[2].toString().trim() : '';
      const tariff = Math.round(parseFloat(row[3] || '0'));
      const ticketStart = row[4] ? row[4].toString().trim() : '';
      const ticketEnd = row[5] ? row[5].toString().trim() : '';
      const quantity = parseInt(row[6] || '0', 10);
      const amount = Math.round(parseFloat(row[7] || '0'));

      if (category && quantity > 0) {
        detailInserts.push({
          id: crypto.randomUUID(),
          station_id: stationId,
          date: dateStr,
          caja,
          ticket_category: category,
          tariff,
          start_ticket: ticketStart,
          end_ticket: ticketEnd,
          quantity,
          amount
        });
      }
    }

    if (detailInserts.length > 0) {
      // Insert in chunks of 500 to avoid database driver parameter limits
      const chunkSize = 500;
      for (let offset = 0; offset < detailInserts.length; offset += chunkSize) {
        const chunk = detailInserts.slice(offset, offset + chunkSize);
        await tx('ticket_details').insert(chunk);
        importedRows += chunk.length;
      }
    }
  }

  // 9. Save Import Log & Snapshot
  const snapshotData = {
    dates: dateList,
    filename,
    rowsCount: importedRows,
    timestamp: new Date().toISOString()
  };

  const importLogId = crypto.randomUUID();
  await tx('imports').insert({
    id: importLogId,
    filename,
    imported_by: userId,
    imported_at: new Date(),
    rows_imported: importedRows,
    status: errors.length === 0 ? 'SUCCESS' : 'FAILED',
    errors: errors.length > 0 ? errors.join('\n') : null,
    snapshot: JSON.stringify(snapshotData)
  });

  // 10. Audit Log
  await tx('audit_log').insert({
    id: crypto.randomUUID(),
    timestamp: new Date(),
    user_id: userId,
    action: 'IMPORT_EXCEL',
    entity_type: 'imports',
    entity_id: importLogId,
    details: JSON.stringify({ filename, datesCount: dateList.length, rows: importedRows })
  });

  return {
    importedRows,
    dates: dateList,
    errors
  };
}
