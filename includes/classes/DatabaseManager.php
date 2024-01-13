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

use Title;

class DatabaseManager {

	/** @var dbr */
	public $dbr;

	/** @var dbw */
	public $dbw;

	/** @var int */
	public $articleId;

	/** @var dateTime */
	public $dateTime;

	/** @var array */
	private $mapSchemaPathPropId = [];

	/** @var array */
	private $errors = [];

	/** @var array */
	public static $propTypes = [
		'text',
		'textarea',
		'date',
		'datetime',
		'time',
		'integer',
		'numeric',
		'boolean'
	];

	/** @var array */
	public static $tables = [
		'pageproperties_schema_pages',
		'pageproperties_schemas',
		'pageproperties_props',
		// 'pageproperties_printouts',
		'pageproperties_prop_tables',
		'pageproperties_links',
		'pageproperties_text',
		'pageproperties_textarea',
		'pageproperties_date',
		'pageproperties_datetime',
		'pageproperties_time',
		'pageproperties_integer',
		'pageproperties_numeric',
		'pageproperties_boolean'
	];

	public function __construct() {
		$this->dbr = wfGetDB( DB_REPLICA );
		$this->dbw = wfGetDB( DB_MASTER );
		$this->dateTime = date( 'Y-m-d H:i:s' );
	}

	/**
	 * @param array $schema
	 * @param array $data
	 * @return array
	 */
	public function prepareData( $schema, $data ) {
		$ret = [];
		$path = $schema['wiki']['name'];
		$pathNoIndex = '';
		$this->flattenData( $ret, $schema, $data, $path, $pathNoIndex );
		return $ret;
	}

	/**
	 * @param Title $title
	 * @param string $type
	 * @param string|array $schema
	 * @return bool
	 */
	public function storeLink( $title, $type, $schema ) {
		if ( !\PageProperties::isKnownArticle( $title ) ) {
			return false;
		}

		$schemas = ( !is_array( $schema ) ? [ $schema ] : $schema );

		// store a missing schema anyway
		if ( !count( $schemas ) ) {
			$schemas = [ null ];
		}

		$tableName = 'pageproperties_links';
		$conds = [
			'page_id' => $title->getId(),
			'type' => $type
		];
		$this->dbw->delete(
			$tableName,
			$conds,
			__METHOD__
		);

		foreach ( $schemas as $schemaName ) {
			$schemaId = $this->getSchemaId( $schemaName );
			if ( !$schemaId ) {
				continue;
			}

			$conds_ = array_merge( $conds, [
				'schema_id' => $schemaId,
				'updated_at' => $this->dateTime,
				'created_at' => $this->dateTime
			] );
			$res = $this->dbw->insert(
				$tableName,
				$conds_
			);
		}
		return true;
	}

	/**
	 * @param string $schema
	 * @return bool
	 */
	public function schemaExists( $schema ) {
		$conds = [
			'page_namespace' => NS_PAGEPROPERTIESSCHEMA,
			'page_is_redirect' => 0,
			'page_title' => str_replace( ' ', '_', $schema )
		];

		return (bool)$this->dbr->selectField(
			'page',
			'count(*) as count',
			$conds,
			__METHOD__,
			[
				'LIMIT' => 1,
				'USE INDEX' => ( version_compare( MW_VERSION, '1.36', '<' ) ? 'name_title' : 'page_name_title' ),
			]
		);

		// $tableName = 'pageproperties_schemas';
		// return (bool)$this->dbr->selectField(
		// 	$tableName,
		// 	'count(*) as count',
		// 	[ 'schemaname' => $schema ],
		// 	__METHOD__,
		// 	[ 'LIMIT' => 1 ]
		// );
	}

	/**
	 * @param string $schemaname
	 * @return int|null
	 */
	public function getSchemaId( $schemaname ) {
		$ret = $this->dbr->selectField(
			'pageproperties_schemas',
			'id',
			[ 'name' => $schemaname ],
			__METHOD__,
			[ 'LIMIT' => 1 ],
		);

		if ( !$ret ) {
			return null;
		}
		return $ret;
	}

	/**
	 * @param int $schema_id
	 * @return string|null
	 */
	public function getSchemaName( $schema_id ) {
		$ret = $this->dbr->selectField(
			'pageproperties_schemas',
			'name',
			[ 'id' => $schema_id ],
			__METHOD__,
			[ 'LIMIT' => 1 ],
		);

		if ( !$ret ) {
			return null;
		}
		return $ret;
	}

	/**
	 * @param Title $title
	 */
	public function removeLinks( $title ) {
		if ( !$title ) {
			return;
		}
		$articleId = $title->getID();
		if ( !$articleId ) {
			return;
		}

		// this prevents possible errors from maintenance/update
		// if an extension will call the hook that calls this
		// method before that extension's tables are created
		if ( !$this->dbr->tableExists( 'pageproperties_links' ) ) {
			return;
		}

		$tableName = 'pageproperties_links';
		$conds = [ 'page_id' => $articleId ];
		$this->dbw->delete(
			$tableName,
			$conds,
			__METHOD__
		);
	}

	/**
	 * @param array $schemas
	 */
	public function invalidatePagesWithQueries( $schemas ) {
		$tableName = 'pageproperties_links';
		foreach ( $schemas as $v ) {
			if ( !isset( $v['id'] ) ) {
				$schemaId = $this->getSchemaId( $v['name'] );
				if ( !$schemaId ) {
					continue;
				}
			} else {
				$schemaId = $v['id'];
			}

			$res = $this->dbr->select(
				$tableName,
				[ 'page_id' ],
				[ 'type' => 'query', 'schema_id' => $schemaId ],
				__METHOD__,
				[]
			);

			foreach ( $res as $row ) {
				$title_ = Title::newFromID( $row->page_id );
				if ( $title_ && $title_->isKnown() ) {
					$wikiPage_ = \PageProperties::getWikiPage( $title_ );
					if ( $wikiPage_ ) {
						$wikiPage_->doPurge();
					}
					// invalidate pages "transcluding"
					// this page as template
					\PageProperties::invalidateCacheOfPagesWithTemplateLinksTo( $title_ );
				}
			}
		}
	}

	/**
	 * @param string $schema
	 * @param bool $evaluate
	 * @return int
	 */
	public function deleteSchema( $schema, $evaluate ) {
		// @TODO delete all props and data related to this schema ?
		$tableName = 'pageproperties_props';

		// @TODO return jobCount
	}

	/**
	 * @param string $schema
	 * @param bool $evaluate
	 * @return int
	 */
	public function renameSchema( $schema, $evaluate ) {
		// @TODO return jobCount
	}

	/**
	 * @param string $schema
	 * @param array $renamedProperties
	 * @return int
	 */
	public function renameProperties( $schema, $renamedProperties ) {
		// @TODO return jobCount
	}

	/**
	 * @param Title $title
	 */
	public function deletePage( $title ) {
		$articleId = $title->getID();

		$tableName = 'pageproperties_schema_pages';
		$conds = [
			'page_id' => $articleId
		];

		$res = $this->dbr->select(
			$tableName,
			// fields
			[ 'schema_id' ],
			// where
			$conds,
			__METHOD__,
			[]
		);

		$schemas = [];
		foreach ( $res as $row ) {
			$schemas[] = [ 'id' => $row->schema_id ];
		}

		$res = $this->dbw->delete(
			$tableName,
			$conds,
			__METHOD__,
			[]
		);

		foreach ( self::$propTypes as $propType ) {
			$tableName = "pageproperties_$propType";

			$res = $this->dbw->delete(
				$tableName,
				$conds,
				__METHOD__,
				[]
			);
		}

		$conds = [
			'page_id' => $articleId
		];

		$tableName = 'pageproperties_links';
		$this->dbw->delete(
			$tableName,
			$conds,
			__METHOD__
		);

		// @TODO remove unused entries
		// from pageproperties_props and pageproperties_schemas
		// if pageproperties_schema_page does not contain a given schema

		// invalidateCacheOfPagesWithTemplateLinksTo
		// on pages with queries involving delete schemas
		$this->invalidatePagesWithQueries( $schemas );
	}

	/**
	 * @param Title $title
	 * @param array $deletedSchemas
	 * @param array &$errors
	 */
	public function deleteArticleSchemas( $title, $deletedSchemas, &$errors ) {
		$articleId = $title->getArticleID();

		$schemas = [];
		foreach ( $deletedSchemas as $schemaName ) {
			$tableName = 'pageproperties_schemas';
			$conds_ = [
				'name' => $schemaName
			];
			$schemaId = $this->dbr->selectField(
				$tableName,
				'id',
				$conds_,
				__METHOD__,
				[ 'ORDER BY' => 'id DESC' ]
			);

			if ( !$schemaId ) {
				continue;
			}

			$schemas[] = [ 'id' => $schemaId ];

			foreach ( self::$propTypes as $propType ) {
				$tableName = "pageproperties_$propType";

				$this->dbw->deleteJoin(
					// delTable
					$tableName,
					// joinTable
					'pageproperties_props',
					// delVar
					'prop_id',
					// joinVar
					$this->dbr->tableName( 'pageproperties_props' ) . '.id',
					// conds
					[ 'page_id' => $articleId, 'schema_id' => $schemaId ],
					__METHOD__
				);
			}

			$conds = [
				'page_id' => $articleId,
				'schema_id' => $schemaId
			];
			$tableName = 'pageproperties_links';
			$this->dbw->delete(
				$tableName,
				$conds,
				__METHOD__
			);

			$this->invalidatePagesWithQueries( $schemas );
		}
	}

	/**
	 * @param string $schemaName
	 * @param int $articleId
	 * @return int
	 */
	private function recordSchema( $schemaName, $articleId ) {
		$tableName = 'pageproperties_schemas';
		$conds = [
			'name' => $schemaName,
		];
		$insert = array_merge( $conds, [
			'updated_at' => $this->dateTime,
			'created_at' => $this->dateTime
		] );
		$schemaId = $this->updateOrInsert( $tableName, $conds, $insert );

		$tableName = 'pageproperties_schema_pages';
		$conds = [
			'page_id' => $articleId,
			'schema_id' => $schemaId,
		];
		$insert = array_merge( $conds, [
			'updated_at' => $this->dateTime,
			'created_at' => $this->dateTime
		] );
		$this->updateOrInsert( $tableName, $conds, $insert );

		return $schemaId;
	}

	/**
	 * @param string $pointer
	 * @return string
	 */
	private function unescapeJsonPointer( $pointer ) {
		$ret = [];
		$arr = explode( '/', $pointer );
		foreach ( $arr as $value ) {
			$value = str_replace( '~1', '/', $value );
			$ret[] = str_replace( '~0', '~', $value );
		}
		return $ret;
	}

	/**
	 * @param string $tableName
	 * @param array $conds
	 * @param array $insert
	 * @param array|null $update
	 * @return int
	 */
	private function updateOrInsert( $tableName, $conds, $insert, $update = null ) {
		$id = $this->dbr->selectField(
			$tableName,
			'id',
			$conds,
			__METHOD__,
			[ 'LIMIT' => 1 ]
		);

		if ( !$id ) {
			$res = $this->dbw->insert(
				$tableName,
				$insert
			);
			// @TODO use `mysql> select last_insert_id();`
			$id = $this->dbr->selectField(
				$tableName,
				'id',
				$conds,
				__METHOD__,
				[ 'ORDER BY' => 'id DESC' ]
			);
		}

		if ( !$update || !count( $update ) ) {
			return $id;
		}

		$res = $this->dbw->update(
			$tableName,
			$update,
			[ 'id' => $id ],
			__METHOD__
		);

		return $id;
	}

	/**
	 * @param string $type
	 * @param string $format
	 * @return array
	 */
	private function schemaFormatToTableId( $type, $format ) {
		$propType = ( $type === 'string' ? $format : $type );

		switch ( $propType ) {
			case 'number':
				$propType = 'numeric';
				break;
			case 'color':
				$propType = 'text';
				break;
			case 'datetime-local':
				$propType = 'datetime';
				break;
			case 'email':
				$propType = 'text';
				break;
			case 'month':
				$propType = 'integer';
				break;
			case 'password':
				$propType = 'text';
				break;
			case 'number':
				$propType = 'numeric';
				break;
			case 'range':
				$propType = 'numeric';
				break;
			case 'tel':
				$propType = 'text';
				break;
			case 'url':
				$propType = 'text';
				break;
			case 'week':
				$propType = 'integer';
		}

		$table_id = 0;
		switch ( $propType ) {
			case 'text':
				$table_id = 1;
				break;
			case 'textarea':
				$table_id = 2;
				break;
			case 'date':
				$table_id = 3;
				break;
			case 'datetime':
				$table_id = 4;
				break;
			case 'time':
				$table_id = 5;
				break;
			case 'integer':
				$table_id = 6;
				break;
			case 'numeric':
				$table_id = 7;
				break;
			case 'boolean':
				$table_id = 8;
		}
		return [ $table_id, $propType ];
	}

	/**
	 * @param string $context
	 * @param Title $title
	 * @param array $flattenData
	 * @param array &$errors
	 * @return int
	 */
	public function recordProperties( $context, $title, $flattenData, &$errors ) {
		$articleId = $title->getArticleID();

		$ret = 0;
		$props = [];
		foreach ( $flattenData as $path => $value ) {
			$pathArr = $this->unescapeJsonPointer( $path );
			$schemaName = array_shift( $pathArr );
			$schemas[] = $schemaName;

			// remove root slash
			// $pathNoIndex = substr( $value['pathNoIndex'], 1 );
			$pathNoIndex = $value['pathNoIndex'];
			$path = implode( '/', $pathArr );
			$props[$schemaName][$path]['schema'] = $value['schema'];
			$props[$schemaName][$path]['pathNoIndex'] = $pathNoIndex;

			$props[$schemaName][$path]['value'] = $value['value'];
		}

		foreach ( $props as $schemaName => $values ) {
			$schemaId = $this->recordSchema( $schemaName, $articleId );

			// delete all props related to this schema_id
			// and article

			// echo 'deleting values' . PHP_EOL;
			foreach ( self::$propTypes as $propType ) {
				$tableName = "pageproperties_$propType";

				$this->dbw->deleteJoin(
					// delTable
					$tableName,
					// joinTable
					'pageproperties_props',
					// delVar
					'prop_id',
					// joinVar
					$this->dbr->tableName( 'pageproperties_props' ) . '.id',
					// conds
					[ 'page_id' => $articleId, 'schema_id' => $schemaId ],
					__METHOD__
				);
			}

			$rows = [];
			$mapPathNoIndexTableId = [];
			$mapPathNoIndexPropType = [];

			foreach ( $values as $path => $val ) {
				$path_no_index = $val['pathNoIndex'];

				[ $table_id, $propType ] = $this->schemaFormatToTableId( $val['schema']['type'],
					array_key_exists( 'format', $val['schema'] ) ? $val['schema']['format'] : null );

				if ( !$table_id || !$propType ) {
					// @TODO log error
					continue;
				}
				$mapPathNoIndexPropType[$path_no_index] = $propType;
				$mapPathNoIndexTableId[$path_no_index] = $table_id;

				$pathParent = substr( $path, 0, strrpos( $path, '/' ) );

				if ( !is_array( $val['value'] ) ) {
					$rows[] = [
						'schema_id' => $schemaId,
						'table_id' => $table_id,
						'path' => $path,
						'path_no_index' => $path_no_index,
						'path_parent' => $pathParent,
						'updated_at' => $this->dateTime,
						'created_at' => $this->dateTime,
					];
				} else {
					foreach ( $val['value'] as $k => $v ) {
						$rows[] = [
							'schema_id' => $schemaId,
							'table_id' => $table_id,
							'path' => "$path/$k",
							'path_no_index' => $path_no_index,
							'path_parent' => $pathParent,
							'updated_at' => $this->dateTime,
							'created_at' => $this->dateTime,
						];
					}
				}
			}

			$tableName = 'pageproperties_props';
			$options = [ 'IGNORE' ];
			$res = $this->dbw->insert(
				$tableName,
				$rows,
				__METHOD__,
				$options
			);

			$conds = [ 'schema_id' => $schemaId ];
			$options = [];
			$joins = [];
			$tables = [ $tableName ];
			$res = $this->dbr->select(
				// tables
				$tables,
				// fields
				[ 'id', 'path' ],
				// where
				$conds,
				__METHOD__,
				// options
				$options,
				// join
				$joins
			);

			$mapPathPropId = [];
			foreach ( $res as $row ) {
				$mapPathPropId[$row->path] = $row->id;
			}

			$rows = [];
			foreach ( $mapPathNoIndexTableId as $path_no_index => $table_id ) {
				$rows[] = [
					'schema_id' => $schemaId,
					'table_id' => $table_id,
					'path_no_index' => $path_no_index,
					'updated_at' => $this->dateTime,
					'created_at' => $this->dateTime,
				];
			}

			$options = [ 'IGNORE' ];
			$tableName = 'pageproperties_prop_tables';
			$res = $this->dbw->insert(
				$tableName,
				$rows,
				__METHOD__,
				$options
			);

			// @TODO use id instead of printouts

			// $options = [ 'IGNORE' ];
			// $tableName = $this->dbr->tableName( 'pageproperties_printouts' );
			// $res = $this->dbw->insert(
			// 	$tableName,
			// 	$rows_,
			// 	__METHOD__,
			// 	$options
			// );

			// $conds = [ 'schema_id' => $schemaId ];
			// $options = [];
			// $joins = [];
			// $tables = [ $tableName ];
			// $res = $this->dbr->select(
			// 	// tables
			// 	$tables,
			// 	// fields
			// 	[ 'id', 'text' ],
			// 	// where
			// 	$conds,
			// 	__METHOD__,
			// 	// options
			// 	$options,
			// 	// join
			// 	$joins
			// );

			// $mapPrintoutId = [];
			// foreach ( $res as $row ) {
			// 	$mapPrintoutId[$row->text] = $row->id;
			// }

			$tables = [];
			foreach ( $values as $path => $val ) {
				$path_no_index = $val['pathNoIndex'];
				$propType = $mapPathNoIndexPropType[$path_no_index];

				if ( !is_array( $val['value'] ) ) {
					if ( !array_key_exists( $path, $mapPathPropId ) ) {
						$this->errors[] = 'ERROR no prop with path ' . $path;
						continue;
					}
					$propId = $mapPathPropId[$path];
					$tables[$propType][] = [
						'page_id' => $articleId,
						'prop_id' => $propId,
						'value' => $val['value'],
						'created_at' => $this->dateTime,
					];
				} else {
					foreach ( $val['value'] as $k => $v ) {
						if ( !array_key_exists( "$path/$k", $mapPathPropId ) ) {
							$this->errors[] = 'ERROR no prop with path' . "$path/$k";
							continue;
						}
						$propId = $mapPathPropId["$path/$k"];
						$tables[$propType][] = [
							'page_id' => $articleId,
							'prop_id' => $propId,
							'value' => $v,
							'created_at' => $this->dateTime,
						];
					}
				}
			}

			foreach ( $tables as $propType => $rows ) {
				$tableName = "pageproperties_$propType";
				$res = $this->dbw->insert( $tableName, $rows );
				$ret += count( $rows );
			}
		}

		return $ret;
	}

	/**
	 * @param array &$ret
	 * @param array $schema
	 * @param array $data
	 * @param string $path
	 * @param string $pathNoIndex
	 */
	private function flattenData( &$ret, $schema, $data, $path, $pathNoIndex ) {
		foreach ( $data as $key => $value ) {
			$currentPath = $path ? "$path/$key" : $key;

			switch ( $schema['type'] ) {
				case 'object':
					if ( !array_key_exists( $key, $schema['properties'] ) ) {
						continue 2;
					}
					$currentPathNoIndex = $pathNoIndex ? "$pathNoIndex/$key" : $key;
					$subschema = $schema['properties'][$key];
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
				$this->flattenData( $ret, $subschema, $value, $currentPath, $currentPathNoIndex );
			} else {
				$ret[$currentPath] = [
					'pathNoIndex' => $currentPathNoIndex,
					'schema' => $subschema,
					'value' => $value
				];
			}
		}
	}

}
