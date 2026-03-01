CREATE TABLE `news_articles` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`turningPointId` int,
	`topicId` int,
	`title` text NOT NULL,
	`titleEn` text,
	`url` varchar(1024) NOT NULL,
	`source` varchar(128) NOT NULL,
	`sourceFlag` varchar(8),
	`language` varchar(16) NOT NULL,
	`publishedAt` timestamp NOT NULL,
	`scrapedAt` timestamp NOT NULL DEFAULT (now()),
	`embeddingVector` json,
	`semanticClusterId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `news_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rss_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`nameLocal` varchar(128),
	`url` varchar(1024) NOT NULL,
	`language` varchar(16) NOT NULL,
	`country` varchar(8),
	`flag` varchar(8),
	`category` varchar(64),
	`isActive` int NOT NULL DEFAULT 1,
	`lastFetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rss_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `rss_sources_url_unique` UNIQUE(`url`)
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(128) NOT NULL,
	`query` varchar(256) NOT NULL,
	`queryEn` varchar(256),
	`totalArticles` int NOT NULL DEFAULT 0,
	`totalMedia` int NOT NULL DEFAULT 0,
	`heatLevel` enum('extreme','high','medium','low') NOT NULL DEFAULT 'medium',
	`trendDirection` enum('up','down','stable') NOT NULL DEFAULT 'stable',
	`trendPercent` int NOT NULL DEFAULT 0,
	`category` varchar(64),
	`isActive` int NOT NULL DEFAULT 1,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topics_id` PRIMARY KEY(`id`),
	CONSTRAINT `topics_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `turning_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topicId` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`titleEn` varchar(256),
	`summary` text NOT NULL,
	`summaryEn` text,
	`dateLabel` varchar(64) NOT NULL,
	`eventDate` timestamp NOT NULL,
	`articleCount` int NOT NULL DEFAULT 0,
	`mediaCount` int NOT NULL DEFAULT 0,
	`heatLevel` enum('extreme','high','medium','low') NOT NULL DEFAULT 'medium',
	`isActive` int NOT NULL DEFAULT 0,
	`semanticDrift` float,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `turning_points_id` PRIMARY KEY(`id`)
);
