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

if ( is_readable( __DIR__ . '/../vendor/autoload.php' ) ) {
	include_once __DIR__ . '/../vendor/autoload.php';
}

include_once __DIR__ . '/specials/LoggerPageProperties.php';
include_once __DIR__ . '/specials/WSSlotsPageProperties.php';

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
		"_PEID",
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
			$outputPage->addHeadItem( 'pageproperties_empty_title', '<style>h1 { border: none; }</style>' );
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

		$contents = WSSlotsPageProperties::getSlotContent( $wikiPage, SLOT_ROLE_PAGEPROPERTIES );
		if ( empty( $contents ) ) {
			return false;
		}

		$contents = $contents->getNativeData();

		$ret = json_decode( $contents, true );
		if ( empty( $contents ) ) {
			return false;
		}

		self::$cached_page_properties[ $key ] = $ret;
		return $ret;
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

		if ( empty( $page_properties['semantic_properties'] ) ) {
			return;
		}

		$semantic_properties = $page_properties['semantic_properties'];

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
		foreach ( $semantic_properties as $label => $value ) {
			// in property pages we don't allow duplicated property
			// labels, by constrast in other pages this is allowed
			// (i.e. properties with multiple values)
			if ( $title->getNamespace() !== SMW_NS_PROPERTY ) {
				list( $label, $value ) = $value;
			}

			$property = SMW\DIProperty::newFromUserLabel( $label );
			$dataValue = $SMWDataValueFactory->newDataValueByProperty( $property, $value, $valueCaption );
			$semanticData->addDataValue( $dataValue );
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

		if ( !empty( $obj['semantic_properties'] ) ) {
			foreach ( $obj['semantic_properties'] as $key => $val ) {
				if ( empty( $val[1] ) ) {
					unset( $obj['semantic_properties'][$key] );
				}
			}
		}

		// unset page properties,
		// this will remove the related slot
		if ( !defined( 'SMW_VERSION' ) || $title->getNamespace() !== SMW_NS_PROPERTY ) {
			if ( !array_key_exists( 'display_title', $obj['page_properties'] )
					&& empty( $obj['semantic_properties'] )
					&& empty( $obj['SEO']['meta'] ) ) {
				$obj = [];
			}
		} else {
			if ( empty( $obj['semantic_properties'] ) ) {
				$obj = [];
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

		return WSSlotsPageProperties::editSlot( $user, $wikiPage, json_encode( $obj ), SLOT_ROLE_PAGEPROPERTIES, $edit_summary, false, '', $doNullEdit );
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
				$outputPage->addHeadItem( $k, Html::element( 'meta', [ 'property' => $k, 'content'  => $url ] ) );
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
			&& !empty( $page_properties['page_properties'] )
			&& array_key_exists( 'display_title', $page_properties['page_properties'] ) ) {
				return $page_properties['page_properties']['display_title'];
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
		self::$SMWStore = \SMW\StoreFactory::getStore();
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
	 * @return array
	 */
	public static function getUnusedProperties() {
		$properties = self::$SMWStore->getUnusedPropertiesSpecial( self::$SMWOptions );

		if ( $properties instanceof SMW\SQLStore\PropertiesCollector ) {
			// SMW 1.9+
			$properties = $properties->runCollector();
		}
		return $properties;
	}

	/**
	 * @return array
	 */
	public static function getUsedProperties() {
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
	public static function getSpecialProperties() {
		$properties = [];
		$propertyList = SMW\PropertyRegistry::getInstance()->getPropertyList();
		$typeLabels = SMW\DataTypeRegistry::getInstance()->getKnownTypeLabels();

		foreach ( $propertyList as $key => $property ) {
			if ( !array_key_exists( $key, $typeLabels ) ) {
				$properties[] = new SMW\DIProperty( $key );
			}
		}
		return $properties;
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
	 * @param User $user
	 * @param Title $title
	 * @param string $scope
	 * @return bool|int|void
	 */
	public static function isAuthorized( $user, $title, $scope ) {
		$authorized = ( array_key_exists( '$wgPagePropertiesAuthorized' . $scope, $GLOBALS ) ? $GLOBALS[ '$wgPagePropertiesAuthorized' . $scope ] : null );

		if ( empty( $authorized ) ) {
			$authorized = [];
		}

		if ( !is_array( $authorized ) ) {
			$authorized = preg_split( "/\s*,\s*/", $authorized, -1, PREG_SPLIT_NO_EMPTY );
		}

		$allowed_groups = [ 'sysop' ];
		$authorized = array_unique( array_merge( $authorized, [ 'sysop' ] ) );

		$userGroupManager = ( self::$userGroupManager ?? MediaWikiServices::getInstance()->getUserGroupManager() );

		// ***the following avoids that an user
		// impersonates a group through the username
		$all_groups = array_merge( $userGroupManager->listAllGroups(), $userGroupManager->listAllImplicitGroups() );

		$authorized_users = array_diff( $authorized, $all_groups );
		$authorized_groups = array_intersect( $authorized, $all_groups );

		$user_groups = self::getUserGroups( $userGroupManager, $user );

		$isAuthorized = count( array_intersect( $authorized_groups, $user_groups ) );

		if ( !$isAuthorized ) {
			$isAuthorized = in_array( $user->getName(), $authorized_users );
		}

		if ( !$isAuthorized && $title && class_exists( 'PageOwnership' ) ) {
			list( $role, $permissions ) = \PageOwnership::permissionsOfPage( $title, $user );

			if ( ( $role == 'editor' || $role == 'admin' ) && in_array( 'manage properties', $permissions ) ) {
				return true;
			}
		}

		return $isAuthorized;
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
		$permStatus = $mp->authorizeMove( $user, $reason );

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
			if ( array_key_exists( $from->getFullText(), self::$cached_page_properties ) ) {
				self::$cached_page_properties[ $to->getFullText() ] = self::$cached_page_properties[ $from->getFullText() ];
				unset( self::$cached_page_properties[ $from->getFullText() ] );
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
