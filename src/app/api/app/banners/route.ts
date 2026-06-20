import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !hasRole(user, ['ADMIN'])) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const banners = await db('public_banners').orderBy('created_at', 'desc');

    return NextResponse.json({ success: true, data: banners });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error', message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !hasRole(user, ['ADMIN'])) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { text, is_active } = await req.json();
    if (!text || text.trim() === '') {
      return NextResponse.json({ success: false, error: 'Bad Request', message: 'El texto es requerido' }, { status: 400 });
    }

    const db = await getDb();
    const newBanner = {
      id: crypto.randomUUID(),
      text: text.trim(),
      is_active: is_active ?? true,
      order_index: 0
    };

    await db('public_banners').insert(newBanner);

    return NextResponse.json({ success: true, data: newBanner });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error', message: error.message }, { status: 500 });
  }
}
