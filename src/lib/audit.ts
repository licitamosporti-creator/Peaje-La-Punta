import crypto from 'crypto';
import { getDb } from './db';

export async function logAudit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: any
): Promise<void> {
  try {
    const db = await getDb();
    await db('audit_log').insert({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: typeof details === 'string' ? details : JSON.stringify(details)
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

export async function logExport(
  userId: string,
  reportType: string,
  format: string,
  filters: any
): Promise<void> {
  try {
    const db = await getDb();
    await db('export_log').insert({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      user_id: userId,
      report_type: reportType,
      format,
      filters: typeof filters === 'string' ? filters : JSON.stringify(filters)
    });
  } catch (error) {
    console.error('Failed to log export event:', error);
  }
}
