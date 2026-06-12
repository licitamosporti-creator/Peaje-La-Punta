"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.excelSerialToDate = excelSerialToDate;
exports.parseFlexibleDate = parseFlexibleDate;
exports.excelSerialToTime = excelSerialToTime;
exports.parseAndSaveExcel = parseAndSaveExcel;
var XLSX = require("xlsx");
var crypto_1 = require("crypto");
// Helper to convert Excel date serial to ISO date string (YYYY-MM-DD)
function excelSerialToDate(serial) {
    if (typeof serial !== 'number') {
        throw new Error('Excel serial date must be a number');
    }
    // Adjust for Excel leap year bug (1900 is treated as leap year)
    var date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
}
function parseFlexibleDate(dateVal) {
    if (!dateVal && dateVal !== 0)
        return '';
    if (typeof dateVal === 'number') {
        return excelSerialToDate(dateVal);
    }
    if (typeof dateVal === 'string') {
        var normalized = dateVal.toLowerCase().trim();
        if (!normalized)
            return '';
        normalized = normalized.replace(/[\.\/\s]/g, '-');
        normalized = normalized.replace(/-+/g, '-');
        var months = { 'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12' };
        for (var _i = 0, _a = Object.entries(months); _i < _a.length; _i++) {
            var _b = _a[_i], name_1 = _b[0], num = _b[1];
            normalized = normalized.replace("-".concat(name_1, "-"), "-".concat(num, "-"));
        }
        var parts = normalized.split('-');
        if (parts.length === 3) {
            if (parts[2].length === 4)
                return "".concat(parts[2], "-").concat(parts[1].padStart(2, '0'), "-").concat(parts[0].padStart(2, '0'));
            else if (parts[0].length === 4)
                return "".concat(parts[0], "-").concat(parts[1].padStart(2, '0'), "-").concat(parts[2].padStart(2, '0'));
            else
                return "20".concat(parts[2].slice(-2), "-").concat(parts[1].padStart(2, '0'), "-").concat(parts[0].padStart(2, '0'));
        }
        var parsed = new Date(dateVal);
        if (!isNaN(parsed.getTime()))
            return parsed.toISOString().split('T')[0];
    }
    throw new Error("Unparseable date: ".concat(dateVal));
}
// Helper to format Excel time fraction (e.g. 0.33333 -> "08:00")
function excelSerialToTime(val) {
    if (typeof val === 'number') {
        var totalMinutes = Math.round(val * 24 * 60);
        var hours = Math.floor(totalMinutes / 60);
        var minutes = totalMinutes % 60;
        return "".concat(hours.toString().padStart(2, '0'), ":").concat(minutes.toString().padStart(2, '0'));
    }
    if (typeof val === 'string') {
        return val.trim();
    }
    return '';
}
function parseAndSaveExcel(filePathOrBuffer, stationId, userId, filename, tx) {
    return __awaiter(this, void 0, void 0, function () {
        var errors, importedRows, processedDates, workbook, requiredSheets, _i, requiredSheets_1, sheet, trafficSheetName, possibleTrafficNames, _a, possibleTrafficNames_1, name_2, matrizSheet, matrizData, datesToProcess, i, row, dateSerial, weekdayIndex, dateStr, dateList, categories, _loop_1, _b, datesToProcess_1, item, personalSheetName, personalSheet, personalData, currentActiveDateStr, i, row, dateSerial, staffInserts, k, colBase, cargo, nombre, startVal, endVal, totalHrs, traficoSheet, traficoData, currentActiveDateStr, i, row, dateSerial, parsedDate, rawCat, catName, hourlyInserts, hr, val, qty, detalleSheetName, detalleSheet, detalleData, detailInserts, i, row, dateSerial, dateStr, caja, category, tariff, ticketStart, ticketEnd, quantity, amount, chunkSize, offset, chunk, snapshotData, importLogId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    errors = [];
                    importedRows = 0;
                    processedDates = new Set();
                    workbook = typeof filePathOrBuffer === 'string'
                        ? XLSX.readFile(filePathOrBuffer)
                        : XLSX.read(filePathOrBuffer, { type: 'buffer' });
                    requiredSheets = ['MATRIZ'];
                    for (_i = 0, requiredSheets_1 = requiredSheets; _i < requiredSheets_1.length; _i++) {
                        sheet = requiredSheets_1[_i];
                        if (!workbook.SheetNames.includes(sheet)) {
                            throw new Error("Falta la hoja requerida: \"".concat(sheet, "\" en el archivo Excel."));
                        }
                    }
                    trafficSheetName = '';
                    possibleTrafficNames = ['TRAFICO HORA', 'TRAFICO MES', 'TRAFICO MES2', 'MATRIZ DE TRÁFICO MENSUAL - RESUMEN DIARIO', 'TRAFICO'];
                    for (_a = 0, possibleTrafficNames_1 = possibleTrafficNames; _a < possibleTrafficNames_1.length; _a++) {
                        name_2 = possibleTrafficNames_1[_a];
                        if (workbook.SheetNames.includes(name_2)) {
                            trafficSheetName = name_2;
                            break;
                        }
                    }
                    if (!trafficSheetName) {
                        console.log("No se encontr\u00F3 la hoja de tr\u00E1fico horario. Se omitir\u00E1 el procesamiento horario.");
                    }
                    matrizSheet = workbook.Sheets['MATRIZ'];
                    matrizData = XLSX.utils.sheet_to_json(matrizSheet, { defval: null, header: 1 });
                    datesToProcess = [];
                    // Row 4 is index 3 (first data row)
                    for (i = 3; i < matrizData.length; i++) {
                        row = matrizData[i];
                        dateSerial = row[0];
                        weekdayIndex = 1;
                        // Soporte para ambos formatos (A=Fecha, B=Día o A=Día, B=Fecha)
                        if (typeof dateSerial === 'string' && typeof row[1] === 'number') {
                            dateSerial = row[1];
                            weekdayIndex = 0;
                        }
                        if (!row || dateSerial === null || dateSerial === undefined || dateSerial === '') {
                            continue;
                        }
                        try {
                            dateStr = parseFlexibleDate(dateSerial);
                            datesToProcess.push({ serial: dateSerial, dateStr: dateStr, rowIndex: i });
                            processedDates.add(dateStr);
                        }
                        catch (err) {
                            errors.push("Error al convertir fecha ".concat(dateSerial, " en la fila ").concat(i + 1, " de MATRIZ: ").concat(err.message));
                        }
                    }
                    if (datesToProcess.length === 0) {
                        throw new Error('No se encontraron registros de fechas válidas en la hoja MATRIZ.');
                    }
                    dateList = Array.from(processedDates);
                    // 4. Ensure Idempotency: Delete previous records for the dates we are importing
                    console.log("Borrando registros existentes para ".concat(dateList.length, " fechas para asegurar idempotencia..."));
                    return [4 /*yield*/, tx('daily_traffic').where('station_id', stationId).whereIn('date', dateList).delete()];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, tx('daily_revenue').where('station_id', stationId).whereIn('date', dateList).delete()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, tx('daily_adjustments').where('station_id', stationId).whereIn('date', dateList).delete()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, tx('daily_payments_summary').where('station_id', stationId).whereIn('date', dateList).delete()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, tx('ticket_details').where('station_id', stationId).whereIn('date', dateList).delete()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, tx('support_staff').where('station_id', stationId).whereIn('date', dateList).delete()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, tx('hourly_traffic').where('station_id', stationId).whereIn('date', dateList).delete()];
                case 7:
                    _c.sent();
                    // 5. Parse and save MATRIZ records
                    console.log('Procesando hoja MATRIZ...');
                    categories = ['Cat I', 'Cat II', 'Cat III', 'Cat IV'];
                    _loop_1 = function (item) {
                        var row, dateStr, weekdayIndex, weekday, trafficInserts, revenueInserts, adjustmentInserts, paymentsInserts, mapTraffic, sobrante, sobEquipo, ajusteDatafono, summaryInserts, efec, elec, iprev;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0:
                                    row = matrizData[item.rowIndex];
                                    dateStr = item.dateStr;
                                    weekdayIndex = 1;
                                    if (typeof row[0] === 'string' && typeof row[1] === 'number') {
                                        weekdayIndex = 0; // Old format
                                    }
                                    weekday = (row[weekdayIndex] || '').toString();
                                    trafficInserts = [];
                                    revenueInserts = [];
                                    adjustmentInserts = [];
                                    paymentsInserts = [];
                                    mapTraffic = function (bucket, method, startCol) {
                                        categories.forEach(function (cat, offset) {
                                            var qty = parseInt(row[startCol + offset] || '0', 10);
                                            if (qty > 0) {
                                                trafficInserts.push({
                                                    id: crypto_1.default.randomUUID(),
                                                    station_id: stationId,
                                                    date: dateStr,
                                                    weekday: weekday,
                                                    category: cat,
                                                    bucket: bucket,
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
                                    if (!(trafficInserts.length > 0)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, tx('daily_traffic').insert(trafficInserts)];
                                case 1:
                                    _g.sent();
                                    importedRows += trafficInserts.length;
                                    _g.label = 2;
                                case 2:
                                    // Map Revenue (Columns AW to AZ -> 48 to 51)
                                    categories.forEach(function (cat, idx) {
                                        var colIdx = 48 + idx;
                                        var amount = Math.round(parseFloat(row[colIdx] || '0'));
                                        if (amount > 0) {
                                            revenueInserts.push({
                                                id: crypto_1.default.randomUUID(),
                                                station_id: stationId,
                                                date: dateStr,
                                                category: cat,
                                                amount: amount
                                            });
                                        }
                                    });
                                    if (!(revenueInserts.length > 0)) return [3 /*break*/, 4];
                                    return [4 /*yield*/, tx('daily_revenue').insert(revenueInserts)];
                                case 3:
                                    _g.sent();
                                    importedRows += revenueInserts.length;
                                    _g.label = 4;
                                case 4:
                                    sobrante = Math.round(parseFloat(row[53] || '0'));
                                    sobEquipo = Math.round(parseFloat(row[54] || '0'));
                                    ajusteDatafono = Math.round(parseFloat(row[55] || '0'));
                                    if (sobrante !== 0) {
                                        adjustmentInserts.push({
                                            id: crypto_1.default.randomUUID(),
                                            station_id: stationId,
                                            date: dateStr,
                                            adjustment_type: 'SOBRANTE',
                                            amount: sobrante
                                        });
                                    }
                                    if (sobEquipo !== 0) {
                                        adjustmentInserts.push({
                                            id: crypto_1.default.randomUUID(),
                                            station_id: stationId,
                                            date: dateStr,
                                            adjustment_type: 'SOBRANTE_EQUIPO',
                                            amount: sobEquipo
                                        });
                                    }
                                    if (ajusteDatafono !== 0) {
                                        adjustmentInserts.push({
                                            id: crypto_1.default.randomUUID(),
                                            station_id: stationId,
                                            date: dateStr,
                                            adjustment_type: 'AJUSTE_DATAFONO',
                                            amount: ajusteDatafono
                                        });
                                    }
                                    if (!(adjustmentInserts.length > 0)) return [3 /*break*/, 6];
                                    return [4 /*yield*/, tx('daily_adjustments').insert(adjustmentInserts)];
                                case 5:
                                    _g.sent();
                                    importedRows += adjustmentInserts.length;
                                    _g.label = 6;
                                case 6:
                                    summaryInserts = [];
                                    efec = Math.round(parseFloat(row[57] || '0'));
                                    elec = Math.round(parseFloat(row[58] || '0'));
                                    iprev = Math.round(parseFloat(row[59] || '0'));
                                    if (efec > 0) {
                                        paymentsInserts.push({ id: crypto_1.default.randomUUID(), station_id: stationId, date: dateStr, payment_method: 'EFECTIVO', amount: efec });
                                    }
                                    if (elec > 0) {
                                        paymentsInserts.push({ id: crypto_1.default.randomUUID(), station_id: stationId, date: dateStr, payment_method: 'ELECTRONICO', amount: elec });
                                    }
                                    if (iprev > 0) {
                                        paymentsInserts.push({ id: crypto_1.default.randomUUID(), station_id: stationId, date: dateStr, payment_method: 'IPREV_COLPASS', amount: iprev });
                                    }
                                    if (!(paymentsInserts.length > 0)) return [3 /*break*/, 8];
                                    return [4 /*yield*/, tx('daily_payments_summary').insert(paymentsInserts)];
                                case 7:
                                    _g.sent();
                                    importedRows += paymentsInserts.length;
                                    _g.label = 8;
                                case 8: return [2 /*return*/];
                            }
                        });
                    };
                    _b = 0, datesToProcess_1 = datesToProcess;
                    _c.label = 8;
                case 8:
                    if (!(_b < datesToProcess_1.length)) return [3 /*break*/, 11];
                    item = datesToProcess_1[_b];
                    return [5 /*yield**/, _loop_1(item)];
                case 9:
                    _c.sent();
                    _c.label = 10;
                case 10:
                    _b++;
                    return [3 /*break*/, 8];
                case 11:
                    personalSheetName = workbook.SheetNames.find(function (s) { return s.toUpperCase().includes('PERSONAL'); });
                    if (!personalSheetName) return [3 /*break*/, 15];
                    console.log('Procesando hoja PERSONAL...');
                    personalSheet = workbook.Sheets[personalSheetName];
                    personalData = XLSX.utils.sheet_to_json(personalSheet, { defval: null, header: 1 });
                    currentActiveDateStr = '';
                    i = 2;
                    _c.label = 12;
                case 12:
                    if (!(i < personalData.length)) return [3 /*break*/, 15];
                    row = personalData[i];
                    if (!row)
                        return [3 /*break*/, 14];
                    dateSerial = row[0];
                    if (dateSerial) {
                        try {
                            currentActiveDateStr = parseFlexibleDate(dateSerial);
                        }
                        catch (_d) {
                            currentActiveDateStr = '';
                        }
                    }
                    if (!currentActiveDateStr || !processedDates.has(currentActiveDateStr)) {
                        return [3 /*break*/, 14];
                    }
                    staffInserts = [];
                    for (k = 0; k < 11; k++) {
                        colBase = 3 + 5 * k;
                        if (colBase >= row.length)
                            break;
                        cargo = row[colBase];
                        nombre = row[colBase + 1];
                        startVal = row[colBase + 2];
                        endVal = row[colBase + 3];
                        totalHrs = parseFloat(row[colBase + 4] || '0');
                        if (cargo || nombre || startVal || endVal || totalHrs > 0) {
                            staffInserts.push({
                                id: crypto_1.default.randomUUID(),
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
                    if (!(staffInserts.length > 0)) return [3 /*break*/, 14];
                    return [4 /*yield*/, tx('support_staff').insert(staffInserts)];
                case 13:
                    _c.sent();
                    importedRows += staffInserts.length;
                    _c.label = 14;
                case 14:
                    i++;
                    return [3 /*break*/, 12];
                case 15:
                    if (!trafficSheetName) return [3 /*break*/, 19];
                    console.log("Procesando hoja ".concat(trafficSheetName, "..."));
                    traficoSheet = workbook.Sheets[trafficSheetName];
                    traficoData = XLSX.utils.sheet_to_json(traficoSheet, { defval: null, header: 1 });
                    currentActiveDateStr = '';
                    i = 2;
                    _c.label = 16;
                case 16:
                    if (!(i < traficoData.length)) return [3 /*break*/, 19];
                    row = traficoData[i];
                    if (!row)
                        return [3 /*break*/, 18];
                    dateSerial = row[0];
                    if (dateSerial !== null && dateSerial !== undefined && dateSerial !== '') {
                        try {
                            parsedDate = parseFlexibleDate(dateSerial);
                            if (parsedDate) {
                                currentActiveDateStr = parsedDate;
                            }
                        }
                        catch (_e) {
                            // If parsing fails, do not wipe out currentActiveDateStr (robust fill-down)
                        }
                    }
                    if (!currentActiveDateStr || !processedDates.has(currentActiveDateStr)) {
                        return [3 /*break*/, 18];
                    }
                    rawCat = row[1];
                    if (!rawCat)
                        return [3 /*break*/, 18];
                    catName = rawCat.toString().trim().toUpperCase();
                    if (catName === 'I' || catName === '1')
                        catName = 'Cat I';
                    else if (catName === 'II' || catName === '2')
                        catName = 'Cat II';
                    else if (catName === 'III' || catName === '3')
                        catName = 'Cat III';
                    else if (catName === 'IV' || catName === '4')
                        catName = 'Cat IV';
                    else if (catName === 'V' || catName === '5')
                        catName = 'Cat V';
                    else if (catName === 'VI' || catName === '6')
                        catName = 'Cat VI';
                    else if (catName === 'VII' || catName === '7')
                        catName = 'Cat VII';
                    else if (catName.includes('CAT'))
                        catName = catName.replace('CAT.', 'Cat ').replace('CAT', 'Cat ').trim();
                    // Skip totals, averages, or blank rows. Accept other categories like EA, EG, Exento, etc.
                    if (!catName || catName.includes('TOTAL') || catName.includes('PROMEDIO') || catName.includes('FECHA')) {
                        return [3 /*break*/, 18];
                    }
                    hourlyInserts = [];
                    for (hr = 0; hr < 24; hr++) {
                        val = row[2 + hr];
                        qty = parseInt(val || '0', 10);
                        if (!isNaN(qty) && qty > 0) {
                            hourlyInserts.push({
                                id: crypto_1.default.randomUUID(),
                                station_id: stationId,
                                date: currentActiveDateStr,
                                category: catName,
                                hour: hr,
                                quantity: qty
                            });
                        }
                    }
                    if (!(hourlyInserts.length > 0)) return [3 /*break*/, 18];
                    return [4 /*yield*/, tx('hourly_traffic').insert(hourlyInserts)];
                case 17:
                    _c.sent();
                    importedRows += hourlyInserts.length;
                    _c.label = 18;
                case 18:
                    i++;
                    return [3 /*break*/, 16];
                case 19:
                    detalleSheetName = workbook.SheetNames.find(function (s) { return s.toUpperCase().includes('DETALLE'); });
                    if (!detalleSheetName) return [3 /*break*/, 23];
                    console.log("Procesando hoja ".concat(detalleSheetName, "..."));
                    detalleSheet = workbook.Sheets[detalleSheetName];
                    detalleData = XLSX.utils.sheet_to_json(detalleSheet, { defval: null, header: 1 });
                    detailInserts = [];
                    for (i = 3; i < detalleData.length; i++) {
                        row = detalleData[i];
                        if (!row || row[0] === null || row[0] === undefined || row[0] === '') {
                            continue;
                        }
                        dateSerial = row[0];
                        dateStr = '';
                        try {
                            dateStr = parseFlexibleDate(dateSerial);
                        }
                        catch (_f) {
                            continue;
                        }
                        if (!processedDates.has(dateStr))
                            continue;
                        caja = row[1] ? row[1].toString().trim() : 'Caja 1';
                        category = row[2] ? row[2].toString().trim() : '';
                        tariff = Math.round(parseFloat(row[3] || '0'));
                        ticketStart = row[4] ? row[4].toString().trim() : '';
                        ticketEnd = row[5] ? row[5].toString().trim() : '';
                        quantity = parseInt(row[6] || '0', 10);
                        amount = Math.round(parseFloat(row[7] || '0'));
                        if (category && quantity > 0) {
                            detailInserts.push({
                                id: crypto_1.default.randomUUID(),
                                station_id: stationId,
                                date: dateStr,
                                caja: caja,
                                ticket_category: category,
                                tariff: tariff,
                                start_ticket: ticketStart,
                                end_ticket: ticketEnd,
                                quantity: quantity,
                                amount: amount
                            });
                        }
                    }
                    if (!(detailInserts.length > 0)) return [3 /*break*/, 23];
                    chunkSize = 500;
                    offset = 0;
                    _c.label = 20;
                case 20:
                    if (!(offset < detailInserts.length)) return [3 /*break*/, 23];
                    chunk = detailInserts.slice(offset, offset + chunkSize);
                    return [4 /*yield*/, tx('ticket_details').insert(chunk)];
                case 21:
                    _c.sent();
                    importedRows += chunk.length;
                    _c.label = 22;
                case 22:
                    offset += chunkSize;
                    return [3 /*break*/, 20];
                case 23:
                    snapshotData = {
                        dates: dateList,
                        filename: filename,
                        rowsCount: importedRows,
                        timestamp: new Date().toISOString()
                    };
                    importLogId = crypto_1.default.randomUUID();
                    return [4 /*yield*/, tx('imports').insert({
                            id: importLogId,
                            filename: filename,
                            imported_by: userId,
                            imported_at: new Date(),
                            rows_imported: importedRows,
                            status: errors.length === 0 ? 'SUCCESS' : 'FAILED',
                            errors: errors.length > 0 ? errors.join('\n') : null,
                            snapshot: JSON.stringify(snapshotData)
                        })];
                case 24:
                    _c.sent();
                    // 10. Audit Log
                    return [4 /*yield*/, tx('audit_log').insert({
                            id: crypto_1.default.randomUUID(),
                            timestamp: new Date(),
                            user_id: userId,
                            action: 'IMPORT_EXCEL',
                            entity_type: 'imports',
                            entity_id: importLogId,
                            details: JSON.stringify({ filename: filename, datesCount: dateList.length, rows: importedRows })
                        })];
                case 25:
                    // 10. Audit Log
                    _c.sent();
                    return [2 /*return*/, {
                            importedRows: importedRows,
                            dates: dateList,
                            errors: errors
                        }];
            }
        });
    });
}
