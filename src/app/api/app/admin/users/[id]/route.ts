import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user || !hasRole(user, ['ADMIN'])) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'Sólo administradores pueden editar usuarios' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { name, role, password } = body;

    const db = await getDb();
    
    // Safety check: Don't allow admin to demote themselves
    if (user.id === id && role && role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Conflict', message: 'No puedes revocar tus propios permisos de administrador.' },
        { status: 409 }
      );
    }

    const updates: any = { updated_at: new Date() };
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(password, salt);
    }

    if (Object.keys(updates).length > 1) { // more than just updated_at
      await db('users').where('id', id).update(updates);
      await logAudit(user.id, 'UPDATE_USER', 'users', id, { name, role, passwordChanged: !!password });
    }

    return NextResponse.json({ success: true, message: 'Usuario actualizado exitosamente' });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user || !hasRole(user, ['ADMIN'])) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'Sólo administradores pueden eliminar usuarios' },
        { status: 403 }
      );
    }

    const { id } = await params;
    
    if (user.id === id) {
      return NextResponse.json(
        { success: false, error: 'Conflict', message: 'No puedes eliminarte a ti mismo del sistema.' },
        { status: 409 }
      );
    }

    const db = await getDb();
    const targetUser = await db('users').where('id', id).first();
    
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Not Found', message: 'Usuario no encontrado' }, { status: 404 });
    }

    // Note: Instead of a hard delete, we could do soft delete, but for simplicity we hard delete here 
    // or rely on DB cascades if there are foreign keys. In SQLite it will just delete.
    await db('users').where('id', id).delete();

    await logAudit(user.id, 'DELETE_USER', 'users', id, { username: targetUser.username });

    return NextResponse.json({ success: true, message: 'Usuario eliminado permanentemente' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
