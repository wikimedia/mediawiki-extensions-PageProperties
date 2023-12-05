--
-- Table structure
--

CREATE TABLE IF NOT EXISTS /*_*/pageproperties_prop_tables (
	`id` int(11) NOT NULL,
	`schema_id` int(11) NOT NULL,
	`path_no_index` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`table_id` int(11) NOT NULL,
	`updated_at` datetime NOT NULL,
	`created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Indexes
--
ALTER TABLE /*_*/pageproperties_prop_tables
	ADD PRIMARY KEY (`id`);

--
ALTER TABLE /*_*/pageproperties_prop_tables
	ADD UNIQUE `index_1` (`schema_id`, `path_no_index` (255));

--
-- AUTO_INCREMENT
--
ALTER TABLE /*_*/pageproperties_prop_tables
	MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

