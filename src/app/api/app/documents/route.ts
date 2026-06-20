import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    
    const station = await db('stations').first();
    if (!station) return NextResponse.json({ error: 'Station not found' }, { status: 404 });

    const documents = await db('documents')
      .where({ station_id: station.id })
      .orderBy('created_at', 'desc');

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const file = formData.get('file') as File;

    if (!title || !category || !file) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = await getDb();
    const station = await db('stations').first();
    if (!station) return NextResponse.json({ error: 'Station not found' }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = path.extname(file.name || '') || '.pdf';
    const fileName = `${crypto.randomUUID()}${extension}`;
    const filePath = `/api/public/documents/download?id=`; // We will append the ID below

    const documentId = crypto.randomUUID();
    const finalPath = `${filePath}${documentId}`;

    await db('documents').insert({
      id: documentId,
      station_id: station.id,
      title,
      category,
      file_path: finalPath,
      file_size: file.size,
      file_data: buffer,
      uploaded_by: decoded.id || null,
    });

    return NextResponse.json({ success: true, document: { id: documentId, title, category, file_path: finalPath } });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });

    const db = await getDb();
    const document = await db('documents').where({ id }).first();

    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // We no longer delete from physical disk since it's in the DB
    // Just delete from DB

    await db('documents').where({ id }).del();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
