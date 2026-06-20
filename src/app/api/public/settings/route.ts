import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    
    // Solo retornamos los pares key-value para el sitio público, sin metadatos.
    const settings = await db('global_settings').select('setting_key', 'setting_value');
    
    // Convert array to simple key-value map
    const configMap: Record<string, string | null> = {};
    settings.forEach(s => {
      configMap[s.setting_key] = s.setting_value;
    });

    return NextResponse.json({ success: true, data: configMap });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
