--
-- Table structure
--

CREATE TABLE IF NOT EXISTS /*_*/pageproperties_schema_pages (
	`id` int(11) NOT NULL,
	`schema_id` int(11) NOT NULL,
	`page_id` int(11) NOT NULL,
	`updated_at` datetime NOT NULL,
	`created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Indexes
--
ALTER TABLE /*_*/pageproperties_schema_pages
	ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT
--
ALTER TABLE /*_*/pageproperties_schema_pages
	MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

