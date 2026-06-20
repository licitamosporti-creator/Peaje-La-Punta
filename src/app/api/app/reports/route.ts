import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logExport } from '@/lib/audit';

// GET export logs
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

    // Query logs
    const logs = await db('export_log')
      .join('users', 'export_log.user_id', 'users.id')
      .select(
        'export_log.*',
        'users.name as user_name',
        'users.username as user_username'
      )
      .orderBy('export_log.timestamp', 'desc')
      .limit(100);

    return NextResponse.json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    console.error('Error fetching export logs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// POST log a new export event
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { report_type, format, filters } = body;

    if (!report_type || !format) {
      return NextResponse.json(
        { success: false, error: 'Bad Request', message: 'Faltan campos obligatorios: report_type, format' },
        { status: 400 }
      );
    }

    await logExport(user.id, report_type, format, filters || {});

    return NextResponse.json({
      success: true,
      message: 'Exportación registrada con éxito en la bitácora de auditoría'
    });

  } catch (error: any) {
    console.error('Error logging export event:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
