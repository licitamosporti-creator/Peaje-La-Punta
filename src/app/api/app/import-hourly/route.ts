import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import { parseHourlyWithAI } from '@/lib/visionParser';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !hasRole(user, ['ADMIN'])) {
      return NextResponse.json({ success: false, error: 'Forbidden', message: 'No tiene permisos.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Bad Request', message: 'No se subió archivo' }, { status: 400 });
    }

    const filename = file.name;
    const mimeType = file.type;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const db = await getDb();
    const station = await db('stations').first();
    if (!station) {
      return NextResponse.json({ success: false, message: 'No hay estación configurada' }, { status: 500 });
    }

    let result: any = null;

    await db.transaction(async (tx) => {
      // Usar parser de Inteligencia Artificial para imágenes
      result = await parseHourlyWithAI(fileBuffer, mimeType, station.id, user.id, filename, tx);
    });

    return NextResponse.json({
      success: true,
      data: {
        filename,
        importedRows: result.importedRows,
        date: result.date
      }
    });

  } catch (error: any) {
    console.error('Error import-hourly:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
