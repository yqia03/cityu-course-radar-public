CREATE TABLE `community_courses` (
	`code` text PRIMARY KEY NOT NULL,
	`title_en` text NOT NULL,
	`title_zh_hans` text NOT NULL,
	`title_zh_hant` text NOT NULL,
	`description_en` text NOT NULL,
	`description_zh_hans` text NOT NULL,
	`description_zh_hant` text NOT NULL,
	`department` text NOT NULL,
	`credits` text NOT NULL,
	`level` text NOT NULL,
	`source_url` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `moderation_log` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_expiry` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`visitor_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reports_review_visitor` ON `reports` (`review_id`,`visitor_id`);--> statement-breakpoint
CREATE INDEX `idx_reports_status` ON `reports` (`status`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`course_code` text NOT NULL,
	`visitor_id` text NOT NULL,
	`usefulness` integer NOT NULL,
	`interest` integer NOT NULL,
	`difficulty` integer NOT NULL,
	`comment` text NOT NULL,
	`nickname` text NOT NULL,
	`semester` text NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "ratings_range" CHECK("reviews"."usefulness" BETWEEN 1 AND 5 AND "reviews"."interest" BETWEEN 1 AND 5 AND "reviews"."difficulty" BETWEEN 1 AND 5),
	CONSTRAINT "review_status" CHECK("reviews"."status" IN ('visible','hidden'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reviews_course_visitor` ON `reviews` (`course_code`,`visitor_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_status_course` ON `reviews` (`status`,`course_code`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
