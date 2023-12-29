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

namespace MediaWiki\Extension\PageProperties\ResultPrinters;

use Linker;
use MediaWiki\Extension\PageProperties\ResultPrinter as ResultPrinter;
use MediaWiki\Extension\PageProperties\Utils\HtmlTable as HtmlTable;

class TableResultPrinter extends ResultPrinter {

	/** @var HtmlTable */
	protected $htmlTable;

	/** @var headers */
	protected $headers = [];

	/**
	 * @inheritDoc
	 */
	public function isHtml() {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function processRow( $title, $value ) {
		$this->htmlTable->row();
		$this->headers['_'] = $this->params['pagetitle-name'];
		$formatted = Linker::link( $title, $title->getText() );
		$this->htmlTable->cell( $formatted );

		$path = '';
		$pathNoIndex = '';
		return $this->processSchemaRec( $title, $this->schema, $value, $path, $pathNoIndex );
	}

	/**
	 * @inheritDoc
	 */
	public function processChild( $schema, $key, $properties, $path ) {
		$value = parent::processChild( $schema, $key, $properties, $path );

		// retrieve label
		if ( array_key_exists( 'title', $schema )
			&& !empty( $schema['title'] ) ) {
			$key = $schema['title'];
		}

		$this->headers[$path] = $key;

		$value = $this->parser->recursiveTagParseFully( $value );
		$this->htmlTable->cell( $value );

		return $value;
	}

	/**
	 * @inheritDoc
	 */
	public function getResults() {
		$this->htmlTable = new htmlTable();
		$results = $this->queryProcessor->getResults();
		return $this->processResults( $results, $this->schema );
	}

	/**
	 * @inheritDoc
	 */
	public function processRoot( $row ) {
		$attributes = [];
		foreach ( $this->headers as $header ) {
			$this->htmlTable->header( $header, $attributes );
		}

		$tableAttrs = [];
		$tableAttrs['width'] = '100%';
		$tableAttrs['class'] = ' wikitable display dataTable';

		return $this->htmlTable->table(
			$tableAttrs
		);
	}

}
