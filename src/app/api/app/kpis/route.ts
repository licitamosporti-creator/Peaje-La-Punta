import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { evaluateAlerts } from '@/lib/alertSystem';

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
      return NextResponse.json({
        success: true,
        data: {
          totalTraffic: 0,
          totalRevenue: 0,
          averageFare: 0,
          paymentSplit: { cash: 0, electronic: 0, iprev: 0 },
          coverage: { activeDays: 0, totalDays: 0, percentage: 0 },
          alerts: [],
          stats: { openNovedades: 0, totalNovedades: 0 }
        }
      }, {
        headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' }
      });
    }

    const stationId = station.id;

    // 3. Aggregate Traffic & Revenue
    const trafficSum = await db('daily_traffic').where('station_id', stationId).sum('quantity as total').first();
    const totalTraffic = parseInt(trafficSum?.total || '0', 10);

    const revenueSum = await db('daily_revenue').where('station_id', stationId).sum('amount as total').first();
    const adjSum = await db('daily_adjustments').where('station_id', stationId).sum('amount as total').first();
    const totalRevenue = parseInt(revenueSum?.total || '0', 10) + parseInt(adjSum?.total || '0', 10);

    const averageFare = totalTraffic > 0 ? Math.round(totalRevenue / totalTraffic) : 0;

    // 4. Payment Splits
    const payments = await db('daily_payments_summary')
      .where('station_id', stationId)
      .select('payment_method')
      .sum('amount as total')
      .groupBy('payment_method');

    const paymentSplit = { cash: 0, electronic: 0, iprev: 0 };
    let totalPayments = 0;
    payments.forEach(p => {
      const amt = parseInt(p.total || '0', 10);
      totalPayments += amt;
      if (p.payment_method === 'EFECTIVO') paymentSplit.cash = amt;
      else if (p.payment_method === 'ELECTRONICO') paymentSplit.electronic = amt;
      else if (p.payment_method === 'IPREV_COLPASS') paymentSplit.iprev = amt;
    });

    const paymentRatios = {
      cash: totalPayments > 0 ? (paymentSplit.cash / totalPayments) * 100 : 0,
      electronic: totalPayments > 0 ? (paymentSplit.electronic / totalPayments) * 100 : 0,
      iprev: totalPayments > 0 ? (paymentSplit.iprev / totalPayments) * 100 : 0
    };

    // 5. Evaluate Alerts
    const alerts = await evaluateAlerts(db, stationId);

    // 6. Calculate Data Coverage
    const activeDaysResult = await db('daily_traffic')
      .where('station_id', stationId)
      .select('date')
      .groupBy('date')
      .orderBy('date', 'asc');

    let coverage = { activeDays: 0, totalDays: 0, percentage: 0, activeDates: [] as string[], minDate: '', maxDate: '' };
    if (activeDaysResult.length > 0) {
      const activeDaysCount = activeDaysResult.length;
      
      // Extract dates as YYYY-MM-DD strings to avoid timezone shifts
      const dateStrings = activeDaysResult.map((r: any) => {
        const d = new Date(r.date);
        return d.toISOString().split('T')[0];
      });
      
      const minDateStr = dateStrings[0];
      const maxDateStr = dateStrings[dateStrings.length - 1];
      
      const minDate = new Date(minDateStr);
      const maxDate = new Date(maxDateStr);
      
      const timeDiff = Math.abs(maxDate.getTime() - minDate.getTime());
      const totalDaysCount = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // inclusive of start day
      
      coverage = {
        activeDays: activeDaysCount,
        totalDays: totalDaysCount,
        percentage: totalDaysCount > 0 ? Math.round((activeDaysCount / totalDaysCount) * 100) : 0,
        activeDates: dateStrings,
        minDate: minDateStr,
        maxDate: maxDateStr
      };
    }

    // 7. General incident statistics
    const openIncidents = await db('novedades').where('station_id', stationId).whereNot('status', 'CERRADO').count('id as count').first();
    const totalIncidents = await db('novedades').where('station_id', stationId).count('id as count').first();

    return NextResponse.json({
      success: true,
      data: {
        stationName: station.panel_name || station.name,
        totalTraffic,
        totalRevenue,
        averageFare,
        paymentSplit: paymentRatios,
        coverage,
        alerts,
        stats: {
          openNovedades: parseInt(openIncidents?.count as string || '0', 10),
          totalNovedades: parseInt(totalIncidents?.count as string || '0', 10)
        }
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=60'
      }
    });

  } catch (error: any) {
    console.error('Error fetching internal KPIs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
