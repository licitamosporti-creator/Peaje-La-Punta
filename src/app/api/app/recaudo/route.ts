import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    const db = await getDb();

    // 2. Get first station
    const station = await db('stations').first();
    if (!station) {
      return NextResponse.json(
        { success: true, data: { matrix: [], ticketDetails: [], adjustments: [] } },
        { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } }
      );
    }

    const stationId = station.id;

    // Get optional date filters
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 3. Build detailed MATRIZ grid records
    // We will query all base elements and merge them by date
    let trafficQuery = db('daily_traffic')
      .where('station_id', stationId)
      .select('date', 'weekday', 'category', 'bucket', 'payment_method', 'quantity');

    let revenueQuery = db('daily_revenue')
      .where('station_id', stationId)
      .select('date', 'category', 'amount');

    let adjustmentsQuery = db('daily_adjustments')
      .where('station_id', stationId)
      .select('date', 'adjustment_type', 'amount');

    let paymentsQuery = db('daily_payments_summary')
      .where('station_id', stationId)
      .select('date', 'payment_method', 'amount');

    let ticketQuery = db('ticket_details')
      .where('station_id', stationId);

    // Apply date range filters if provided
    if (startDate) {
      trafficQuery = trafficQuery.where('date', '>=', startDate);
      revenueQuery = revenueQuery.where('date', '>=', startDate);
      adjustmentsQuery = adjustmentsQuery.where('date', '>=', startDate);
      paymentsQuery = paymentsQuery.where('date', '>=', startDate);
      ticketQuery = ticketQuery.where('date', '>=', startDate);
    }
    if (endDate) {
      trafficQuery = trafficQuery.where('date', '<=', endDate);
      revenueQuery = revenueQuery.where('date', '<=', endDate);
      adjustmentsQuery = adjustmentsQuery.where('date', '<=', endDate);
      paymentsQuery = paymentsQuery.where('date', '<=', endDate);
      ticketQuery = ticketQuery.where('date', '<=', endDate);
    }

    const [trafficData, revenueData, adjustmentsData, paymentsData, ticketDetails] = await Promise.all([
      trafficQuery,
      revenueQuery,
      adjustmentsQuery,
      paymentsQuery,
      ticketQuery.orderBy('date', 'asc').orderBy('caja', 'asc')
    ]);

    // Pivot and consolidate daily matrix data
    const dailyMap = new Map<string, any>();

    // Init dates
    trafficData.forEach(t => {
      const d = typeof t.date === 'string' ? t.date : t.date.toISOString().split('T')[0];
      if (!dailyMap.has(d)) {
        dailyMap.set(d, {
          date: d,
          weekday: t.weekday,
          trafficNormalCash: { I: 0, II: 0, III: 0, IV: 0, total: 0 },
          trafficNormalElec: { I: 0, II: 0, III: 0, IV: 0, total: 0 },
          trafficNormalColpass: { I: 0, II: 0, III: 0, IV: 0, total: 0 },
          trafficEspecialCash: { I: 0, II: 0, III: 0, IV: 0, total: 0 },
          trafficEspecialElec: { I: 0, II: 0, III: 0, IV: 0, total: 0 },
          trafficEspecialColpass: { I: 0, II: 0, III: 0, IV: 0, total: 0 },
          trafficEvasor: { I: 0, II: 0, III: 0, IV: 0, total: 0 },
          trafficEspecialExento: { I: 0, II: 0, III: 0, IV: 0, total: 0 },
          trafficExento: { I: 0, II: 0, III: 0, IV: 0, total: 0 },
          totalTraffic: 0,
          revenueCat: { I: 0, II: 0, III: 0, IV: 0 },
          totalRevenue: 0,
          adjustments: { SOBRANTE: 0, SOBRANTE_EQUIPO: 0, AJUSTE_DATAFONO: 0, total: 0 },
          totalRevenueWithAdjustments: 0,
          payments: { EFECTIVO: 0, ELECTRONICO: 0, IPREV_COLPASS: 0, total: 0 }
        });
      }

      const day = dailyMap.get(d)!;
      const cat = t.category.replace('Cat ', '').trim(); // "I", "II", etc.
      const qty = parseInt(t.quantity || '0', 10);

      // Distribute quantities to pivoted fields
      if (t.bucket === 'NORMAL') {
        if (t.payment_method === 'EFECTIVO') day.trafficNormalCash[cat] = qty;
        else if (t.payment_method === 'ELECTRONICO') day.trafficNormalElec[cat] = qty;
        else if (t.payment_method === 'IPREV_COLPASS') day.trafficNormalColpass[cat] = qty;
      } else if (t.bucket === 'ESPECIAL') {
        if (t.payment_method === 'EFECTIVO') day.trafficEspecialCash[cat] = qty;
        else if (t.payment_method === 'ELECTRONICO') day.trafficEspecialElec[cat] = qty;
        else if (t.payment_method === 'IPREV_COLPASS') day.trafficEspecialColpass[cat] = qty;
      } else if (t.bucket === 'EVASOR') {
        day.trafficEvasor[cat] = qty;
      } else if (t.bucket === 'ESPECIAL_EXENTO') {
        day.trafficEspecialExento[cat] = qty;
      } else if (t.bucket === 'EXENTO') {
        day.trafficExento[cat] = qty;
      }
    });

    // Consolidate totals for traffic maps
    dailyMap.forEach(day => {
      const sumCat = (obj: any) => {
        obj.total = (obj.I || 0) + (obj.II || 0) + (obj.III || 0) + (obj.IV || 0);
        return obj.total;
      };
      day.totalTraffic =
        sumCat(day.trafficNormalCash) +
        sumCat(day.trafficNormalElec) +
        sumCat(day.trafficNormalColpass) +
        sumCat(day.trafficEspecialCash) +
        sumCat(day.trafficEspecialElec) +
        sumCat(day.trafficEspecialColpass) +
        sumCat(day.trafficEvasor) +
        sumCat(day.trafficEspecialExento) +
        sumCat(day.trafficExento);
    });

    // Merge revenue data
    revenueData.forEach(r => {
      const d = typeof r.date === 'string' ? r.date : r.date.toISOString().split('T')[0];
      const day = dailyMap.get(d);
      if (day) {
        const cat = r.category.replace('Cat ', '').trim();
        const amt = parseInt(r.amount || '0', 10);
        day.revenueCat[cat] = amt;
      }
    });

    // Merge adjustments data
    adjustmentsData.forEach(adj => {
      const d = typeof adj.date === 'string' ? adj.date : adj.date.toISOString().split('T')[0];
      const day = dailyMap.get(d);
      if (day) {
        const amt = parseInt(adj.amount || '0', 10);
        day.adjustments[adj.adjustment_type] = amt;
      }
    });

    // Consolidate revenue totals
    dailyMap.forEach(day => {
      day.totalRevenue = (day.revenueCat.I || 0) + (day.revenueCat.II || 0) + (day.revenueCat.III || 0) + (day.revenueCat.IV || 0);
      day.adjustments.total = (day.adjustments.SOBRANTE || 0) + (day.adjustments.SOBRANTE_EQUIPO || 0) + (day.adjustments.AJUSTE_DATAFONO || 0);
      day.totalRevenueWithAdjustments = day.totalRevenue + day.adjustments.total;
    });

    // Merge payments summary data
    paymentsData.forEach(p => {
      const d = typeof p.date === 'string' ? p.date : p.date.toISOString().split('T')[0];
      const day = dailyMap.get(d);
      if (day) {
        const amt = parseInt(p.amount || '0', 10);
        day.payments[p.payment_method] = amt;
      }
    });

    dailyMap.forEach(day => {
      day.payments.total = (day.payments.EFECTIVO || 0) + (day.payments.ELECTRONICO || 0) + (day.payments.IPREV_COLPASS || 0);
    });

    // Convert daily map to sorted list
    const matrixGridList = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Consolidate adjustments list specifically for adjustments tabs
    const dailyAdjustmentsList = adjustmentsData.map(a => ({
      date: typeof a.date === 'string' ? a.date : a.date.toISOString().split('T')[0],
      type: a.adjustment_type,
      amount: parseInt(a.amount || '0', 10)
    })).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      data: {
        matrix: matrixGridList,
        ticketDetails,
        adjustments: dailyAdjustmentsList
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=60'
      }
    });

  } catch (error: any) {
    console.error('Error fetching internal recaudo data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
