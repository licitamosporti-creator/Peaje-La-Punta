import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Inicie sesión para acceder a este recurso' },
        { status: 401 }
      );
    }

    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No se encontró el archivo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Instead of saving to disk, convert to base64 Data URL
    // since Netlify filesystem is ephemeral/read-only
    const mimeType = file.type || 'application/octet-stream';
    const base64String = `data:${mimeType};base64,${buffer.toString('base64')}`;

    return NextResponse.json({ success: true, url: base64String });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
