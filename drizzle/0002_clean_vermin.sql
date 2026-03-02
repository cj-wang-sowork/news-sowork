CREATE TABLE `point_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`type` enum('view_reward','ai_usage','welcome','admin') NOT NULL,
	`topicId` int,
	`note` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `point_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `topic_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topicId` int NOT NULL,
	`viewerId` int,
	`viewerIp` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topic_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `topics` ADD `creatorId` int;--> statement-breakpoint
ALTER TABLE `topics` ADD `visibility` enum('public','private') DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `topics` ADD `viewCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `points` int DEFAULT 100 NOT NULL;