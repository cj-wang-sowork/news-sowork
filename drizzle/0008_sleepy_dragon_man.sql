ALTER TABLE `users` MODIFY COLUMN `authMethod` enum('password','oauth','google') DEFAULT 'password';--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;