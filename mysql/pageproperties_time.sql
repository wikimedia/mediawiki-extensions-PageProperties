--
-- Table structure
--
CREATE TABLE IF NOT EXISTS /*_*/pageproperties_time (
	`id` int(11) NOT NULL,
	`page_id` int(11) NOT NULL,
	`prop_id` int(11) NOT NULL,
	`value` TIME NULL,
	`created_at` datetime NOT NULL 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Indexes
--
ALTER TABLE /*_*/pageproperties_time
	ADD PRIMARY KEY (`id`);
	
	
ALTER TABLE /*_*/pageproperties_time
	ADD INDEX `page_id` (`page_id`);
	
ALTER TABLE /*_*/pageproperties_time
	ADD INDEX `prop_id` (`prop_id`);

--
-- AUTO_INCREMENT
--
ALTER TABLE /*_*/pageproperties_time
	MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

