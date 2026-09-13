CREATE TABLE `replay_chunks` (
	`code` text NOT NULL,
	`match_no` integer NOT NULL,
	`round_no` integer NOT NULL,
	`compute_id` text NOT NULL,
	`start_step` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`code`, `match_no`, `round_no`, `compute_id`, `start_step`)
);
