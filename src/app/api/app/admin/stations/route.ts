import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !hasRole(user, ['ADMIN'])) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { name, panel_name } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Bad Request', message: 'El nombre oficial es obligatorio' }, { status: 400 });
    }

    const db = await getDb();
    
    // Check if a station with this name already exists
    const existing = await db('stations').where('name', name.trim()).first();
    if (existing) {
      return NextResponse.json({ success: false, error: 'Conflict', message: 'Ya existe una estación con este nombre' }, { status: 409 });
    }

    const newStationId = crypto.randomUUID();

    await db('stations').insert({
      id: newStationId,
      name: name.trim(),
      panel_name: panel_name ? panel_name.trim() : null,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });

    // Log action
    await logAudit(
      user.id,
      'CREATE_STATION',
      'station',
      newStationId,
      `Se creó la estación: ${name}`
    );

    return NextResponse.json({ success: true, message: 'Estación creada correctamente', data: { id: newStationId } });
  } catch (error: any) {
    console.error('Error creating station:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
