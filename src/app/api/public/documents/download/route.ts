import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return new NextResponse('Missing document ID', { status: 400 });
    }

    const db = await getDb();
    
    // Select only file_data to reduce memory footprint unless needed
    const document = await db('documents').where('id', id).select('title', 'file_data').first();

    if (!document) {
      return new NextResponse('Document not found', { status: 404 });
    }

    if (!document.file_data) {
      return new NextResponse('File data is empty', { status: 404 });
    }

    // Determine content type (default to pdf since we assume mostly pdfs for this app)
    // Could be expanded by saving mimetype to the DB, but for now application/pdf is safe.
    let contentType = 'application/pdf';
    
    // Create a new response with the binary data
    const response = new NextResponse(document.file_data);
    response.headers.set('Content-Type', contentType);
    
    // Make sure the filename is sanitized for the Content-Disposition header
    const safeTitle = document.title ? document.title.replace(/[^a-zA-Z0-9-_\.]/g, '_') : 'documento';
    response.headers.set('Content-Disposition', `inline; filename="${safeTitle}.pdf"`);

    return response;
  } catch (error) {
    console.error('Download Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
