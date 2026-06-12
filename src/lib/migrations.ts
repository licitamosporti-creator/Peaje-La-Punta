import { Knex } from 'knex';

export async function runMigrations(knex: Knex): Promise<void> {
  const hasTable = async (name: string) => knex.schema.hasTable(name);

  // 1. STATIONS
  if (!(await hasTable('stations'))) {
    await knex.schema.createTable('stations', (table) => {
      table.string('id', 36).primary();
      table.string('name').unique().notNullable();
      table.string('panel_name').nullable();
      table.timestamps(true, true);
    });
  } else {
    // Migration: add panel_name if it doesn't exist
    const hasPanelName = await knex.schema.hasColumn('stations', 'panel_name');
    if (!hasPanelName) {
      await knex.schema.alterTable('stations', table => {
        table.string('panel_name').nullable();
      });
    }
  }

  // 2. USERS
  if (!(await hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
      table.string('id', 36).primary();
      table.string('username').unique().notNullable();
      table.string('password_hash').notNullable();
      table.string('role').notNullable(); // ADMIN, OPERADOR, INTERVENTOR
      table.string('name').notNullable();
      table.timestamps(true, true);
    });
  }

  // 3. IMPORTS LOG
  if (!(await hasTable('imports'))) {
    await knex.schema.createTable('imports', (table) => {
      table.string('id', 36).primary();
      table.string('filename').notNullable();
      table.string('imported_by', 36).references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('imported_at').defaultTo(knex.fn.now());
      table.integer('rows_imported').defaultTo(0);
      table.string('status').notNullable(); // SUCCESS, FAILED
      table.text('errors');
      table.text('snapshot'); // JSON stringified snapshot of raw file info
    });
  }

  // 4. DAILY TRAFFIC (MATRIZ)
  if (!(await hasTable('daily_traffic'))) {
    await knex.schema.createTable('daily_traffic', (table) => {
      table.string('id', 36).primary();
      table.string('station_id', 36).references('id').inTable('stations').onDelete('CASCADE').notNullable();
      table.date('date').notNullable();
      table.string('weekday', 15).notNullable();
      table.string('category', 10).notNullable(); // Cat I, Cat II, etc.
      table.string('bucket', 20).notNullable(); // NORMAL, ESPECIAL, EVASOR, ESPECIAL_EXENTO, EXENTO
      table.string('payment_method', 20).notNullable(); // EFECTIVO, ELECTRONICO, IPREV_COLPASS
      table.integer('quantity').notNullable().defaultTo(0);
      
      table.unique(['station_id', 'date', 'category', 'bucket', 'payment_method']);
      table.index(['station_id', 'date']);
    });
  }

  // 5. DAILY REVENUE (MATRIZ)
  if (!(await hasTable('daily_revenue'))) {
    await knex.schema.createTable('daily_revenue', (table) => {
      table.string('id', 36).primary();
      table.string('station_id', 36).references('id').inTable('stations').onDelete('CASCADE').notNullable();
      table.date('date').notNullable();
      table.string('category', 10).notNullable(); // Cat I, Cat II, Cat III, Cat IV
      table.bigInteger('amount').notNullable().defaultTo(0);

      table.unique(['station_id', 'date', 'category']);
      table.index(['station_id', 'date']);
    });
  }

  // 6. DAILY ADJUSTMENTS (MATRIZ)
  if (!(await hasTable('daily_adjustments'))) {
    await knex.schema.createTable('daily_adjustments', (table) => {
      table.string('id', 36).primary();
      table.string('station_id', 36).references('id').inTable('stations').onDelete('CASCADE').notNullable();
      table.date('date').notNullable();
      table.string('adjustment_type', 30).notNullable(); // SOBRANTE, SOBRANTE_EQUIPO, AJUSTE_DATAFONO
      table.bigInteger('amount').notNullable().defaultTo(0);

      table.unique(['station_id', 'date', 'adjustment_type']);
      table.index(['station_id', 'date']);
    });
  }

  // 7. DAILY PAYMENTS SUMMARY (MATRIZ)
  if (!(await hasTable('daily_payments_summary'))) {
    await knex.schema.createTable('daily_payments_summary', (table) => {
      table.string('id', 36).primary();
      table.string('station_id', 36).references('id').inTable('stations').onDelete('CASCADE').notNullable();
      table.date('date').notNullable();
      table.string('payment_method', 25).notNullable(); // EFECTIVO, ELECTRONICO, IPREV_COLPASS
      table.bigInteger('amount').notNullable().defaultTo(0);

      table.unique(['station_id', 'date', 'payment_method']);
      table.index(['station_id', 'date']);
    });
  }

  // 8. TICKET DETAILS (DETALLE MENSUAL)
  if (!(await hasTable('ticket_details'))) {
    await knex.schema.createTable('ticket_details', (table) => {
      table.string('id', 36).primary();
      table.string('station_id', 36).references('id').inTable('stations').onDelete('CASCADE').notNullable();
      table.date('date').notNullable();
      table.string('caja', 20).notNullable(); // Caja 1, Caja 2
      table.string('ticket_category', 20).notNullable(); // Cat I, Cat I E, etc.
      table.bigInteger('tariff').notNullable();
      table.string('ticket_start', 30).notNullable();
      table.string('ticket_end', 30).notNullable();
      table.integer('quantity').notNullable();
      table.bigInteger('amount').notNullable();

      table.index(['station_id', 'date']);
    });
  }

  // 9. SUPPORT STAFF (PERSONAL)
  if (!(await hasTable('support_staff'))) {
    await knex.schema.createTable('support_staff', (table) => {
      table.string('id', 36).primary();
      table.string('station_id', 36).references('id').inTable('stations').onDelete('CASCADE').notNullable();
      table.date('date').notNullable();
      table.string('role', 50).notNullable(); // e.g. "Controlador de Trafico"
      table.string('name').nullable(); // Name can be null
      table.string('start_time', 10).nullable(); // "08:00"
      table.string('end_time', 10).nullable(); // "17:00"
      table.decimal('total_hours', 5, 2).notNullable();

      table.index(['station_id', 'date']);
    });
  }

  // 10. HOURLY TRAFFIC (TRAFICO MES2)
  if (!(await hasTable('hourly_traffic'))) {
    await knex.schema.createTable('hourly_traffic', (table) => {
      table.string('id', 36).primary();
      table.string('station_id', 36).references('id').inTable('stations').onDelete('CASCADE').notNullable();
      table.date('date').notNullable();
      table.string('category', 10).notNullable(); // Cat I, Cat II, etc.
      table.integer('hour').notNullable(); // 0 to 23
      table.integer('quantity').notNullable().defaultTo(0);

      table.unique(['station_id', 'date', 'category', 'hour']);
      table.index(['station_id', 'date']);
    });
  }

  // 11. NOVEDADES
  if (!(await hasTable('novedades'))) {
    await knex.schema.createTable('novedades', (table) => {
      table.string('id', 36).primary();
      table.string('station_id', 36).references('id').inTable('stations').onDelete('CASCADE').notNullable();
      table.string('type', 30).notNullable(); // OPERATIVO, TECNICO, SEGURIDAD, etc.
      table.string('severity', 20).notNullable(); // BAJA, MEDIA, ALTA, CRITICA
      table.string('status', 20).notNullable(); // ABIERTO, EN_PROCESO, CERRADO
      table.string('lane_box', 30).nullable(); // Carril/Caja
      table.text('description').notNullable();
      table.string('impact', 20).notNullable(); // TRANSITO, RECAUDO, AMBOS
      table.text('evidences'); // Path or names separated by commas
      table.text('root_cause'); // Must be set to close
      table.text('actions'); // Action items
      table.timestamp('start_time').notNullable();
      table.timestamp('end_time').nullable();
      table.boolean('is_public').defaultTo(false);
      table.string('created_by', 36).references('id').inTable('users').onDelete('SET NULL');
      table.string('closed_by', 36).references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index(['station_id', 'start_time']);
    });
  }

  // 12. AUDIT LOG
  if (!(await hasTable('audit_log'))) {
    await knex.schema.createTable('audit_log', (table) => {
      table.string('id', 36).primary();
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.string('user_id', 36).references('id').inTable('users').onDelete('SET NULL');
      table.string('action').notNullable(); // IMPORT, NOVEDAD_EDIT, NOVEDAD_CLOSE, etc.
      table.string('entity_type').notNullable(); // e.g. "imports", "novedades", "daily_adjustments"
      table.string('entity_id', 36).nullable();
      table.text('details'); // JSON string representation
    });
  }

  // 13. EXPORT LOG
  if (!(await hasTable('export_log'))) {
    await knex.schema.createTable('export_log', (table) => {
      table.string('id', 36).primary();
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.string('user_id', 36).references('id').inTable('users').onDelete('SET NULL').notNullable();
      table.string('report_type').notNullable(); // DIARIO, SEMANAL, MENSUAL
      table.string('format').notNullable(); // PDF, CSV
      table.text('filters'); // JSON string representation of filters applied
    });
  }

  // 12. PUBLIC BANNERS
  if (!(await hasTable('public_banners'))) {
    await knex.schema.createTable('public_banners', (table) => {
      table.string('id', 36).primary();
      table.string('text', 255).notNullable();
      table.boolean('is_active').defaultTo(true);
      table.integer('order_index').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // 14. DOCUMENTS
  if (!(await hasTable('documents'))) {
    await knex.schema.createTable('documents', (table) => {
      table.string('id', 36).primary();
      table.string('station_id', 36).references('id').inTable('stations').onDelete('CASCADE').notNullable();
      table.string('title').notNullable();
      table.string('category').notNullable(); // Resoluciones, Certificaciones, Tarifas, Otros
      table.string('file_path').notNullable();
      table.integer('file_size').notNullable();
      table.string('uploaded_by', 36).references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['station_id', 'category']);
    });
  }

  // 15. GLOBAL SETTINGS
  if (!(await hasTable('global_settings'))) {
    await knex.schema.createTable('global_settings', (table) => {
      table.string('id', 36).primary();
      table.string('setting_key').unique().notNullable();
      table.text('setting_value').nullable();
      table.string('label').notNullable();
      table.string('description').nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }
}
