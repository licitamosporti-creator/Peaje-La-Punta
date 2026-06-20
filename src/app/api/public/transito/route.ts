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
        { success: true, data: { daily: [], categories: [], hourly: [] } },
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
      const maxDateRow = await db('daily_traffic').where('station_id', stationId).max('date as maxDate').first();
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

    // 2. Daily traffic trends with category and bucket breakdown
    let dailyCatTrafficQuery = db('daily_traffic')
      .where('station_id', stationId)
      .select('date', 'category', 'bucket')
      .sum('quantity as quantity')
      .groupBy('date', 'category', 'bucket')
      .orderBy('date', 'asc');
    dailyCatTrafficQuery = applyDateFilter(dailyCatTrafficQuery);
    const dailyCatTraffic = await dailyCatTrafficQuery;

    const trafficByDate = new Map<string, { total: number; categories: { [key: string]: number }; buckets: { [key: string]: number } }>();
    dailyCatTraffic.forEach(t => {
      const d = typeof t.date === 'string' ? t.date : t.date.toISOString().split('T')[0];
      const cat = t.category.replace('Cat ', '').trim();
      const qty = parseInt(t.quantity || '0', 10);
      const bucket = t.bucket || 'NORMAL';
      
      if (!trafficByDate.has(d)) {
        trafficByDate.set(d, { 
          total: 0, 
          categories: { I: 0, II: 0, III: 0, IV: 0 },
          buckets: { NORMAL: 0, ESPECIAL: 0, EVASOR: 0, ESPECIAL_EXENTO: 0, EXENTO: 0 }
        });
      }
      const cur = trafficByDate.get(d)!;
      cur.total += qty;
      cur.categories[cat] += qty;
      cur.buckets[bucket] = (cur.buckets[bucket] || 0) + qty;
    });

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

    const dailyCombined = Array.from(trafficByDate.entries()).map(([date, val]) => ({
      date,
      weekday: weekdayMap.get(date) || '',
      quantity: val.total,
      categories: val.categories,
      buckets: val.buckets
    })).sort((a, b) => a.date.localeCompare(b.date));

    // 3. Category aggregates
    let catTrafficQuery = db('daily_traffic')
      .where('station_id', stationId)
      .select('category')
      .sum('quantity as total')
      .groupBy('category');
    catTrafficQuery = applyDateFilter(catTrafficQuery);
    const catTraffic = await catTrafficQuery;

    const categoriesCombined = catTraffic.map(c => ({
      category: c.category,
      quantity: parseInt(c.total || '0', 10)
    }));

    // 4. Hourly traffic average profile per weekday
    let hourlyByDateAndHourQuery = db('hourly_traffic')
      .where('station_id', stationId)
      .select('date', 'hour')
      .sum('quantity as total')
      .groupBy('date', 'hour');
    hourlyByDateAndHourQuery = applyDateFilter(hourlyByDateAndHourQuery);
    const hourlyByDateAndHour = await hourlyByDateAndHourQuery;

    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const hourlyWeekdayMap = new Map();
    
    for (let h = 0; h < 24; h++) {
      const dayStats: any = {};
      daysOfWeek.forEach(d => { dayStats[d] = { sum: 0, count: new Set() } });
      hourlyWeekdayMap.set(h, dayStats);
    }

    // Process all dates matching the selected period
    hourlyByDateAndHour.forEach((row: any) => {
      const dStr = typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0];
      const d = new Date(dStr + "T12:00:00Z");
      const dayName = daysOfWeek[d.getUTCDay()];
      const hour = parseInt(row.hour, 10);
      const total = parseInt(row.total || '0', 10);
      
      const stats = hourlyWeekdayMap.get(hour)[dayName];
      stats.sum += total;
      stats.count.add(dStr);
    });

    const hourlyCombined = [];
    for (let h = 0; h < 24; h++) {
      const row: any = { hour: h };
      const stats = hourlyWeekdayMap.get(h);
      daysOfWeek.forEach(d => {
        const c = stats[d].count.size;
        row[d] = c > 0 ? Math.round(stats[d].sum / c) : 0;
      });
      hourlyCombined.push(row);
    }

    return NextResponse.json({
      success: true,
      data: {
        daily: dailyCombined,
        categories: categoriesCombined,
        hourly: hourlyCombined
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    console.error('Error fetching public transito data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
