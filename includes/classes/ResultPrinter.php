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

use MediaWiki\Extension\PageProperties\QueryProcessor as QueryProcessor;
use MediaWiki\Extension\Scribunto\Engines\LuaStandalone\LuaStandaloneEngine as LuaStandaloneEngine;

class ResultPrinter {

	/** @var output */
	protected $output;

	/** @var format */
	private $format;

	/** @var parser */
	public $parser;

	/** @var queryProcessor */
	public $queryProcessor;

	/** @var separator */
	public $separator = '';

	/** @var valuesSeparator */
	public $valuesSeparator = ', ';

	/** @var params */
	public $params;

	/** @var schema */
	public $schema;

	/** @var printouts */
	public $printouts;

	/** @var tree */
	public $tree;

	/**
	 * @param Parser $parser
	 * @param Output $output
	 * @param QueryProcessor $queryProcessor
	 * @param array $schema
	 * @param array $templates
	 * @param array $params
	 * @param array $printouts
	 */
	public function __construct( $parser, $output, $queryProcessor, $schema, $templates, $params, $printouts ) {
		$this->queryProcessor = $queryProcessor;

		$defaultParameters = [
			'format' => [ 'json', 'string' ],
			'schema' => [ '', 'string' ],
			'separator' => [ '', 'string' ],
			'values-separator' => [ ', ', 'string' ],
			'template' => [ '', 'string' ],
			'pagetitle-name' => [ 'pagetitle', 'string' ],
 ];

		$params = \PageProperties::applyDefaultParams( $defaultParameters, $params );

		$this->format = $params['format'];
		$this->params = $params;
		$this->schema = $schema;
		$this->parser = $parser;
		$this->output = $output;
		$this->printouts = $printouts;
		$this->templates = $templates;
		$this->valuesSeparator = $params['values-separator'];
		$this->separator = $params['separator'];
	}

	/**
	 * @return bool
	 */
	public function isHtml() {
		return true;
	}

	/**
	 * @return string
	 */
	public function getResults() {
		$results = $this->queryProcessor->getResults();
		return $this->processResults( $results, $this->schema );
	}

	/**
	 * @param Title $title
	 * @param array $value
	 * @return string
	 */
	public function processRow( $title, $value ) {
		$path = '';
		return $this->processSchemaRec( $this->schema, $value, $path );
	}

	/**
	 * @param Title $title
	 * @param array $value
	 * @return string
	 */
	public function processRowTree( $title, $value ) {
		$path = '';
		$pathNoIndex = '';
		return $this->processSchemaRecTree( $this->schema, $value, $path, $pathNoIndex );
	}

	/**
	 * @param array $results
	 * @param array $schema
	 * @return string
	 */
	public function processResults( $results, $schema ) {
		$ret = [];
		foreach ( $results as $value ) {
			list( $title_, $row ) = $value;
			$ret[] = $this->processRow( $title_, $row );
		}

		return $this->processRoot( $ret );
	}

	/**
	 * @param array $rows
	 * @return string
	 */
	public function processRoot( $rows ) {
		return implode( '', $rows );
	}

	/**
	 * @param string $titleStr
	 * @param array $params
	 * @return string
	 */
	protected function processTemplate( $titleStr, $params ) {
		// @see Scribunto_LuaEngine -> expandTemplate
		if ( class_exists( 'MediaWiki\Extension\Scribunto\Engines\LuaStandalone\LuaStandaloneEngine' ) ) {
			$args = $params;
			$titleText = $titleStr;
			$luaStandaloneEngine = new LuaStandaloneEngine( [
				'parser' => $this->parser,
				'title' => $this->parser->getTitle()
			] );
			$frameId = 'empty';
			$text = $luaStandaloneEngine->expandTemplate( $frameId, $titleText, $args );
			return $text[0];
		}

		$argv = [];
		foreach ( $params as $key => $value ) {
			// escpae pipe character !!
			$value = str_replace( '|', '&#124;', (string)$value );
			$argv[] = "$key=$value";
		}

		$titleTemplate = \Title::makeTitle( NS_TEMPLATE, $titleStr );

		if ( !$titleTemplate ) {
			return "[[$titleTemplate]]";
		}

		$text = '{{' . $titleTemplate . '|' . implode( '|', $argv ) . '}}';

		return $this->parser->recursiveTagParse( $text );
	}

	/**
	 * @param array $schema
	 * @param array $arr
	 * @param string $path
	 * @param string $pathNoIndex
	 * @return string
	 */
	 protected function processSchemaRecTree( $schema, $arr, $path, $pathNoIndex ) {
		$isArray = $schema['type'] === 'array';

		if ( $path === '' ) {
			$this->templateMap = [];
		}

		// reset indexes
		if ( $isArray ) {
			$arr = array_values( $arr );
		}
		$ret = [];
		foreach ( $arr as $key => $value ) {
			$currentPath = $path ? "$path/$key" : $key;

			switch ( $schema['type'] ) {
				case 'object':
					$subschema = null;
					if ( array_key_exists( $key, $schema['properties'] ) ) {
						$subschema = $schema['properties'][$key];
					}
					$currentPathNoIndex = $pathNoIndex ? "$pathNoIndex/$key" : $key;
					break;
				case 'array':
					$currentPathNoIndex = $pathNoIndex;
					// @FIXME handle tuple
					$subschema = $schema['items'];
					break;
				default:
					if ( !array_key_exists( $key, $schema ) ) {
						continue 2;
					}
					$subschema = $schema[$key];
			}

			if ( is_array( $value ) ) {
				$ret[$key] = $this->processSchemaRecTree( $subschema, $value, $currentPath, $currentPathNoIndex );
			} else {
				$ret[$key] = $this->processChild( $subschema, $key, $value, $currentPathNoIndex, $path === '' );
			}
		}

		return $this->processParent( $schema, $ret, $pathNoIndex );
	 }

	/**
	 * @param array $schema
	 * @param array $arr
	 * @param string $path
	 * @return string
	 */
	 protected function processSchemaRec( $schema, $arr, $path ) {
		// $isArray = ( $schema['type'] === 'array' );

		if ( $path === '' ) {
			$this->templateMap = [];
		}
		$ret = [];
		foreach ( $arr as $key => $value ) {
			$currentPath = $path ? "$path/$key" : $key;

			switch ( $schema['type'] ) {
				case 'object':
					$subschema = $schema['properties'][$key];
					break;
				case 'array':
					// @FIXME handle tuple
					// the source array does not contain indexes
					$subschema = $schema['items']['properties'][$key];
					break;
				default:
					$subschema = $schema[$key];
			}

			if ( is_array( $value ) ) {
				$ret[$key] = $this->processSchemaRec( $subschema, $value, $currentPath );
			} else {
				$ret[$key] = $this->processChild( $subschema, $key, $value, $currentPath );
			}
		}

		return $this->processParent( $schema, $ret, $path );
	 }

	/**
	 * @param array $schema
	 * @param array $value
	 * @param string $path
	 * @return string
	 */
	public function processParent( $schema, $value, $path ) {
		$isArray = ( $schema['type'] === 'array' );
		if ( $isArray ) {
			return implode( $this->valueSeparator ?? '', $value );
		}

		$ret = '';
		if ( array_key_exists( $path, $this->templates )
			&& !empty( $this->templates[$path] ) ) {
			$ret = $this->processTemplate( $this->templates[$path], $value );

		} else {
			$ret = implode( $this->separator ?? '', $value );
		}

		$isRoot = ( $path === '' );
		if ( $this->isHtml() && $isRoot ) {
			return $this->parser->recursiveTagParseFully( $ret );
		}

		return $ret;
	}

	/**
	 * @param array|null $schema
	 * @param string $key
	 * @param string $value
	 * @param string $path
	 * @return string
	 */
	public function processChild( $schema, $key, $value, $path ) {
		// apply template
		if ( array_key_exists( $path, $this->templates )
			&& !empty( $this->templates[$path] ) ) {
			$value = $this->processTemplate( $this->templates[$path], [ $key => $value ], false );
		}

		// retrieve label
		// if ( array_key_exists( 'title', $schema )
		// 	&& !empty( $schema['title'] ) ) {
		// 	$key = $schema['title'];
		// }

		return (string)$value;
	}

}
