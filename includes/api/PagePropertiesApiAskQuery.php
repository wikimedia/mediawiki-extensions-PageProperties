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
use MediaWiki\MediaWikiServices;

class PagePropertiesApiAskQuery extends ApiBase {

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

		// $parser = MediaWikiServices::getInstance()->getParserFactory()->getInstance();
		$parser = MediaWikiServices::getInstance()->getParserFactory()->create();

		// *** credits WikiTeQ
		$title = RequestContext::getMain()->getTitle();
		$poptions = $output->parserOptions();

		// parsed query
		$query = $parser->preprocess( $data['query'], $title, $poptions );
		// -------------->

		$this->parser = $parser;

		// @TODO
		// set params like
		$optionsMap = [
			'order' => 'ORDER BY',
			'limit' => 'LIMIT',
			'offset' => 'OFFSET',
			// 'sort' => '',
		];
		$params_ = [
			'schema' => $data['schema']
		];
		$printouts = $data['properties'];

		$output = RequestContext::getMain()->getOutput();
		$schema = \PageProperties::getSchema( $output, $data['schema'] );

		if ( !empty( $data['options-query-formula'] ) ) {
			$defaultValue = $data['options-query-formula'];
		} else {
			$defaultValue = implode( ' - ', array_map( static function ( $value ) {
				return "<$value>";
			}, $printouts ) );
		}

		$templates = [];
		$queryProcessor = new QueryProcessor( $query, $printouts, $params_ );
		$resultsPrinter = new QueryResultPrinter( $parser, $output, $queryProcessor, $schema, $templates, $params_, $printouts );
		$results = $resultsPrinter->getResults();

		$optionsValues = [];
		foreach ( $results as $properties ) {
			$value = $this->replaceFormula( $properties, $defaultValue );
			// option value formula
			if ( !empty( $data['options-query-formula'] ) ) {
				$value = $this->parseWikitext( $value );
			}

			if ( empty( $value ) ) {
				continue;
			}

			$label = $value;

			// only available for MenuTagSearchMultiselect
			if ( !empty( $data['options-label-formula'] ) ) {
				$label = $this->parseWikitext(
					$this->replaceFormula( $proprties, $data['options-label-formula'] ) );
			}
			$optionsValues[$value] = $label;
		}

		$result->addValue( [ $this->getModuleName() ], 'result', json_encode( $optionsValues ) );
	}

	/**
	 * @param string $str
	 * @return string
	 */
	private	function parseWikitext( $str ) {
		return Parser::stripOuterParagraph( $this->output->parseAsContent( $str ) );
	}

	/**
	 * @param array $properties
	 * @param array $formula
	 * @return string
	 */
	private function replaceFormula( $properties, $formula ) {
		preg_match_all( '/<\s*([^<>]+)\s*>/', $formula, $matches, PREG_PATTERN_ORDER );

		foreach ( $properties as $property => $value ) {
			if ( in_array( $property, $matches[1] ) ) {
				$formula = preg_replace( '/\<\s*' . preg_quote( $property, '/' ) . '\s*\>/', $value, $formula );
			}
		}
		return $formula;
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
	protected function getExamplesMessages() {
		return [
			'action=pageproperties-askquery'
			=> 'apihelp-pageproperties-askquery-example-1'
		];
	}
}
