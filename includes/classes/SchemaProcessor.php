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

use MediaWiki\Extension\PageProperties\SemanticMediawiki as SemanticMediawiki;
use MediaWiki\MediaWikiServices;
use Parser;

class SchemaProcessor {

	/** @var output */
	private $output;

	/** @var formattedNamespaces */
	private $formattedNamespaces;

	/** @var formattedNamespaces */
	private $allowedMimeTypes;

	/** @var array */
	public static $schemaTypes = [
		'string',
		'number',
		'integer',
		'boolean',
		'object',
		'array',
		'null'
	];

	/** @var array */
	public static $schemaTextFormat = [
		'color',
		'date',
		'datetime',
		'datetime-local',
		'email',
		'month',
		'password',
		'number',
		'range',
		'tel',
		'text',
		'textarea',
		'time',
		'url',
		'week'
	];

	/** @var mapSchema */
	private $mapSchema = [
		'title' => [ 'title', 'string' ],
		'description' => [ 'description', 'string' ],
		// 'multiple-items',
		'min-items' => [ 'minItems', 'int' ],
		'max-items' => [ 'maxItems', 'int' ],
		'unique-items' => [ 'uniqueItems', 'bool' ],
	];

	/** @var mapSchemaOptions */
	private $mapSchemaOptions = [
		'collapsible' => [ 'disable_collapse', 'bool' ],
		'collapsed' => [ 'collapsed', 'bool' ],
		// 'hidden' => [ 'hidden' => 'bool' ],
	];

	/** @var mapField */
	private $mapField = [
		// 'name',
		'label' => 'title',
		'help-message' => 'description',
		'default' => 'default',
		// 'required',
		// 'multiple-items',
		// 'selectOptionsFrom',
		// 'options-values',		// harcoded options
		// 'options-wikilist',		// page with wiki-list
		// 'options-askquery',		// askquery
		// 'askquery-printouts',	// printouts to retrieve (property names)
		// 'askquery-subject',		// include subject (true, false)
		// 'options-query-formula',		// replacement formula
		// 'options-value-formula',		// replacement formula (currently not used)
		// 'options-label-formula',		// replacement formula
		// 'propertyModel',		// json-schema or smw-property
		// 'SMW-property',			// mapped SMW property
		// 'SMW-property-type',		// SMW property type (for recovering in case it changes)
		// 'jsonSchema-type',
		// 'jsonSchema-format',
		// 'preferred-input',
		// 'input-config',			// see below
		// 'value-formula',			// replacement formula
	];

	/** @var mapInputConfig */
	private $mapInputConfig = [
		'maxLength' => 'maxLength',
		'minLength' => 'minLength',
		'max' => 'maximum',
		'min' => 'minimum',
		'validate' => 'pattern',
		'allowDuplicates' => 'uniqueItems',
		'readOnly' => 'readOnly',
		'disabled' => 'readOnly',
		'type' => 'format',
		'tagLimit' => 'maxItems',
		'min' => 'minInclusive',
		'max' => 'maxInclusive',
		// ...
	];

	// @see ManageProperties var optionsInputs
	/** @var optionsInputs */
	private $optionsInputs = [
		'OO.ui.DropdownInputWidget',
		'OO.ui.ComboBoxInputWidget',
		'OO.ui.MenuTagMultiselectWidget',
		'ButtonMultiselectWidget',

		// should also be in the list ? https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.ButtonSelectWidget
		// "OO.ui.ButtonSelectWidget"
		'OO.ui.RadioSelectInputWidget',
		'OO.ui.CheckboxMultiselectInputWidget'
	];

	public function __construct() {
		$this->formattedNamespaces = MediaWikiServices::getInstance()
			->getContentLanguage()->getFormattedNamespaces();

		$this->allowedMimeTypes = $this->getAllowedMimeTypes();
	}

	/**
	 * @param Output $output
	 */
	public function setOutput( $output ) {
		$this->output = $output;
	}

	/**
	 * @param array $schema
	 * @return array
	 */
	public function convertToSchema( $schema ) {
		$ret = [];
		$this->handleRootTo( $ret, $schema );
		return $ret;
	}

	/**
	 * @param array $schema
	 * @param string $label
	 * @return array
	 */
	public function processSchema( $schema, $label ) {
		$ret = [
			'wiki' => [
				// the name is always set, in case of
				// arrays is only used by the form builder
				'name' => $label,
			]
		];
		$this->handleRootFrom( $ret, $schema );
		return $ret;
	}

	/**
	 * @param array $data
	 * @param string $parentKey
	 * @return array
	 */
	public function generateFromData( $data, $parentKey ) {
		if ( !is_array( $data ) || !count( $data ) ) {
			return [];
		}
		$value = $data;
		if ( \PageProperties::isList( $data ) ) {
			$value = $data[0];
		}
		return $this->parseSchemaRec( $value, $parentKey );
	}

	/**
	 * @param string $inputName
	 * @return bool
	 */
	private function isMultiselect( $inputName ) {
		return strpos( $inputName, 'Multiselect' ) !== false;
	}

	/**
	 * @return array
	 */
	public function getAllowedMimeTypes() {
		include_once __DIR__ . '/MimeTypes.php';

		// phpcs:ignore MediaWiki.NamingConventions.ValidGlobalName.allowedPrefix, MediaWiki.Usage.ExtendClassUsage.FunctionConfigUsage
		global $MimeTypes;
		$ret = [];
		foreach ( $GLOBALS['wgFileExtensions'] as $ext ) {
			if ( !array_key_exists( $ext, $MimeTypes ) ) {
				self::$Logger->error( 'MimeType not found: ' . $ext );
				continue;
			}
			$value = $MimeTypes[$ext];
			if ( !is_array( $value ) ) {
				$value = [ $value ];
			}
			foreach ( $value as $val ) {
				$ret[] = $val;
			}
		}

		return $ret;
	}

	/**
	 * @param string $type
	 * @param string $format
	 * @return bool
	 */
	private function getAvailableInputs( $type, $format ) {
		$ret = [];
		switch ( $type ) {
			case 'string':
				switch ( $format ) {
					case 'color':
						$ret = [ 'OO.ui.TextInputWidget (color)' ];
						break;
					case 'date':
						$ret = [ 'mw.widgets.DateInputWidget' ];
						break;
					case 'datetime':
						$ret = [ 'mw.widgets.datetime.DateTimeInputWidget' ];
						break;
					case 'datetime-local':
						$ret = [ 'mw.widgets.datetime.DateTimeInputWidget' ];
						break;
					case 'email':
						$ret = [ 'OO.ui.TextInputWidget (email)' ];
						break;
					case 'month':
						$ret = [ 'mw.widgets.DateInputWidget (precision month)' ];
						break;
					case 'password':
						$ret = [ 'OO.ui.TextInputWidget (password)' ];
						break;
					case 'number':
						$ret = [
							'OO.ui.NumberInputWidget',
							'OO.ui.TextInputWidget (number)',
							'RatingWidget'
						];
						break;
					case 'range':
						// @TODO add range input
						$ret = [
							'OO.ui.TextInputWidget'
						];
						break;
					case 'tel':
						$ret = [
							'intl-tel-input',
							'OO.ui.TextInputWidget (tel)',
							'OO.ui.TagMultiselectWidget'
						];
						break;
					case 'text':
						$ret = [
							'OO.ui.TextInputWidget',
							'OO.ui.TagMultiselectWidget',
							'OO.ui.MultilineTextInputWidget',
							'mw.widgets.TitlesMultiselectWidget',
							'mw.widgets.TitleInputWidget',
							'mw.widgets.UsersMultiselectWidget',
							'mw.widgets.UserInputWidget',
							'OO.ui.SelectFileWidget',
							'mw.widgets.CategoryMultiselectWidget',
						];
						break;
					case 'textarea':
						$ret = [ 'OO.ui.MultilineTextInputWidget' ];
						break;
					case 'time':
						$ret = [ 'mw.widgets.datetime.DateTimeInputWidget' ];
						break;
					case 'url':
						$ret = [ 'OO.ui.TextInputWidget (url)' ];
						break;
					case 'week':
						$ret = [ 'OO.ui.TextInputWidget' ];
						break;
				}
				break;

			case 'number':
			case 'integer':
				$ret = [
					'OO.ui.NumberInputWidget',
					'OO.ui.TextInputWidget (number)',
					'RatingWidget'
				];

				break;
			case 'boolean':
				$ret = [ 'OO.ui.ToggleSwitchWidget' ];
				break;

			// select rather a type and toggle "multiple values"
			case 'array':
				break;
		}

		$filterType = [ 'boolean' ];
		$filterFormat = [ 'password' ];
		if ( !in_array( $type, $filterType )
			 && ( $type !== 'string' || !in_array( $format, $filterFormat ) )
		) {
			$ret = array_merge( $ret, $this->optionsInputs );
		}

		return $ret;
	}

	/**
	 * @param array &$ret
	 * @param array $properties
	 * @param array &$parent
	 */
	private function handleFieldTo( &$ret, $properties, &$parent ) {
		if ( !empty( $properties['required'] ) ) {
			if ( !array_key_exists( 'required', $parent ) ) {
				$parent['required'] = [];
			}
			$parent['required'][] = $properties['name'];
		}

		if ( !empty( $properties['visibility'] ) && $properties['visibility'] === 'hidden' ) {
			if ( !array_key_exists( 'options', $ret ) ) {
				$ret['options'] = [];
			}
			$ret['options']['hidden'] = true;
		}

		if ( array_key_exists( 'selectOptionsFrom', $properties )
			&& $properties['selectOptionsFrom'] === 'options-values' ) {
			// TODO unset other data sources if added
			unset( $properties['options-wikilist'] );
		}

		// copy hardcoded options to json-schema enum
		// only if uniqueItems is true, see definition
		// in schema-draft-07
		if ( empty( $properties['input-config']['allowDuplicates'] )
			&& in_array( $properties['preferred-input'], $this->optionsInputs ) ) {
			$options = [];
			if ( array_key_exists( 'options-allow-null', $properties ) && $properties['options-allow-null'] ) {
				$options[] = '';
			}
			if (
				// keep commented the following since
				// 'selectOptionsFrom' only exists if the item/subitem
				// has been edited
				// $properties['selectOptionsFrom'] === 'options-values' &&
				!empty( $properties['options-values'] )
				&& is_array( $properties['options-values'] )
				&& count( $properties['options-values'] ) ) {
				$options = array_merge( $options, $properties['options-values'] );
			}
			// @TODO the wikilist could be hardcoded as well
			$ret['enum'] = $options;
		}

		if ( !empty( $properties['input-config'] ) && is_array( $properties['input-config'] ) ) {
			foreach ( $properties['input-config'] as $prop => $val ) {
				// copy as standard json-schema
				if ( array_key_exists( $prop, $this->mapInputConfig ) ) {
					if ( $prop === 'allowDuplicates' ) {
						$val = (bool)!$val;
					}
					$ret[$this->mapInputConfig[$prop]] = $val;

					// remove since the source of truth is the
					// standard json-schema
					unset( $properties['input-config'][$prop] );
				}
			}
		}

		// @FIXME json-schema should be always
		// set, the other property models should
		// be considered an additional layer
		if ( empty( $properties['propertyModel'] ) ) {
			$properties['propertyModel'] = 'json-schema';
		}

		switch ( $properties['propertyModel'] ) {
			case 'json-schema':
				if ( !empty( $properties['jsonSchema-type'] ) ) {
					$ret['type'] = $properties['jsonSchema-type'];
				}
				if ( !empty( $properties['jsonSchema-format'] ) ) {
					$ret['format'] = $properties['jsonSchema-format'];
				}
				break;
			case 'smw-property':
				[ $type, $format ] = SemanticMediawiki::smwTypeToSchema( $properties['smw-property-type'] )
					+ [ null, null ];
				if ( !is_array( $type ) ) {
					$ret['type'] = $type;
					if ( !empty( $format ) ) {
						$ret['format'] = $format;
					}

				// @TODO test geographical coordinates
				} else {
					$ret = array_merge( $ret, $type );
				}
				break;
		}

		// remove all properties in the wiki object
		// for which the source of truth is the standard
		// json-schema
		$ignore = [
			// convenience for the builder
			'selectOptionsFrom',

			// convenience for the builder
			'schema',

			'propertyModel',
			'jsonSchema-type',
			'jsonSchema-format',
			// 'required',
			'options-values',
			// 'multiple-items',
			// 'label'
		];

		foreach ( $properties as $property => $value ) {
			if ( in_array( $property, $ignore ) ) {
				continue;
			}

			if ( is_string( $value ) && $value === "" ) {
				continue;
			}

			// copy as standard json-schema
			if ( array_key_exists( $property, $this->mapField ) ) {
				$ret[$this->mapField[$property]] = $value;
				continue;
			}

			$ret['wiki'][$property] = $value;
		}
	}

	/**
	 * @param array &$ret
	 * @param array $schema
	 */
	function handleSchemaTo( &$ret, $schema ) {
		$propNames = [ 'properties', 'additionalProperties' ];

		foreach ( $propNames as $propName ) {
			if ( $this->isValidObj( $schema, $propName ) ) {
				foreach ( $schema[$propName] as $key => $val ) {
					if ( is_array( $val ) ) {
						$ret[$propName][$key] = [];
						$this->handleRootTo( $ret[$propName][$key], $val, $ret );
					}
				}
			}
		}

		$propNames = [ 'oneOf', 'allOf', 'anyOf' ];

		if ( $this->isValidObj( $schema, 'items' ) ) {
			if ( !\PageProperties::isList( $schema['items'] ) ) {
				if ( !array_key_exists( 'wiki', $schema['items'] ) ) {
					$schema['items']['wiki'] = [];
				}
				$ret['items'] = [
					'type' => 'object',
					'wiki' => [
						'name' => ( array_key_exists( 'name', $schema['items']['wiki'] ) ?
							$schema['items']['wiki']['name'] : '' )
					]
				];
				$this->handleRootTo( $ret['items'], $schema['items'], $ret );

			// @TODO implement tuple
			} else {
				$propNames[] = 'items';
			}
		}

		foreach ( $propNames as $propName ) {
			if ( $this->isValidObj( $schema, $propName ) ) {
				$i = 0;
				foreach ( $schema[$propName] as $key => $val ) {
					if ( is_array( $val ) ) {
						$ret[$propName][$i] = [];
						$this->handleRootTo( $ret[$propName][$i], $val, $ret );
						$i++;
					}
				}
			}
		}

		foreach ( $schema as $property => $value ) {

			// already assigned
			if ( array_key_exists( $property, $ret ) ) {
				continue;
			}

			// ignore, because the source of truth
			// is the wiki object in this case
			foreach ( $this->mapSchema as $k => $v ) {
				if ( $property === $v[0] ) {
					continue 2;
				}
			}

			if ( is_array( $value ) && count( $value ) === 0 ) {
				continue;
			}

			if ( is_string( $value ) && $value === "" ) {
				continue;
			}

			$ret[$property] = $value;
		}

		// remove all properties in the wiki object
		// for which the source of truth is the standard
		// json-schema
		$ignore = [
			'multiple-items',
		];

		foreach ( $schema['wiki'] as $property => $value ) {
			if ( in_array( $property, $ignore ) ) {
				continue;
			}

			if ( is_string( $value ) && $value === "" ) {
				continue;
			}

			// copy as standard json-schema
			if ( array_key_exists( $property, $this->mapSchema ) ) {
				[ $standardProp, $propType ] = $this->mapSchema[$property];
				settype( $value, $propType );

				switch ( $property ) {
					case 'title':
					case 'description':
						$ret['wiki']["$property-parsed"] = $ret[$standardProp] =
							$this->parseWikitext( $value );
						$value;
						break;
					default:
						$ret[$standardProp] = $value;
				}
			}

			if ( array_key_exists( $property, $this->mapSchemaOptions ) ) {
				if ( !array_key_exists( 'options', $ret ) ) {
					$ret['options'] = [];
				}
				[ $standardProp, $propType ] = $this->mapSchemaOptions[$property];

				if ( $property === 'collapsible' ) {
						$value = !$value;
				}
				settype( $value, $propType );
				$ret['options'][$standardProp] = $value;
			}

			$ret['wiki'][$property] = $value;
		}
	}

	/**
	 * @param array &$ret
	 * @param array $schema
	 * @param array|null &$parent
	 */
	private function handleRootTo( &$ret, $schema, &$parent = null ) {
		if ( !array_key_exists( 'wiki', $schema ) ) {
			$schema['wiki'] = [];
		}

		if ( !array_key_exists( 'wiki', $ret ) ) {
			$ret['wiki'] = [];
		}

		if ( empty( $schema['wiki']['type'] ) ) {
			switch ( $schema['type'] ) {
				case 'object':
				case 'array':
					$schema['wiki']['type'] = 'schema';
					break;
				case 'boolean':
				case 'integer':
				case 'number':
				case 'string':
				case 'null':
					$schema['wiki']['type'] = 'property';
					break;
			}
		}

		switch ( $schema['wiki']['type'] ) {
			case 'schema':
				$this->handleSchemaTo( $ret, $schema );
				break;
			case 'property':
				$this->handleFieldTo( $ret, $schema['wiki'], $parent );
				break;
			case 'content-block':
				$ret['type'] = 'object';
				$ret['wiki'] = $schema['wiki'];
				$ret['description'] = $this->parseWikitext( $schema['wiki']['content'] );
				break;
		}
	}

	/**
	 * @param array &$ret
	 * @param array $properties
	 * @param array &$parent
	 */
	private function handleFieldFrom( &$ret, $properties, &$parent ) {
		if ( !array_key_exists( 'wiki', $properties ) ) {
			$properties['wiki'] = [];
		}

		if ( !array_key_exists( 'wiki', $ret ) ) {
			$ret['wiki'] = [];
		}
		$ret['wiki']['type'] = 'property';
		$ret['wiki']['multiple-items'] = $parent['type'] === 'array';

		if ( array_key_exists( 'required', $parent )
			&& in_array( $ret['wiki']['name'], $parent['required'] ) ) {
			$ret['wiki']['required'] = true;
		}

		if ( $properties['type'] === 'string' && empty( $properties['format'] ) ) {
			$properties['format'] = 'text';
		}

		// copy input-config otherwise if
		// single properties will be assigned through $this->mapInputConfig
		// the remaining will be ignored in the loop below as already assigned
		if ( !empty( $properties['wiki']['input-config'] ) ) {
			$ret['wiki']['input-config'] = $properties['wiki']['input-config'];
		}

		$parseFields = [ 'default', 'help-message', 'label' ];
		foreach ( $properties as $key => $value ) {
			switch ( $key ) {
				case 'type':
					$ret['wiki']['jsonSchema-type'] = $value;
					break;
				case 'format':
					$ret['wiki']['jsonSchema-format'] = $value;
					break;
				case 'options':
					$this->handleOptionsFrom( $ret, $value );
					break;
				case 'enum':
					// the function $this->handleOptionsValues( $ret );
					// will further parse the options
					if ( empty( $properties['wiki']['options-wikilist'] )
						&& empty( $properties['wiki']['options-values'] )
						&& is_array( $value )
						&& count( $value ) ) {

						// @FIXME we are not distinguishing between "" and NULL
						if ( empty( $value[0] ) ) {
							array_shift( $value );
							$ret['wiki']['options-allow-null'] = true;
						}

						$ret['wiki']['options-values'] = $value;
					}
					break;
				default:
					// @TODO re-apply mapping formula [??]
					if ( array_search( $key, $this->mapInputConfig ) ) {
						$ret['wiki']['input-config'][array_search( $key, $this->mapInputConfig )] = $value;
					}
					$mappedField = array_search( $key, $this->mapField );

					if ( $mappedField ) {
						$ret['wiki'][$mappedField] = $value;

						if ( in_array( $mappedField, $parseFields ) ) {
							$ret['wiki'][ "$mappedField-parsed" ] = $this->parseWikitext( $value,
								$mappedField !== 'default' ? null : $properties );
						}
					}
			}
		}

		if ( empty( $properties['wiki']['preferred-input'] ) ) {
			$availableInputs = $this->getAvailableInputs( $properties['type'], $properties['format'] ?? null );
			$properties['wiki']['preferred-input'] = $availableInputs[0];
		}

		// @FIXME determine value-prefix
		// from input-config -> namespace if applicable
		$namespace = null;
		switch ( $properties['wiki']['preferred-input'] ) {
			case 'mw.widgets.UserInputWidget':
			case 'mw.widgets.UsersMultiselectWidget':
				$namespace = 2;
				break;
			case 'OO.ui.SelectFileWidget':
				$namespace = 6;
				break;
		}

		if ( $namespace ) {
			$ret['wiki']['value-prefix'] = $this->formattedNamespaces[$namespace] . ':';
		}

		// @TODO handle with $this->mapInputConfig if json-schema supports that
		if ( !empty( $properties['wiki']['preferred-input'] )
			&& $properties['wiki']['preferred-input'] === 'OO.ui.SelectFileWidget'
			&& empty( $properties['wiki']['input-config']['accept'] ) ) {
			$ret['wiki']['input-config']['accept'] = $this->allowedMimeTypes;
		}

		foreach ( $properties['wiki'] as $property => $value ) {

			// already assigned
			if ( array_key_exists( $property, $ret['wiki'] ) ) {
				continue;
			}

			if ( is_string( $value ) && $value === "" ) {
				continue;
			}

			$ret['wiki'][$property] = $value;
		}

		foreach ( $properties as $property => $value ) {

			// already assigned
			if ( array_key_exists( $property, $ret ) ) {
				continue;
			}

			if ( is_string( $value ) && $value === "" ) {
				continue;
			}

			$ret[$property] = $value;
		}
		$this->handleOptionsValues( $ret );
	}

	/**
	 * @param array &$ret
	 * @param array $schema
	 */
	function handleSchemaFrom( &$ret, $schema ) {
		if ( !array_key_exists( 'wiki', $schema ) ) {
			$schema['wiki'] = [];
		}

		if ( !array_key_exists( 'wiki', $ret ) ) {
			$ret['wiki'] = [];
		}

		if ( empty( $schema['wiki']['type'] ) ) {
			$ret['wiki']['type'] = 'schema';
		}

		foreach ( $schema as $property => $value ) {

			// already assigned
			if ( array_key_exists( $property, $ret ) ) {
				continue;
			}

			if ( is_string( $value ) && $value === "" ) {
				continue;
			}

			if ( $property === 'options' ) {
				$this->handleOptionsFrom( $ret, $value );
				// @ATTENTION
				// we do not continue the loop here
				// to assign standard properties
				// to returned schema for the use
				// of the viewer
			}

			foreach ( $this->mapSchema as $mappedProp => $mappedValue ) {
				[ $standardProp, $propType ] = $mappedValue;
				if ( $standardProp === $property
					&& !array_key_exists( $mappedProp, $schema['wiki'] ) ) {
					$value_ = $value;
					settype( $value_, $propType );
					$ret['wiki'][ $mappedProp ] = $value_;

					// @ATTENTION
					// we do not continue the loop here
					// to assign standard properties
					// to returned schema for the use
					// of the viewer
				}
			}

			$ret[$property] = $value;
		}

		foreach ( $schema['wiki'] as $property => $value ) {

			// already assigned
			if ( array_key_exists( $property, $ret['wiki'] ) ) {
				continue;
			}

			if ( is_string( $value ) && $value === "" ) {
				continue;
			}

			$ret['wiki'][$property] = $value;
		}

		$propNames = [ 'properties', 'additionalProperties' ];

		foreach ( $propNames as $propName ) {
			if ( $this->isValidObj( $schema, $propName ) ) {
				foreach ( $schema[$propName] as $key => $val ) {
					// @FIXME
					// add support for null
					if ( array_key_exists( 'type', $val )
						&& $val['type'] === 'null' ) {
						unset( $ret[$propName][$key] );
						continue;
					}

					if ( is_array( $val ) ) {
						$ret[$propName][$key] = [
							'wiki' => [
								'name' => $key
							]
						];
						$this->handleRootFrom( $ret[$propName][$key], $val, $ret );
					}
				}
			}
		}

		$propNames = [ 'oneOf', 'allOf', 'anyOf' ];

		if ( $this->isValidObj( $schema, 'items' ) ) {
			if ( !\PageProperties::isList( $schema['items'] ) ) {
				if ( !array_key_exists( 'wiki', $schema['items'] ) ) {
					$schema['items']['wiki'] = [];
				}
				$ret['items'] = [
					'wiki' => [
						'name' => ( array_key_exists( 'name', $schema['items']['wiki'] ) ?
							$schema['items']['wiki']['name'] : '' )
					]
				];
				$this->handleRootFrom( $ret['items'], $schema['items'], $ret );

			// tuple
			} else {
				$propNames[] = 'items';
			}
		}

		// convert to object, use wiki->name as key
		// or create a new literal key
		foreach ( $propNames as $propName ) {
			if ( $this->isValidObj( $schema, $propName ) ) {
				foreach ( $schema[$propName] as $i => $val ) {
					if ( !array_key_exists( 'wiki', $val ) ) {
						$val['wiki'] = [];
					}
					$key = ( array_key_exists( 'name', $val['wiki'] ) ? $val['wiki']['name'] : "item_$i" );
					$ret[$propName][$key] = [
						'wiki' => [
							'name' => $key
						]
					];
					$this->handleRootFrom( $ret[$propName][$key], $val, $ret );
				}
			}
		}
	}

	/**
	 * @param array &$ret
	 * @param array $schema
	 * @param array|null &$parent
	 */
	private function handleRootFrom( &$ret, $schema, &$parent = null ) {
		// FIXME this is correct as long as
		// type is required by json-schema specification
		if ( empty( $schema['type'] ) ) {
			$schema['type'] = ( !empty( $schema['default'] ) ? 'string' : 'object' );
			$schema['options']['hidden'] = true;
		}

		switch ( $schema['type'] ) {
			case 'object':
			case 'array':
				$this->handleSchemaFrom( $ret, $schema );
				break;
			case 'boolean':
			case 'integer':
			case 'number':
			case 'string':
				$this->handleFieldFrom( $ret, $schema, $parent );
				break;
			case 'null':
				// @TODO

				break;
		}
	}

	/**
	 * @param array &$ret
	 * @param array $options
	 */
	function handleOptionsFrom( &$ret, $options ) {
		if ( !is_array( $options ) ) {
			return;
		}

		if ( !empty( $options['hidden'] ) ) {
			$ret['wiki']['visibility'] = 'hidden';
		}

		// map options values
		foreach ( $options as $key => $value ) {
			foreach ( $this->mapSchemaOptions as $mappedProp => $mappedValue ) {
				[ $standardProp, $propType ] = $mappedValue;
				if ( $key === $standardProp ) {
					// settype( $optionValue, $mappedType );
					if ( $mappedProp === 'collapsible' ) {
						$value == !$value;
					}
					$ret['wiki'][$mappedProp] = $value;
				}
			}
		}
	}

	/**
	 * @param array $schema
	 * @param array $propName
	 * @return bool
	 */
	function isValidObj( $schema, $propName ) {
		return array_key_exists( $propName, $schema )
			&& !empty( $schema[$propName] )
			&& is_array( $schema[$propName] );
			// && !empty( $schema[$propName]['wiki'] );
	}

	/**
	 * @param array $properties
	 * @param string $formula
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
	 * @param string $text
	 * @param bool $allItems
	 * @return array
	 */
	private function parseWikilist( $text, $allItems = true ) {
		$ret = [];
		$lines = explode( "\n", $text );

		$listStart = false;
		foreach ( $lines as $value ) {
			// get only first level of items
			preg_match( '/^\*\s*([^\*].*)$/', $value, $match );
			if ( $match ) {
				$listStart = true;
				if ( !in_array( $match[1], $ret ) ) {
					$ret[] = $match[1];
				}
			} elseif ( $listStart && !$allItems && empty( $value ) ) {
				break;
			}
		}
		return $ret;
	}

	/**
	 * @param array &$ret
	 */
	public function handleOptionsValues( &$ret ) {
		$values = [];
		$wiki = $ret['wiki'];

		if ( !empty( $wiki['options-values'] ) ) {
			$values = $wiki['options-values'];

		} elseif ( !empty( $wiki['options-wikilist'] ) ) {
			$title_ = \Title::newFromText( $wiki['options-wikilist'] );

			if ( $title_ && $title_->isKnown() ) {
				$text_ = \PageProperties::getWikipageContent( $title_ );
				$values = $this->parseWikilist( $text_ );
			}
		}

		if ( array_key_exists( 'options-allow-null', $wiki ) && $wiki['options-allow-null'] ) {
			array_unshift( $values, '' );
		}

		if ( !count( $values ) ) {
			unset( $ret['enum'] );
			return;
		}

		if ( empty( $wiki['options-label-formula'] ) ) {
			$ret['enum'] = $values;
			$ret['wiki']['options-values-parsed'] = array_combine( $values, $values );
			return;
		}

		/* e.g.
{{#switch: {{{1}}}
 | A = MapA
 | B = MapB
 | C = MapC
 | TestCat1 = Map1
 | TestCat2 = Map2
}}

*/
		$options = [];
		foreach ( $values as $val ) {
			// @credits: WikiTeq
			$label = $this->parseWikitext(
					$this->replaceFormula( [ 'value' => $val ], $wiki['options-label-formula'] ) );
			// ----------
			$options[ $val ] = ( !empty( $label ) ? $label : $val );
		}

		$ret['enum'] = array_keys( $options );
		$ret['wiki']['options-values-parsed'] = $options;
	}

	/**
	 * @param string $value
	 * @param array|null $properties
	 * @return string
	 */
	private	function parseWikitext( $value, $properties = null ) {
		$output = $this->output;
		$parseWikitext = static function ( $str ) use ( $output, $properties ) {
			// return $this->parser->recursiveTagParseFully( $str );
			$val = Parser::stripOuterParagraph( $output->parseAsContent( $str ) );

			// @FIXME move to a dedicated function
			// use validate filters
			// @see https://www.php.net/manual/en/filter.filters.validate.php
			if ( $properties !== null ) {
				switch ( $properties['type'] ) {
					case 'number':
						$val = filter_var( $val, FILTER_VALIDATE_FLOAT, FILTER_NULL_ON_FAILURE );
						settype( $val, "float" );
						break;

					case 'int':
					case 'integer':
						$val = filter_var( $val, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE );
						settype( $val, "integer" );
						break;

					case 'bool':
					case 'boolean':
						$val = filter_var( $val, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
						settype( $val, "boolean" );
						break;

					case 'string':
					default:
						switch ( $properties['format'] ) {
							case 'url':
								$val = filter_var( $val, FILTER_VALIDATE_URL, FILTER_NULL_ON_FAILURE );
								break;
							case 'email':
								$val = filter_var( $val, FILTER_VALIDATE_EMAIL, FILTER_NULL_ON_FAILURE );
								break;
							case 'number':
								$val = filter_var( $val, FILTER_VALIDATE_FLOAT, FILTER_NULL_ON_FAILURE );
								break;
						}
						// settype( $val, "string" );
				}
			} else {
				$val = trim( $val );
			}
			return $val;
		};
		// *** html_entity_decode is required for the default value in input
		if ( !is_array( $value ) ) {
			return html_entity_decode( $parseWikitext( $value ) );
		}
		return array_filter( array_map( static function ( $value ) use ( &$parseWikitext ) {
			return html_entity_decode( $parseWikitext( $value ) );
		}, $value ) );
	}

	/**
	 * @param array $data
	 * @param string $parentKey
	 * @return array
	 */
	public function parseSchemaRec( $data, $parentKey ) {
		$ret = [];
		if ( !is_array( $data ) ) {
			$ret['type'] = strtolower( $this->getType( $data ) );
			$ret['title'] = ucfirst( str_replace( '_', ' ', $parentKey ) );
			return $ret;
		}

		$isArray = \PageProperties::isList( $data );

		if ( !$isArray ) {
			$ret['type'] = 'object';
			$ret['title'] = ucfirst( str_replace( '_', ' ', $parentKey ) );
			$ret['properties'] = [];
			foreach ( $data as $key => $value ) {
				$ret['properties'][$key] = $this->parseSchemaRec( $value, $key );
			}

			return $ret;
		}

		$ret['type'] = 'array';
		$ret['title'] = ucfirst( str_replace( '_', ' ', $parentKey ) );
		$ret['items'] = [];
		foreach ( $data as $key => $value ) {
			$ret['items'] = $this->parseSchemaRec( $value, '' );
			// @TODO handle tuple
			break;
		}
		return $ret;
	}

	/**
	 * @param string|int|null $value
	 * @return string
	 */
	private function getType( $value ) {
		$type = gettype( $value );

		switch ( $type ) {
			case 'integer':
			case 'double':
				return 'number';
			default:
				return $type;
		}
	}

}
