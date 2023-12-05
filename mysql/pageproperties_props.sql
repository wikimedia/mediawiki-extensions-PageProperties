--
-- Table structure
--

CREATE TABLE IF NOT EXISTS /*_*/pageproperties_props (
	`id` int(11) NOT NULL,
	`schema_id` int(11) NOT NULL,
	`table_id` int(11) NOT NULL,
	`path` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`path_parent` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`path_no_index` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`updated_at` datetime NOT NULL,
	`created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Indexes
--
ALTER TABLE /*_*/pageproperties_props
	ADD PRIMARY KEY (`id`);
	

ALTER TABLE /*_*/pageproperties_props
	ADD INDEX `schema_id` (`schema_id`);
	
ALTER TABLE /*_*/pageproperties_props
	ADD INDEX `table_id` (`table_id`);
	
ALTER TABLE /*_*/pageproperties_props
	ADD INDEX `path_parent` (`path_parent` (255));
	
ALTER TABLE /*_*/pageproperties_props
	ADD INDEX `path_no_index` (`path_no_index` (255));
	

--
-- AUTO_INCREMENT
--
ALTER TABLE /*_*/pageproperties_props
	MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

