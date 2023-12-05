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

use MediaWiki\Extension\PageProperties\ResultPrinters\TableResultPrinter as TableResultPrinter;

class DatatableResultPrinter extends TableResultPrinter {

	/**
	 * @inheritDoc
	 */
	public function processRoot( $row ) {
		$attributes = [];
		foreach ( $this->headers as $header ) {
			$this->htmlTable->header( $header, $attributes );
		}

		$tableAttrs = [];
	// $tableAttrs['data-count'] = $this->queryProcessor->getCount();
		$tableAttrs['data-querydata'] = json_encode( $this->queryProcessor->getQueryData() );
		$tableAttrs['width'] = '100%';
		$tableAttrs['class'] = 'pageproperties datatable display dataTable';

		return $this->htmlTable->table(
			$tableAttrs
		);
	}

}
