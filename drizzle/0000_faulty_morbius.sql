CREATE TABLE `public_searches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_key` text NOT NULL,
	`product` text NOT NULL,
	`search_count` integer DEFAULT 1 NOT NULL,
	`first_searched_at` text NOT NULL,
	`last_searched_at` text NOT NULL,
	CONSTRAINT "public_searches_product_length" CHECK(length("public_searches"."product") BETWEEN 2 AND 120),
	CONSTRAINT "public_searches_positive_count" CHECK("public_searches"."search_count" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `public_searches_product_key` ON `public_searches` (`product_key`);--> statement-breakpoint
CREATE INDEX `public_searches_recent` ON `public_searches` (`last_searched_at`,`id`);