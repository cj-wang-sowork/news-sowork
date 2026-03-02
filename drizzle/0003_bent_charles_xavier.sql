CREATE TABLE `conversation_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`pointsCost` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topicId` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`pointsUsed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topicId` int,
	`customTitle` varchar(256),
	`customQuery` varchar(256),
	`note` text,
	`isPinned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_topics_id` PRIMARY KEY(`id`)
);
