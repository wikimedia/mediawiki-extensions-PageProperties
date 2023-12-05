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
 * @copyright Copyright ©2021-2023, https://wikisphere.org
 */

namespace MediaWiki\Extension\PageProperties;

use RequestContext;
use SMW\MediaWiki\MediaWikiNsContentReader;

// @TODO to be integrated ...

class SemanticMediawiki {
	/** @var \SMW\Options */
	protected static $SMWOptions = null;

	/** @var \SMW\ApplicationFactory */
	protected static $SMWApplicationFactory = null;

	/** @var \SMW\Store */
	public static $SMWStore = null;

	/** @var \SMW\DataValueFactory */
	public static $SMWDataValueFactory = null;

	/** @var int */
	public static $queryLimit = 500;

	/** @var SlotsParserOutput */
	private static $SlotsParserOutput = [];

	/**
	 * @see extensions/SemanticMediaWiki/import/groups/predefined.properties.json
	 * @var string[]
	 */
	public static $exclude = [
		// content_group
		"_SOBJ",
		"_ASK",
		"_MEDIA",
		"_MIME",
		"_ATTCH_LINK",
		"_FILE_ATTCH",
		"_CONT_TYPE",
		"_CONT_AUTHOR",
		"_CONT_LEN",
		"_CONT_LANG",
		"_CONT_TITLE",
		"_CONT_DATE",
		"_CONT_KEYW",
		"_TRANS",
		"_TRANS_SOURCE",
		"_TRANS_GROUP",

		// declarative
		"_TYPE",
		"_UNIT",
		// imported from
		"_IMPO",
		"_CONV",
		"_SERV",
		"_PVAL",
		"_LIST",
		"_PREC",
		"_PDESC",
		"_PPLB",
		"_PVAP",
		"_PVALI",
		"_PVUC",
		// "_PEID",
		"_PEFU",

		// schema
		"_SCHEMA_TYPE",
		"_SCHEMA_DEF",
		"_SCHEMA_DESC",
		"_SCHEMA_TAG",
		"_SCHEMA_LINK",
		"_FORMAT_SCHEMA",
		"_CONSTRAINT_SCHEMA",
		"_PROFILE_SCHEMA",

		// classification_group
		"_INST",
		"_PPGR",
		"_SUBP",
		"_SUBC"
	];

	/**
	 * *** special properties related to property definitions
	 * @see https://www.semantic-mediawiki.org/wiki/Help:Special_properties
	 * @var string[]
	 */
	public static $specialPropertyDefinitions = [
		'_PVAL',
		'_CONV',
		'_UNIT',
		'_URI',
		'_SERV',
		'_SUBP',
		'_LIST',
		'_PVAP',
		'_PREC',
		'_PDESC',
		'_PVUC',
		'_PVALI',
		'_PEFU',
		'_PEID',
		'_PPLB'
	];

	/**
	 * @return void
	 */
	public static function initSMW() {
		if ( !defined( 'SMW_VERSION' ) ) {
			return;
		}
		self::$SMWOptions = new \SMWRequestOptions();
		self::$SMWOptions->limit = self::$queryLimit;
		self::$SMWStore = \SMW\StoreFactory::getStore();
		// self::$SMWStore = $applicationFactory->getStore( '\\SMW\SQLStore\SQLStore' );
		self::$SMWDataValueFactory = \SMW\DataValueFactory::getInstance();
		self::$SMWApplicationFactory = \SMW\Services\ServicesFactory::getInstance();
	}

	/**
	 * @param Content $content
	 * @param Title $title
	 * @param ParserOutput &$parserOutput
	 * @return void
	 */
	public static function onContentAlterParserOutput( Content $content, Title $title, ParserOutput &$parserOutput ) {
		if ( !method_exists( ParserOutput::class, 'mergeMapStrategy' ) ) {
			$semanticData = $parserOutput->getExtensionData( \SMW\ParserData::DATA_ID );
			if ( !( $semanticData instanceof \SMW\SemanticData ) ) {
				$semanticData = new SMW\SemanticData( SMW\DIWikiPage::newFromTitle( $title ) );
			}
			self::updateSemanticData( $semanticData, 'onContentAlterParserOutput' );
			$parserOutput->setExtensionData( \SMW\ParserData::DATA_ID, $semanticData );
			return;
		}

		// *** this is an hack to prevent the error "Cannot use object of type SMW\SemanticData as array"
			// includes/parser/ParserOutput.php(2297) function mergeMapStrategy
			// includes/parser/ParserOutput.php(2163): ParserOutput::mergeMapStrategy()
			// includes/Revision/RevisionRenderer.php(271): ParserOutput->mergeHtmlMetaDataFrom()
			// includes/Revision/RevisionRenderer.php(158): MediaWiki\Revision\RevisionRenderer->combineSlotOutput()
		// *** it is only necessary from 1.38 and higher versions
		// *** remove SemanticData from the first slot(s) and
		// *** attach in the pageproperties slot (it will be merged in the combined output)

		$key = $title->getFullText();
		if ( !array_key_exists( $key, self::$SlotsParserOutput ) ) {
			$slots = \PageProperties::getSlots( $title );

			if ( !$slots ) {
				return;
			}

			if ( !array_key_exists( SLOT_ROLE_PAGEPROPERTIES, $slots ) ) {
				return;
			}

			self::$SlotsParserOutput[ $key ] = [ 'content' => $slots[SLOT_ROLE_PAGEPROPERTIES]->getContent() ];
		}

		if ( !self::$SlotsParserOutput[ $key ][ 'content' ]->equals( $content ) ) {
			$semanticData = $parserOutput->getExtensionData( \SMW\ParserData::DATA_ID );
			if ( !( $semanticData instanceof \SMW\SemanticData ) ) {
				$semanticData = new SMW\SemanticData( SMW\DIWikiPage::newFromTitle( $title ) );
			}
			self::updateSemanticData( $semanticData, 'onContentAlterParserOutput' );
			self::$SlotsParserOutput[ $key ]['data'] = $semanticData;
			$parserOutput->setExtensionData( \SMW\ParserData::DATA_ID, null );

		// *** this assumes that pageproperties is the last slot, isn't so ?
		} elseif ( !empty( self::$SlotsParserOutput[ $key ]['data'] ) ) {
			$parserOutput->setExtensionData( \SMW\ParserData::DATA_ID, self::$SlotsParserOutput[ $key ]['data'] );
		}
	}

	/**
	 * @param SemanticData &$semanticData
	 * @param string $caller
	 * @return void
	 */
	public static function updateSemanticData( &$semanticData, $caller ) {
		// phpcs:ignore Generic.CodeAnalysis.UnconditionalIfStatement.Found
		if ( true ) {
			return;
		}
		$subject = $semanticData->getSubject();
		$title = $subject->getTitle();

		$page_properties = \PageProperties::getPageProperties( $title );

		if ( $page_properties === false ) {
			return;
		}

		// do not retrieve from the onBeforeInitialize hook!
		$SMWDataValueFactory = \SMW\DataValueFactory::getInstance();
		$valueCaption = false;

		if ( !empty( $page_properties['page-properties']['categories'] ) ) {
			$namespace = $subject->getNamespace();
			foreach ( $page_properties['page-properties']['categories'] as $category ) {
				if ( !empty( $category ) ) {
					$cat = new \SMW\DIWikiPage( $category, NS_CATEGORY );
					$property = new \SMW\DIProperty( $namespace !== NS_CATEGORY ? \SMW\DIProperty::TYPE_CATEGORY : \SMW\DIProperty::TYPE_SUBCATEGORY );
					$dataValue = $SMWDataValueFactory->newDataValueByItem( $cat, $property, $valueCaption, $subject );
					$semanticData->addDataValue( $dataValue );
				}
			}
		}

		// if ( !empty( $page_properties['semantic-forms'] ) ) {
		// 	$property = new \SMW\DIProperty( '__pageproperties_semantic_form' );
		// 	$semanticData->removeProperty( $property );
		// 	foreach ( $page_properties['semantic-forms'] as $form ) {
		// 		if ( !empty( $form ) ) {
		// 			$dataValue = $SMWDataValueFactory->newDataValueByProperty( $property, (string)$form, $valueCaption, $subject );
		// 			$semanticData->addDataValue( $dataValue );
		// 		}
		// 	}
		// }

		if ( !empty( $page_properties['schemas'] ) ) {
			$context = new RequestContext();
			$context->setTitle( $title );
			$output = $context->getOutput();

			$schemas = \PageProperties::getSchemas( $output, $page_properties );
			// @TODO use a method independent from SMW to identify forms
			// @see updatePagesFormsJobs
			// $property = new \SMW\DIProperty( '__pageproperties_semantic_form' );
			// $semanticData->removeProperty( $property );

			foreach ( $page_properties['schemas'] as $schemaName => $values ) {
				if ( !array_key_exists( $schemaName, $schemas ) ) {
					continue;
				}
				$descriptor = $schemas[$schemaName];
				// $dataValue = $SMWDataValueFactory->newDataValueByProperty( $property, (string)$form, $valueCaption, $subject );
				// $semanticData->addDataValue( $dataValue );

				// @TODO make this recursive
				foreach ( $values as $label => $value ) {
					if ( strpos( $label, '__' ) === 0 ) {
						continue;
					}
					$field = $descriptor['properties'][$label];

					// if ( !in_array( $field['type'], $self::schemaTypes ) ) {
					// 	continue;
					// }

					if ( !array_key_exists( 'SMW-property', $field ) ) {
						continue;
					}

					$property = \SMW\DIProperty::newFromUserLabel( $field['SMW-property'] );

					if ( !is_array( $value ) ) {
						$value = [ $value ];
					}
					foreach ( $value as $val ) {
						if ( $val !== "" ) {
							if ( is_bool( $val ) ) {
								$val = ( !empty( $val ) ? 'yes' : 'no' );
							}
							$dataValue = $SMWDataValueFactory->newDataValueByProperty( $property, (string)$val, $valueCaption, $subject );
							$semanticData->addDataValue( $dataValue );
						}
					}
				}
			}
		}
	}

	/**
	 * *** currently unused
	 * @param Title $title
	 * @return array
	 */
	public static function getSemanticData( Title $title ) {
		// $subject = new \SMW\DIWikiPage( $title, NS_MAIN );
		$subject = \SMW\DIWikiPage::newFromTitle( $title );
		$semanticData = self::$SMWStore->getSemanticData( $subject );
		$ret = [];

		foreach ( $semanticData->getProperties() as $property ) {
			$key = $property->getKey();
			if ( in_array( $key, self::$exclude ) ) {
				continue;
			}
			$propertyDv = self::$SMWDataValueFactory->newDataValueByItem( $property, null, false, $subject );

			if ( !$property->isUserAnnotable() || !$propertyDv->isVisible() ) {
				continue;
			}

			foreach ( $semanticData->getPropertyValues( $property ) as $dataItem ) {
				$dataValue = self::$SMWDataValueFactory->newDataValueByItem( $dataItem, $property, false, $subject );

				if ( $dataValue->isValid() ) {
					$label = $property->getLabel();

					// @TODO, get appropriate methods of other dataValues
					if ( $dataValue instanceof \SMWTimeValue ) {
						$ret[ $label ][] = $dataValue->getISO8601Date();
					} else {
						$dataValue->setOption( 'no.text.transformation', true );
						$dataValue->setOption( 'form/short', true );
						$ret[ $label ][] = $dataValue->getWikiValue();
					}
				}
			}
		}

		return $ret;
	}

	/**
	 * @param array $properties
	 * @return array
	 */
	public static function getSemanticProperties( $properties ) {
		$ret = [];
		foreach ( $properties as $label ) {
			if ( !$label ) {
				continue;
			}
			$prop = \SMW\DIProperty::newFromUserLabel( $label );
			$ret[$label] = [ $prop, $prop->getKey(), $prop->getLabel(), $prop->isUserDefined() ];
		}

		return self::formatSemanticProperties( $ret );
	}

	/**
	 * @param array $properties
	 * @param array|null $pageproperties
	 * @return array
	 */
	public static function formatSemanticProperties( $properties, $pageproperties = null ) {
		$dataTypeRegistry = \SMW\DataTypeRegistry::getInstance();
		$dataValueFactory = \SMW\DataValueFactory::getInstance();
		$langCode = \RequestContext::getMain()->getLanguage()->getCode();
		$propertyRegistry = \SMW\PropertyRegistry::getInstance();

		if ( !$pageproperties ) {
			$specialPropertyDefinitions = array_merge( self::$specialPropertyDefinitions, [ '_TYPE', '_IMPO' ] );

		} else {
			$typeLabels = $dataTypeRegistry->getKnownTypeLabels();

			array_walk( $pageproperties, static function ( &$value ) {
				if ( !is_array( $value ) ) {
					 $value = [ $value ];
				}
			} );
		}

		$ret = [];
		foreach ( $properties as $value ) {
			list( $property, $property_key, $label, $userDefined ) = $value;

			if ( $userDefined ) {
				$title_ = \Title::makeTitleSafe( SMW_NS_PROPERTY,  $label );
				if ( !$title_ || !$title_->isKnown() ) {
					// see src/Factbox/Factbox.php => createRows()
					$propertyDv = $dataValueFactory->newDataValueByItem( $property, null );

					if ( !self::propertyUsage( $propertyDv ) ) {
						continue;
					}
				}
			}

			$canonicalLabel = $property->getCanonicalLabel();
			$preferredLabel = $property->getPreferredLabel();

			if ( !$pageproperties || !array_key_exists( '_TYPE', $pageproperties ) ) {
				$typeID = $property->findPropertyTypeID();
				// $typeID = $propertyDv->getTypeID();
			} else {
				$typeID = array_search( $pageproperties[ '_TYPE' ][0], $typeLabels );
			}

			$description = $propertyRegistry->findPropertyDescriptionMsgKeyById( $property_key );

			if ( $description ) {
				$description = wfMessage( $description )->text();
			}

			$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );

			if ( empty( $typeLabel ) ) {
				$typeId_ = $dataTypeRegistry->getFieldType( $typeID );
				$typeLabel = $dataTypeRegistry->findTypeLabel( $typeId_ );
			}

			// *** the key should be $label unless
			// the wiki forces the use of canonical names
			// for namespaces and property names, see
			// the following https://github.com/SemanticMediaWiki/SemanticMediaWiki/pull/2358

			$ret[ $label ] = [
				'key' => $property_key,
				'userDefined' => $userDefined,
				'canonicalLabel' => $canonicalLabel,
				'preferredLabel' => $preferredLabel,
				'type' => $typeID,
				'typeLabel' => $typeLabel,
				'description' => $description,
				'properties' => [],
			];

			if ( $pageproperties && !$description ) {
				$ret[ $label ][ 'properties' ] = $pageproperties;

				// @TODO do the same for _PPLB
				// @see https://www.semantic-mediawiki.org/wiki/Help:Special_property_Has_preferred_property_label
				if ( !empty( $pageproperties['_PDESC'] ) ) {
					$property_ = new \SMW\DIProperty( '_PDESC' );
					$dataValues = array_map( static function ( $value ) use ( $dataValueFactory, $property_ ) {
						return $dataValueFactory->newDataValueByProperty( $property_, $value );
					}, $pageproperties['_PDESC'] );

					$ret[ $label ][ 'description' ] = self::getMonolingualText( $langCode, $dataValues );
				}

				continue;
			}

			// *** solution 1, this seems faster
			$semanticData = self::$SMWStore->getSemanticData( $property->getDiWikiPage() );

			// foreach ( $semanticData->getProperties() as $property_ ) {
			// 	$key_ = $property_->getKey();
			// 	if ( !in_array( $key_, $specialPropertyDefinitions ) ) {
			// 		continue;
			// 	}

			foreach ( $specialPropertyDefinitions as $key_ ) {
				$property_ = new \SMW\DIProperty( $key_ );

				// *** solution 2
				// $values = self::$SMWStore->getPropertyValues( $property->getDiWikiPage(), $property_ );

				$values = $semanticData->getPropertyValues( $property_ );

				if ( !$values ) {
					continue;
				}

				$dataValues = array_map( static function ( $value ) use ( $dataValueFactory, $property_ ) {
					return $dataValueFactory->newDataValueByItem( $value, $property_ );
				}, $values );

				foreach ( $dataValues as $dataItem ) {
					$ret[ $label ][ 'properties' ][ $key_ ][] = $dataItem->getWikiValue();
				}

				// @TODO retrieve options described by the property _PVALI
				// @see https://www.semantic-mediawiki.org/wiki/Help:Special_property_Allows_value_list

				// @TODO do the same for _PPLB
				if ( $key_ === '_PDESC' && !$description ) {
					$ret[ $label ][ 'description' ] = self::getMonolingualText( $langCode, $dataValues );
				}
			}
		}

		return $ret;
	}

	/**
	 * @see SemanticMediaWiki/src/DataValues/MonolingualTextValue.php
	 * @param string $langCode
	 * @param array $dataValues
	 * @return string|null
	 */
	public static function getMonolingualText( $langCode, $dataValues ) {
		foreach ( $dataValues as $value ) {
			$desc = $value->getTextValueByLanguageCode( $langCode );
			if ( !empty( $desc ) ) {
				$list = $value->toArray();
				return current( $list );
			}
		}
		return null;
	}

	/**
	 * @return array
	 */
	public static function getAllProperties() {
		$predefinedProperties = self::getPredefinedProperties();
		$properties = self::$SMWStore->getPropertiesSpecial( self::$SMWOptions );

		if ( $properties instanceof \SMW\SQLStore\PropertiesCollector ) {
			// SMW 1.9+
			$properties = array_map( static function ( $value ) {
				return $value[0];
			}, $properties->runCollector() );
		}

		$properties = array_merge( $properties, $predefinedProperties );

		$ret = [];
		foreach ( $properties as $property ) {
			if ( !method_exists( $property, 'getKey' ) ) {
				continue;
			}

			$property_key = $property->getKey();

			if ( empty( $property_key ) ) {
				continue;
			}

			$label = $property->getLabel();

			if ( empty( $label ) ) {
				continue;
			}

			if ( in_array( $property_key, self::$exclude ) ) {
				continue;
			}

			if ( !$property->isUserAnnotable() || !$property->isShown() ) {
				continue;
			}

			$ret[] = [ $property, $property_key, $label, $property->isUserDefined() ];
		}

		return $ret;
	}

	/**
	 * @see SemanticMediawiki/src/Mediawiki/page/PropertyPage.php -> getCount
	 * @param \SMW\SMWDataValue $propertyDv
	 * @return array
	 */
	public static function propertyUsage( $propertyDv ) {
		$requestOptions = self::$SMWOptions;
		$requestOptions->setLimit( 1 );

		$searchLabel = $propertyDv->getSearchLabel();
		$requestOptions->addStringCondition( $searchLabel, \SMW\StringCondition::COND_EQ );

		$cachedLookupList = self::$SMWStore->getPropertiesSpecial( $requestOptions );
		$usageList = $cachedLookupList->fetchList();

		if ( !$usageList || $usageList === [] ) {
			return 0;
		}

		$usage = end( $usageList );
		$usageCount = $usage[1];
		return $usageCount;
	}

	/**
	 * @return array
	 */
	public static function getPredefinedProperties() {
		$ret = [];
		$propertyList = \SMW\PropertyRegistry::getInstance()->getPropertyList();

		// built-in data types
		$typeLabels = \SMW\DataTypeRegistry::getInstance()->getKnownTypeLabels();

		foreach ( $propertyList as $key => $value ) {
			if ( array_key_exists( $key, $typeLabels ) ) {
				continue;
			}

			$ret[] = new \SMW\DIProperty( $key );
		}

		return $ret;
	}

	/**
	 * @return array
	 */
	public static function getImportedVocabularies() {
		$ret = [];
		$IMPORT_PREFIX = \SMW\DataValues\ImportValue::IMPORT_PREFIX;
		$imported_vocabularies = \PageProperties::getPagesWithPrefix( $IMPORT_PREFIX, NS_MEDIAWIKI );

		// see SemanticMediawiki/src/DataValues/ValueParsers/ImportValueParser.php
		$mediaWikiNsContentReader = new MediaWikiNsContentReader;
		foreach ( $imported_vocabularies as $title ) {
			$controlledVocabulary = $mediaWikiNsContentReader->read(
				$title->getText()
			);

			$namespace = substr( $title->getText(), strlen( $IMPORT_PREFIX ) );
			list( $uri, $name, $typelist ) = self::doParse( $controlledVocabulary );

			preg_match( '/\[([^\[\]]+)\]/', $name, $match );
			$vocabulary_label = preg_replace( '/^[^\s]+\s/', '', $match[1] );

			$ret[ $vocabulary_label ] = [];
			foreach ( $typelist as $key => $value ) {
				// if ( $value !== 'Category' && $value !== 'Type:Category' ) {
					$label_value = $namespace . ':' . $key;
					$ret[ $vocabulary_label ][ $label_value ] = str_replace( 'Type:', '', $value );
				// }
			}
		}

		return $ret;
	}

	/**
	 * @see extensions/SemanticMediaWiki/src/DataValues/ValueParsers/ImportValueParser.php (the method is private)
	 * @param array $controlledVocabulary
	 * @return array
	 */
	private static function doParse( $controlledVocabulary ) {
		$list = [];
		$importDefintions = array_map( 'trim', preg_split( "([\n][\s]?)", $controlledVocabulary ) );

		// Get definition from first line
		$fristLine = array_shift( $importDefintions );

		if ( strpos( $fristLine, '|' ) === false ) {
			return;
		}

		list( $uri, $name ) = explode( '|', $fristLine, 2 );

		foreach ( $importDefintions as $importDefintion ) {
			if ( strpos( $importDefintion, '|' ) === false ) {
				continue;
			}

			list( $secname, $typestring ) = explode( '|', $importDefintion, 2 );
			$list[trim( $secname )] = $typestring;
		}

		return [ $uri, $name, $list ];
	}

	/**
	 * @param \SMW\DIProperty $property
	 * @return array
	 */
	public static function getPropertySubjects( $property ) {
		$options = new \SMW\RequestOptions();
		$dataItems = self::$SMWStore->getAllPropertySubjects( $property, $options );

		if ( $dataItems instanceof \Traversable ) {
			$dataItems = iterator_to_array( $dataItems );
		}

		return array_map( static function ( $value ) {
			return $value->getTitle();
		}, $dataItems );
	}

	/**
	 * @param array $array
	 * @param string $property
	 * @return null|string|bool|int
	 */
	public static function firstPropertyValue( $array, $property ) {
		if ( !array_key_exists( $property, $array ) ) {
			return null;
		}

		$value = $array[$property];

		if ( !is_array( $value ) ) {
			return $value;
		}

		if ( !count( $value ) ) {
			return null;
		}

		return $value[0];
	}

	/**
	 * @see SemanticTasks/src/Query.php
	 * @param string $query_string
	 * @param array(String) $properties_to_display
	 * @param array|null $parameters
	 * @param bool|null $display_title
	 * @return \SMWQueryResult
	 */
	public static function getQueryResults( $query_string, $properties_to_display, $parameters = [], $display_title = true ) {
		if ( self::$SMWDataValueFactory === null ) {
			self::initSMW();
		}

		$printouts = [];
		foreach ( $properties_to_display as $property ) {
			// @see SemanticMediaWiki/src/Mediawiki/ApiRequestParameterFormatter.php -> formatPrintouts
			$printouts[] = new \SMWPrintRequest(
				\SMWPrintRequest::PRINT_PROP,
				$property,
				self::$SMWDataValueFactory->newPropertyValueByLabel( $property )
			);
		}

		if ( $display_title ) {
			\SMWQueryProcessor::addThisPrintout( $printouts, $parameters );
		}

		$params = \SMWQueryProcessor::getProcessedParams( $parameters, $printouts );

		$inline = true;
		$query = \SMWQueryProcessor::createQuery( $query_string, $params, $inline, null, $printouts );

		return self::$SMWApplicationFactory->getStore()->getQueryResult( $query );
	}

	/**
	 * @param string $query_string
	 * @param array(String) $properties_to_display
	 * @param array|null $parameters
	 * @param bool $display_title
	 * @return array
	 */
	public static function getQueryLatestPrintouts( $query_string, $properties_to_display, $parameters = [], $display_title = true ) {
		$results = self::getQueryResults( $query_string, $properties_to_display, $parameters, $display_title );
		$arr = $results->serializeToArray();

		if ( !count( $arr['results'] ) ) {
			return [];
		}

		end( $arr['results'] );
		return $arr['results'][key( $arr['results'] )]['printouts'];
	}

	/**
	 * @return array
	 */
	public static function getCategories() {
		$categories = \PageProperties::getAllCategories();

		$dataValueFactory = \SMW\DataValueFactory::getInstance();

		$ret = [];
		foreach ( $categories as $title_ ) {
			// $title = new TitleValue( NS_CATEGORY, $row->cat_title );
			$label = $title_->getText();

			$ret[$label] = [
				'label' => $label,
				'properties' => [],
			];

			$subject = new \SMW\DIWikiPage( $title_->getText(), NS_CATEGORY );

			$semanticData = self::$SMWStore->getSemanticData( $subject );

			$prop = new \SMW\DIProperty( '_IMPO' );

			$values = $semanticData->getPropertyValues( $prop );

			foreach ( $values as $value ) {
				$dataValue = $dataValueFactory->newDataValueByItem( $value, $prop );

				if ( $dataValue instanceof \SMW\DataValues\ImportValue ) {
					$ret[$label]['properties']['_IMPO'][] = $dataValue->getWikiValue();
				}
			}
		}

		return $ret;
	}

	/**
	 * @param string $type
	 * @return array
	 */
	public static function smwTypeToSchema( $type ) {
		switch ( $type ) {
			// Annotation URI
			case '_anu':
				return [ 'string', 'url' ];

			// email
			case '_ema':
				return [ 'string', 'email' ];

			// Quantity
			case '_qty':
				return [ 'string', 'number' ];

			// number
			case '_num':
				return [ 'number' ];

			// temperature
			case '_tem':
				return [ 'string', 'number' ];

			// Record
			case '_rec':
				return [ 'string', 'text' ];

			// External identifier
			case '_eid':
				return [ 'string', 'text' ];

			// Reference
			case '_ref_rec':
				return [ 'string', 'text' ];

			// Monolingual text
			case '_mlt_rec':
				return [ 'string', 'text' ];

			// Keyword
			case '_keyw':
				return [ 'string', 'text' ];

			// Geographic coordinates
			// @see https://json-schema.org/learn/miscellaneous-examples.html
			case '_geo':
				return [
					[
						'$id' => 'https://example.com/geographical-location.schema.json',
						'$schema' => 'https://json-schema.org/draft/2020-12/schema',
						'title' => 'Longitude and Latitude Values',
						'description' => 'A geographical coordinate.',
						'required' => [ 'latitude', 'longitude' ],
						'type' => 'object',
						'properties' => [
							'latitude' => [
								'type' => 'number',
								'minimum' => -90,
								'maximum' => 90
							],
							'longitude' => [
								'type' => 'number',
								'minimum' => -180,
								'maximum' => 180
							]
						]
					]
				];

			case '_uri':
				return [ 'string', 'url' ];

			// code
			case '_cod':
				return [ 'string', 'text' ];

			// telephone
			case '_tel':
				return [ 'string', 'tel' ];

			// boolean
			case '_boo':
				return [ 'boolean' ];

			case '_dat':
				return [ 'string', 'datetime' ];

			case '_wpg':
				return [ 'string', 'text' ];

			case '_txt':
				return [ 'string', 'text' ];
		}

		return [ 'string', 'text' ];
	}
}
