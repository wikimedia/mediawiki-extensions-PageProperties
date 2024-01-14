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

use MediaWiki\Extension\PageProperties\ResultPrinter as ResultPrinter;

class QueryResultPrinter extends ResultPrinter {

	/** @var rows */
	protected $rows = [];

	/** @var fields */
	protected $fields = [];

	/**
	 * @inheritDoc
	 */
	public function isHtml() {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function processRow( $title, $value ) {
		if ( count( $this->fields ) > 0 ) {
			$this->rows[] = $this->fields;
			$this->fields = [];
		}

		if ( !empty( $this->params['pagetitle'] ) ) {
			$this->fields[$this->params['pagetitle-name']] = $title->getText();
		}

		$path = '';
		$pathNoIndex = '';
		return $this->processSchemaRec( $title, $this->schema, $value, $path, $pathNoIndex );
	}

	/**
	 * @inheritDoc
	 */
	public function processChild( $schema, $key, $properties, $path ) {
		$this->fields[$path] = $properties[$key];
	}

	/**
	 * @inheritDoc
	 */
	public function getResults() {
		$results = $this->queryProcessor->getResults();
		return $this->processResults( $results, $this->schema );
	}

	/**
	 * @inheritDoc
	 */
	public function processRoot( $rows ) {
		if ( count( $this->fields ) > 0 ) {
			$this->rows[] = $this->fields;
		}
		return $this->rows;
	}

}
