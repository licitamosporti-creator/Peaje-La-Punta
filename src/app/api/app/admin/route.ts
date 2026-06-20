import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// GET admin data (users list, stations list, audit logs)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    // Role check: Only ADMIN can view admin data
    if (!hasRole(user, ['ADMIN'])) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'Acceso denegado. Solo administradores pueden acceder a este recurso' },
        { status: 403 }
      );
    }

    const db = await getDb();

    // Query stations
    const stations = await db('stations').select('*').orderBy('name', 'asc');

    // Query users (exclude password hashes)
    const users = await db('users')
      .select('id', 'username', 'role', 'name', 'created_at', 'updated_at')
      .orderBy('username', 'asc');

    // Query audit logs (join with users)
    const auditLogs = await db('audit_log')
      .leftJoin('users', 'audit_log.user_id', 'users.id')
      .select(
        'audit_log.*',
        'users.name as user_name',
        'users.username as user_username'
      )
      .orderBy('audit_log.timestamp', 'desc')
      .limit(100);

    return NextResponse.json({
      success: true,
      data: {
        stations,
        users,
        auditLogs
      }
    });
  } catch (error: any) {
    console.error('Error fetching admin details:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// POST create user (ADMIN only)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    // Role check: Only ADMIN can create users
    if (!hasRole(user, ['ADMIN'])) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'Acceso denegado. Solo administradores pueden crear usuarios' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { username, password, role, name } = body;

    // Validate fields
    if (!username || !password || !role || !name) {
      return NextResponse.json(
        { success: false, error: 'Bad Request', message: 'Faltan campos obligatorios: username, password, role, name' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['ADMIN', 'OPERADOR', 'INTERVENTOR'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Bad Request', message: 'Rol inválido. Debe ser ADMIN, OPERADOR, o INTERVENTOR' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if user already exists
    const existing = await db('users').where('username', username.toLowerCase().trim()).first();
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Conflict', message: 'El nombre de usuario ya está registrado' },
        { status: 409 }
      );
    }

    // Create user
    const newUserId = crypto.randomUUID();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUserObj = {
      id: newUserId,
      username: username.toLowerCase().trim(),
      password_hash: passwordHash,
      role,
      name: name.trim(),
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('users').insert(newUserObj);

    // Audit log
    await logAudit(user.id, 'CREATE_USER', 'users', newUserId, {
      username: newUserObj.username,
      role: newUserObj.role,
      name: newUserObj.name
    });

    return NextResponse.json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        id: newUserId,
        username: newUserObj.username,
        role: newUserObj.role,
        name: newUserObj.name
      }
    });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
