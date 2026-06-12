import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import { parseAndSaveExcel } from '@/lib/excelParser';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    // 2. Authorize roles (only OPERADOR and ADMIN can import)
    if (!hasRole(user, ['OPERADOR', 'ADMIN'])) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'No tiene permisos para importar archivos Excel' },
        { status: 403 }
      );
    }

    // 3. Parse Multipart Form Data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Bad Request', message: 'No se subió ningún archivo' },
        { status: 400 }
      );
    }

    const filename = file.name;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const db = await getDb();

    // 4. Get active station
    const station = await db('stations').first();
    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Internal Server Error', message: 'No hay ninguna estación configurada' },
        { status: 500 }
      );
    }

    // 5. Run parser within a database transaction
    let result: any = null;
    let fallbackUsed = false;
    
    try {
      // Intentar parser estricto (MATRIZ, etc.)
      result = await db.transaction(async (tx) => {
        return await parseAndSaveExcel(fileBuffer, station.id, user.id, filename, tx);
      });
    } catch (strictError: any) {
      console.log('Fallo parser estricto, intentando heurístico...', strictError.message);
      // Log the error to a file for debugging
      try {
        require('fs').writeFileSync(require('path').join(process.cwd(), 'last-strict-error.log'), strictError.stack || strictError.message);
      } catch (e) {}
      // Fallback a parser dinámico
      const { parseDynamicExcel } = await import('@/lib/dynamicExcelParser');
      fallbackUsed = true;
      result = await db.transaction(async (tx) => {
        return await parseDynamicExcel(fileBuffer, station.id, user.id, filename, tx);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        filename,
        importedRows: result.importedRows,
        dates: result.dates,
        errors: result.errors,
        warnings: result.warnings || (fallbackUsed ? ['Se utilizó el mapeo dinámico. Algunos datos pudieron omitirse.'] : [])
      }
    });

  } catch (error: any) {
    console.error('Error importing Excel file:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateToDel = searchParams.get('date');

    if (!dateToDel) {
      return NextResponse.json({ success: false, error: 'Bad Request', message: 'Fecha no especificada' }, { status: 400 });
    }

    const db = await getDb();
    const station = await db('stations').first();
    
    if (!station) {
      return NextResponse.json({ success: false, error: 'Internal Server Error', message: 'No hay estación' }, { status: 500 });
    }

    await db.transaction(async (tx) => {
      await tx('daily_traffic').where('station_id', station.id).where('date', dateToDel).delete();
      await tx('daily_revenue').where('station_id', station.id).where('date', dateToDel).delete();
      await tx('daily_adjustments').where('station_id', station.id).where('date', dateToDel).delete();
      await tx('daily_payments_summary').where('station_id', station.id).where('date', dateToDel).delete();
      await tx('ticket_details').where('station_id', station.id).where('date', dateToDel).delete();
      await tx('hourly_traffic').where('station_id', station.id).where('date', dateToDel).delete();
    });

    return NextResponse.json({ success: true, message: `Datos del ${dateToDel} eliminados correctamente.` });
  } catch (error: any) {
    console.error('Error deleting data:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
