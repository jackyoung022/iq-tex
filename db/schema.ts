import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Public product statistics only. Customer settings and identities never enter D1.
export const publicSearches = sqliteTable('public_searches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productKey: text('product_key').notNull(),
  product: text('product').notNull(),
  searchCount: integer('search_count').notNull().default(1),
  firstSearchedAt: text('first_searched_at').notNull(),
  lastSearchedAt: text('last_searched_at').notNull(),
}, table => [
  uniqueIndex('public_searches_product_key').on(table.productKey),
  index('public_searches_recent').on(table.lastSearchedAt, table.id),
  check('public_searches_product_length', sql`length(${table.product}) BETWEEN 2 AND 120`),
  check('public_searches_positive_count', sql`${table.searchCount} >= 1`),
]);
