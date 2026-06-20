import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { headers } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-peaje';

async function checkAdmin(req: Request) {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.role === 'ADMIN';
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const isAdmin = await checkAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const db = await getDb();
    const settings = await db('global_settings').select('*');
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const isAdmin = await checkAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { settings } = await req.json();
    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json({ success: false, error: 'Formato inválido' }, { status: 400 });
    }

    const db = await getDb();
    
    // Updates are batched or done individually
    await db.transaction(async (trx) => {
      for (const item of settings) {
        if (item.setting_key && item.setting_value !== undefined) {
          await trx('global_settings')
            .where('setting_key', item.setting_key)
            .update({
              setting_value: item.setting_value,
              updated_at: db.fn.now()
            });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
