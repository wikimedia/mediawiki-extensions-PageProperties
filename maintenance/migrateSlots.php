<?php

/**
 * This file is part of the MediaWiki extension PageProperties.
 *
 * PageProperties is free software: you can redistribute it and/or modify
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
 * @copyright Copyright ©2024, https://wikisphere.org
 */

$IP = getenv( 'MW_INSTALL_PATH' );
if ( $IP === false ) {
	$IP = __DIR__ . '/../../..';
}
require_once "$IP/maintenance/Maintenance.php";

use MediaWiki\Extension\PageProperties\Aliases\Title as TitleClass;

class MigrateSlots extends Maintenance {

	/** @var \Wikimedia\Rdbms\DBConnRef|\Wikimedia\Rdbms\IDatabase|\Wikimedia\Rdbms\IReadableDatabase */
	private $db;

	/** @var User */
	private $user;

	/** @var bool */
	private $removeSlot = false;

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'migrate slots' );
		$this->requireExtension( 'PageProperties' );

		// name,  description, required = false,
		//	withArg = false, shortName = false, multiOccurrence = false
		//	$this->addOption( 'format', 'import format (csv or json)', true, true );

		$this->addOption( 'remove-slot', 'remove pageproperties slot', false, false );
	}

	/**
	 * inheritDoc
	 */
	public function execute() {
		$this->removeSlot = (bool)$this->getOption( 'remove-slot' ) ?? false;
		$this->user = User::newSystemUser( 'Maintenance script', [ 'steal' => true ] );
		$this->db = \PageProperties::getDB( DB_PRIMARY );

		$this->processArticles();
	}

	private function processArticles() {
		$maxByPageId = $this->getMaxPageId();
		$context = RequestContext::getMain();

		for ( $i = 0; $i <= $maxByPageId; $i++ ) {
			$title = TitleClass::newFromID( $i );

			if ( !$title || !$title->isKnown() ) {
				continue;
			}

			echo "processing $i/$maxByPageId" . PHP_EOL;

			// foreach ( $this->excludePrefix as $prefix ) {
			// 	if ( strpos( $title->getFullText(), $prefix ) === 0 ) {
			// 		continue 2;
			// 	}
			// }

			$wikiPage = \PageProperties::getWikiPage( $title );

			if ( !$wikiPage ) {
				continue;
			}

			$context->setTitle( $title );
			$revisionRecord = $wikiPage->getRevisionRecord();

			$this->handlePagePropertiesSlot( $wikiPage, $revisionRecord );
		}
	}

	/**
	 * @param WikiPage $wikiPage
	 * @param RevisionRecord &$revisionRecord
	 */
	private function handlePagePropertiesSlot( $wikiPage, &$revisionRecord ) {
		$slots = $revisionRecord->getSlots()->getSlots();

		if ( !array_key_exists( 'pageproperties', $slots ) ) {
			return;
		}

		$title = $wikiPage->getTitle();
		echo $title->getFullText() . PHP_EOL;
		echo 'migrating slot pageproperties to table' . PHP_EOL;

		$slotContent = $slots['pageproperties']->getContent();
		$contents = $slotContent->getNativeData();
		$contents = json_decode( $contents, true );

		$pageProperties = [
			'display_title' => null,
			'language' => null,
			'meta' => null,
			'meta_subpages' => null,
			// $mainPage->getPrefixedText() == $this->title->getPrefixedText(),
			'meta_entire_site' => false
		];

		if ( !empty( $contents['page-properties']['display-title'] ) ) {
			$pageProperties['display_title'] = $contents['page-properties']['display-title'];
		}
		if ( !empty( $contents['page-properties']['language'] ) ) {
			$pageProperties['language'] = $contents['page-properties']['language'];
		}
		if ( !empty( $contents['SEO']['meta'] ) ) {
			$pageProperties['meta'] = $contents['SEO']['meta'];
		}
		if ( !empty( $contents['SEO']['subpages'] ) ) {
			$pageProperties['meta_subpages'] = $contents['SEO']['subpages'];
		}
		if ( !empty( $contents['SEO']['entire-site'] ) ) {
			$pageProperties['meta_entire_site'] = $contents['SEO']['entire-site'];
		}

		$errors = [];
		\PageProperties::setPageProperties( $title, $pageProperties, $errors );

		if ( !$this->removeSlot ) {
			return;
		}

		$pageUpdater = $wikiPage->newPageUpdater( $this->user );
		$pageUpdater->removeSlot( 'pageproperties' );

		$summary = "PageProperties migrate slots";
		$flags = EDIT_INTERNAL;
		$comment = CommentStoreComment::newUnsavedComment( $summary );
		$RevisionRecord = $pageUpdater->saveRevision( $comment, $flags );
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

}

$maintClass = MigrateSlots::class;
require_once RUN_MAINTENANCE_IF_MAIN;
