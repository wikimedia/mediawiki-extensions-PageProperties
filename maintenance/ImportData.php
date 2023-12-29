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

use MediaWiki\Extension\PageProperties\Importer as Importer;

$IP = getenv( 'MW_INSTALL_PATH' );
if ( $IP === false ) {
	$IP = __DIR__ . '/../../..';
}
require_once "$IP/maintenance/Maintenance.php";

if ( is_readable( __DIR__ . '/../vendor/autoload.php' ) ) {
	include_once __DIR__ . '/../vendor/autoload.php';
}

class ImportData extends Maintenance {
	/** @var error_messages */
	private $error_messages = [];

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'import json data' );
		$this->requireExtension( 'PageProperties' );

		// name,  description, required = false,
		//	withArg = false, shortName = false, multiOccurrence = false
		//	$this->addOption( 'format', 'import format (csv or json)', true, true );
		$this->addOption( 'file', 'filename (complete path)', true, true );
		$this->addOption( 'schema', 'schema registered on the wiki', false, true );
		$this->addOption( 'pagename-formula', 'pagename formula', false, true );
		$this->addOption( 'main-slot', 'whether to save to main slot', false, false );
		$this->addOption( 'limit', 'limit pages to be imported', false, true );
	}

	/**
	 * inheritDoc
	 * @return string|void
	 */
	public function execute() {
		$path = $this->getOption( 'file' ) ?? null;
		$schemaName = $this->getOption( 'schema' ) ?? null;
		$pagenameFormula = $this->getOption( 'pagename-formula' ) ?? null;
		$mainSlot = $this->getOption( 'main-slot' ) ?? false;
		$limit = $this->getOption( 'limit' ) ?? false;

		$limit = ( $limit === false ? INF : (int)$limit );
		$contents = file_get_contents( $path );

		if ( !$contents ) {
			return 'no contents';
		}

		if ( empty( $schemaName ) ) {
			return 'no schema';
		}

		$data = json_decode( $contents, true );

		if ( !$data ) {
			return 'invalid json';
		}

		$context = new RequestContext();
		$context->setTitle( Title::makeTitle( NS_MAIN, '' ) );

		$user = User::newSystemUser( 'Maintenance script', [ 'steal' => true ] );

		$importer = new Importer( $user, $context, $schemaName, $mainSlot, $limit );

		$showMsg = static function ( $msg ) {
			echo $msg . PHP_EOL;
		};

		$importer->importData( $pagenameFormula, $data, $showMsg );
	}

}

$maintClass = ImportData::class;
require_once RUN_MAINTENANCE_IF_MAIN;
