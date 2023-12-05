--
-- Table structure
--

CREATE TABLE IF NOT EXISTS /*_*/pageproperties_links (
  `id` int(11) NOT NULL,
  `page_id` int(11) NOT NULL,
  `schema_id` int(11) NOT NULL,
  `type` enum('query', 'form') NOT NULL, 
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Indexes
--
ALTER TABLE /*_*/pageproperties_links
  ADD PRIMARY KEY (`id`);
 
 
ALTER TABLE /*_*/pageproperties_links
	ADD INDEX `page_id` (`page_id`);

ALTER TABLE /*_*/pageproperties_links
	ADD INDEX `schema_id` (`schema_id`);

--
-- AUTO_INCREMENT
--
ALTER TABLE /*_*/pageproperties_links
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

