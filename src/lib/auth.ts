import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    console.warn('⚠️ JWT_SECRET no definido. Usando clave de desarrollo. NO usar en producción.');
    return 'dev-only-insecure-key-do-not-use-in-production';
  }
  return secret;
})();

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  name: string;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch (e) {
    return null;
  }
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    // 1. Check Authorization header
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded) return decoded;
    }

    // 2. Check Cookie (useful for frontend server component rendering)
    const tokenCookie = req.cookies.get('token');
    if (tokenCookie) {
      const decoded = verifyToken(tokenCookie.value);
      if (decoded) return decoded;
    }

    return null;
  } catch (error) {
    return null;
  }
}

export function hasRole(user: AuthUser, allowedRoles: string[]): boolean {
  return allowedRoles.includes(user.role);
}
