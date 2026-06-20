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
      return NextResponse.json({ success: true, data: [] });
    }

    const stationId = station.id;

    // Get optional date filters
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = db('support_staff')
      .where('station_id', stationId);

    if (startDate) {
      query = query.where('date', '>=', startDate);
    }
    if (endDate) {
      query = query.where('date', '<=', endDate);
    }

    const staffList = await query.orderBy('date', 'asc').orderBy('name', 'asc');

    return NextResponse.json({
      success: true,
      data: staffList
    });

  } catch (error: any) {
    console.error('Error fetching support staff data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
