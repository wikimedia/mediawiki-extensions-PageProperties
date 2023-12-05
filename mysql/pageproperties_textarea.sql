--
-- Table structure
--
CREATE TABLE IF NOT EXISTS /*_*/pageproperties_textarea (
	`id` int(11) NOT NULL,
	`page_id` int(11) NOT NULL,
	`prop_id` int(11) NOT NULL,
	`value` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
	`created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Indexes
--
ALTER TABLE /*_*/pageproperties_textarea
	ADD PRIMARY KEY (`id`);

ALTER TABLE /*_*/pageproperties_textarea
	ADD INDEX `page_id` (`page_id`);
	
ALTER TABLE /*_*/pageproperties_textarea
	ADD INDEX `prop_id` (`prop_id`);

--
-- AUTO_INCREMENT
--
ALTER TABLE /*_*/pageproperties_textarea
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

