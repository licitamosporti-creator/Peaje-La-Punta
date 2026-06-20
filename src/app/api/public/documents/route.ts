import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const db = await getDb();
    
    // Default to first station
    const station = await db('stations').first();
    if (!station) return NextResponse.json({ error: 'Station not found' }, { status: 404 });

    const documents = await db('documents')
      .where({ station_id: station.id })
      .orderBy('created_at', 'desc');

    // Remove internal info like uploaded_by before sending public response
    const publicDocs = documents.map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      file_path: doc.file_path,
      file_size: doc.file_size,
      created_at: doc.created_at
    }));

    return NextResponse.json({ documents: publicDocs });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
