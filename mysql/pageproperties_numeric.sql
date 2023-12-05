--
-- Table structure
--

CREATE TABLE IF NOT EXISTS /*_*/pageproperties_numeric (
	`id` int(11) NOT NULL,
	`page_id` int(11) NOT NULL,
	`prop_id` int(11) NOT NULL,
	`value` NUMERIC NULL,
	`updated_at` datetime NOT NULL,
	`created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Indexes
--
ALTER TABLE /*_*/pageproperties_numeric
	ADD PRIMARY KEY (`id`);

ALTER TABLE /*_*/pageproperties_numeric
	ADD INDEX `page_id` (`page_id`);
	
ALTER TABLE /*_*/pageproperties_numeric
	ADD INDEX `prop_id` (`prop_id`);

--
-- AUTO_INCREMENT
--
ALTER TABLE /*_*/pageproperties_numeric
	MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;


