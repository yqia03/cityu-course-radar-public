ALTER TABLE `reviews` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `network_hash` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `submitted_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reviews_course_content` ON `reviews` (`course_code`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_reviews_network_time` ON `reviews` (`network_hash`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_reviews_visitor_time` ON `reviews` (`visitor_id`,`submitted_at`);
