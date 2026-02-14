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
 * @copyright Copyright ©2021-2024, https://wikisphere.org
 */

use MediaWiki\Extension\PageProperties\Aliases\Html as HtmlClass;
use MediaWiki\Extension\PageProperties\Aliases\Title as TitleClass;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\MediaWikiServices;

class PageProperties {

	/** @var array */
	protected static $cachedPageProperties = [];

	/** @var User */
	public static $User;

	/** @var UserGroupManager */
	private static $userGroupManager;

	/** @var Logger */
	private static $Logger;

	/** @var int */
	public static $queryLimit = 500;

	/**
	 * @return void
	 */
	public static function initialize() {
		self::$Logger = LoggerFactory::getInstance( 'PageProperties' );
		self::$User = RequestContext::getMain()->getUser();
		self::$userGroupManager = MediaWikiServices::getInstance()->getUserGroupManager();
	}

	/**
	 * @param Title|Mediawiki\Title\Title $title
	 * @param OutputPage $outputPage
	 * @return void
	 */
	public static function setJsonLD( $title, $outputPage ) {
		if ( !class_exists( '\EasyRdf\Graph' ) || !class_exists( '\ML\JsonLD\JsonLD' ) ) {
			return;
		}

		// @TODO use directly the function makeExportDataForSubject
		// SemanticMediawiki/includes/export/SMW_Exporter.php
		$export_rdf = MediaWikiServices::getInstance()
			->getSpecialPageFactory()
			->getTitleForAlias( 'ExportRDF' );
		if ( $export_rdf ) {
			$export_url = $export_rdf->getFullURL( [ 'page' => $title->getFullText(), 'recursive' => '1', 'backlinks' => 0 ] );

			try {
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

			} catch ( Exception $e ) {
				self::$Logger->error( 'EasyRdf error: ' . $export_url );
				return;
			}

			// https://hotexamples.com/examples/-/EasyRdf_Graph/serialise/php-easyrdf_graph-serialise-method-examples.html
			if ( is_scalar( $output ) ) {
				$outputPage->addHeadItem( 'json-ld', HtmlClass::Element(
						'script', [ 'type' => 'application/ld+json' ], $output
					)
				);
			}
		}
	}

	/**
	 * @param Title|Mediawiki\Title\Title $title
	 * @param array $conds_ null
	 * @return array|false
	 */
	public static function getPageProperties( $title, $conds_ = [] ) {
		if ( !$title || !$title->canExist() ) {
			return false;
		}

		$page_id = $title->getArticleID();
		if ( !$title->isKnown() || empty( $page_id ) ) {
			return false;
		}

		if ( array_key_exists( $page_id, self::$cachedPageProperties ) ) {
			return self::$cachedPageProperties[ $page_id ];
		}
		$conds = [];
		if ( !empty( $page_id ) ) {
			$conds['page_id'] = $page_id;
		}
		$dbr = self::getDB( DB_REPLICA );

		if ( !$dbr->tableExists( 'pageproperties_pageproperties' ) ) {
			return false;
		}

		$row = $dbr->selectRow(
			'pageproperties_pageproperties',
			'*',
			array_merge( $conds, $conds_ ),
			__METHOD__
		);

		if ( !$row ) {
			// phpcs:ignore MediaWiki.Usage.AssignmentInReturn.AssignmentInReturn
			return self::$cachedPageProperties[ $page_id ] = false;
		}

		$row = (array)$row;
		$row['meta'] = ( empty( $row['meta'] ) ? []
			: json_decode( $row['meta'], true ) );

		// phpcs:ignore MediaWiki.Usage.AssignmentInReturn.AssignmentInReturn
		return self::$cachedPageProperties[ $page_id ] = $row;
	}

	/**
	 * @param Title|Mediawiki\Title\Title $title
	 * @param array $obj
	 * @param array &$errors null
	 * @return array|false
	 */
	public static function setPageProperties( $title, $obj, &$errors = [] ) {
		$page_id = $title->getArticleID();
		$date = date( 'Y-m-d H:i:s' );
		$obj['updated_at'] = $date;
		$obj['meta'] = ( !empty( $obj[ 'meta' ] ) ? json_encode( $obj[ 'meta' ] )
			: null );

		$dbr = self::getDB( DB_PRIMARY );
		if ( self::getPageProperties( $title ) === false ) {
			$obj['page_id'] = $page_id;
			$obj['created_at'] = $date;
			$res = $dbr->insert(
				'pageproperties_pageproperties',
				$obj
			);
		} else {
			$res = $dbr->update(
				'pageproperties_pageproperties',
				$obj,
				[ 'page_id' => $page_id ],
				__METHOD__
			);
		}
		// always true
		return $res;
	}

	/**
	 * @param Title|Mediawiki\Title\Title $title
	 * @param OutputPage $outputPage
	 * @return void
	 */
	public static function setMetaAndTitle( $title, $outputPage ) {
		global $wgSitename;
		$meta = [];
		$mainPage = TitleClass::newMainPage();

		// the current page is different than the main page
		if ( $mainPage->getPrefixedDBkey() != $title->getPrefixedDBkey() ) {
			$pageProperties = self::getPageProperties( $mainPage, [ 'meta_entire_site' => 1 ] );

			if ( !empty( $pageProperties['meta_entire_site'] )
				&& !empty( $pageProperties['meta'] ) ) {
				$meta = $pageProperties['meta'];
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

		if ( $page_title !== false ) {
			// can be different from the html title
			$outputPage->setPageTitle( $page_title );

			// required by SkinWMAU
			$outputPage->setDisplayTitle( $page_title );

		} else {
			$page_title = $title->getText();
			if ( !empty( $GLOBALS['wgPagePropertiesDisplayAlwaysUnprefixedTitles'] ) ) {
				$outputPage->setPageTitle( $page_title );

				// required by SkinWMAU
				$outputPage->setDisplayTitle( $page_title );
			}
		}

		// page_title can be an empty string
		if ( empty( $page_title ) ) {
			$outputPage->addHeadItem( 'pageproperties_empty_title', '<style>h1 { border: none; } .mw-body .firstHeading { border-bottom: none; margin-bottom: 0; margin-top: 0; } </style>' );
		}

		$html_title_already_set = ( array_key_exists( 'title', $meta ) && class_exists( 'MediaWiki\Extension\WikiSEO\WikiSEO' ) );

		if ( $html_title_already_set ) {
			return;
		}

		if ( empty( $page_title ) && !array_key_exists( 'title', $meta ) ) {
			$html_title = '';

			if ( $wgSitename != $title->getText() ) {
				$html_title = $title->getText() . ' - ';
			}

			$html_title .= $wgSitename;
			$outputPage->setHTMLTitle( $html_title );

		} elseif ( array_key_exists( 'title', $meta ) ) {
			$outputPage->setHTMLTitle( $meta[ 'title' ] );
		}
	}

	/**
	 * @param Title|Mediawiki\Title\Title $title
	 * @return array
	 */
	private static function getMergedMetas( $title ) {
		$page_ancestors = self::page_ancestors( $title, false );

		$output = [];
		foreach ( $page_ancestors as $title_ ) {
			$pageProperties_ = self::getPageProperties( $title_ );

			if ( !empty( $pageProperties_ )
				 && ( !empty( $pageProperties_['meta_subpages'] ) || $title_->getArticleID() == $title->getArticleID() )
				 && !empty( $pageProperties_['meta'] ) ) {
					$output = array_merge( $output, $pageProperties_['meta'] );
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
				$outputPage->addHeadItem( $k, HtmlClass::element( 'link', [ 'rel' => 'alternate', 'href' => $v, 'hreflang' => substr( $k, 9 ) ] ) );
				continue;
			}

			if ( strpos( $k, ':' ) === false ) {
				if ( !array_key_exists( $k, $outputMeta ) ) {
					$outputPage->addMeta( $k, $v );
				}

			} else {
				$outputPage->addHeadItem( $k, HtmlClass::element( 'meta', [ 'property' => $k, 'content'  => $v ] ) );
			}
		}
	}

	/**
	 * @param Title|Mediawiki\Title\Title $title
	 * @return mixed
	 */
	public static function getDisplayTitle( $title ) {
		$pageProperties = self::getPageProperties( $title );
		// display title can be null
		if ( $pageProperties !== false
			&& $pageProperties['display_title'] !== null ) {
			return $pageProperties['display_title'];
		}
		return false;
	}

	/**
	 * @param Title|Mediawiki\Title\Title $title
	 * @return bool
	 */
	public static function isKnownArticle( $title ) {
		// *** unfortunately we cannot always rely on $title->isContentPage()
		// @see https://github.com/debtcompliance/EmailPage/pull/4#discussion_r1191646022
		// or use $title->exists()
		return ( $title && $title->canExist() && $title->getArticleID() > 0
			&& $title->isKnown() );
	}

	/**
	 * @param Title|Mediawiki\Title\Title $title
	 * @return WikiPage|null
	 */
	public static function getWikiPage( $title ) {
		if ( !$title || !$title->canExist() ) {
			return null;
		}
		// MW 1.36+
		if ( method_exists( MediaWikiServices::class, 'getWikiPageFactory' ) ) {
			return MediaWikiServices::getInstance()->getWikiPageFactory()->newFromTitle( $title );
		}
		return WikiPage::factory( $title );
	}

	/**
	 * @return array
	 */
	public static function getUserGroups() {
		$user = self::$User;
		$UserGroupManager = self::$userGroupManager;
		$user_groups = array_unique( array_merge(
			$UserGroupManager->getUserEffectiveGroups( $user ),
			$UserGroupManager->getUserImplicitGroups( $user )
		) );
		// $key = array_search( '*', $user_groups );
		// $user_groups[ $key ] = 'all';
		return $user_groups;
	}

	/**
	 * @param Title|Mediawiki\Title\Title $title
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
				$title_ = TitleClass::newFromText( $title_text );
				if ( $title_ && $title_->isKnown() ) {
					$output[] = $title_;
				}
			}
		}

		return $output;
	}

	/**
	 * @param string $titleText
	 * @return string
	 */
	public static function currentSubpage( $titleText ) {
		// @see skins/skin.php -> subPageSubtitle()
		$arr = explode( '/', $titleText );
		$ret = '';
		$growinglink = '';
		$display = '';
		foreach ( $arr as $text ) {
			$growinglink .= $text;
			$display .= $text;
			$title_ = TitleClass::newFromText( $growinglink );
			if ( is_object( $title_ ) && $title_->isKnown() ) {
				$ret = $display;
				$display = '';
			} else {
				$display .= '/';
			}
			$growinglink .= '/';
		}
		return $ret;
	}

	/**
	 * @param int $db
	 * @return \Wikimedia\Rdbms\DBConnRef
	 */
	public static function getDB( $db ) {
		if ( !method_exists( MediaWikiServices::class, 'getConnectionProvider' ) ) {
			// @see https://gerrit.wikimedia.org/r/c/mediawiki/extensions/PageEncryption/+/1038754/comment/4ccfc553_58a41db8/
			return MediaWikiServices::getInstance()->getDBLoadBalancer()->getConnection( $db );
		}
		$connectionProvider = MediaWikiServices::getInstance()->getConnectionProvider();
		switch ( $db ) {
			case DB_PRIMARY:
				return $connectionProvider->getPrimaryDatabase();
			case DB_REPLICA:
			default:
				return $connectionProvider->getReplicaDatabase();
		}
	}

}
