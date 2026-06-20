import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user || !hasRole(user, ['ADMIN'])) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Bad Request', message: 'ID no proporcionado' }, { status: 400 });
    }

    const body = await req.json();
    const { name, panel_name } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Bad Request', message: 'El nombre es obligatorio' }, { status: 400 });
    }

    const db = await getDb();
    
    // Update station
    await db('stations').where({ id }).update({ name, panel_name, updated_at: db.fn.now() });

    // Log action
    await logAudit(
      user.id,
      'UPDATE_STATION',
      'station',
      id,
      `Se actualizó la estación: ${name}`
    );

    return NextResponse.json({ success: true, message: 'Estación actualizada correctamente' });
  } catch (error: any) {
    console.error('Error updating station:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user || !hasRole(user, ['ADMIN'])) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Bad Request', message: 'ID no proporcionado' }, { status: 400 });
    }

    const db = await getDb();
    
    // Check if station exists
    const station = await db('stations').where({ id }).first();
    if (!station) {
      return NextResponse.json({ success: false, error: 'Not Found', message: 'Estación no encontrada' }, { status: 404 });
    }

    // Delete station
    await db('stations').where({ id }).delete();

    // Log action
    await logAudit(
      user.id,
      'DELETE_STATION',
      'station',
      id,
      `Se eliminó la estación: ${station.name}`
    );

    return NextResponse.json({ success: true, message: 'Estación eliminada correctamente' });
  } catch (error: any) {
    console.error('Error deleting station:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
