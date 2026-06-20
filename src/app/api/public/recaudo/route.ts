import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();

    // 1. Get first station
    const station = await db('stations').first();
    if (!station) {
      return NextResponse.json(
        { success: true, data: { daily: [], categories: [] } },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
      );
    }

    const stationId = station.id;

    const startDateParam = req.nextUrl.searchParams.get('startDate');
    const endDateParam = req.nextUrl.searchParams.get('endDate');
    const period = req.nextUrl.searchParams.get('period');

    let startDateStr = startDateParam;
    let endDateStr = endDateParam;

    if (period === 'last7' || period === 'last30') {
      const days = period === 'last7' ? 6 : 29;
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

    // 2. Fetch daily detailed revenue to build categories breakdown per date
    let dailyRevDetailedQuery = db('daily_revenue')
      .where('station_id', stationId)
      .select('date', 'category', 'amount')
      .orderBy('date', 'asc');
    dailyRevDetailedQuery = applyDateFilter(dailyRevDetailedQuery);
    const dailyRevDetailed = await dailyRevDetailedQuery;

    const revByDate = new Map<string, { total: number; categories: { [key: string]: number } }>();
    dailyRevDetailed.forEach(r => {
      const d = typeof r.date === 'string' ? r.date : r.date.toISOString().split('T')[0];
      const cat = r.category.replace('Cat ', '').trim();
      const amt = parseInt(r.amount || '0', 10);
      if (!revByDate.has(d)) {
        revByDate.set(d, { total: 0, categories: { I: 0, II: 0, III: 0, IV: 0 } });
      }
      const cur = revByDate.get(d)!;
      cur.total += amt;
      cur.categories[cat] = amt;
    });

    // Fetch weekdays from daily_traffic
    let weekdaysQuery = db('daily_traffic')
      .where('station_id', stationId)
      .select('date', 'weekday')
      .groupBy('date', 'weekday');
    weekdaysQuery = applyDateFilter(weekdaysQuery);
    const weekdaysResult = await weekdaysQuery;
    const weekdayMap = new Map(weekdaysResult.map(w => {
      const wDate = typeof w.date === 'string' ? w.date : w.date.toISOString().split('T')[0];
      return [wDate, w.weekday];
    }));

    // 3. Fetch daily payment summaries (daily_payments_summary)
    let dailyPayQuery = db('daily_payments_summary')
      .where('station_id', stationId)
      .select('date', 'payment_method')
      .sum('amount as total_amount')
      .groupBy('date', 'payment_method');
    dailyPayQuery = applyDateFilter(dailyPayQuery);
    const dailyPay = await dailyPayQuery;

    // Structure payments by date
    const payByDate = new Map<string, { cash: number; electronic: number; iprev: number }>();
    dailyPay.forEach(p => {
      const d = typeof p.date === 'string' ? p.date : p.date.toISOString().split('T')[0];
      if (!payByDate.has(d)) {
        payByDate.set(d, { cash: 0, electronic: 0, iprev: 0 });
      }
      const cur = payByDate.get(d)!;
      const amt = parseInt(p.total_amount || '0', 10);
      if (p.payment_method === 'EFECTIVO') cur.cash = amt;
      else if (p.payment_method === 'ELECTRONICO') cur.electronic = amt;
      else if (p.payment_method === 'IPREV_COLPASS') cur.iprev = amt;
    });

    // 3.5 Fetch daily adjustments (daily_adjustments)
    let dailyAdjQuery = db('daily_adjustments')
      .where('station_id', stationId)
      .select('date')
      .sum('amount as total_amount')
      .groupBy('date');
    dailyAdjQuery = applyDateFilter(dailyAdjQuery);
    const dailyAdj = await dailyAdjQuery;

    const adjByDate = new Map<string, number>();
    dailyAdj.forEach(a => {
      const aDate = typeof a.date === 'string' ? a.date : a.date.toISOString().split('T')[0];
      adjByDate.set(aDate, parseInt(a.total_amount || '0', 10));
    });

    const dailyCombined = Array.from(revByDate.entries()).map(([date, val]) => {
      const p = payByDate.get(date) || { cash: 0, electronic: 0, iprev: 0 };
      const adj = adjByDate.get(date) || 0;
      return {
        date,
        weekday: weekdayMap.get(date) || '',
        totalRevenue: val.total,
        revenueCat: val.categories,
        cash: p.cash,
        electronic: p.electronic,
        iprev: p.iprev,
        adjustments: adj
      };
    });

    // 4. Fetch category aggregates (sum for the whole period)
    let catSumQuery = db('daily_revenue')
      .where('station_id', stationId)
      .select('category')
      .sum('amount as total')
      .groupBy('category');
    catSumQuery = applyDateFilter(catSumQuery);
    const catSum = await catSumQuery;

    const categoriesCombined = catSum.map(c => ({
      category: c.category,
      amount: parseInt(c.total || '0', 10)
    }));

    return NextResponse.json({
      success: true,
      data: {
        daily: dailyCombined,
        categories: categoriesCombined
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    console.error('Error fetching public recaudo data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
