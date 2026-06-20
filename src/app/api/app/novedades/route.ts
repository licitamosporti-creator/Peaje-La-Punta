import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// GET all novedades
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

    // Get first station
    const station = await db('stations').first();
    if (!station) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Join with users to get creator/closer names
    const list = await db('novedades')
      .where('novedades.station_id', station.id)
      .leftJoin('users as u1', 'novedades.created_by', 'u1.id')
      .leftJoin('users as u2', 'novedades.closed_by', 'u2.id')
      .select(
        'novedades.*',
        'u1.name as creator_name',
        'u2.name as closer_name'
      )
      .orderBy('novedades.start_time', 'desc');

    return NextResponse.json({
      success: true,
      data: list
    });
  } catch (error: any) {
    console.error('Error fetching novedades:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// POST create novelty
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
    const {
      type,
      severity,
      lane_box,
      description,
      impact,
      start_time,
      end_time,
      is_public,
      evidences,
      actions,
      root_cause
    } = body;

    // Validate fields
    if (!type || !severity || !description || !impact || !start_time) {
      return NextResponse.json(
        { success: false, error: 'Bad Request', message: 'Faltan campos obligatorios: type, severity, description, impact, start_time' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const station = await db('stations').first();
    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Internal Server Error', message: 'No hay ninguna estación configurada' },
        { status: 500 }
      );
    }

    const newNovedadId = crypto.randomUUID();

    const insertObj = {
      id: newNovedadId,
      station_id: station.id,
      type,
      severity,
      status: 'ABIERTO', // Default status on create
      lane_box: lane_box || null,
      description,
      impact,
      evidences: evidences || null,
      root_cause: root_cause || null,
      actions: actions || null,
      start_time: new Date(start_time),
      end_time: end_time ? new Date(end_time) : null,
      is_public: !!is_public,
      created_by: user.id,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('novedades').insert(insertObj);

    // Audit log
    await logAudit(user.id, 'CREATE_NOVEDAD', 'novedades', newNovedadId, {
      type,
      severity,
      lane_box,
      impact
    });

    return NextResponse.json({
      success: true,
      data: insertObj
    });

  } catch (error: any) {
    console.error('Error creating novedad:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
