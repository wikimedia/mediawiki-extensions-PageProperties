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
 * @copyright Copyright ©2023, https://wikisphere.org
 */

namespace MediaWiki\Extension\PageProperties;

use MediaWiki\Extension\PageProperties\DatabaseManager as DatabaseManager;
use MediaWiki\Extension\PageProperties\SchemaProcessor as SchemaProcessor;
use MediaWiki\Extension\PageProperties\SubmitForm as SubmitForm;
use MediaWiki\Revision\SlotRecord;
use Title;

class Importer {

	/** @var User */
	private $user;

	/** @var string */
	private $schemaName;

	/** @var array */
	private $schema;

	/** @var Context */
	private $context;

	/** @var bool|int */
	private $limit = false;

	/** @var Importer|Importer1_35 */
	private $importer;

	/** @var bool */
	private $mainSlot = false;

	/** @var callback */
	private $showMsg;

	/**
	 * @param User $user
	 * @param Context $context
	 * @param string $schemaName
	 * @param bool|null $mainSlot false
	 * @param bool|null $limit false
	 */
	public function __construct( $user, $context, $schemaName, $mainSlot = false, $limit = false ) {
		$this->user = $user;
		$this->context = $context;
		$this->schemaName = $schemaName;
		$this->mainSlot = $mainSlot;
		$this->limit = $limit;
	}

	/**
	 * @param string $pagenameFormula
	 * @param array $data
	 * @param function $showMsg
	 * @return bool
	 */
	public function importData( $pagenameFormula, $data, $showMsg ) {
		if ( empty( $pagenameFormula ) ) {
			$showMsg( 'no pagename formula' );
			return false;
		}

		$this->showMsg = $showMsg;

		$schema = \PageProperties::getSchema( $this->context->getOutput(), $this->schemaName );

		if ( !$schema ) {
			$showMsg( 'generating schema' );
			if ( !$this->createSchema( $this->schemaName, $data ) ) {
				$showMsg( "couldn't save schema" );
				return false;
			}
		} else {
			$this->schema = $schema;
		}

		if ( !\PageProperties::isList( $data ) ) {
			$data = [ $data ];
		}

		$databaseManager = new DatabaseManager();
		$submitForm = new SubmitForm( $this->user, $this->context );
		$this->importer = \PageProperties::getImporter();

		$n = 0;
		foreach ( $data as $key => $value ) {
			$flatten = $databaseManager->prepareData( $schema, $value );
			$titleText = $submitForm->replacePageNameFormula( $flatten, $pagenameFormula, $properties );

			$title_ = Title::newFromText( $titleText );
			if ( !$title_->canExist() ) {
				$showMsg( 'wrong title ' . $titleText );
				continue;
			}

			$pagename = $this->createArticle( $title_, $value );
			$showMsg( 'saving article: ' . $pagename );
			$entries = $databaseManager->recordProperties( 'ImportData', $title_, $flatten, $errors );

			$showMsg( "$entries entries created for article $pagename" );
			$n++;
			if ( $this->limit !== false && $n === $this->limit ) {
				break;
			}
		}
		return true;
	}

	/**
	 * @param Title $title
	 * @param array $data
	 * @return string
	 */
	public function createArticle( $title, $data ) {
		$obj = [
			'schemas' => [
				$this->schemaName => $data
			]
		];

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
			$this->showMsg( "error: $pagename " . $e->getMessage() );
		}

		return $pagename;
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

}
