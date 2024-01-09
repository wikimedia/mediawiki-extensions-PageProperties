<?php

/**
 * This file is part of the MediaWiki extension PageProperties.
 *
 * ContactManager is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * PageProperties is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with PageProperties.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @file
 * @ingroup extensions
 * @author thomas-topway-it <support@topway.it>
 * @copyright Copyright ©2023, https://wikisphere.org
 */

use MediaWiki\Extension\PageProperties\DatabaseManager as DatabaseManager;
use MediaWiki\Extension\PageProperties\ReplaceText\Search as Search;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\SlotRecord;

$IP = getenv( 'MW_INSTALL_PATH' );
if ( $IP === false ) {
	$IP = __DIR__ . '/../../..';
}
require_once "$IP/maintenance/Maintenance.php";

if ( is_readable( __DIR__ . '/../vendor/autoload.php' ) ) {
	include_once __DIR__ . '/../vendor/autoload.php';
}

include_once __DIR__ . '/ReplaceText/Search.php';

class RebuildData extends Maintenance {
	/** @var User */
	private $user;

	/** @var int */
	private $limit;

	/** @var services */
	private $services;

	/** @var string */
	private $excludePrefix;

	/** @var array */
	private $excludeSchemas;

	/** @var array */
	private $onlySchemas;

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'rebuild data' );
		$this->requireExtension( 'PageProperties' );

		// name,  description, required = false,
		//	withArg = false, shortName = false, multiOccurrence = false
		//	$this->addOption( 'format', 'import format (csv or json)', true, true );

		$this->addOption( 'limit', 'limit', false, true );
		$this->addOption( 'exclude-prefix', 'exclude prefix', false, true );
		$this->addOption( 'exclude-schemas', 'exclude schemas', false, true );
		$this->addOption( 'only-schemas', 'only schemas', false, true );
	}

	/**
	 * inheritDoc
	 */
	public function execute() {
		$limit = $this->getOption( 'limit' ) ?? false;
		$this->excludePrefix = $this->getOption( 'exclude-prefix' ) ?? '';
		$this->excludeSchemas = $this->getOption( 'exclude-schemas' ) ?? '';
		$this->onlySchemas = $this->getOption( 'only-schemas' ) ?? '';

		$this->excludePrefix = preg_split( '/\s*,\s*/', $this->excludePrefix, -1, PREG_SPLIT_NO_EMPTY );
		$this->excludeSchemas = preg_split( '/\s*,\s*/', $this->excludeSchemas, -1, PREG_SPLIT_NO_EMPTY );
		$this->onlySchemas = preg_split( '/\s*,\s*/', $this->onlySchemas, -1, PREG_SPLIT_NO_EMPTY );

		$this->services = MediaWikiServices::getInstance();
		$this->db = wfGetDB( DB_MASTER );
		$this->user = User::newSystemUser( 'Maintenance script', [ 'steal' => true ] );

		$this->dropTables();
		$this->createTables();
		$this->rebuildData();
		$this->rebuildLinks();
	}

	private function rebuildLinks() {
		$search = '#pageproperties(form|print|query)';
		$selected_namespaces = null;
		$category = null;
		$prefix = null;
		$use_regex = true;

		$res = Search::doSearchQuery(
			$search,
			$selected_namespaces,
			$category,
			$prefix,
			$use_regex
		);

		foreach ( $res as $row ) {
			$title = Title::makeTitleSafe( $row->page_namespace, $row->page_title );
			if ( $title == null ) {
				continue;
			}

			foreach ( $this->excludePrefix as $prefix ) {
				if ( strpos( $title->getFullText(), $prefix ) === 0 ) {
					continue 2;
				}
			}

			$wikiPage = \PageProperties::getWikiPage( $title );

			if ( !$wikiPage ) {
				continue;
			}

			$wikiPage->doPurge();
			$context = RequestContext::getMain();
			$context->setTitle( $title );

			echo 'rebuilding links of ' . $title->getText() . PHP_EOL;

			// @ATTENTION required to execute
			// onOutputPageParserOutput, alternatively use
			// addParserOutputMetadata @see McrUndoAction

			try {
				$article = new Article( $title );
				$article->render();
			} catch ( Exception $e ) {
				echo $e->getMessage() . PHP_EOL;
			}
		}
	}

	private function rebuildData() {
		$maxByPageId = $this->getMaxPageId();

		for ( $i = 0; $i <= $maxByPageId; $i++ ) {
			$title = Title::newFromID( $i );

			echo "processing $i/$maxByPageId" . PHP_EOL;

			if ( !$title || !$title->isKnown() ) {
				continue;
			}

			foreach ( $this->excludePrefix as $prefix ) {
				if ( strpos( $title->getFullText(), $prefix ) === 0 ) {
					continue 2;
				}
			}

			$wikiPage = \PageProperties::getWikiPage( $title );

			if ( !$wikiPage ) {
				continue;
			}
			$revisionRecord = $wikiPage->getRevisionRecord();

			$slot = $this->getSlot( $revisionRecord );

			if ( !$slot ) {
				continue;
			}

			echo 'rebuilding data for ' . $title->getFullText() . PHP_EOL;

			$content = $slot->getContent();
			$errors = [];
			\PageProperties::rebuildArticleDataFromSlot( $title, $content, $errors );
		}
	}

	/**
	 * @return int
	 */
	private function getMaxPageId() {
		return (int)$this->db->selectField(
			'page',
			'MAX(page_id)',
			'',
			__METHOD__
		);
	}

	/**
	 * return string|void
	 */
	private function createTables() {
		$shared = false;
		$updater = DatabaseUpdater::newForDB( $this->db, $shared, $this );
		$dbType = $updater->getDB()->getType();
		$base = __DIR__;
		foreach ( DatabaseManager::$tables as $tableName ) {
			$filename = "$base/../$dbType/$tableName.sql";
			if ( file_exists( $filename ) ) {
				$this->db->sourceFile( $filename );
				echo 'creating ' . $tableName . PHP_EOL;
			}
		}
	}

	/**
	 * return string|void
	 */
	private function dropTables() {
		foreach ( DatabaseManager::$tables as $tableName ) {
			if ( $tableName === 'pageproperties_pageproperties' ) {
				continue;
			}
			echo 'dropping ' . $tableName . PHP_EOL;
			$res = $this->db->dropTable(
				$tableName
			);
		}
	}

	/**
	 * @param RevisionRecord $revisionRecord
	 * @return MediaWiki\Revision\SlotRecord
	 */
	private function getSlot( $revisionRecord ) {
		$slots = $revisionRecord->getSlots()->getSlots();

		if ( array_key_exists( SLOT_ROLE_PAGEPROPERTIES, $slots ) ) {
			return $slots[SLOT_ROLE_PAGEPROPERTIES];
		}

		// rebuild only if main slot contains json data

		try {
			$modelId = $revisionRecord->getSlot( SlotRecord::MAIN )->getContent()->getContentHandler()->getModelID();
		} catch ( Exception $e ) {
			echo $e->getMessage() . PHP_EOL;
			return null;
		}
		if ( $modelId === 'json' || $modelId === CONTENT_MODEL_PAGEPROPERTIES_JSONDATA ) {
			return $slots[SlotRecord::MAIN];

		}

		return null;
	}

}

$maintClass = RebuildData::class;
require_once RUN_MAINTENANCE_IF_MAIN;
