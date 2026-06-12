import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();

    // 1. Get first station (we support multi-station, default to the first one)
    const station = await db('stations').first();
    if (!station) {
      return NextResponse.json({
        success: true,
        data: {
          totalTraffic: 0,
          totalRevenue: 0,
          averageFare: 0,
          paymentSplit: { cash: 0, electronic: 0, iprev: 0 },
          novedades: []
        }
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
      });
    }

    const stationId = station.id;

    const startDateParam = req.nextUrl.searchParams.get('startDate');
    const endDateParam = req.nextUrl.searchParams.get('endDate');
    const period = req.nextUrl.searchParams.get('period');

    let startDateStr = startDateParam;
    let endDateStr = endDateParam;

    if (period === 'last7' || period === 'last30') {
      const days = period === 'last7' ? 6 : 29;
      // Use max date from daily_revenue since it's the primary financial table
      const maxDateRow = await db('daily_revenue').where('station_id', stationId).max('date as maxDate').first();
      const rawDate = maxDateRow ? (maxDateRow.maxDate || maxDateRow.maxdate) : null;
      if (rawDate) {
        endDateStr = typeof rawDate === 'string' ? rawDate : rawDate.toISOString().split('T')[0];
        const d = new Date(endDateStr + 'T12:00:00');
        d.setDate(d.getDate() - days);
        startDateStr = d.toISOString().split('T')[0];
      }
    }

    const applyDateFilter = (query: any) => {
      if (startDateStr) query.where('date', '>=', startDateStr);
      if (endDateStr) query.where('date', '<=', endDateStr);
      return query;
    };

    // 2. Aggregate Total Traffic (daily_traffic quantity sum)
    let trafficQuery = db('daily_traffic').where('station_id', stationId).sum('quantity as total');
    trafficQuery = applyDateFilter(trafficQuery);
    const trafficSum = await trafficQuery.first();
    const totalTraffic = parseInt(trafficSum?.total || '0', 10);

    // 2.2. Get Latest Date and calculate Month and Week statistics
    let maxDateQuery = db('daily_traffic').where('station_id', stationId).max('date as maxDate');
    maxDateQuery = applyDateFilter(maxDateQuery);
    const trafficMaxDateRow = await maxDateQuery.first();
    const maxDate = trafficMaxDateRow ? (trafficMaxDateRow.maxDate || trafficMaxDateRow.maxdate) : null;

    let monthTraffic = 0;
    let monthRevenue = 0;
    let periodMonthName = '';

    let weekTraffic = 0;
    let weekRevenue = 0;
    let periodWeekLabel = '';

    if (maxDate) {
      let maxDateObj: Date;
      let year = 0;
      let month = 0;

      if (maxDate instanceof Date) {
        maxDateObj = maxDate;
        year = maxDate.getFullYear();
        month = maxDate.getMonth() + 1;
      } else {
        const dateStr = String(maxDate).split('T')[0];
        const parts = dateStr.split('-');
        maxDateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (parts.length >= 2) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
        }
      }

      const formatDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      // --- Month aggregation (e.g. Abril 2026) ---
      if (year > 0 && month > 0) {
        const monthStr = month < 10 ? `0${month}` : `${month}`;
        const prefix = `${year}-${monthStr}`;
        const lastDay = new Date(year, month, 0).getDate();
        const monthStartDate = `${prefix}-01`;
        const monthEndDate = `${prefix}-${lastDay}`;

        const monthTrafficSum = await db('daily_traffic')
          .where('station_id', stationId)
          .whereBetween('date', [monthStartDate, monthEndDate])
          .sum('quantity as total')
          .first();
        monthTraffic = parseInt(monthTrafficSum?.total || '0', 10);

        const monthRevenueSum = await db('daily_revenue')
        .where('station_id', stationId)
        .whereBetween('date', [monthStartDate, monthEndDate])
        .sum('amount as total')
        .first();
      const monthAdjSum = await db('daily_adjustments')
        .where('station_id', stationId)
        .whereBetween('date', [monthStartDate, monthEndDate])
        .sum('amount as total')
        .first();
      monthRevenue = parseInt(monthRevenueSum?.total || '0', 10) + parseInt(monthAdjSum?.total || '0', 10);

        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        periodMonthName = `${monthNames[month - 1]} ${year}`;
      }

      // --- Week aggregation (Last 7 active days) ---
      const minDateObj = new Date(maxDateObj);
      minDateObj.setDate(maxDateObj.getDate() - 6);

      const weekStartDate = formatDateStr(minDateObj);
      const weekEndDate = formatDateStr(maxDateObj);

      const weekTrafficSum = await db('daily_traffic')
        .where('station_id', stationId)
        .whereBetween('date', [weekStartDate, weekEndDate])
        .sum('quantity as total')
        .first();
      weekTraffic = parseInt(weekTrafficSum?.total || '0', 10);

      const weekRevenueSum = await db('daily_revenue')
        .where('station_id', stationId)
        .whereBetween('date', [weekStartDate, weekEndDate])
        .sum('amount as total')
        .first();
      const weekAdjSum = await db('daily_adjustments')
        .where('station_id', stationId)
        .whereBetween('date', [weekStartDate, weekEndDate])
        .sum('amount as total')
        .first();
      weekRevenue = parseInt(weekRevenueSum?.total || '0', 10) + parseInt(weekAdjSum?.total || '0', 10);

      const formatDayMonth = (d: Date) => {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${d.getDate()} ${months[d.getMonth()]}`;
      };
      periodWeekLabel = `${formatDayMonth(minDateObj)} - ${formatDayMonth(maxDateObj)}`;
    }

    // 3. Aggregate Total Revenue (daily_revenue amount sum)
    let revenueQuery = db('daily_revenue').where('station_id', stationId).sum('amount as total');
    revenueQuery = applyDateFilter(revenueQuery);
    const revenueSum = await revenueQuery.first();
    
    let adjQuery = db('daily_adjustments').where('station_id', stationId).sum('amount as total');
    adjQuery = applyDateFilter(adjQuery);
    const adjSum = await adjQuery.first();

    const totalRevenue = parseInt(revenueSum?.total || '0', 10) + parseInt(adjSum?.total || '0', 10);

    // 4. Calculate Average Fare
    const averageFare = totalTraffic > 0 ? Math.round(totalRevenue / totalTraffic) : 0;

    // 5. Payment Splits from daily_payments_summary
    let paymentsQuery = db('daily_payments_summary')
      .where('station_id', stationId)
      .select('payment_method')
      .sum('amount as total')
      .groupBy('payment_method');
    paymentsQuery = applyDateFilter(paymentsQuery);
    const payments = await paymentsQuery;

    const paymentSplit = { cash: 0, electronic: 0, iprev: 0 };
    let totalPayments = 0;
    payments.forEach(p => {
      const amt = parseInt(p.total || '0', 10);
      totalPayments += amt;
      if (p.payment_method === 'EFECTIVO') paymentSplit.cash = amt;
      else if (p.payment_method === 'ELECTRONICO') paymentSplit.electronic = amt;
      else if (p.payment_method === 'IPREV_COLPASS') paymentSplit.iprev = amt;
    });

    // Ratios
    const paymentRatios = {
      cash: totalPayments > 0 ? (paymentSplit.cash / totalPayments) * 100 : 0,
      electronic: totalPayments > 0 ? (paymentSplit.electronic / totalPayments) * 100 : 0,
      iprev: totalPayments > 0 ? (paymentSplit.iprev / totalPayments) * 100 : 0
    };

    // 6. Public Novedades (Sanitized, non-sensitive, is_public = true)
    let publicNovedadesQuery = db('novedades')
      .where('station_id', stationId)
      .where('is_public', true)
      .select('id', 'type', 'severity', 'status', 'description', 'impact', 'lane_box', 'start_time', 'end_time')
      .orderBy('start_time', 'desc')
      .limit(10);
      
    if (startDateStr) publicNovedadesQuery = publicNovedadesQuery.where('start_time', '>=', `${startDateStr} 00:00:00`);
    if (endDateStr) publicNovedadesQuery = publicNovedadesQuery.where('start_time', '<=', `${endDateStr} 23:59:59`);
    
    const publicNovedades = await publicNovedadesQuery;

    // 7. Active Banners
    let activeBanners: any[] = [];
    try {
      if (await db.schema.hasTable('public_banners')) {
        activeBanners = await db('public_banners')
          .where('is_active', true)
          .orderBy('order_index', 'asc')
          .orderBy('created_at', 'desc')
          .select('id', 'text');
      }
    } catch (e) {
      console.log('Banners table not ready yet');
    }

    return NextResponse.json({
      success: true,
      data: {
        stationName: station.name,
        totalTraffic,
        totalRevenue,
        averageFare,
        paymentSplit: paymentRatios,
        novedades: publicNovedades,
        monthTraffic,
        monthRevenue,
        periodMonthName,
        weekTraffic,
        weekRevenue,
        periodWeekLabel,
        banners: activeBanners
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    console.error('Error fetching public KPIs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
