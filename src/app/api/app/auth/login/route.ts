import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Bad Request', message: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Query user
    const user = await db('users').where('username', username.toLowerCase()).first();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    };

    // Sign JWT token
    const token = signToken(payload);

    // Set cookie
    const response = NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name
        }
      }
    });

    // HTTP-Only cookie, valid for 12 hours
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 60 * 60, // 12 hours in seconds
      path: '/'
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
