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
 * @author thomas-topway-it <thomas.topway.it@mail.com>
 * @copyright Copyright ©2021-2022, https://wikisphere.org
 */

use MediaWiki\MediaWikiServices;
use SMW\MediaWiki\MediaWikiNsContentReader;

if ( is_readable( __DIR__ . '/../vendor/autoload.php' ) ) {
	include_once __DIR__ . '/../vendor/autoload.php';
}

include_once __DIR__ . '/LoggerPageProperties.php';
include_once __DIR__ . '/WSSlotsPageProperties.php';

class PageProperties {
	protected static $cached_page_properties = [];
	protected static $SMWOptions = null;
	protected static $SMWApplicationFactory = null;
	/** @var SMW\Store */
	public static $SMWStore = null;
	/** @var SMW\DataValueFactory */
	public static $SMWDataValueFactory = null;
	/** @var User */
	public static $User;
	/** @var UserGroupManager */
	private static $userGroupManager;
	/** @var array */
	private static $slotsCache = [];

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
		"_SUBC",

		"__pageproperties_preferred_input",
		"__pageproperties_allows_multiple_values",
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
		'_PPLB',
		'__pageproperties_preferred_input',
		'__pageproperties_allows_multiple_values'
	];

	/**
	 * @return void
	 */
	public static function initialize() {
		self::$User = RequestContext::getMain()->getUser();
		self::$userGroupManager = MediaWikiServices::getInstance()->getUserGroupManager();
		self::initSMW();
	}

	/**
	 * @param Title $title
	 * @param OutputPage $outputPage
	 * @return void
	 */
	public static function setJsonLD( $title, $outputPage ) {
		if ( !class_exists( '\EasyRdf\Graph' ) || !class_exists( '\ML\JsonLD\JsonLD' ) ) {
			return;
		}

		// @todo use directly the function makeExportDataForSubject
		// SemanticMediawiki/includes/export/SMW_Exporter.php
		$export_rdf = SpecialPage::getTitleFor( 'ExportRDF' );
		if ( $export_rdf->isKnown() ) {
			$export_url = $export_rdf->getFullURL( [ 'page' => $title->getFullText(), 'recursive' => '1', 'backlinks' => 0 ] );
			$foaf = new \EasyRdf\Graph( $export_url );
			$foaf->load();

			$format = \EasyRdf\Format::getFormat( 'jsonld' );
			$output = $foaf->serialise( $format, [
				// ***see vendor/easyrdf/easyrdf/lib/Serialiser/JsonLd.php
				// this will convert
				// [{"@value":"a"},{"@value":"b"}]
				// to ["a", "b"]
				'compact' => true,
			] );

			// https://hotexamples.com/examples/-/EasyRdf_Graph/serialise/php-easyrdf_graph-serialise-method-examples.html
			if ( is_scalar( $output ) ) {
				$outputPage->addHeadItem( 'json-ld', Html::Element(
						'script', [ 'type' => 'application/ld+json' ], $output
					)
				);
			}
		}
	}

	/**
	 * @param Title $title
	 * @return null|array
	 */
	public static function getSlots( $title ) {
		$key = $title->getFullText();

		if ( array_key_exists( $key, self::$slotsCache ) ) {
			return self::$slotsCache[$key];
		}

		$wikiPage = self::getWikiPage( $title );

		if ( !$wikiPage ) {
			return;
		}
		$revision = $wikiPage->getRevisionRecord();

		if ( !$revision ) {
			return;
		}

		self::$slotsCache[$key] = $revision->getSlots()->getSlots();

		return self::$slotsCache[$key];
	}

	/**
	 * @param Title $title
	 * @return void
	 */
	public static function emptySlotsCache( $title ) {
		$key = $title->getFullText();
		unset( self::$slotsCache[$key] );
	}

	/**
	 * @param Title $title
	 * @param array $slots
	 * @return void
	 */
	public static function setSlots( $title, $slots ) {
		$key = $title->getFullText();
		self::$slotsCache[$key] = $slots;
	}

	/**
	 * @param Title $title
	 * @param OutputPage $outputPage
	 * @return void
	 */
	public static function setMetaAndTitle( $title, $outputPage ) {
		global $wgSitename;
		$meta = [];
		$mainPage = Title::newMainPage();

		// the current page is other than the main page
		if ( $mainPage->getText() != $title->getText() ) {
			// null, [ 'meta_entire_site' => 1 ]
			$page_properties = self::getPageProperties( $mainPage, true );

			if ( !empty( $page_properties['SEO']['entire_site'] ) && !empty( $page_properties['SEO']['meta'] ) ) {
				$meta = $page_properties['SEO']['meta'];
			}
		}

		// retrieve page properties of all ancestors including
		// current page
		$meta = array_merge( $meta, self::getMergedMetas( $title ) );

		if ( !empty( $meta ) ) {
			$meta_underscored = [];
			array_walk( $meta, static function ( $value, $key ) use( &$meta_underscored ) {
				$meta_underscored[ str_replace( ' ', '_', $key ) ] = $value;
			} );

			if ( class_exists( 'MediaWiki\Extension\WikiSEO\WikiSEO' ) ) {
				$seo = new MediaWiki\Extension\WikiSEO\WikiSEO();
				$seo->setMetadata( $meta_underscored );
				$seo->addMetadataToPage( $outputPage );

			} else {
				self::addMetaToPage( $outputPage, $meta_underscored );
			}
		}

		$page_title = self::getDisplayTitle( $title );

		if ( $page_title === false ) {
			$page_title = $title->getText();
		}

		$html_title_already_set = ( array_key_exists( 'title', $meta ) && class_exists( 'MediaWiki\Extension\WikiSEO\WikiSEO' ) );

		if ( $html_title_already_set ) {
			$html_title = $outputPage->getHtmlTitle();
		}

		// can be different from the html title
		$outputPage->setPageTitle( $page_title );

		if ( $html_title_already_set ) {
			$outputPage->setHtmlTitle( $html_title );
		}

		// page_title can be null
		if ( empty( $page_title ) ) {
			$outputPage->addHeadItem( 'pageproperties_empty_title', '<style>h1 { border: none; } .mw-body .firstHeading { border-bottom: none; margin-bottom: 0; margin-top: 0; } </style>' );
		}

		if ( !$html_title_already_set && empty( $page_title ) && !array_key_exists( 'title', $meta ) ) {
			$html_title = '';

			if ( $wgSitename != $title->getText() ) {
				$html_title = $title->getText() . ' - ';
			}

			$html_title .= $wgSitename;

			$outputPage->setHTMLTitle( $html_title );

		} elseif ( !$html_title_already_set && array_key_exists( 'title', $meta ) ) {
			$outputPage->setHTMLTitle( $meta[ 'title' ] );
		}
	}

	/**
	 * @param Title $title
	 * @param bool $entire_site
	 * @return false|array
	 */
	public static function getPageProperties( $title, $entire_site = false ) {
		// ***attention!
		// $page_id is 0 for newly created pages
		// $title->getArticleID();
		$key = $title->getFullText();

		// read from cache
		if ( array_key_exists( $key, self::$cached_page_properties ) ) {
			return self::$cached_page_properties[ $key ];
		}

		if ( !$title->canExist() ) {
			return false;
		}
		self::$cached_page_properties[ $key ] = false;

		$wikiPage = self::getWikiPage( $title );

		if ( !$wikiPage ) {
			return false;
		}

		// $contents = WSSlotsPageProperties::getSlotContent( $wikiPage, SLOT_ROLE_PAGEPROPERTIES );
		$slots = self::getSlots( $title );

		if ( !$slots || !array_key_exists( SLOT_ROLE_PAGEPROPERTIES, $slots ) ) {
			return false;
		}

		$content = $slots[SLOT_ROLE_PAGEPROPERTIES]->getContent();

		if ( empty( $content ) ) {
			return false;
		}

		$contents = $content->getNativeData();

		$ret = json_decode( $contents, true );

		if ( empty( $ret ) ) {
			return false;
		}

		// back-compatibility
		self::convertOldDataStructure( $ret );

		self::$cached_page_properties[ $key ] = $ret;
		return $ret;
	}

	/**
	 * @param array &$ret
	 */
	public static function convertOldDataStructure( &$ret ) {
		if ( !empty( $ret['semantic_properties'] ) ) {
			$properties = [];
			foreach ( $ret['semantic_properties'] as $value ) {
				list( $label, $value ) = $value;
				$properties[$label][] = $value;
			}
			foreach ( $properties as $key => $value ) {
				if ( count( $value ) === 1 ) {
					$properties[$key][$label] = $value;
				}
			}
			$ret['semantic_properties'] = $properties;
		}

		$keys = [ 'page_properties' => [ 'display_title' ], 'semantic_properties' => [], 'SEO' => [ 'entire-site' ] ];

		foreach ( $keys as $key => $value ) {
			if ( !array_key_exists( $key, $ret ) ) {
				continue;
			}

			foreach ( $value as $k => $v ) {
				if ( array_key_exists( $k, $ret[$key] ) && strpos( $k, '_' ) !== false ) {
					$ret[$key][ str_replace( '_', '-', $k ) ] = $ret[ $key ][ $k];
					unset( $ret[$key][ $k ] );
				}
			}

			if ( array_key_exists( $key, $ret ) && strpos( $key, '_' ) !== false ) {
				$ret[ str_replace( '_', '-', $key ) ] = $ret[ $key ];
				unset( $ret[ $key ] );
			}
		}
	}

	/**
	 * @param SemanticData &$semanticData
	 * @param string $caller
	 * @return void
	 */
	public static function updateSemanticData( &$semanticData, $caller ) {
		$subject = $semanticData->getSubject();
		$title = $subject->getTitle();

		$page_properties = self::getPageProperties( $title );

		// do not retrieve from the onBeforeInitialize hook!
		$SMWDataValueFactory = SMW\DataValueFactory::getInstance();

		if ( $page_properties === false ) {
			return;
		}

		if ( empty( $page_properties['semantic-properties'] ) ) {
			return;
		}

		$semantic_properties = $page_properties['semantic-properties'];

		// override annotated properties in property page
		if ( $title->getNamespace() === SMW_NS_PROPERTY ) {
			foreach ( $semanticData->getProperties() as $property ) {
				if ( array_key_exists( $property->getLabel(), $semantic_properties ) ) {
					$semanticData->removeProperty( $property );
				}
			}
		}

		$valueCaption = false;
		// see extensions/SemanticMediawiki/src/Parser/InTextAnnotationParser.php
		foreach ( $semantic_properties as $label => $values ) {
			if ( !is_array( $values ) ) {
				$values = [ $values ];
			}

			foreach ( $values as $value ) {
				$property = SMW\DIProperty::newFromUserLabel( $label );
				$dataValue = $SMWDataValueFactory->newDataValueByProperty( $property, $value, $valueCaption );
				$semanticData->addDataValue( $dataValue );
			}
		}
	}

	/**
	 * @see includes/api/ApiBase.php
	 * @param User $user
	 * @param Title $title
	 * @return bool
	 */
	public static function checkWritePermissions( $user, $title ) {
		$actions = [ 'edit' ];
		if ( !$title->exists() ) {
			$actions[] = 'create';
		}

		if ( class_exists( 'MediaWiki\Permissions\PermissionStatus' ) ) {
			$status = new MediaWiki\Permissions\PermissionStatus();
			foreach ( $actions as $action ) {
				$user->authorizeWrite( $action, $title, $status );
			}
			if ( !$status->isGood() ) {
				return false;
			}
			return true;
		}

		$PermissionManager = MediaWikiServices::getInstance()->getPermissionManager();
		$errors = [];
		foreach ( $actions as $action ) {
			$errors = array_merge(
				$errors,
				$PermissionManager->getPermissionErrors( $action, $user, $title )
			);
		}

		return ( count( $errors ) === 0 );
	}

	/**
	 * @param User $user
	 * @param Title $title
	 * @param array $obj
	 * @param bool $doNullEdit
	 * @return null|bool
	 */
	public static function setPageProperties( $user, $title, $obj, $doNullEdit = true ) {
		$canWrite = self::checkWritePermissions( $user, $title );

		if ( !$canWrite ) {
			return false;
		}

		if ( !empty( $obj['semantic-properties'] ) ) {
			// remove empty values and implode arrays with
			// single values
			foreach ( $obj['semantic-properties'] as $key => $val ) {
				if ( is_array( $val ) ) {
					foreach ( $val as $k => $v ) {
						if ( trim( $v ) === "" ) {
							unset( $obj['semantic-properties'][$key][$k] );
						}
					}
					if ( count( $obj['semantic-properties'][$key] ) === 1 ) {
						$obj['semantic-properties'][$key] = current( $obj['semantic-properties'][$key] );
					}
				}
				if ( is_array( $obj['semantic-properties'][$key] ) ) {
					if ( empty( $obj['semantic-properties'][$key] ) ) {
						unset( $obj['semantic-properties'][$key] );
					}
				} elseif ( trim( $obj['semantic-properties'][$key] ) === "" ) {
					unset( $obj['semantic-properties'][$key] );
				}
			}
		}

		if ( !empty( $obj['SEO'] ) ) {
			if ( empty( $obj['SEO']['meta'] ) ) {
				unset( $obj['SEO'] );
			}
		}

		if ( empty( implode( $obj['page-properties']['categories'] ) ) ) {
			unset( $obj['page-properties']['categories'] );
		}

		$keys = [ 'page-properties', 'SEO', 'semantic-properties' ];

		// if $obj is empty the related slot will be removed
		foreach ( $keys as $key ) {
			if ( empty( $obj[$key] ) ) {
				unset( $obj[$key] );
			}
		}

		// previous solution:
		// cache will be unset through the hook onPageSaveComplete
		$edit_summary = "PageProperties update";
		$wikiPage = self::getWikiPage( $title );

		// new solution: update cache
		// $title->getArticleID();
		$key = $title->getFullText();
		self::$cached_page_properties[ $key ] = $obj;

		$ret = WSSlotsPageProperties::editSlot( $user, $wikiPage, ( !empty( $obj ) ? json_encode( $obj ) : '' ), SLOT_ROLE_PAGEPROPERTIES, $edit_summary, false, '', $doNullEdit );

		// the slot cache was preventively populated with the planned revision
		// (see WSSlotsPageProperties.php)
		if ( !$ret || !method_exists( MediaWiki\Storage\PageUpdater::class, 'prepareUpdate' ) ) {
			self::emptySlotsCache( $title );
		}

		return $ret;
	}

	/**
	 * @param Title $title
	 * @return array
	 */
	private static function getMergedMetas( $title ) {
		$page_ancestors = self::page_ancestors( $title, false );

		$output = [];
		foreach ( $page_ancestors as $title_ ) {
			$page_properties_ = self::getPageProperties( $title_ );

			if ( !empty( $page_properties_ )
				 && ( !empty( $page_properties_['SEO']['subpages'] ) || $title_->getArticleID() == $title->getArticleID() )
				 && !empty( $page_properties_['SEO']['meta'] ) ) {
					$output = array_merge( $output, $page_properties_['SEO']['meta'] );
			}
		}

		return $output;
	}

	/**
	 * @param OutputPage $outputPage
	 * @param array $meta
	 * @return void
	 */
	private static function addMetaToPage( $outputPage, $meta ) {
		// Meta tags already set in the page
		$outputMeta = [];

		foreach ( $outputPage->getMetaTags() as $metaTag ) {
			$outputMeta[ $metaTag[0] ] = $metaTag[1];
		}

		foreach ( $meta as $k => $v ) {
			if ( strpos( $k, 'hreflang' ) !== false ) {
				$outputPage->addHeadItem( $k, Html::element( 'link', [ 'rel' => 'alternate', 'href' => $v, 'hreflang' => substr( $k, 9 ) ] ) );
				continue;
			}

			if ( strpos( $k, ':' ) === false ) {
				if ( !array_key_exists( $k, $outputMeta ) ) {
					$outputPage->addMeta( $k, $v );
				}

			} else {
				$outputPage->addHeadItem( $k, Html::element( 'meta', [ 'property' => $k, 'content'  => $v ] ) );
			}
		}
	}

	/**
	 * @param Title $title
	 * @return mixed
	 */
	public static function getDisplayTitle( $title ) {
		$page_properties = self::getPageProperties( $title );
		// display title can be null
		if ( $page_properties !== false
			&& !empty( $page_properties['page-properties'] )
			&& array_key_exists( 'display-title', $page_properties['page-properties'] ) ) {
				return $page_properties['page-properties']['display-title'];
		}
		return false;
	}

	/**
	 * @return void
	 */
	public static function initSMW() {
		if ( !defined( 'SMW_VERSION' ) ) {
			return;
		}
		self::$SMWOptions = new \SMWRequestOptions();
		self::$SMWOptions->limit = 500;
		self::$SMWStore = SMW\StoreFactory::getStore();
		// $applicationFactory = ApplicationFactory::getInstance();
		// self::$SMWStore = $applicationFactory->getStore( '\SMW\SQLStore\SQLStore' );
		self::$SMWDataValueFactory = SMW\DataValueFactory::getInstance();
	}

	/**
	 * @param Title $title
	 * @return void
	 */
	public static function getWikiPage( $title ) {
		// MW 1.36+
		if ( method_exists( MediaWikiServices::class, 'getWikiPageFactory' ) ) {
			return MediaWikiServices::getInstance()->getWikiPageFactory()->newFromTitle( $title );
		}
		return WikiPage::factory( $title );
	}

	/**
	 * @see SemanticMediawiki/includes/querypages/PropertiesQueryPage.php -> getUserDefinedPropertyInfo
	 * @param SMW\DIProperty $property
	 * @param string $key
	 * @return void
	 */
	public static function getPropertyDataValues( $property, $key ) {
		$prop = new SMW\DIProperty( $key );
		$values = self::$SMWStore->getPropertyValues( $property->getDiWikiPage(), $prop );

		if ( !is_array( $values ) || count( $values ) == 0 ) {
			return null;
		}

		$dataValueFactory = SMW\DataValueFactory::getInstance();
		return array_map( static function ( $value ) use( $dataValueFactory, $prop ) {
			return $dataValueFactory->newDataValueByItem( $value, $prop );
		}, $values );
	}

	/**
	 * @param SMW\DIProperty|null $property
	 * @param array|null $storedProperties
	 * @return array
	 */
	public static function getSemanticProperties( $property = null, $storedProperties = [] ) {
		$properties = [];
		$storedPropertiesKeys = [];
		if ( !$property ) {
			$allProperties = array_merge( self::getAllProperties(), self::getPredefinedProperties() );
			$dataValueFactory = SMW\DataValueFactory::getInstance();

			foreach ( $allProperties as $property ) {
				if ( !method_exists( $property, 'getKey' ) ) {
					continue;
				}
				$property_key = $property->getKey();

				if ( empty( $property_key ) ) {
					continue;
				}

				if ( in_array( $property_key, self::$exclude ) ) {
					continue;
				}

				if ( !$property->isUserAnnotable() ) {
					continue;
				}

				// see src/Factbox/Factbox.php => createRows()
				$propertyDv = $dataValueFactory->newDataValueByItem( $property, null );

				if ( !$propertyDv->isVisible() ) {
					continue;
				}

				$userDefined = $property->isUserDefined();
				$label = $property->getLabel();

				if ( $userDefined ) {
					$title_ = Title::makeTitleSafe( SMW_NS_PROPERTY,  $label );
					if ( !$title_ || !$title_->isKnown() ) {
						if ( !self::propertyUsage( $propertyDv ) ) {
							continue;
						}
					}
				}

				$properties[] = [ $property, $property_key, $label, $userDefined ];
			}

		} else {
			$properties[] = [ $property, $property->getKey(), $property->getLabel(), true ];

			if ( $storedProperties ) {
				foreach ( $storedProperties as $key => $value ) {
					$prop = SMW\DIProperty::newFromUserLabel( $key );
					$storedPropertiesKeys[ $prop->getKey() ] = ( is_array( $value ) ? $value : [ $value ] );
				}
			}
		}

		$specialPropertyDefinitions = array_merge( self::$specialPropertyDefinitions, [ '_TYPE', '_IMPO' ] );
		$dataTypeRegistry = SMW\DataTypeRegistry::getInstance();
		$typeLabels = $dataTypeRegistry->getKnownTypeLabels();
		$langCode = RequestContext::getMain()->getLanguage()->getCode();

		$ret = [];
		foreach ( $properties as $value ) {
			list( $property, $property_key, $label, $userDefined ) = $value;

			$canonicalLabel = $property->getCanonicalLabel();
			$preferredLabel = $property->getPreferredLabel();

			if ( array_key_exists( '_TYPE', $storedPropertiesKeys ) ) {
				$typeID = array_search( $storedPropertiesKeys[ '_TYPE' ][0], $typeLabels );
			} else {
				$typeID = $property->findPropertyTypeID();
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
				'description' => null,
				'properties' => [],
			];

			if ( count( $storedPropertiesKeys ) ) {
				foreach ( $storedPropertiesKeys as $key => $value ) {
					$ret[ $label ][ 'properties' ][$key] = $value;
				}
				continue;
			}

			if ( $userDefined ) {
				foreach ( $specialPropertyDefinitions as $key_ ) {

					$dataValues = self::getPropertyDataValues( $property, $key_ );
					if ( $dataValues ) {

						if ( $key_ === '_PDESC' ) {
							foreach ( $dataValues as $value ) {
								$desc = $value->getTextValueByLanguageCode( $langCode );
								if ( !empty( $desc ) ) {
									// @see SemanticMediaWiki/src/DataValues/MonolingualTextValue.php
									$list = $value->toArray();
									$ret[ $label ][ 'description' ] = current( $list );
									break;
								}
							}
						}

						$ret[ $label ][ 'properties' ][ $key_ ] = array_map( static function ( $value ) {
							// @todo return value depending on the datatype
							return $value->getWikiValue();
						}, $dataValues );
					}
				}
			}
		}

		return $ret;
	}

	/**
	 * @see SemanticMediawiki/src/Mediawiki/page/PropertyPage.php -> getCount
	 * @param SMW\SMWDataValue $propertyDv
	 * @return array
	 */
	public static function propertyUsage( $propertyDv ) {
		$requestOptions = self::$SMWOptions;
		$requestOptions->setLimit( 1 );

		$searchLabel = $propertyDv->getSearchLabel();
		$requestOptions->addStringCondition( $searchLabel, SMW\StringCondition::COND_EQ );

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
	public static function getAllProperties() {
		$properties = self::$SMWStore->getPropertiesSpecial( self::$SMWOptions );

		if ( $properties instanceof SMW\SQLStore\PropertiesCollector ) {
			// SMW 1.9+
			$properties = $properties->runCollector();
		}

		return array_map( static function ( $value ) {
				return $value[0];
		}, $properties );
	}

	/**
	 * @return array
	 */
	public static function getPredefinedProperties() {
		$ret = [];
		$propertyList = SMW\PropertyRegistry::getInstance()->getPropertyList();

		// built-in data types
		$typeLabels = SMW\DataTypeRegistry::getInstance()->getKnownTypeLabels();

		foreach ( $propertyList as $key => $value ) {

			if ( in_array( $key, self::$exclude ) ) {
				continue;
			}

			if ( array_key_exists( $key, $typeLabels ) ) {
				continue;
			}

			$ret[] = new SMW\DIProperty( $key );
		}

		return $ret;
	}

	/**
	 * @return array
	 */
	public static function getImportedVocabularies() {
		$ret = [];
		$IMPORT_PREFIX = SMW\DataValues\ImportValue::IMPORT_PREFIX;
		$imported_vocabularies = self::getPagesWithPrefix( $IMPORT_PREFIX, NS_MEDIAWIKI );

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
	 * @param SMW\DIProperty $property
	 * @return array
	 */
	public static function getPropertySubjects( $property ) {
		$options = new SMW\RequestOptions();
		$dataItems = self::$SMWStore->getAllPropertySubjects( $property, $options );

		if ( $dataItems instanceof \Traversable ) {
			$dataItems = iterator_to_array( $dataItems );
		}

		return array_map( static function ( $value ) {
			return $value->getTitle();
		}, $dataItems );
	}

	/**
	 * @param User $user
	 * @param array $arr
	 * @return array
	 */
	public static function bulkUpdateProperties( $user, $arr ) {
		$update_pages = [];
		$titles_map = [];
		foreach ( $arr as $label => $newLabel ) {
			$property = SMW\DIProperty::newFromUserLabel( $label );
			$pages = self::getPropertySubjects( $property );

			foreach ( $pages as $title_ ) {
				$title_text = $title_->getFullText();
				$titles_map[ $title_text ] = $title_;
				$update_pages[ $title_text ][ $label ] = $newLabel;
			}
		}

		if ( count( $update_pages ) ) {
			$user_id = $user->getId();
			$jobs = [];
			foreach ( $update_pages as $title_text => $values ) {
				$title_ = $titles_map[ $title_text ];
				$jobs[] = new PagePropertiesJob( $title_, [ 'user_id' => $user_id, 'values' => $values ] );
			}

			$services = MediaWikiServices::getInstance();
			if ( method_exists( $services, 'getJobQueueGroup' ) ) {
				// MW 1.37+
				$services->getJobQueueGroup()->push( $jobs );
			} else {
				JobQueueGroup::singleton()->push( $jobs );
			}
		}
	}

	/**
	 * @param UserGroupManager $userGroupManager
	 * @param User $user
	 * @param bool $replace_asterisk
	 * @return array
	 */
	public static function getUserGroups( $userGroupManager, $user, $replace_asterisk = false ) {
		$user_groups = $userGroupManager->getUserEffectiveGroups( $user );

		if ( array_search( '*', $user_groups ) === false ) {
			$user_groups[] = '*';
		}

		if ( $replace_asterisk ) {
			$key = array_search( '*', $user_groups );
			$user_groups[ $key ] = 'all';
		}

		return $user_groups;
	}

	/**
	 * @param Title $title
	 * @param bool $exclude_current
	 * @return array
	 */
	public static function page_ancestors( $title, $exclude_current = true ) {
		$output = [];

		$title_parts = explode( '/', $title->getText() );

		if ( $exclude_current ) {
			array_pop( $title_parts );
		}

		$path = [];

		foreach ( $title_parts as $value ) {
			$path[] = $value;
			$title_text = implode( '/', $path );

			if ( $title->getText() == $title_text ) {
				$output[] = $title;

			} else {
				$title_ = Title::newFromText( $title_text );
				if ( $title_->isKnown() ) {
					$output[] = $title_;
				}
			}
		}

		return $output;
	}

	/**
	 * @param array $array
	 * @return string|null
	 */
	public static function array_last( $array ) {
		return ( count( $array ) ? $array[ array_key_last( $array ) ] : null );
	}

	/**
	 * @see specials/SpecialPrefixindex.php -> showPrefixChunk
	 * @param string $prefix
	 * @param int $namespace
	 * @return array
	 */
	public static function getPagesWithPrefix( $prefix, $namespace = NS_MAIN ) {
		$dbr = wfGetDB( DB_REPLICA );

		$conds = [
			'page_namespace' => $namespace,
			'page_is_redirect' => 0,
			'page_title' . $dbr->buildLike( $prefix, $dbr->anyString() )
		];

		$res = $dbr->select(
			'page',
			[ 'page_namespace', 'page_title' ],
			$conds,
			__METHOD__,
			[
				// see here https://doc.wikimedia.org/mediawiki-core/
				'USE INDEX' => ( version_compare( MW_VERSION, '1.36', '<' ) ? 'name_title' : 'page_name_title' ),
			]
		);

		if ( !$res->numRows() ) {
			return [];
		}

		$ret = [];

		foreach ( $res as $row ) {
			$title = Title::newFromRow( $row );

			if ( !$title->isKnown() ) {
				continue;
			}

			$ret[] = $title;
		}

		return $ret;
	}

	/**
	 * @see api/ApiMove.php => MovePage
	 * @param User $user
	 * @param Title $from
	 * @param Title $to
	 * @param string|null $reason
	 * @param bool $createRedirect
	 * @param array $changeTags
	 * @return Status
	 */
	public static function movePage( $user, Title $from, Title $to, $reason = null, $createRedirect = false, $changeTags = [] ) {
		$movePageFactory = MediaWikiServices::getInstance()->getMovePageFactory();
		$mp = $movePageFactory->newMovePage( $from, $to );
		$valid = $mp->isValidMove();

		if ( !$valid->isOK() ) {
			return $valid;
		}

		// ***edited
		if ( method_exists( MovePage::class, 'authorizeMove' ) ) {
			$permStatus = $mp->authorizeMove( $user, $reason );
		} else {
			$permStatus = $mp->checkPermissions( $user, $reason );
		}

		if ( !$permStatus->isOK() ) {
			return $permStatus;
		}

		// Check suppressredirect permission
		//if ( !$this->getAuthority()->isAllowed( 'suppressredirect' ) ) {
		//	$createRedirect = true;
		//}

		// ***edited
		$status = $mp->move( $user, $reason, $createRedirect, $changeTags );

		if ( $status->isOK() ) {
			// update cache
			$from_text = $from->getFullText();
			if ( array_key_exists( $from_text, self::$cached_page_properties ) ) {
				self::$cached_page_properties[ $to->getFullText() ] = self::$cached_page_properties[ $from_text ];
				unset( self::$cached_page_properties[ $from_text ] );
			}
		}

		return $status;
	}

	/**
	 * @param Wikipage $wikipage
	 * @param User $user
	 * @param string $reason
	 * @return void
	 */
	public static function deletePage( $wikipage, $user, $reason ) {
		if ( version_compare( MW_VERSION, '1.35', '<' ) ) {
			$error = '';
			$wikipage->doDeleteArticle( $reason, false, null, null, $error, $user );
		} else {
			$wikipage->doDeleteArticleReal( $reason, $user );
		}
	}
}
