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
use MediaWiki\Extension\PageProperties\SchemaProcessor as SchemaProcessor;
use MediaWiki\Extension\PageProperties\SubmitForm as SubmitForm;
use MediaWiki\Revision\SlotRecord;

$IP = getenv( 'MW_INSTALL_PATH' );
if ( $IP === false ) {
	$IP = __DIR__ . '/../../..';
}
require_once "$IP/maintenance/Maintenance.php";

if ( is_readable( __DIR__ . '/../vendor/autoload.php' ) ) {
	include_once __DIR__ . '/../vendor/autoload.php';
}

class ImportData extends Maintenance {
	/** @var User */
	private $user;

	/** @var string */
	private $langCode;

	/** @var importer */
	private $importer;

	/** @var error_messages */
	private $error_messages = [];

	/** @var schema */
	private $schema;

	/** @var output */
	private $output;

	/** @var context */
	private $context;

	/** @var schemaName */
	private $schemaName;

	/** @var mainSlot */
	private $mainSlot;

	/** @var limit */
	private $limit;

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
		$this->addOption( 'target-page', 'target-page', false, true );
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
		$targetPage = $this->getOption( 'pagename-formula' ) ?? null;
		$mainSlot = $this->getOption( 'main-slot' ) ?? false;
		$limit = $this->getOption( 'limit' ) ?? false;

		$this->limit = ( $limit === false ? INF : (int)$limit );

		$contents = file_get_contents( $path );

		if ( !$contents ) {
			return 'no contents';
		}

		if ( empty( $schemaName ) ) {
			return 'no schema';
		}

		$this->schemaName = $schemaName;

		$data = json_decode( $contents, true );

		if ( !$data ) {
			return 'invalid json';
		}

		$context = new RequestContext();
		$this->context = $context;
		$context->setTitle( Title::makeTitle( NS_MAIN, '' ) );
		$this->output = $context->getOutput();
		$this->mainSlot = $mainSlot;

		$this->user = User::newSystemUser( 'Maintenance script', [ 'steal' => true ] );
		$this->importer = \PageProperties::getImporter();
		$schema = \PageProperties::getSchema( $this->output, $schemaName );

		if ( !$schema ) {
			echo 'generating schema' . PHP_EOL;
			if ( !$this->createSchema( $schemaName, $data ) ) {
				return 'schema not saved';
			}
		} else {
			$this->schema = $schema;
		}

		if ( \PageProperties::isList( $data ) ) {
			$this->handleList( $pagenameFormula, $data );
			return;
		}

		$this->handleObject( $targetPage, $data );
	}

	/**
	 * @param string $pagenameFormula
	 * @param array $data
	 * @return bool|void
	 */
	private function handleList( $pagenameFormula, $data ) {
		if ( empty( $pagenameFormula ) ) {
			echo 'no pagename formula' . PHP_EOL;
			return false;
		}

		$databaseManager = new DatabaseManager();
		$submitForm = new SubmitForm( $this->user, $this->context );

		$n = 0;
		foreach ( $data as $key => $value ) {
			$flatten = $databaseManager->prepareData( $this->schema, $value );
			$titleText = $submitForm->replacePageNameFormula( $flatten, $pagenameFormula, $properties );

			$title_ = Title::newFromText( $titleText );
			if ( !$title_->canExist() ) {
				echo 'wrong title ' . $titleText . PHP_EOL;
				continue;
			}

			$pagename = $this->createArticle( $title_, $value );

			echo 'saving article: ' . $pagename . "\n";

			$entries = $databaseManager->recordProperties( 'ImportData', $title_, $flatten, $errors );

			echo "$entries entries created for article $pagename" . PHP_EOL;
			$n++;
			if ( $n === $this->limit ) {
				break;
			}
		}
	}

	/**
	 * @param string $targetPage
	 * @param array $data
	 * @return bool|void
	 */
	private function handleObject( $targetPage, $data ) {
		if ( empty( $targetPage ) ) {
			echo 'no target page' . PHP_EOL;
			return false;
		}
		// @TODO ...
	}

	/**
	 * @param string $name
	 * @param array $data
	 * @return RevisionRecord|null
	 */
	private function createSchema( $name, $data ) {
		$schemaProcessor = new SchemaProcessor();
		$schemaProcessor->setOutput( $this->output );
		$schema = $schemaProcessor->generateFromData( $data, $name );
		// $recordedObj = $schemaProcessor->convertToSchema( $schema );
		$recordedObj = $schema;
		$title = Title::makeTitleSafe( NS_PAGEPROPERTIESSCHEMA, $name );
		$this->schema = $schemaProcessor->processSchema( $schema, $name );
		return \PageProperties::saveRevision( $this->user, $title, json_encode( $recordedObj ) );
	}

	/**
	 * @param Title $title
	 * @param array $data
	 * @return string
	 */
	private function createArticle( $title, $data ) {
		$obj = [
			'schemas' => [
				$this->schemaName => $data
			]
		];

		// return \PageProperties::saveRevision( $this->user, $title, json_encode( $recordedObj ) );
		$contents = [
			[
				'role' => $this->mainSlot ? SlotRecord::MAIN : SLOT_ROLE_PAGEPROPERTIES,
				'model' => CONTENT_MODEL_PAGEPROPERTIES_JSONDATA,
				'text' => json_encode( $obj, JSON_PRETTY_PRINT )
			],
		];

		if ( !$this->mainSlot ) {
			array_unshift( $contents, [
				'role' => SlotRecord::MAIN,
				'model' => 'wikitext',
				'text' => ''
			] );
		}

		$pagename = $title->getFullText();

		try {
			$this->importer->doImportSelf( $pagename, $contents );
		} catch ( Exception $e ) {
			$this->error_messages[$pagename] = $e->getMessage();
		}

		// print_r($this->error_messages);
		return $pagename;
	}
}

$maintClass = ImportData::class;
require_once RUN_MAINTENANCE_IF_MAIN;
