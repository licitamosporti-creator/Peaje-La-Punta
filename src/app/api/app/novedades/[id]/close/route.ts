import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    // 1. Authenticate user
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    // 2. Role Check: Only INTERVENTOR and ADMIN can close a novelty
    if (!hasRole(user, ['INTERVENTOR', 'ADMIN'])) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'Solo los interventores o administradores pueden cerrar novedades' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { root_cause, end_time } = body;

    // RULE: Causa raíz (root_cause) es obligatoria al cierre
    if (!root_cause || root_cause.toString().trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Bad Request', message: 'La causa raíz es obligatoria para cerrar una novedad' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check novelty existence
    const existing = await db('novedades').where('id', id).first();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Not Found', message: 'No se encontró la novedad especificada' },
        { status: 404 }
      );
    }

    // Update record
    const closeTime = end_time ? new Date(end_time) : new Date();
    await db('novedades')
      .where('id', id)
      .update({
        status: 'CERRADO',
        root_cause: root_cause.toString().trim(),
        end_time: closeTime,
        closed_by: user.id,
        updated_at: new Date()
      });

    // Audit log
    await logAudit(user.id, 'CLOSE_NOVEDAD', 'novedades', id, {
      root_cause: root_cause.toString().trim(),
      closed_at: closeTime
    });

    return NextResponse.json({
      success: true,
      message: 'Novedad cerrada correctamente',
      data: {
        id,
        status: 'CERRADO',
        root_cause: root_cause.toString().trim(),
        end_time: closeTime,
        closed_by: user.id
      }
    });

  } catch (error: any) {
    console.error('Error closing novelty:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// Support PUT mapping to the same function for convenience
export async function PUT(req: NextRequest, { params }: RouteContext) {
  return POST(req, { params });
}
