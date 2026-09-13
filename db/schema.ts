// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  version: integer('version').notNull().default(0),
  payload: text('payload').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const replayChunks = sqliteTable('replay_chunks', {
  code: text('code').notNull(),
  matchNo: integer('match_no').notNull(),
  roundNo: integer('round_no').notNull(),
  computeId: text('compute_id').notNull(),
  startStep: integer('start_step').notNull(),
  payload: text('payload').notNull(),
}, t => [primaryKey({columns:[t.code,t.matchNo,t.roundNo,t.computeId,t.startStep]})]);
