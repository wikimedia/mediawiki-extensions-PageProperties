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

class JsonResultPrinter extends ResultPrinter {

	public function isHtml() {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function getResults() {
		$results = $this->queryProcessor->getResultsTree();
		return $this->processResults( $results, $this->schema );
	}

	public function processResults( $results, $schema ) {
		$this->output->addModuleStyles( [ 'mediawiki.content.json' ] );

		$ret = [];
		foreach ( $results as $value ) {
			list( $title_, $row ) = $value;
			$ret[] = [
				$this->params['pagetitle-name'] => $title_->getText(),
				'data' => $row
			];
		}

		// print_r($ret);

		$content = new \JsonContent( '' );
		return $content->rootValueTable( json_decode( json_encode( $ret ), false ) );
	}
}
