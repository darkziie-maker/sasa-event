CREATE TABLE `guests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationCode` varchar(24) NOT NULL,
	`name` varchar(180) NOT NULL,
	`department` varchar(140) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`isWinner` boolean NOT NULL DEFAULT false,
	`prizeId` int,
	`winnerAt` timestamp,
	`redeemedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guests_id` PRIMARY KEY(`id`),
	CONSTRAINT `guests_registrationCode_unique` UNIQUE(`registrationCode`)
);
--> statement-breakpoint
CREATE TABLE `prizes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`detail` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prizes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` varchar(32) NOT NULL DEFAULT 'user';