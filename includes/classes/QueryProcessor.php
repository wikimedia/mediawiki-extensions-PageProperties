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

if ( is_readable( __DIR__ . '/../vendor/autoload.php' ) ) {
	include_once __DIR__ . '/../vendor/autoload.php';
}

use MediaWiki\Extension\PageProperties\DatabaseManager as DatabaseManager;
use Title;

class QueryProcessor {

	/** @var results */
	private $results = [];

	/** @var resultsList */
	private $resultsList = [];

	/** @var conditionProperties */
	private $conditionProperties = [];

	/** @var conditionSubjects */
	private $conditionSubjects = [];

	/** @var printouts */
	private $printouts = [];

	/** @var params */
	private $params = [];

	/** @var dbr */
	private $dbr;

	/** @var count */
	private $count;

	/** @var treeFormat */
	private $treeFormat;

	/** @var conditions */
	private $conditions = [];

	/** @var query */
	private $query;

	/** @var databaseManager */
	private $databaseManager;

	/** @var errors */
	private $errors;

	/** @var mapKeyToPrintout */
	private $mapKeyToPrintout;

	/**
	 * @param string $query
	 * @param array $printouts
	 * @param array $params
	 */
	public function __construct( $query, $printouts, $params ) {
		$defaultParameters = [
			'schema' => [ '', 'string' ],
			'limit' => [ 100, 'integer' ],
			'offset' => [ 0, 'integer' ],
			'order' => [ '', 'string' ],
			'pagetitle-name' => [ 'pagetitle', 'string' ],
			'hierarchical-conditions' => [ true, 'bool' ],
		];

		$params = \PageProperties::applyDefaultParams( $defaultParameters, $params );

		$this->databaseManager = new DatabaseManager();
		$this->query = $query;
		$this->printouts = $printouts;
		$this->params = $params;
		$this->dbr = wfGetDB( DB_REPLICA );
	}

	/**
	 * @return array
	 */
	public function getCount() {
		$this->count = true;
		$this->treeFormat = false;
		return $this->performQuery();
	}

	/**
	 * @return array
	 */
	public function getCountTree() {
		$this->count = true;
		$this->treeFormat = true;
		return $this->performQuery();
	}

	/**
	 * @return array
	 */
	public function getResults() {
		$this->count = false;
		$this->treeFormat = false;
		$this->performQuery();
		return $this->results;
	}

	/**
	 * @return array
	 */
	public function getResultsTree() {
		$this->count = false;
		$this->treeFormat = true;
		$this->performQuery();
		return $this->results;
	}

	/**
	 * @return array
	 */
	public function getQueryData() {
		return [
			'query' => $this->query,
			'printouts' => $this->printouts,
			'params' => $this->params
		];
	}

	private function parseQuery() {
		// @TODO implement search operators
		// https://www.semantic-mediawiki.org/wiki/Help:Search_operators
		preg_replace_callback( '/\[\[([^\[\]]+)\]\]/',
			function ( $matches ) {
			if ( strpos( $matches[1], '::' ) !== false ) {
				list( $prop, $value ) = explode( '::',  $matches[1] );
				$this->conditionProperties[$prop] = $value;
			} else {
				$this->conditionSubjects[] = $matches[1];
			}
			}, $this->query );

		// check if is a title
		if ( empty( $this->conditionProperties )
			&& empty( $this->conditionSubjects ) ) {
			$title_ = Title::newFromText( trim( $this->query ) );
			if ( $title_ && $title_->isKnown() ) {
				$this->conditionSubjects[] = $title_->getFullText();
			}
		}
	}

	/**
	 * @param string $table_id
	 * @return string
	 */
	private function tableNameFromId( $table_id ) {
		switch ( $table_id ) {
			case 1:
				return 'text';
			case 2:
				return 'textarea';
			case 3:
				return 'date';
			case 4:
				return 'datetime';
			case 5:
				return 'time';
			case 6:
				return 'integer';
			case 7:
				return 'numeric';
			case 8:
				return 'boolean';
		}
	}

	/**
	 * @return array
	 */
	private function getOptions() {
		if ( $this->count ) {
			return [];
		}

		$options = [];
		$optionsMap = [
			'order' => 'ORDER BY',
			'limit' => 'LIMIT',
			'offset' => 'OFFSET',
		];

		// $options = ['GROUP BY' => 'page_id'];
		foreach ( $optionsMap as $key => $value ) {
			if ( !empty( $this->params[$key] ) ) {
				$val = $this->params[$key];
				switch ( $key ) {
					case 'order':
						$arr = [];
						$values = preg_split( '/\s*,\s*/', $val, -1, PREG_SPLIT_NO_EMPTY );
						foreach ( $values as $v ) {
							preg_match( '/^\s*(.+?)\s*(ASC|DESC)?\s*$/i', $v, $match_ );
							$propName = $match_[1];
							$sort = $match_[2] ?? 'ASC';
							$index = array_search( $propName, $this->mapKeyToPrintout );
							if ( $index !== false ) {
								$arr[] = "v$index $sort";
							}
						}
						$options[$value] = implode( ', ', $arr );
						break;
					case 'limit':
					case 'offset':
						// *** this shouldn't be anymore necessary
						if ( preg_match( '/^\s*\d+\s*$/', $val ) ) {
							$options[$value] = (int)$this->params[$key];
						}
						break;
				}
			}
		}

		return $options;
	}

	/**
	 * @param string $dataType
	 * @param string|int|float|bool &$val
	 */
	private function castVal( $dataType, &$val ) {
		switch ( $dataType ) {
			case 'text':
			case 'textarea':
				settype( $val, "string" );
				$val = $this->dbr->addQuotes( $val );
				break;
			case 'integer':
				settype( $val, "integer" );
				break;
			case 'numeric':
				settype( $val, "float" );
				break;
			case 'date':
				$val = date( "Y-m-d", strtotime( $val ) );
				$val = $this->dbr->addQuotes( $val );
				break;
			case 'datetime':
				$val = date( "Y-m-d H:i:s", strtotime( $val ) );
				$val = $this->dbr->addQuotes( $val );
				break;
			case 'time':
				$val = date( "H:i:s", strtotime( $val ) );
				$val = $this->dbr->addQuotes( $val );
				break;
			case 'boolean':
				settype( $val, "boolean" );
				break;
		}
	}

	/**
	 * @param string $value
	 * @param string $key
	 * @param string $dataType
	 * @return string
	 */
	private function parseCondition( $value, $key, $dataType ) {
		// @TODO expand query language with <, > and more
		// cast where
		/*

		and use a form like the following:

			[[name::equals::Afghanistan]]
		(in the parser function + create
		a query builder similar to that
		of Datatables
		@see https://datatables.net/extensions/searchbuilder/customConditions.html

		case '=':
								$searchBuilder[] = "[[{$str}{$v}]]";
								break;
							case '!=':
								$searchBuilder[] = "[[{$str}!~$v]]";
								break;
							case 'starts':
								$searchBuilder[] = "[[{$str}~$v*]]";
								break;
							case '!starts':
								$searchBuilder[] = "[[{$str}!~$v*]]";
								break;
							case 'contains':
								$searchBuilder[] = "[[{$str}~*$v*]]";
								break;
							case '!contains':
								$searchBuilder[] = "[[{$str}!~*$v*]]";
								break;
							case 'ends':
								$searchBuilder[] = "[[{$str}~*$v]]";
								break;
							case '!ends':
								$searchBuilder[] = "[[$str}!~*$v]]";
								break;

				*/

		$any = $this->dbr->anyString();

		// use $this->dbr->buildLike( $prefix, $this->dbr->anyString() )
		// if $value contains ~
		$likeBefore = false;
		$likeAfter = false;
		preg_match( '/^(~)?(.+?)(~)?$/', $value, $match );

		if ( !empty( $match ) ) {
			$value = $match[2];
			if ( !empty( $match[1] ) ) {
				$likeBefore = true;
			}
			if ( !empty( $match[3] ) ) {
				$likeAfter = true;
			}
		}
		$val = $value;
		if ( !$likeBefore && !$likeAfter ) {
			$this->castVal( $dataType, $val );
			return "t$key.value = $val";
		}

		if ( $likeBefore && !$likeAfter ) {
			$val = $this->dbr->buildLike( $any, $val );
		} elseif ( !$likeBefore && $likeAfter ) {
			$val = $this->dbr->buildLike( $val, $any );
		} elseif ( $likeBefore && $likeAfter ) {
			$val = $this->dbr->buildLike( $any, $val, $any );
		}
		return "t$key.value$val";
	}

	private function performQuery() {
		$this->parseQuery();

		if ( empty( $this->conditionProperties )
			&& empty( $this->conditionSubjects ) ) {
			echo 'no query' . PHP_EOL;
			return;
		}

		$schemaId = $this->databaseManager->getSchemaId( $this->params['schema'] );

		if ( $schemaId === null ) {
			echo 'no schema (' . $this->params['schema'] . ')' . PHP_EOL;
			return;
		}

		$conds = [
			'schema_id' => $schemaId,
		];

		$res = $this->dbr->select(
			'pageproperties_prop_tables',
			[ 'table_id', 'path_no_index' ],
			$conds,
			__METHOD__
		);

		if ( !$res->numRows() ) {
			return 'no matched schema';
		}

		$mapPathNoIndexTable = [];
		foreach ( $res as $row ) {
			$row = (array)$row;
			$tablename = $this->tableNameFromId( $row['table_id'] );
			$mapPathNoIndexTable[$row['path_no_index']] = $tablename;
		}

		if ( empty( $this->printouts ) ) {
			$this->printouts = array_keys( $mapPathNoIndexTable );
		}

		$arr = [];
		foreach ( $this->conditionProperties as $pathNoIndex => $v ) {
			$arr[$pathNoIndex] = 0;
		}

		foreach ( $this->printouts as $pathNoIndex ) {
			$arr[$pathNoIndex] = 1;
		}

		uksort( $arr, static function ( $ka, $kb ) {
			$a = substr_count( $ka, '/' );
			$b = substr_count( $kb, '/' );
			return ( $a == $b ? 0 : (int)( $a > $b ) );
		} );

		$this->conditionProperties = array_intersect_key( $this->conditionProperties, $mapPathNoIndexTable );

		$arr = [];
		foreach ( $this->conditionProperties as $pathNoIndex => $v ) {
			$arr[$pathNoIndex] = false;
		}

		foreach ( $this->printouts as $pathNoIndex ) {
			if ( array_key_exists( $pathNoIndex, $mapPathNoIndexTable ) ) {
				$arr[$pathNoIndex] = true;
			}
		}

		$combined = [];
		foreach ( $arr as $pathNoIndex => $isPrintout ) {
			$printoutParent = substr( $pathNoIndex, 0, strrpos( $pathNoIndex, '/' ) );

			$combined[] = [
				'printout' => $pathNoIndex,
				'printoutParent' => $printoutParent,
				'depth' => substr_count( $pathNoIndex, '/' ),
				'isPrintout' => $isPrintout
			];
		}

		usort( $combined, static function ( $a, $b ) {
			return ( $a['depth'] == $b['depth'] ? 0
				: (int)( $a['depth'] > $b['depth'] ) );
		} );

		foreach ( $combined as $i => $v ) {
			for ( $ii = 0; $ii < $i; $ii++ ) {
				if ( !empty( $combined[$ii]['printoutParent'] )
					&& strpos( $v['printoutParent'], $combined[$ii]['printoutParent'] ) === 0 ) {
					$combined[$i]['parent'] = $ii;
					$combined[$i]['isSibling'] = $v['depth'] === $combined[$ii]['depth'];
				}
			}
		}

		$fields = [];
		$tables = [];
		$conds = [];
		$options = [];
		$joins = [];

		$fields[] = "t0.page_id AS page_id";
		$conds = [
			"p0.schema_id" => $schemaId,
		];

		// @TODO use subjquery to
		foreach ( $combined as $key => $v ) {
			$pathNoIndex = $v['printout'];
			$isPrintout = $v['isPrintout'];
			if ( $isPrintout ) {
				$this->mapKeyToPrintout[$key] = $v['printout'];
			}
			$tablename = $mapPathNoIndexTable[$pathNoIndex];
			$joinConds = [];
			$joinConds[] = "p$key.id=t$key.prop_id";

			if ( $key === 0 ) {
				$conds["p$key.path_no_index"] = $pathNoIndex;
			} else {
				$joinConds["p$key.path_no_index"] = $pathNoIndex;
			}

			if ( array_key_exists( $pathNoIndex, $this->conditionProperties ) ) {
				if ( $key === 0 ) {
					$conds[] = $this->parseCondition( $this->conditionProperties[$pathNoIndex], $key, $tablename );
				} else {
					$joinConds[] = $this->parseCondition( $this->conditionProperties[$pathNoIndex], $key, $tablename );
				}
			}

			if ( $key > 0 ) {
				$joinConds[] = "p$key.schema_id=p0.schema_id";
				$joinConds[] = "t$key.page_id=t0.page_id";
				if ( $this->params['hierarchical-conditions']
					&& array_key_exists( 'parent', $v ) ) {
					$pKey = $v['parent'];
					if ( !$v['isSibling'] ) {
						$joinConds[] = "LOCATE( p$pKey.path_parent, p$key.path_parent ) = 1";

					// @IMPORTANT!! otherwise, with locate between
					// identical strings, the query will not work!!
					// (it could be related to how mysql manages indexes)
					} else {
						$joinConds[] = "p$pKey.path_parent = p$key.path_parent";
					}
				}
			}
			$tables[] = $this->dbr->tableName( "pageproperties_$tablename" ) . " AS t$key";
			$tables[] = $this->dbr->tableName( 'pageproperties_props' ) . " AS p$key";

			if ( $key > 0 ) {
				$joins[$this->dbr->tableName( "pageproperties_$tablename" ) . " AS t$key"] = [ 'JOIN', [] ];
			}
			$joins[$this->dbr->tableName( 'pageproperties_props' ) . " AS p$key"] = [ 'JOIN', $this->dbr->makeList( $joinConds, LIST_AND ) ];

			if ( $isPrintout ) {
				if ( !$this->treeFormat ) {
					$fields[] = "t$key.value AS v$key";
				} else {
					$fields[] = "GROUP_CONCAT(t$key.value SEPARATOR 0x1E) AS v$key";
					$fields[] = "GROUP_CONCAT(p$key.path SEPARATOR 0x1E) AS p$key";
				}
			}
		}

		$categories = [];
		foreach ( $this->conditionSubjects as $value ) {
			$title_ = Title::newFromText( $value );
			if ( !$title_ || !$title_->isKnown() ) {
				continue;
			}
			if ( $title_->getNamespace() !== NS_CATEGORY ) {
				$conds[] = 't0.page_id = ' . $title_->getArticleId();

			} else {
				$categories[] = 'cl_to = ' . $this->dbr->addQuotes( $title_->getDbKey() )
					. ' AND cl_from = t0.page_id';
			}
		}

		if ( count( $categories ) ) {
			$joins[] = 'JOIN ' . $this->dbr->tableName( 'categorylinks' )
				. ' ON ' . $this->dbr->makeList( $categories, LIST_OR );
		}

		// selectSQLText
		$method = !$this->count ? 'select' : 'selectField';

		$options = $this->getOptions();

		if ( $this->treeFormat ) {
			$options['GROUP BY'] = 'page_id';
		}

		$res = $this->dbr->$method(
			// tables
			$tables,
			// fields
			!$this->count ? $fields : 'COUNT(*) as count',
			// where
			$conds,
			__METHOD__,
			// options
			$options,
			// join
			$joins
		);

		if ( $this->count ) {
			return (int)$res;
		}

		if ( !$res->numRows() ) {
			return;
		}

		$separator = chr( hexdec( '0x1E' ) );
		$titles = [];
		foreach ( $res as $row ) {
			$row = (array)$row;
			$row_ = [];
			$pageId = $row['page_id'];
			unset( $row['page_id'] );

			if ( !array_key_exists( $pageId, $titles ) ) {
				$title_ = Title::newFromID( $pageId );
				$titles[$pageId] = $title_;
			}

			if ( !$this->treeFormat ) {
				// important, this ensures rows have same
				// number of fields
				$row_ = array_fill_keys( $this->printouts, '' );

				$fields = [];
				foreach ( $row as $k => $v ) {
					if ( empty( $v ) ) {
						continue;
					}

					$index = substr( $k, 1 );
					$row_[$this->mapKeyToPrintout[$index]] = $v;
				}
			} else {
				foreach ( $this->mapKeyToPrintout as $key => $printout ) {
					$paths = explode( $separator, $row["p$key"] );
					$values = explode( $separator, $row["v$key"] );
					foreach ( $paths as $key => $path ) {
						$row_[$path] = $values[$key];
					}
				}
			}

			$this->results[] = [
				$titles[$pageId],
				\PageProperties::plainToNested( $row_ )
			];
		}
	}

}
