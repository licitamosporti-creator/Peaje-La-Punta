import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

// GET single novelty
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const db = await getDb();

    const record = await db('novedades')
      .where('novedades.id', id)
      .leftJoin('users as u1', 'novedades.created_by', 'u1.id')
      .leftJoin('users as u2', 'novedades.closed_by', 'u2.id')
      .select(
        'novedades.*',
        'u1.name as creator_name',
        'u2.name as closer_name'
      )
      .first();

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Not Found', message: 'No se encontró la novedad especificada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: record
    });
  } catch (error: any) {
    console.error('Error fetching single novelty:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// PUT update novelty
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const {
      type,
      severity,
      status,
      lane_box,
      description,
      impact,
      evidences,
      actions,
      root_cause,
      start_time,
      end_time,
      is_public
    } = body;

    const db = await getDb();

    // Check existence
    const existing = await db('novedades').where('id', id).first();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Not Found', message: 'No se encontró la novedad especificada' },
        { status: 404 }
      );
    }

    const updateObj: any = {
      updated_at: new Date()
    };

    if (type !== undefined) updateObj.type = type;
    if (severity !== undefined) updateObj.severity = severity;
    if (status !== undefined) updateObj.status = status;
    if (lane_box !== undefined) updateObj.lane_box = lane_box || null;
    if (description !== undefined) updateObj.description = description;
    if (impact !== undefined) updateObj.impact = impact;
    if (evidences !== undefined) updateObj.evidences = evidences || null;
    if (actions !== undefined) updateObj.actions = actions || null;
    if (root_cause !== undefined) updateObj.root_cause = root_cause || null;
    if (start_time !== undefined) updateObj.start_time = new Date(start_time);
    if (end_time !== undefined) updateObj.end_time = end_time ? new Date(end_time) : null;
    if (is_public !== undefined) updateObj.is_public = !!is_public;

    // If status is updated to CERRADO, we check if they closed it through this endpoint instead of the explicit /close endpoint
    if (status === 'CERRADO') {
      if (!root_cause && !existing.root_cause) {
        return NextResponse.json(
          { success: false, error: 'Bad Request', message: 'Causa raíz es obligatoria para cerrar una novedad' },
          { status: 400 }
        );
      }
      updateObj.closed_by = user.id;
      if (!updateObj.end_time && !existing.end_time) {
        updateObj.end_time = new Date();
      }
    }

    await db('novedades').where('id', id).update(updateObj);

    // Audit log
    await logAudit(user.id, 'UPDATE_NOVEDAD', 'novedades', id, {
      changedFields: Object.keys(updateObj)
    });

    return NextResponse.json({
      success: true,
      data: { ...existing, ...updateObj }
    });

  } catch (error: any) {
    console.error('Error updating novelty:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// DELETE novelty
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    // Role check: Only ADMIN can delete
    if (!hasRole(user, ['ADMIN'])) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'Solo los administradores pueden eliminar novedades' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const db = await getDb();

    // Check existence
    const existing = await db('novedades').where('id', id).first();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Not Found', message: 'No se encontró la novedad especificada' },
        { status: 404 }
      );
    }

    await db('novedades').where('id', id).delete();

    // Audit log
    await logAudit(user.id, 'DELETE_NOVEDAD', 'novedades', id, {
      deletedRecord: existing
    });

    return NextResponse.json({
      success: true,
      message: 'Novedad eliminada correctamente'
    });

  } catch (error: any) {
    console.error('Error deleting novelty:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
