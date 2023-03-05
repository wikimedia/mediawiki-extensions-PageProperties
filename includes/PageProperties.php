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
 * @author thomas-topway-it <business@topway.it>
 * @copyright Copyright ©2021-2023, https://wikisphere.org
 */

use MediaWiki\Extension\PageProperties\ReplaceText as ReplaceText;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\SlotRecord;
use SMW\MediaWiki\MediaWikiNsContentReader;

if ( is_readable( __DIR__ . '/../vendor/autoload.php' ) ) {
	include_once __DIR__ . '/../vendor/autoload.php';
}

const ALL_FORMS = 0b0001;
const ALL_PROPERTIES = 0b0010;

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
	/** @var array */
	public static $semanticProperties = [];
	// public static $semanticForms = [];
	/** @var array */
	public static $forms = [];
	/** @var array */
	public static $pageForms = [];
	/** @var int */
	public static $formIndex = 0;
	/** @var int */
	public static $queryLimit = 500;

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

		if ( !array_key_exists( 'wgPagePropertiesShowSlotsNavigation', $GLOBALS ) ) {
			$GLOBALS['wgPagePropertiesShowSlotsNavigation'] = self::$User->isAllowed( 'pageproperties-canmanagesemanticproperties' );
		}

		if ( !array_key_exists( 'wgPagePropertiesCreateJobsWarningLimit', $GLOBALS ) ) {
			$GLOBALS['wgPagePropertiesCreateJobsWarningLimit'] = 0;
		}
	}

	/**
	 * @param Parser $parser
	 * @param string $template
	 * @param array $argv
	 * @return string
	 */
	private static function templateRender( $parser, $template, $argv ) {
		$templateRenderer = new SMW\MediaWiki\Renderer\HtmlTemplateRenderer(
			( new SMW\MediaWiki\Renderer\WikitextTemplateRenderer() ),
			$parser
		);

		foreach ( $argv as $key => $value ) {
			$templateRenderer->addField( $key, $value );
		}

		$templateRenderer->packFieldsForTemplate( $template );

		return $templateRenderer->render();
	}

	/**
	 * @param Parser $parser
	 * @param mixed ...$argv
	 * @return array
	 */
	public static function parserFunctionPagepropertiesFormButton( Parser $parser, ...$argv ) {
		$out = $parser->getOutput();

/*
{{#pagepropertiesformbutton: text
|Form a
|Form b
|Form c
|button-type=
|class=
}}
*/
		$defaultParameters = [
			'button-type',
			'class',
		];

		$buttonText = array_shift( $argv );

		$defaultParameters = [
			'css-class',
			'redirect-page',
			'submit-text',
			'paging',
			'email-to',
			'navigation-next',
			'navigation-back',
		];

		list( $forms, $options ) = self::parseParameters( $argv, $defaultParameters );

		if ( empty( $options['button-type'] ) ) {
			$options['button-type'] = 'button';
		}

		if ( empty( $options['class'] ) ) {
			$options['class'] = 'pageproperties-form-button';
		}

		$options['class'] = explode( " ", $options['class'] );

		if ( $options['button-type'] === 'button' ) {
			$options['class'][] = 'mw-ui-button';
			$options['class'][] = 'mw-ui-progressive';
		}

		$specialpage_title = SpecialPage::getTitleFor( 'EditSemantic' );

		$html = '';
		// $html .= '<form action="' . $specialpage_title . '" method="POST"';
		// $html .= '<input type="hidden" name="form" value="'. implode( '|', $forms ) . '" />';
		// $html .= '<button>' . $buttonText . '</button>';
		// $html .= '</form>';

		$url = wfAppendQuery( $specialpage_title->getLocalURL(), 'form=' . urlencode( implode( '|', $forms ) ) );
		$html .= '<a class="' . implode( " ", $options['class'] ) . '" href="' . $url . '">';
		$html .= $buttonText;
		$html .= '</a>';

		if ( $options['button-type'] === 'button' ) {
			$out->addModules( [ 'mediawiki.ui.button' ] );
		}

		return [
			$html,
			'noparse' => true,
			'isHTML' => true
		];
	}

	/**
	 * @param Parser $parser
	 * @param mixed ...$argv
	 * @return array
	 */
	public static function parserFunctionPagepropertiesForm( Parser $parser, ...$argv ) {
		$out = $parser->getOutput();
		$out->setFlag( 'pagepropertiesform' );
		$title = $parser->getTitle();

/*
{{#pagepropertiesform: Form a
|Form b
|Form c
|css-class =
|redirect-page =
|submit-text =
|paging = [ sections, steps ] (multiple-forms-display-strategy)
|email-to =
|navigation-next =
|navigation-back =
}}

*/
		$defaultParameters = [
			'css-class',
			'redirect-page',
			'submit-text',
			'paging',
			'email-to',
			'navigation-next',
			'navigation-back',
		];

		list( $forms, $options ) = self::parseParameters( $argv, $defaultParameters );

		$formID = self::formID( $title, $forms, ++self::$formIndex );

		self::$pageForms[$formID] = [ 'forms' => $forms, 'options' => $options ];

		$out->setExtensionData( 'pagepropertiesforms', self::$pageForms );

		return [
			'<div class="pagepropertiesform-wrapper" id="pagepropertiesform-wrapper-' . $formID . '"></div>',
			'noparse' => true,
			'isHTML' => true
		];
	}

	/**
	 * @param array $parameters
	 * @param array $defaultParameters
	 * @return array
	 */
	public static function parseParameters( $parameters, $defaultParameters ) {
		$ret = [];
		$options = [];
		foreach ( $parameters as $value ) {
			if ( strpos( $value, '=' ) !== false ) {
				list( $k, $v ) = explode( '=', $value, 2 );
				$k = str_replace( ' ', '-', trim( $k ) );

				if ( in_array( $k, $defaultParameters ) ) {
					$options[$k] = trim( $v );
					continue;
				}
			}
			$ret[] = $value;
		}

		return [ $ret, $options ];
	}

	/**
	 * @param Parser $parser
	 * @param mixed ...$argv
	 * @return array
	 */
	public static function parserFunctionPageproperties( Parser $parser, ...$argv ) {
		$parser->getOutput()->setFlag( 'pageproperties' );

/*

{{#pageproperties: {{FULLPAGENAME}}
|?File
|?Caption
|template=DisplayPictures
|template?File=DisplayPicture
|separator=,<nowiki> </nowiki>
|values-separator=<br>
}}

*/
		$title = Title::newFromText( array_shift( $argv ) );

		if ( !$title || !$title->isKnown() ) {
			$title = $parser->getTitle();
		}

		$page_properties = self::getPageProperties( $title );

		if ( empty( $page_properties ) || empty( $page_properties['semantic-properties'] ) ) {
			return "";
		}

		$page_properties = $page_properties['semantic-properties'];

		// $templateParser = new TemplateParser();
		// $templateParser->processTemplate()
		$mainTemplate = null;
		$props = [];
		$propsTemplate = [];
		$separator = '';
		$valuesSeparator = '';
		foreach ( $argv as $val ) {

			if ( strpos( $val, 'separator=' ) === 0 ) {
				$separator = substr( $val, strlen( 'separator=' ) );
				continue;
			}

			if ( strpos( $val, 'values-separator=' ) === 0 ) {
				$valuesSeparator = substr( $val, strlen( 'values-separator=' ) );
				continue;
			}

			if ( strpos( $val, '?' ) === 0 ) {
				$props[substr( $val, 1 )] = null;
				continue;
			}

			if ( strpos( $val, 'template=' ) === 0 ) {
				$mainTemplate = substr( $val, strlen( 'template=' ) );
				continue;
			}

			if ( strpos( $val, 'template?' ) === 0 ) {
				list( $prop,  $template ) = explode( '=', substr( $val, strlen( 'template?' ) ), 2 ) + [ null, null ];
				$propsTemplate[$prop] = $template;
			}
		}

		$props = array_merge( $props, $propsTemplate );

		$IDs = [];
		foreach ( $props as $prop => $value ) {
			if ( $prop && !empty( $page_properties[$prop] ) ) {
				$props[$prop] = $page_properties[$prop];

				if ( !is_array( $props[$prop] ) ) {
					$props[$prop] = [ $props[$prop] ];
				}

				if ( array_key_exists( $prop, $propsTemplate ) ) {
					foreach ( $props[$prop] as $k => $v ) {
						$unique_id = uniqid();
						$IDs[$unique_id] = self::templateRender( $parser, $propsTemplate[$prop], [ $prop => $v ] );
						$props[$prop][$k] = $unique_id;
					}
				}

				// https://www.semantic-mediawiki.org/wiki/Help:Setting_values/Working_with_the_separator_parameter
				// $sep = '|+sep';
				$props[$prop] = implode( $valuesSeparator, $props[$prop] );
			}
		}

		$ret = ( $mainTemplate ? self::templateRender( $parser, $mainTemplate, $props ) : implode( $separator, $props ) );

		foreach ( $IDs as $key => $value ) {
			$ret = str_replace( $key, $value, $ret );
		}

		// 'noparse' => true,
		return [ $ret, 'isHTML' => true ];
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

		// @TODO use directly the function makeExportDataForSubject
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

		if ( $page_properties === false ) {
			return;
		}

		// do not retrieve from the onBeforeInitialize hook!
		$SMWDataValueFactory = SMW\DataValueFactory::getInstance();
		$valueCaption = false;

		if ( !empty( $page_properties['page-properties']['categories'] ) ) {
			$namespace = $subject->getNamespace();
			foreach ( $page_properties['page-properties']['categories'] as $category ) {
				if ( !empty( $category ) ) {
					$cat = new SMW\DIWikiPage( $category, NS_CATEGORY );
					$property = new SMW\DIProperty( $namespace !== NS_CATEGORY ? SMW\DIProperty::TYPE_CATEGORY : SMW\DIProperty::TYPE_SUBCATEGORY );
					$dataValue = $SMWDataValueFactory->newDataValueByItem( $cat, $property, $valueCaption, $subject );
					$semanticData->addDataValue( $dataValue );
				}
			}
		}

		if ( !empty( $page_properties['semantic-forms'] ) ) {
			$property = new SMW\DIProperty( '__pageproperties_semantic_form' );
			$semanticData->removeProperty( $property );
			foreach ( $page_properties['semantic-forms'] as $form ) {
				if ( !empty( $form ) ) {
					$dataValue = $SMWDataValueFactory->newDataValueByProperty( $property, (string)$form, $valueCaption, $subject );
					$semanticData->addDataValue( $dataValue );
				}
			}
		}

		if ( !empty( $page_properties['semantic-properties'] ) ) {
			$semantic_properties = $page_properties['semantic-properties'];

			// override annotated properties in property page
			if ( $title->getNamespace() === SMW_NS_PROPERTY ) {
				foreach ( $semanticData->getProperties() as $property ) {
					if ( array_key_exists( $property->getLabel(), $semantic_properties ) ) {
						$semanticData->removeProperty( $property );
					}
				}
			}

			// see extensions/SemanticMediawiki/src/Parser/InTextAnnotationParser.php
			foreach ( $semantic_properties as $label => $values ) {

				if ( $label === "" ) {
					continue;
				}

				if ( !is_array( $values ) ) {
					$values = [ $values ];
				}

				foreach ( $values as $value ) {
					if ( $value !== "" ) {
						$property = SMW\DIProperty::newFromUserLabel( $label );
						$dataValue = $SMWDataValueFactory->newDataValueByProperty( $property, (string)$value, $valueCaption, $subject );
						$semanticData->addDataValue( $dataValue );
					}
				}
			}
		}
	}

	/**
	 * @see includes/api/ApiBase.php
	 * @param User $user
	 * @param Title $title
	 * @param array &$errors
	 * @return bool
	 */
	public static function checkWritePermissions( $user, $title, &$errors ) {
		$actions = [ 'edit' ];
		if ( !$title->isKnown() ) {
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
	 * @param array &$obj
	 * @param array &$errors
	 * @param null|string $mainSlotContent
	 * @param null|string $mainSlotContentModel
	 * @return null|bool
	 */
	public static function setPageProperties( $user, $title, &$obj, &$errors, $mainSlotContent = null, $mainSlotContentModel = null ) {
		$canWrite = self::checkWritePermissions( $user, $title, $errors );

		if ( !$canWrite ) {
			return false;
		}

		// remove empty values and implode arrays with
		// single values
		$semanticProperties = [];
		if ( !empty( $obj['semantic-properties'] ) ) {
			foreach ( $obj['semantic-properties'] as $key => $val ) {
				$semanticProperties[$key] = $val;

				if ( !is_array( $semanticProperties[$key] ) ) {
					$semanticProperties[$key] = [ $semanticProperties[$key] ];
				}

				$semanticProperties[$key] = array_filter( array_values( $semanticProperties[$key] ) );

				if ( count( $semanticProperties[$key] ) === 1 ) {
					$semanticProperties[$key] = $semanticProperties[$key][0];
				}

				if ( empty( $semanticProperties[$key] ) ) {
					unset( $semanticProperties[$key] );
				}
			}

			$obj['semantic-properties'] = $semanticProperties;
		}

		if ( !empty( $obj['SEO'] ) ) {
			if ( empty( $obj['SEO']['meta'] ) ) {
				unset( $obj['SEO'] );
			}
		}

		if ( !empty( $obj['page-properties'] ) && array_key_exists( 'categories', $obj['page-properties'] )
			&& empty( implode( $obj['page-properties']['categories'] ) ) ) {
			unset( $obj['page-properties']['categories'] );
		}

		$keys = [ 'page-properties', 'SEO', 'semantic-properties', 'semantic-forms' ];

		// if $obj is empty the related slot will be removed
		foreach ( $keys as $key ) {
			if ( empty( $obj[$key] ) ) {
				unset( $obj[$key] );
			}
		}

		$slots = [];
		if ( $mainSlotContent !== null ) {
			$slots[SlotRecord::MAIN] = $mainSlotContent;
		}

		// update cache (optimistic update)
		$key = $title->getFullText();
		self::$cached_page_properties[ $key ] = $obj;

		$slots[SLOT_ROLE_PAGEPROPERTIES] = ( !empty( $obj ) ? json_encode( $obj ) : '' );

		$ret = self::recordSlots( $user, $title, $slots, $mainSlotContentModel );

		// the slot cache was preventively populated with the planned revision
		// (see WSSlotsPageProperties.php)
		if ( !$ret || !method_exists( MediaWiki\Storage\PageUpdater::class, 'prepareUpdate' ) ) {
			self::emptySlotsCache( $title );
		}

		return $ret;
	}

	/**
	 * ***credits WSSlots MediaWiki extension - Wikibase Solutions
	 * @param User $user
	 * @param Title $title
	 * @param array $slots
	 * @param string $mainSlotContentModel
	 * @return bool
	 */
	private static function recordSlots( $user, $title, $slots, $mainSlotContentModel ) {
		$wikiPage = self::getWikiPage( $title );
		$pageUpdater = $wikiPage->newPageUpdater( $user );
		$oldRevisionRecord = $wikiPage->getRevisionRecord();
		$slotRoleRegistry = MediaWikiServices::getInstance()->getSlotRoleRegistry();
		$newMainSlot = false;

		// The 'main' content slot MUST be set when creating a new page
		if ( $oldRevisionRecord === null && !array_key_exists( MediaWiki\Revision\SlotRecord::MAIN, $slots ) ) {
			$newMainSlot = true;
			// *** attention !! with a null content *sometimes* the properties
			// don't show immediately in the factbox !
			$main_content = ContentHandler::makeContent( "", $title );
			$pageUpdater->setContent( SlotRecord::MAIN, $main_content );
		}

		$oldModel = false;
		foreach ( $slots as $slotName => $text ) {

			if ( $text === "" && $slotName !== SlotRecord::MAIN ) {
				$pageUpdater->removeSlot( $slotName );
				continue;
			}

			if ( $slotName === SlotRecord::MAIN && $mainSlotContentModel ) {
				$modelId = $mainSlotContentModel;

			} elseif ( $oldRevisionRecord !== null && $oldRevisionRecord->hasSlot( $slotName ) ) {
				$modelId = $oldRevisionRecord->getSlot( $slotName )->getContent()->getContentHandler()->getModelID();

				// *** old content model
				if ( $slotName === SLOT_ROLE_PAGEPROPERTIES && $modelId === 'json' ) {
					$pageUpdater->removeSlot( $slotName );
					$oldModel = true;
					continue;
				}

			} else {
				$modelId = $slotRoleRegistry->getRoleHandler( $slotName )->getDefaultModel( $title );
			}

			$slotContent = ContentHandler::makeContent( $text, $title, $modelId );
			$pageUpdater->setContent( $slotName, $slotContent );
		}

		// *** this ensures that onContentAlterParserOutput relies
		// on updated data
		if ( !$oldModel && method_exists( MediaWiki\Storage\PageUpdater::class, 'prepareUpdate' ) ) {
			$derivedDataUpdater = $pageUpdater->prepareUpdate();
			$slots = $derivedDataUpdater->getSlots()->getSlots();
			self::setSlots( $title, $slots );
		}

		$summary = "PageProperties update";
		$flags = EDIT_INTERNAL;
		$comment = CommentStoreComment::newUnsavedComment( $summary );

		$ret = $pageUpdater->saveRevision( $comment, $flags );

		if ( $oldModel ) {
			return self::recordSlots( $user, $title, $slots, $mainSlotContentModel );
		}

		// Perform an additional null-edit to make sure all page properties are up-to-date
		if ( $newMainSlot || ( !$pageUpdater->isUnchanged() && !array_key_exists( SlotRecord::MAIN, $slots ) ) ) {
			$comment = CommentStoreComment::newUnsavedComment( "" );
			$ret_ = $pageUpdater = $wikiPage->newPageUpdater( $user );
			$pageUpdater->saveRevision( $comment, EDIT_SUPPRESS_RC | EDIT_AUTOSUMMARY );
		}

		return ( $ret !== null );
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
		self::$SMWOptions->limit = self::$queryLimit;
		self::$SMWStore = SMW\StoreFactory::getStore();
		// self::$SMWStore = $applicationFactory->getStore( '\SMW\SQLStore\SQLStore' );
		self::$SMWDataValueFactory = SMW\DataValueFactory::getInstance();
		self::$SMWApplicationFactory = SMW\Services\ServicesFactory::getInstance();
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
	 * @param OutputPage $out
	 * @param array $obj
	 * @return void
	 */
	public static function addJsConfigVars( $out, $obj ) {
		$loadedData = [];

		if ( isset( $obj['pageForms'] ) ) {

			// this will populate self::$semanticProperties with properties
			// taken from forms fields
			foreach ( $obj['pageForms'] as $value ) {
				self::setForms( $out, $value['forms'] );
			}

			if (
				// *** uncomment to retrieve all forms and all semantic properties
				// only if there aren't forms on the page (and the user has the related rights)

				/* !count( self::$forms ) && */

				$obj['config']['context'] === 'EditSemantic' ) {
				$flags = self::setAllFormsAndSemanticProperties( $out );

				if ( $flags & ALL_FORMS ) {
					$loadedData[] = 'forms';
				}

				if ( $flags & ALL_PROPERTIES ) {
					$loadedData[] = 'semantic-properties';
				}
			}

			$semanticProperties = self::getSemanticProperties( self::$semanticProperties );

			// remove fields in form related to non-existing properties
			foreach ( self::$forms as $key => $value ) {
				self::$forms[$key]['fields'] = array_intersect_key( $value['fields'], $semanticProperties );
			}

			$obj['forms'] = self::$forms;
			$obj['semanticProperties'] = $semanticProperties;

			// @TODO use standard Mediawiki's sessions interface
			if ( isset( $_SESSION ) ) {
				foreach ( $obj['pageForms'] as $formID => $value_ ) {
					if ( array_key_exists( 'pagepropertiesform-submissiondata-' . $formID, $_SESSION ) ) {
						$obj['sessionData'] = $_SESSION['pagepropertiesform-submissiondata-' . $formID];
						$obj['sessionData']['formID'] = $formID;
						unset( $_SESSION['pagepropertiesform-submissiondata-' . $formID] );
						break;
					}
				}
			}

			// remove undeclared properties
			// this is applicable if the form data has been cached
			// and following one or more properties have been deleted
			// from the form descriptor
			if ( !empty( $obj['sessionData'] ) && isset( $obj['sessionData']['properties'] ) ) {
				$obj['sessionData']['properties'] = array_intersect_key( $obj['sessionData']['properties'], $semanticProperties );
			}
		}

		// @TODO only with 'OO.ui.SelectFileWidget'
		$allowedMimeTypes = self::getAllowedMimeTypes();

		$title = $out->getTitle();

		$default = [
			'semanticProperties' => [],
			'forms' => [],
			'pageForms' => [],
			'categories' => [],
			'properties' => [],
			'sessionData' => [],
			'config' => [
				'actionUrl' => SpecialPage::getTitleFor( 'PagePropertiesSubmit' )->getLocalURL()
					. '/' . wfEscapeWikiText( $title->getPrefixedURL() )
					. '?' . $_SERVER['QUERY_STRING'],
				'returnUrl' => 'http' . ( isset( $_SERVER['HTTPS'] ) && $_SERVER['HTTPS'] === 'on' ? "s" : "" ) . "://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]",
				'allowedMimeTypes' => $allowedMimeTypes,
				// *** keep commented to prevent array_merge_recursive
				// creating an array instead of a single value
				// 'targetPage' => null,
				'isNewPage' => $title->isContentPage() && !$title->isKnown(),
				// *** keep commented to prevent array_merge_recursive
				// creating an array instead of a single value
				// 'context' => null,
				'loadedData' => $loadedData,
				'canManageSemanticProperties' => self::$User->isAllowed( 'pageproperties-canmanagesemanticproperties' ),
				'canComposeForms' => self::$User->isAllowed( 'pageproperties-cancomposeforms' ),
				'canAddSingleProperties' => self::$User->isAllowed( 'pageproperties-canaddsingleproperties' ),

				// this is always true
				// 'canEditSemanticProperties' => self::$User->isAllowed( 'pageproperties-caneditsemanticproperties' ),

				'contentModels' => self::getContentModels(),
			],
		];

		$config = $obj['config'];
		$obj = array_merge( $default, $obj );
		$obj['config'] = array_merge_recursive( $default['config'], $config );

		$out->addJsConfigVars( [
			'pageproperties-semanticProperties' => json_encode( $obj['semanticProperties'], true ),
			'pageproperties-forms' => json_encode( $obj['forms'], true ),
			'pageproperties-categories' => json_encode( $obj['categories'], true ),
			'pageproperties-pageForms' => json_encode( $obj['pageForms'], true ),
			'pageproperties-properties' => json_encode( $obj['properties'], true ),
			'pageproperties-sessionData' => json_encode( $obj['sessionData'], true ),
			'pageproperties-config' => json_encode( $obj['config'], true ),
		] );
	}

	/**
	 * @param Output $output
	 * @return int
	 */
	public static function setAllFormsAndSemanticProperties( $output ) {
		$ret = 0;

		if ( self::$User->isAllowed( 'pageproperties-canmanagesemanticproperties' )
			|| self::$User->isAllowed( 'pageproperties-cancomposeforms' ) ) {

			$allForms = self::getPagesWithPrefix( null, NS_PAGEPROPERTIESFORM );

			self::setForms( $output, array_map( static function ( $title ) {
				return $title->getText();
			}, $allForms ) );

			$ret += ALL_FORMS;
		}

		if ( self::$User->isAllowed( 'pageproperties-canmanagesemanticproperties' )
			|| self::$User->isAllowed( 'pageproperties-canaddsingleproperties' ) ) {

			self::$semanticProperties = array_map( static function ( $value ) {
				// label
				return $value[2];
			}, self::getAllProperties() );

			$ret += ALL_PROPERTIES;
		}

		return $ret;
	}

	/**
	 * @param Title $title
	 * @param array $forms
	 * @param int $index
	 * @return string
	 */
	public static function formID( $title, $forms, $index ) {
		// *** must be deterministic, to handle session data
		return hash( 'md5', $title->getFullText() . implode( $forms ) . $index );
	}

	/**
	 * @return array
	 */
	public static function getAllowedMimeTypes() {
		include_once __DIR__ . '/MimeTypes.php';

		// phpcs:ignore MediaWiki.NamingConventions.ValidGlobalName.allowedPrefix, MediaWiki.Usage.ExtendClassUsage.FunctionConfigUsage
		global $MimeTypes;
		$ret = [];
		foreach ( $GLOBALS['wgFileExtensions'] as $ext ) {
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
	 * *** currently unused
	 * @param Title $title
	 * @return array
	 */
	public static function getSemanticData( Title $title ) {
		// $subject = new SMW\DIWikiPage( $title, NS_MAIN );
		$subject = SMW\DIWikiPage::newFromTitle( $title );
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
	 * @param Output $output
	 * @param array $semanticForms
	 * @return array
	 */
	public static function setForms( $output, $semanticForms ) {
		$dataValueFactory = SMW\DataValueFactory::getInstance();
		$pDescProp = new SMW\DIProperty( '_PDESC' );
		$langCode = RequestContext::getMain()->getLanguage()->getCode();

		$ret = [];
		foreach ( $semanticForms as $value ) {
			$title = Title::newFromText( $value, NS_PAGEPROPERTIESFORM );

			if ( !$title || !$title->isKnown() ) {
				continue;
			}

			$titleText = $title->getText();

			if ( array_key_exists( $titleText, self::$forms ) ) {
				continue;
			}

			$text = self::getWikipageContent( $title );
			if ( !empty( $text ) ) {
				$obj = json_decode( $text, true );
				$obj['fields'] = self::processFieldsContent( $output, $dataValueFactory, $pDescProp, $langCode, $obj['fields'] );
				self::$forms[$titleText] = $obj;
			}
		}
	}

	/**
	 * @param Output $output
	 * @param SMW\DataValueFactory $dataValueFactory
	 * @param SMW\DIProperty $pDescProp
	 * @param string $langCode
	 * @param array $fields
	 * @return array
	 */
	public static function processFieldsContent( $output, $dataValueFactory, $pDescProp, $langCode, $fields ) {
		$replaceFormula = static function ( $data, $formula ) {
			preg_match_all( '/<\s*([^<>]+)\s*>/', $formula, $matches, PREG_PATTERN_ORDER );

			foreach ( $data as $property => $values ) {
				if ( in_array( $property, $matches[1] ) ) {
					$formula = preg_replace( '/\<\s*' . $property . '\s*\>/', self::array_last( $values ), $formula );
				}
			}

			return $formula;
		};

		foreach ( $fields as $label => $field ) {

			if ( !in_array( $label, self::$semanticProperties ) ) {
				self::$semanticProperties[] = $label;
			}

			if ( !empty( $field['default'] ) ) {
				// @TODO or use recursiveTagParseFully
				$fields[ $label ][ 'default-result'] = Parser::stripOuterParagraph( $output->parseAsContent( $fields[ $label ][ 'default'] ) );
			}

			if ( !empty( $field['help-message'] ) ) {
				$helpMessages = $field['help-message'];
				if ( !is_array( $helpMessages ) ) {
					$helpMessages = [ $helpMessages ];
				}
				$dataValues = [];
				foreach ( $helpMessages as $value_ ) {
					$dataValues[] = $dataValueFactory->newDataValueByProperty( $pDescProp, $value_ );
				}
				$fields[ $label ][ 'help-message-result' ] = self::getMonolingualText( $langCode, $dataValues );
			}

			$optionsValues = [];
			if ( !empty( $field['options-values'] ) ) {
				$optionsValues = $field['options-values'];

			} elseif ( !empty( $field['options-wikilist'] ) ) {
				$title_ = Title::newFromText( $field['options-wikilist'] );

				if ( $title_ && $title_->isKnown() ) {
					$text_ = self::getWikipageContent( $title_ );
					$optionsValues = self::parseWikilist( explode( "\n", $text_ ) );
				}

			} elseif ( !empty( $field['options-askquery'] ) ) {
				$results = self::getQueryResults(
					$field['options-askquery'],
					!empty( $field['askquery-printouts'] ) ? $field['askquery-printouts'] : [],
					[ 'limit' => is_int( $field['options-limit'] ) ? $field['options-limit'] : 100 ],
					!empty( $field['askquery-subject'] )
				);

				$arr_ = $results->serializeToArray();

				foreach ( $arr_['results'] as $titleText => $page ) {
					$title_ = Title::newFromText( $titleText );

					if ( !empty( $field['options-formula'] ) ) {
						$data_ = array_merge( [ 'subject' => [ $title_->getText() ] ], $page['printouts'] );
						$value_ = $replaceFormula( $data_, $field['options-formula'] );
						$optionsValues[] = Parser::stripOuterParagraph( $output->parseAsContent( $value_ ) );
						continue;
					}

					if ( !empty( $field['askquery-subject'] ) ) {
						$optionsValues[] = $title_->getText();
						continue;
					}

					// retrieve only the first requested property
					foreach ( $page['printouts'] as $property => $values ) {
						if ( $field['askquery-printouts'][0] !== $property ) {
							continue;
						}
						foreach ( $values as $value ) {
							$optionsValues[] = $value;
						}
					}
				}
			}

			if ( count( $optionsValues ) ) {
				$fields[ $label ][ 'options-values-result' ] = array_values( array_unique( $optionsValues ) );
			}
		}

		return $fields;
	}

	/**
	 * @param string $content
	 * @return array
	 */
	public static function parseWikilist( $content ) {
		$list = [];
		foreach ( $content as $value ) {
			if ( empty( $value ) ) {
				continue;
			}

			preg_match( '/^\s*(\*+)\s*(.+)\s*$/', $value, $match );

			$depth = strlen( $match[1] );
			$list[] = [ $depth, $match[2] ];
		}

		$ret = [];

		// Link to first level
		$t = &$ret;
		$previousDepth = 1;

		foreach ( $list as $value ) {
			list( $depth, $txt ) = $value;

			if ( $previousDepth < $depth ) {
				$parentLevel = &$t;
				$t[array_key_last( $t )] = [];

				// Link to deepest level
				$t = &$t[array_key_last( $t )];

			} elseif ( $depth < $previousDepth ) {
				$t = &$parentLevel;
			}

			$t[$txt] = $txt;
			$previousDepth = $depth;
		}

		return $ret;
	}

	/**
	 * @param array $semanticProperties
	 * @return array
	 */
	public static function getAllForms( $semanticProperties ) {
		$arr = self::getPagesWithPrefix( null, NS_PAGEPROPERTIESFORM );
		$ret = [];

		foreach ( $arr as $title ) {
			$text = self::getWikipageContent( $title );
			if ( !empty( $text ) ) {
				$obj = json_decode( $text, true );
				$obj['fields'] = array_intersect_key( $obj['fields'], $semanticProperties );

				$ret[$title->getText()] = $obj;
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
			$prop = SMW\DIProperty::newFromUserLabel( $label );
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
		$dataTypeRegistry = SMW\DataTypeRegistry::getInstance();
		$dataValueFactory = SMW\DataValueFactory::getInstance();
		$langCode = RequestContext::getMain()->getLanguage()->getCode();
		$propertyRegistry = SMW\PropertyRegistry::getInstance();

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
				$title_ = Title::makeTitleSafe( SMW_NS_PROPERTY,  $label );
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
					$property_ = new SMW\DIProperty( '_PDESC' );
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
				$property_ = new SMW\DIProperty( $key_ );

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

		if ( $properties instanceof SMW\SQLStore\PropertiesCollector ) {
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
	public static function getPredefinedProperties() {
		$ret = [];
		$propertyList = SMW\PropertyRegistry::getInstance()->getPropertyList();

		// built-in data types
		$typeLabels = SMW\DataTypeRegistry::getInstance()->getKnownTypeLabels();

		foreach ( $propertyList as $key => $value ) {
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
	 * @param User $user
	 * @param array $arr
	 * @return int
	 */
	public static function updatePagesFormsJobs( $user, $arr ) {
		$property = new SMW\DIProperty( '__pageproperties_semantic_form' );

		// find all pages having this property (as property)
		$pages = self::getPropertySubjects( $property );

		foreach ( $pages as $title_ ) {
			$title_text = $title_->getFullText();
			$titles_map[ $title_text ] = $title_;
			$update_pages[ $title_text ][ $label ] = $newLabel;
		}

		// @TODO edit the semantic-forms array in the pageproperties-semantic
		// slot, implement as PagePropertiesJob

		// @TODO find the occurence in the parserFunctionPagepropertiesForm
		// as well
	}

	/**
	 * @param User $user
	 * @param array $arr
	 * @param string $scope
	 * @param bool|null $evaluate
	 * @return int|int
	 */
	public static function updateFormsJobs( $user, $arr, $scope, $evaluate = false ) {
		$replaceTextClass = new ReplaceText\ReplaceText();

		$selected_namespaces = [ NS_PAGEPROPERTIESFORM ];
		$category = null;
		$prefix = null;
		$use_regex = false;
		$user_id = $user->getId();
		$jobNum = 0;

		foreach ( $arr as $label => $newLabel ) {
			$property = SMW\DIProperty::newFromUserLabel( $label );

			// find all forms holding this property (as text)
			$res_ = $replaceTextClass->getTitlesForEditingWithContext( $label, $selected_namespaces, $category, $prefix, $use_regex );

			if ( $evaluate ) {
				$jobNum += count( $res_ );
				continue;
			}

			foreach ( $res_ as $value_ ) {
				list( $title_ ) = $value_;
				$edit_summary = wfMessage( 'replacetext_editsummary', $label, $newLabel )->inContentLanguage()->plain();
				$jobs[] = new PagePropertiesJobReplaceText( $title_,
					 [
						'user_id' => $user_id,
						'target_str' => $label,
						'replacement_str' => $newLabel,
						'edit_summary' => $edit_summary,
						'scope' => $scope
					]
				);
			}
		}

		return ( !$evaluate ? $jobs : $jobNum );
	}

	/**
	 * @param User $user
	 * @param array $arr
	 * @param bool|null $evaluate
	 * @return array|int
	 */
	public static function updatePropertiesJobs( $user, $arr, $evaluate = false ) {
		$update_pages = [];
		$titles_map = [];
		$jobs = [];
		$user_id = $user->getId();

		foreach ( $arr as $label => $newLabel ) {
			$property = SMW\DIProperty::newFromUserLabel( $label );

			// find all pages holding this property (as property)
			$pages = self::getPropertySubjects( $property );

			foreach ( $pages as $title_ ) {
				$title_text = $title_->getFullText();
				$titles_map[ $title_text ] = $title_;
				$update_pages[ $title_text ][ $label ] = $newLabel;
			}
		}

		$count = count( $update_pages );

		if ( $evaluate ) {
			return $count;
		}

		foreach ( $update_pages as $title_text => $values ) {
			$title_ = $titles_map[ $title_text ];
			$jobs[] = new PagePropertiesJob( $title_, [ 'user_id' => $user_id, 'values' => $values ] );
		}

		return $jobs;
	}

	/**
	 * @param array $jobs
	 * @return int
	 */
	public static function pushJobs( $jobs ) {
		$count = count( $jobs );
		if ( !$count ) {
			return 0;
		}
		$services = MediaWikiServices::getInstance();
		if ( method_exists( $services, 'getJobQueueGroup' ) ) {
			// MW 1.37+
			$services->getJobQueueGroup()->push( $jobs );
		} else {
			JobQueueGroup::singleton()->push( $jobs );
		}

		return $count;
	}

	/**
	 * @see includes/specials/SpecialChangeContentModel.php
	 * @return array
	 */
	public static function getContentModels() {
		$services = Mediawiki\MediaWikiServices::getInstance();
		$contentHandlerFactory = $services->getContentHandlerFactory();
		$models = $contentHandlerFactory->getContentModels();
		$options = [];

		foreach ( $models as $model ) {
			$handler = $contentHandlerFactory->getContentHandler( $model );

			if ( !$handler->supportsDirectEditing() ) {
				continue;
			}

			$options[ ContentHandler::getLocalizedName( $model ) ] = $model;
		}

		ksort( $options );

		return $options;
	}

	/**
	 * @return array
	 */
	public static function getCategories() {
		$dbr = wfGetDB( DB_REPLICA );

		$res = $dbr->select(
			'category',
			[ 'cat_title', 'cat_pages' ],
			null,
			__METHOD__,
			[
				'LIMIT' => self::$queryLimit,
				'USE INDEX' => 'cat_title',
			]
		);

		if ( !$res->numRows() ) {
			return [];
		}

		$ret = [];
		foreach ( $res as $row ) {
			$title_ = Title::newFromText( $row->cat_title, NS_CATEGORY );
			if ( !$title_ || !$title_->isKnown() ) {
				continue;
			}
			$ret[] = $title_;
		}

		return $ret;
	}

	/**
	 * @return array
	 */
	public static function getCategoriesSemantic() {
		$categories = self::getCategories();

		$dataValueFactory = SMW\DataValueFactory::getInstance();

		$ret = [];
		foreach ( $categories as $title_ ) {
			// $title = new TitleValue( NS_CATEGORY, $row->cat_title );
			$label = $title_->getText();

			$ret[$label] = [
				'label' => $label,
				'properties' => [],
			];

			$subject = new SMW\DIWikiPage( $title_->getText(), NS_CATEGORY );

			$semanticData = self::$SMWStore->getSemanticData( $subject );

			$prop = new SMW\DIProperty( '_IMPO' );

			$values = $semanticData->getPropertyValues( $prop );

			foreach ( $values as $value ) {
				$dataValue = $dataValueFactory->newDataValueByItem( $value, $prop );

				if ( $dataValue instanceof SMW\DataValues\ImportValue ) {
					$ret[$label]['properties']['_IMPO'][] = $dataValue->getWikiValue();
				}
			}
		}

		return $ret;
	}

	/**
	 * @return Importer|Importer1_35
	 */
	public static function getImporter() {
		$services = MediaWikiServices::getInstance();

		if ( version_compare( MW_VERSION, '1.36', '>' ) ) {
			include_once __DIR__ . '/Importer/PagePropertiesImporter.php';

			// @see ServiceWiring.php -> WikiImporterFactory
			return new PagePropertiesImporter(
				$services->getMainConfig(),
				$services->getHookContainer(),
				$services->getContentLanguage(),
				$services->getNamespaceInfo(),
				$services->getTitleFactory(),
				$services->getWikiPageFactory(),
				$services->getWikiRevisionUploadImporter(),
				$services->getPermissionManager(),
				$services->getContentHandlerFactory(),
				$services->getSlotRoleRegistry()
			);
		}

		include_once __DIR__ . '/Importer/PagePropertiesImporter1_35.php';
		return new PagePropertiesImporter1_35( $services->getMainConfig() );
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
				if ( $title_ && $title_->isKnown() ) {
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
			'page_is_redirect' => 0
		];

		if ( !empty( $prefix ) ) {
			$conds[] = 'page_title' . $dbr->buildLike( $prefix, $dbr->anyString() );
		}

		$res = $dbr->select(
			'page',
			[ 'page_namespace', 'page_title', 'page_id' ],
			$conds,
			__METHOD__,
			[
				'LIMIT' => self::$queryLimit,
				'ORDER BY' => 'page_title',
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
		// if ( !$this->getAuthority()->isAllowed( 'suppressredirect' ) ) {
		//	$createRedirect = true;
		// }

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

	/**
	 * @param Title $title
	 * @return string
	 */
	public static function getWikipageContent( $title ) {
		$wikiPage = self::getWikiPage( $title );
		return $wikiPage->getContent( \MediaWiki\Revision\RevisionRecord::RAW )->getNativeData();
	}

	/**
	 * @param array $arr
	 * @param string $oldkey
	 * @param string $newkey
	 * @return string
	 */
	public static function replaceArrayKey( $arr, $oldkey, $newkey ) {
		if ( array_key_exists( $oldkey, $arr ) ) {
			$keys = array_keys( $arr );
			$keys[ array_search( $oldkey, $keys ) ] = $newkey;

			return array_combine( $keys, $arr );
		}
		return $arr;
	}
}
