import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'), // Can be null for root
  name: text('name').notNull(),
  type: text('type', { enum: ['file', 'folder'] }).notNull(),
  size: integer('size').notNull().default(0),
  mimeType: text('mime_type'),
  r2Key: text('r2_key'), // Null for folders
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});
