CREATE TABLE `topic_merge_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` enum('merge','split') NOT NULL,
	`sourceTopicId` int NOT NULL,
	`targetTopicId` int,
	`resultTopicId` int,
	`executedByUserId` int,
	`signalCount` int NOT NULL DEFAULT 0,
	`sourceTopicQuery` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topic_merge_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `topic_merge_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceTopicId` int NOT NULL,
	`targetTopicId` int NOT NULL,
	`action` enum('merge','split') NOT NULL,
	`confidence` int NOT NULL DEFAULT 3,
	`note` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topic_merge_signals_id` PRIMARY KEY(`id`)
);
