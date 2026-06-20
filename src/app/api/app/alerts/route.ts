import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { evaluateAlerts } from '@/lib/alertSystem';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    const db = await getDb();
    const station = await db('stations').first();
    if (!station) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Evaluate alerts dynamically using current DB records
    const list = await evaluateAlerts(db, station.id);

    return NextResponse.json({
      success: true,
      data: list
    });
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
