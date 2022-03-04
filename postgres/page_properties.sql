

CREATE TABLE IF NOT EXISTS page_properties (
  `page_id` int(11) NOT NULL,
  `display_title` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `language` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `properties` blob DEFAULT NULL,
  `meta` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `meta_subpages` tinyint(1) DEFAULT NULL,
  `meta_entire_site` tinyint(1) DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


ALTER TABLE page_properties
  ADD UNIQUE KEY `index_a` (`page_id`);
