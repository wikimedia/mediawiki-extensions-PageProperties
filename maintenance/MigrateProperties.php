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
 * @author thomas-topway-it <thomas.topway.it@mail.com>
 * @copyright Copyright ©2022, https://wikisphere.org
 */

use MediaWiki\MediaWikiServices;

$IP = getenv( 'MW_INSTALL_PATH' );
if ( $IP === false ) {
	$IP = __DIR__ . '/../../..';
}
require_once "$IP/maintenance/Maintenance.php";

class MigrateProperties extends Maintenance {
	/** @var User */
	private $user;

	/** @var string */
	private $langCode;

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Migrate page properties from database to slots' );
		$this->requireExtension( 'PageProperties' );
	}

	public function execute() {
		$services = MediaWikiServices::getInstance();
		$contLang = $services->getContentLanguage();
		$this->langCode = $contLang->getCode();
		$this->user = User::newSystemUser( 'Maintenance script', [ 'steal' => true ] );

		$db = $this->getDB( DB_MASTER );

		if ( !$db->tableExists( 'page_properties' ) ) {
			$this->output( "\nNo properties to import!\n" );
			return;
		}

		$res = $db->select( 'page_properties', '*' );

		$errors = [];
		$skipped = [];
		$saved = 0;

		foreach ( $res as $row ) {
			// print_r( $row );
			$row = (array)$row;

			if ( !$row || $row == [ false ] ) {
				continue;
			}

			$title = Title::newFromID( $row['page_id'] );

			if ( !$title->isKnown() ) {
				$skipped[] = $title->getFullText();
				continue;
			}

			$page_properties = \PageProperties::getPageProperties( $title );

			if ( $page_properties !== false ) {
				$skipped[] = $title->getFullText();
				continue;
			}

			$contentSaved = $this->savePagePropertiesDB( $title, $row );

			if ( $contentSaved ) {
				$saved++;

			} else {
				$errors[] = $title->getFullText();
			}
		}

		$this->output( "\nDone!\n" );
		$this->output( "Rows migrated: {$saved}\n" );
		$this->output( "Rows skipped: " . ( count( $skipped ) ? "\n\t" . implode( "\n\t", $skipped ) : '0' ) . "\n" );
		$this->output( "Errors: " . ( count( $errors ) ? "\n\t" . implode( "\n\t", $errors ) : '0' ) . "\n" );
	}

	/**
	 * @param Title $title
	 * @param array $row
	 * @return bool|null
	 */
	private function savePagePropertiesDB( $title, $row ) {
		$page_properties = [
			'page-properties' => [
				'display-title' => $row['display_title'],
				'language' => $row['language'],
			],
			'semantic-properties' => ( empty( $row['properties'] ) ? [] : json_decode( $row['properties'], true ) ),
			'SEO' => [
				'subpages' => $row['meta_subpages'],
				'entire-site' => $row['meta_entire_site'],
				'meta' => ( empty( $row['meta'] ) ? [] : json_decode( $row['meta'], true ) ),
			]
		];

		// do more adjustements
		if ( $this->langCode === $page_properties['page-properties']['language'] ) {
			unset( $page_properties['page-properties']['language'] );
		}

		if ( $title->getText() === $page_properties['page-properties']['display-title'] ) {
			unset( $page_properties['page-properties']['display-title'] );
		}

		foreach ( $page_properties['semantic-properties'] as $key_ => $value_ ) {
			$page_properties['semantic-properties'][$key_][0] = Title::makeTitleSafe( SMW_NS_PROPERTY, $value_[0] )->getText();
		}

		// print_r($page_properties);

		$contentSaved = \PageProperties::setPageProperties( $this->user, $title, $page_properties );

		return $contentSaved;
	}

}

$maintClass = MigrateProperties::class;
require_once RUN_MAINTENANCE_IF_MAIN;
