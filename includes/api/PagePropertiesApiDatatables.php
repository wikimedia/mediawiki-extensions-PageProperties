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

use MediaWiki\Extension\PageProperties\QueryProcessor as QueryProcessor;
use MediaWiki\Extension\PageProperties\ResultPrinters\QueryResultPrinter as QueryResultPrinter;

class PagePropertiesApiDatatables extends ApiBase {

	/** @var output */
	private $output;

	/** @var parser */
	private $parser;

	/**
	 * @inheritDoc
	 */
	public function isWriteMode() {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function mustBePosted(): bool {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function execute() {
		$user = $this->getUser();

		\PageProperties::initialize();
		$result = $this->getResult();
		$params = $this->extractRequestParams();
		$output = $this->getContext()->getOutput();

		$this->output = $output;
		$data = json_decode( $params['data'], true );

		// @see https://datatables.net/reference/option/ajax
		$datatableData = $data['datatableData'];
		// $settings = $data['settings'];
		$tableData = $data['tableData'];
		$params_ = $tableData['querydata']['params'];
		$query = $tableData['querydata']['query'];
		$printouts = $tableData['querydata']['printouts'];
		$cacheKey = $tableData['querydata']['cachekey'];

		$tableData['defer-each'] = 100;

		if ( empty( $datatableData['length'] ) ) {
			$datatableData['length'] = $tableData['defer-each'];
		}

		$this->parser = $parser;

		// add/set specific parameters for this call
		$params_ = array_merge(
			$params_,
			[
				// @see https://datatables.net/manual/server-side
				// array length will be sliced client side if greater
				// than the required datatables length
				"limit" => max( $datatableData['length'], $tableData['defer-each'] ),
				"offset" => $datatableData['start'],

				// @TODO
				// "order" => $datatableData['order'],

			]
		);

		$templates = [];
		$queryProcessor = new QueryProcessor( $query, $printouts, $params_ );
		$resultsPrinter = new QueryResultPrinter( $parser, $output, $queryProcessor, $schema, $templates, $params_, $printouts );
		$results = $resultsPrinter->getResults();

		$rows = [];
		foreach ( $results as $row ) {
			$rows[] = array_values( $row );
		}

		// @see https://datatables.net/extensions/scroller/examples/initialisation/server-side_processing.html
		$ret = [
			'draw' => $datatableData['draw'],
			'data' => $rows,
			'recordsTotal' => $tableData['count'],
			'recordsFiltered' => $tableData['count'],
			'cacheKey' => $cacheKey,
			'datalength' => $datatableData['length']
		];

		$result->addValue( [ $this->getModuleName() ], 'result', json_encode( $ret ) );
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'data' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			],
		];
	}

	/**
	 * @inheritDoc
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * @inheritDoc
	 */
	protected function getExamples() {
		return false;
	}
}
