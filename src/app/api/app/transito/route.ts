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
        { success: true, data: { dailyBuckets: [], hourlyData: [] } },
        { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } }
      );
    }

    const stationId = station.id;

    // Get optional date filters
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 3. Query Daily traffic buckets
    let dailyTrafficQuery = db('daily_traffic')
      .where('station_id', stationId)
      .select('date', 'weekday', 'category', 'bucket', 'payment_method', 'quantity');

    // 4. Query Hourly traffic matrix
    let hourlyQuery = db('hourly_traffic')
      .where('station_id', stationId)
      .select('date', 'category', 'hour', 'quantity');

    if (startDate) {
      dailyTrafficQuery = dailyTrafficQuery.where('date', '>=', startDate);
      hourlyQuery = hourlyQuery.where('date', '>=', startDate);
    }
    if (endDate) {
      dailyTrafficQuery = dailyTrafficQuery.where('date', '<=', endDate);
      hourlyQuery = hourlyQuery.where('date', '<=', endDate);
    }

    const [dailyTraffic, hourlyTraffic] = await Promise.all([
      dailyTrafficQuery.orderBy('date', 'asc'),
      hourlyQuery.orderBy('date', 'asc').orderBy('hour', 'asc')
    ]);

    // Pivot hourly traffic by date and category
    // We want a shape like: Array of { date: string, category: string, hourly: Array of 24 numbers, total: number }
    const hourlyMap = new Map<string, { date: string; category: string; hours: number[]; total: number }>();
    
    hourlyTraffic.forEach(h => {
      const d = typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0];
      const key = `${d}_${h.category}`;
      if (!hourlyMap.has(key)) {
        hourlyMap.set(key, {
          date: d,
          category: h.category.replace('Cat ', '').trim(),
          hours: Array(24).fill(0),
          total: 0
        });
      }
      const item = hourlyMap.get(key)!;
      const q = parseInt(h.quantity || '0', 10);
      item.hours[h.hour] = q;
      item.total += q;
    });

    const hourlyList = Array.from(hourlyMap.values());

    // Consolidate daily bucket sums
    // We want a list of days: { date, weekday, normal, especial, evasor, especial_exento, exento, total }
    const bucketDayMap = new Map<string, any>();
    dailyTraffic.forEach(t => {
      const d = typeof t.date === 'string' ? t.date : t.date.toISOString().split('T')[0];
      if (!bucketDayMap.has(d)) {
        bucketDayMap.set(d, {
          date: d,
          weekday: t.weekday,
          NORMAL: 0,
          ESPECIAL: 0,
          EVASOR: 0,
          ESPECIAL_EXENTO: 0,
          EXENTO: 0,
          total: 0
        });
      }
      const item = bucketDayMap.get(d)!;
      const q = parseInt(t.quantity || '0', 10);
      item[t.bucket] += q;
      item.total += q;
    });

    const dailyBucketList = Array.from(bucketDayMap.values());

    return NextResponse.json({
      success: true,
      data: {
        dailyBuckets: dailyBucketList,
        hourlyData: hourlyList
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=60'
      }
    });

  } catch (error: any) {
    console.error('Error fetching internal transito data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
