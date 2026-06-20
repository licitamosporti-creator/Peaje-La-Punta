import { Knex } from 'knex';

export interface Alert {
  type: 'ZERO_REVENUE' | 'TRAFFIC_DROP' | 'RECONCILIATION_MISMATCH' | 'PENDING_DATA';
  severity: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  title: string;
  description: string;
  date: string;
  details?: any;
}

export async function evaluateAlerts(db: Knex, stationId: string): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Get active date range (first active to last active)
  const activeDays = await db('daily_traffic')
    .where('station_id', stationId)
    .groupBy('date')
    .select('date')
    .sum('quantity as total_qty')
    .orderBy('date', 'asc');

  if (activeDays.length === 0) {
    return [];
  }

  const activeDates = activeDays.map(d => d.date);
  const processedDates = new Set(activeDates);
  const minDateStr = activeDates[0];
  const maxDateStr = activeDates[activeDates.length - 1];

  // 1. Calculate historical average traffic (across active days)
  let totalActiveTraffic = 0;
  activeDays.forEach(d => {
    totalActiveTraffic += parseInt(d.total_qty || '0', 10);
  });
  const avgTraffic = activeDays.length > 0 ? totalActiveTraffic / activeDays.length : 0;

  // Let's query MATRIZ records directly by date
  // Since we inserted normalized tables, we can retrieve summaries per date:
  const dailySummary = await db('daily_traffic')
    .where('station_id', stationId)
    .select('date', 'weekday')
    .sum('quantity as total_traffic')
    .groupBy('date', 'weekday');

  const dailyRevenue = await db('daily_revenue')
    .where('station_id', stationId)
    .select('date')
    .sum('amount as total_revenue')
    .groupBy('date');

  const dailyAdjustments = await db('daily_adjustments')
    .where('station_id', stationId)
    .select('date', 'adjustment_type', 'amount');

  const dailyPayments = await db('daily_payments_summary')
    .where('station_id', stationId)
    .select('date', 'payment_method', 'amount');

  // Key arrays by date for fast lookup
  const trafficMap = new Map(dailySummary.map(t => [t.date, parseInt(t.total_traffic || '0', 10)]));
  const revenueMap = new Map(dailyRevenue.map(r => [r.date, parseInt(r.total_revenue || '0', 10)]));
  
  // Adjustments mapped by date
  const adjustmentsMap = new Map<string, { [key: string]: number }>();
  dailyAdjustments.forEach(adj => {
    const d = adj.date;
    if (!adjustmentsMap.has(d)) {
      adjustmentsMap.set(d, { SOBRANTE: 0, SOBRANTE_EQUIPO: 0, AJUSTE_DATAFONO: 0 });
    }
    const current = adjustmentsMap.get(d)!;
    current[adj.adjustment_type] = parseInt(adj.amount || '0', 10);
  });

  // Payments summary mapped by date
  const paymentsMap = new Map<string, { [key: string]: number }>();
  dailyPayments.forEach(pm => {
    const d = pm.date;
    if (!paymentsMap.has(d)) {
      paymentsMap.set(d, { EFECTIVO: 0, ELECTRONICO: 0, IPREV_COLPASS: 0 });
    }
    const current = paymentsMap.get(d)!;
    current[pm.payment_method] = parseInt(pm.amount || '0', 10);
  });

  // Loop through all dates that have active traffic logs
  for (const date of activeDates) {
    const traffic = trafficMap.get(date) || 0;
    const revenue = revenueMap.get(date) || 0;

    // RULE 1: Recaudo diario = 0 con tráfico > 0
    if (traffic > 0 && revenue === 0) {
      alerts.push({
        type: 'ZERO_REVENUE',
        severity: 'CRITICA',
        title: 'Recaudo Cero con Tráfico Activo',
        description: `El día ${date} se registraron ${traffic} vehículos pero el recaudo reportado es de $0.`,
        date,
        details: { traffic, revenue }
      });
    }

    // RULE 2: Caída de tráfico > X% (e.g. 30%) vs promedio del periodo
    const dropPercentage = avgTraffic > 0 ? ((avgTraffic - traffic) / avgTraffic) * 100 : 0;
    const thresholdPercentage = parseFloat(process.env.ALERT_TRAFFIC_DROP_PCT || '30');
    if (dropPercentage > thresholdPercentage) {
      alerts.push({
        type: 'TRAFFIC_DROP',
        severity: 'ALTA',
        title: 'Caída Significativa de Tráfico',
        description: `El día ${date} se registró un tráfico de ${traffic} vehículos, lo que representa una caída del ${dropPercentage.toFixed(1)}% frente al promedio diario de ${Math.round(avgTraffic)} vehículos.`,
        date,
        details: { traffic, average: Math.round(avgTraffic), pct: dropPercentage }
      });
    }

    // RULE 3: Diferencia entre "Total medios de pago" y "Total Recaudo + Sobrantes"
    const adjs = adjustmentsMap.get(date) || { SOBRANTE: 0, SOBRANTE_EQUIPO: 0, AJUSTE_DATAFONO: 0 };
    const paySum = paymentsMap.get(date) || { EFECTIVO: 0, ELECTRONICO: 0, IPREV_COLPASS: 0 };

    const totalRevenuePlusSobrantes = revenue + adjs.SOBRANTE + adjs.SOBRANTE_EQUIPO + adjs.AJUSTE_DATAFONO;
    const totalPayments = paySum.EFECTIVO + paySum.ELECTRONICO + paySum.IPREV_COLPASS;

    const diff = Math.abs(totalPayments - totalRevenuePlusSobrantes);
    const thresholdDiff = parseFloat(process.env.ALERT_RECON_THRESHOLD || '0');
    if (diff > thresholdDiff) {
      alerts.push({
        type: 'RECONCILIATION_MISMATCH',
        severity: 'CRITICA',
        title: 'Inconsistencia en Conciliación Financiera',
        description: `El día ${date} los Medios de Pago ($${totalPayments.toLocaleString()}) no coinciden con el Recaudo + Ajustes ($${totalRevenuePlusSobrantes.toLocaleString()}). Diferencia de: $${diff.toLocaleString()}.`,
        date,
        details: { totalPayments, totalRevenuePlusSobrantes, difference: diff }
      });
    }
  }

  // RULE 4: Días sin datos (pendientes) en periodo activo
  // Generate all dates between minDateStr and maxDateStr
  const start = new Date(minDateStr);
  const end = new Date(maxDateStr);
  const dateCursor = new Date(start);

  while (dateCursor <= end) {
    const cursorStr = dateCursor.toISOString().split('T')[0];
    if (!processedDates.has(cursorStr)) {
      alerts.push({
        type: 'PENDING_DATA',
        severity: 'MEDIA',
        title: 'Día Pendiente de Carga de Datos',
        description: `El día ${cursorStr} se encuentra dentro del rango de operación activa pero no tiene datos registrados de tráfico o recaudo.`,
        date: cursorStr
      });
    }
    dateCursor.setDate(dateCursor.getDate() + 1);
  }

  return alerts;
}
