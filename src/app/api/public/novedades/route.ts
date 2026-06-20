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
      return NextResponse.json({ success: true, data: [] }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
    }

    const stationId = station.id;

    // 2. Fetch public novedades
    const publicNovedades = await db('novedades')
      .where('station_id', stationId)
      .where('is_public', true)
      .select(
        'id',
        'type',
        'severity',
        'status',
        'lane_box',
        'description',
        'impact',
        'start_time',
        'end_time'
      )
      .orderBy('start_time', 'desc');

    return NextResponse.json({
      success: true,
      data: publicNovedades
    });
  } catch (error: any) {
    console.error('Error fetching public novedades:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
