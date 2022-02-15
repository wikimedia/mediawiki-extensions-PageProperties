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


use MediaWiki\Linker\LinkRenderer;
use MediaWiki\Linker\LinkTarget;
use MediaWiki\MediaWikiServices;

class PageProperties
{
	protected static $cached_page_properties = [];
	protected static $SMWOptions = null;
	protected static $SMWApplicationFactory = null;
	protected static $SMWStore = null;
	protected static $SMWDataValueFactory = null;
	private static $User;


	// see extensions/SemanticMediaWiki/import/groups/predefined.properties.json
	public static $exclude = [
		//content_group
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

		//declarative
		"_TYPE",
		"_UNIT",
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

		//schema
		"_SCHEMA_TYPE",
		"_SCHEMA_DEF",
		"_SCHEMA_DESC",
		"_SCHEMA_TAG",
		"_SCHEMA_LINK",
		"_FORMAT_SCHEMA",
		"_CONSTRAINT_SCHEMA",
		"_PROFILE_SCHEMA",

		//classification_group
		"_INST",
		"_PPGR",
		"_SUBP",
		"_SUBC"
	];


	public function __constructStatic()
	{

		self::$User = RequestContext::getMain()->getUser();

	}


	public static function initExtension( $credits = [] )
	{

		// see includes/specialpage/SpecialPageFactory.php

		$GLOBALS['wgSpecialPages']['PageProperties'] = [

			'class' => \SpecialPageProperties::class,
			'services' => [
				'ContentHandlerFactory',
				'ContentModelChangeFactory',
				'WikiPageFactory'
			]

		];



	}

	public static function onLoadExtensionSchemaUpdates($updater = null)
	{
		$base = __DIR__;

		$array = [
			['table' => 'page_properties', 'filename' => 'page_properties.sql'],
		];

		if ($updater->getDB()->getType() == 'mysql') {
			foreach ($array as $value) {
				$updater->addExtensionUpdate(
					[
						'addTable', $value['table'],
						$base . '/' . $value['filename'], true
					]
				);
			}
		}
	}



	public static function onSkinTemplateNavigation(SkinTemplate $skinTemplate, array &$links)
	{
		//global $wgTitle;

		$user = self::$User;

		if ( !$user->isRegistered() ) {
			return;
		}

		$title = $skinTemplate->getTitle();
		
		// display page properties only to authorized editors

		if ( $title->getNamespace() != NS_MAIN ) {
			return;
		}

		if ( !$title->exists() ) {
			return;
		}

		$isAuthorized = \PagePropertiesFunctions::isAuthorized( $user, $title );


		if ( $isAuthorized ) {
			$specialpage = Title::newFromText( 'Special:PageProperties' )->getLocalURL();
			$links[ 'actions' ][] = [ 'text' => 'Properties', 'href' => $specialpage . '/' . wfEscapeWikiText( $title->getPartialURL() ) ];
		}
	}

	public static function getPageProperties($page_id, $conds_ = [] )
	{

		// read from cache
		if ( !empty( $page_id ) && array_key_exists( $page_id, self::$cached_page_properties ) ) {
			return self::$cached_page_properties[ $page_id ];
		}


		$conds = [];

		if ( !empty( $page_id ) ) {
			$conds['page_id'] = $page_id;
		}

		$dbr = wfGetDB(DB_REPLICA);

// 'page_title ' . $dbr->buildLike( $oldusername->getDBkey() . '/', $dbr->anyString() )

		$row = $dbr->selectRow(
			'page_properties',
			'*',
			array_merge( $conds, $conds_ ),
			__METHOD__
		);

		$row = (array)$row;

		if ( !$row || $row == [false] ) {
			return false;
		}

		$row['meta'] = ( empty( $row['meta'] ) ? [] : json_decode( $row['meta'], true ) );

		self::$cached_page_properties[ $row['page_id'] ] = $row;

		return $row;
	}



	private static function getMergedMetas($title) {

		$page_ancestors = \PagePropertiesFunctions::page_ancestors( $title, false );

		$output = [];

		foreach ( $page_ancestors as $title_ ) {

			$page_properties_ = self::getPageProperties( $title_->getArticleID() );

			if ( !empty( $page_properties_ ) && ( !empty( $page_properties_['meta_subpages'] ) || $title_->getArticleID() == $title->getArticleID() ) && !empty( $page_properties_['meta'] ) ) {
				$output = array_merge( $output, $page_properties_['meta'] );
			}

		}

		return $output;

	}



	public static function BeforePageDisplay(OutputPage $outputPage, Skin $skin)
	{
		global $wgSitename;
		global $wgScriptPath;


		$title = $outputPage->getTitle();

		if ( $outputPage->isArticle() && $title->isKnown() ) {

			$meta = [];

			$mainPage = Title::newMainPage();

			if ( $mainPage->getText() != $title->getText() ) {
				$page_properties = self::getPageProperties(null, [ 'meta_entire_site' => 1 ]);

				if ( !empty( $page_properties['meta'] ) ) {
					$meta = $page_properties['meta'];
				}
	
			}

			$meta = array_merge( $meta, self::getMergedMetas( $title ) );


			if ( !empty( $meta ) ) {
					
				$meta = array_map( function( $value ) {
					return str_replace( ' ', '_', $value );
				}, $meta );


				if ( class_exists( 'MediaWiki\Extension\WikiSEO\WikiSEO' ) ) {
					$seo = new MediaWiki\Extension\WikiSEO\WikiSEO();
					$seo->setMetadata( $meta );
					$seo->addMetadataToPage( $outputPage );
			
				} else {
					self::addMetadataToPage( $outputPage, $meta );
				}

			}

			$page_title = self::getDisplayTitle( $title );

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
				$outputPage->addHeadItem('pageproperties_empty_title', '<style>h1 { border: none; }</style>');
			}


			if ( !$html_title_already_set && empty( $page_title ) && !array_key_exists( 'title', $meta )  ) {

				$html_title = '';
	
				if ( $wgSitename != $title->getText() ) {
					$html_title = $title->getText() . ' - ';
				}

				$html_title .= $wgSitename;

				$outputPage->setHTMLTitle( $html_title );

			} else if ( !$html_title_already_set && array_key_exists( 'title', $meta ) ) {
				$outputPage->setHTMLTitle( $meta[ 'title' ] );
			}

		}

	}



	private static function addMetaToPage( $outputPage, $meta ) 
	{

// Meta tags already set in the page
		$outputMeta = [];
		foreach ( $this->outputPage->getMetaTags() as $metaTag ) {
			$outputMeta[ $metaTag[0] ] = $metaTag[1];
		}

		foreach ( $meta as $k => $v ) {

			if ( strpos( $k, 'hreflang' ) !== false ) {

				$outputPage->addHeadItem(
					$k, Html::element(
						'link', [
							'rel' => 'alternate',
							'href' => $v,
							'hreflang' => substr( $k, 9 ),
						]
					)
												
				);

				continue;

			}


			if ( strpos( $k, ':' ) === false ) {

				if ( !array_key_exists( $k, $outputMeta ) ) {
					$outputPage->addMeta( $k, $v );
				}

			} else {

				$outputPage->addHeadItem($k, Html::element(
						'meta', [ 'property' => $k, 'content'  => $url ]
					)
				);

			}

		}

	}


// https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/DisplayTitle/+/refs/heads/REL1_36/includes/DisplayTitleHooks.php
	public static function onHtmlPageLinkRendererBegin(
		LinkRenderer $linkRenderer,
		LinkTarget $target,
		&$text,
		&$extraAttribs,
		&$query,
		&$ret
	)
	{

		// Do not use DisplayTitle if current page is defined in $wgDisplayTitleExcludes
		$config = MediaWikiServices::getInstance()->getMainConfig();
		$request = $config->get('Request');
		$title = $request->getVal('title');

		// ***edited
		if (isset($GLOBALS['wgDisplayTitleExcludes']) && in_array($title, $GLOBALS['wgDisplayTitleExcludes'])) {
			return;
		}


		// ***edited
		// show standard title in special pages
		$title_obj = Title::newFromText($title);

		if ($title_obj && $title_obj->getNamespace() != NS_MAIN) {
			return;
		}

		$title = Title::newFromLinkTarget($target);
		self::handleLink($title, $text, true);
	}


// https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/DisplayTitle/+/refs/heads/REL1_36/includes/DisplayTitleHooks.php
	public static function onSelfLinkBegin(
		Title $nt,
		&$html,
		&$trail,
		&$prefix,
		&$ret
	)
	{
		// Do not use DisplayTitle if current page is defined in $wgDisplayTitleExcludes
		$config = MediaWikiServices::getInstance()->getMainConfig();
		$request = $config->get('Request');
		$title = $request->getVal('title');
		if (in_array($title, $GLOBALS['wgDisplayTitleExcludes'])) {
			return;
		}

		self::handleLink($nt, $html, false);
	}


// https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/DisplayTitle/+/refs/heads/REL1_36/includes/DisplayTitleHooks.php
	private static function handleLink(Title $target, &$html, $wrap)
	{
		$customized = false;

		if (isset($html)) {
			$title = null;
			$text = null;
			if (is_string($html)) {
				$text = str_replace('_', ' ', $html);
			} elseif (is_int($html)) {
				$text = (string)$html;
			} elseif ($html instanceof HtmlArmor) {
				$text = str_replace('_', ' ', HtmlArmor::getHtml($html));
			}

			// handle named Semantic MediaWiki subobjects (see T275984)
			// by removing trailing fragment
			$fragment = $target->getFragment();
			if ($fragment != '') {
				$fragment = '#' . $fragment;
				$fraglen = strlen($fragment);
				if (strrpos($text, $fragment) == strlen($text) - $fraglen) {
					$text = substr($text, 0, 0 - $fraglen);
					if ($wrap) {
						$html = new HtmlArmor($text);
					}
				}
			}

			$customized = ($text !== null
				&& $text != $target->getPrefixedText()
				&& $text != $target->getText()
			);
		}

		if ( !$customized ) {
			$html_ = self::getDisplayTitle($target);

			if (!empty($html_)) {
				$html = $html_;

				if ($wrap) {
					$html = new HtmlArmor($html);
				}
			}
		}
	}

	public static function getDisplayTitle( $title )
	{
		$page_properties = self::getPageProperties( $title->getArticleID() );

		// display title can be null
		if ( $page_properties !== false ) {
			return $page_properties['display_title'];			
		}
		
		return $title->getText();
	}



	public static function shownTitle( $title )
	{
		return  \PagePropertiesFunctions::array_last( explode( ",", $title->getText() ) );
	}



	public static function initSMW()
	{

		if ( !defined( 'SMW_VERSION' ) ) {
			return;
		}

		self::$SMWOptions = new \SMWRequestOptions();
		self::$SMWOptions->limit = 500;
		self::$SMWApplicationFactory = SMW\ApplicationFactory::getInstance();
		self::$SMWStore = \SMW\StoreFactory::getStore();
		self::$SMWDataValueFactory = SMW\DataValueFactory::getInstance();
	}



	public static function getAnnotatedProperties( Title $title, $user )
	{
		$output = [];

		$page = WikiPage::factory( $title );

		$parserOutput = $page->getParserOutput( ParserOptions::newFromUser( $user ) );

		$parserData = self::$SMWApplicationFactory->newParserData( $title, $parserOutput );

		$semanticData = $parserData->getSemanticData();

		foreach ( $semanticData->getProperties() as $property ) {
			$output[] = $property->getKey();
		}

		return $output;

	}




	public static function getUnusedProperties( Title $title )
	{
		$properties = self::$SMWStore->getUnusedPropertiesSpecial( self::$SMWOptions );

		if ($properties instanceof SMW\SQLStore\PropertiesCollector) {
			// SMW 1.9+
			$properties = $properties->runCollector();
		}

		return $properties;

	}



	public static function getUsedProperties( Title $title )
	{
		$properties = self::$SMWStore->getPropertiesSpecial( self::$SMWOptions );

		if ($properties instanceof SMW\SQLStore\PropertiesCollector) {
			// SMW 1.9+
			$properties = $properties->runCollector();
		}

		return array_map( function($value) {
				return $value[0];
			}, $properties );

	}



	public static function getSpecialProperties( Title $title )
	{
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


	public static function getSemanticData( Title $title )
	{
		$subject = new SMW\DIWikiPage( $title, NS_MAIN );

		$semanticData = self::$SMWStore->getSemanticData( $subject );

		$output = [];

		foreach ( $semanticData->getProperties() as $property ) {
																																										$key = $property->getKey();
			if ( in_array( $key, self::$exclude ) ) {
				continue;
			}
				
			$propertyDv = self::$SMWDataValueFactory->newDataValueByItem( $property, null );

			if ( !$property->isUserAnnotable() || !$propertyDv->isVisible() ) {
				continue;
			}

			
			foreach ( $semanticData->getPropertyValues($property) as $dataItem ) {

				if ($key !== '_ATTCH_LINK') {

					$dataValue = self::$SMWDataValueFactory->newDataValueByItem($dataItem, $property);

					if ( $dataValue->isValid() ) {

						$dataValue->setOption('no.text.transformation', true);
						$dataValue->setOption('form/short', true);

						$output[] = [ $key, $dataValue->getWikiValue() ];	// . $dataValue->getInfolinkText( SMW_OUTPUT_WIKI );

					}

				}
		
			}

		}
 
		return $output;
		
	}



// the function onSMWStoreBeforeDataUpdateComplete will be called
	public static function rebuildSemanticData(Title $title)
	{
		if ( !defined( 'SMW_VERSION' ) ) {
			return;
		}

		$store = \SMW\StoreFactory::getStore();
		$store->setOption( \SMW\Store::OPT_CREATE_UPDATE_JOB, false);

		$rebuilder = new \SMW\Maintenance\DataRebuilder(
			$store,
			self::$SMWApplicationFactory->newTitleFactory()
		);

		$rebuilder->setOptions(
			// Tell SMW to only rebuild the current page
			new \SMW\Options( [ 'page' => $title ] )
		);

		$rebuilder->rebuild();
	}



	public static function onSMWStoreBeforeDataUpdateComplete( $store, $semanticData )
	{
		$subject = $semanticData->getSubject();

		$title = $subject->getTitle();

		$page_properties = self::getPageProperties( $title->getArticleID() );

		if ( empty( $page_properties['properties'] ) ) {
			return;
		}

		$properties = json_decode( $page_properties['properties'] );

		$valueCaption = false;

		$annotationProcessor = new \SMW\Parser\AnnotationProcessor(
			$semanticData,
			self::$SMWDataValueFactory
		);


// see extensions/SemanticMediawiki/src/Parser/InTextAnnotationParser.php
		foreach ( $properties as $val ) {

			list( $property, $value ) = $val;

			$dataValue = $annotationProcessor->newDataValueByText(
				$property,
				$value,
				$valueCaption,
				$subject
			);

			$semanticData->addDataValue($dataValue);

			//print_r($semanticData->getErrors());

		}

		return true;
	}


}



PageProperties::__constructStatic();



