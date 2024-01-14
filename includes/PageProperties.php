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

use MediaWiki\Extension\PageProperties\DatabaseManager as DatabaseManager;
use MediaWiki\Extension\PageProperties\QueryProcessor as QueryProcessor;
use MediaWiki\Extension\PageProperties\SchemaProcessor as SchemaProcessor;
use MediaWiki\Extension\PageProperties\SemanticMediawiki as SemanticMediawiki;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\SlotRecord;

if ( is_readable( __DIR__ . '/../vendor/autoload.php' ) ) {
	include_once __DIR__ . '/../vendor/autoload.php';
}

class PageProperties {
	/** @var array */
	protected static $cachedJsonData = [];

	/** @var array */
	protected static $cachedPageProperties = [];

	/** @var User */
	public static $User;

	/** @var UserGroupManager */
	private static $userGroupManager;

	/** @var array */
	private static $slotsCache = [];

	/** @var array */
	public static $schemas = [];

	/** @var array */
	public static $pageForms = [];

	/** @var int */
	public static $formIndex = 0;

	/** @var array */
	public static $pageButtons = [];

	/** @var int */
	public static $buttonIndex = 0;

	/** @var Logger */
	private static $Logger;

	/** @var int */
	public static $queryLimit = 500;

	/** @var SMW */
	public static $SMW;

	/** @var SchemaProcessor */
	public static $schemaProcessor;

	/** @var array */
	public static $PagepropertiesButtonDefaultParameters = [
		'label' => [
			'label' => 'pageproperties-parserfunction-button-label-label',
			'description' => 'pageproperties-parserfunction-button-label-description',
			'type' => 'string',
			'required' => true,
			'default' => '',
			'example' => 'pageproperties-parserfunction-button-label-example'
		],
		'value' => [
			'label' => 'pageproperties-parserfunction-button-value-label',
			'description' => 'pageproperties-parserfunction-button-value-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-button-value-example'
		],
		'callback' => [
			'label' => 'pageproperties-parserfunction-button-callback-label',
			'description' => 'pageproperties-parserfunction-button-callback-description',
			'type' => 'string',
			'required' => true,
			'default' => '',
			'example' => 'pageproperties-parserfunction-button-callback-example'
		],
		'preload' => [
			'label' => 'pageproperties-parserfunction-button-preload-label',
			'description' => 'pageproperties-parserfunction-button-preload-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-button-preload-example'
		],
		'icon' => [
			'label' => 'pageproperties-parserfunction-button-icon-label',
			'description' => 'pageproperties-parserfunction-button-icon-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-button-icon-example'
		]
	];

	/** @var array */
	public static $PagepropertiesFormDefaultParameters = [
		'schemas' => [
			'label' => 'pageproperties-parserfunction-form-schemas-label',
			'description' => 'pageproperties-parserfunction-form-schemas-description',
			'type' => 'string',
			'required' => true,
			'default' => '',
			'example' => 'pageproperties-parserfunction-form-schemas-example'
		],
		'title' => [
			'label' => 'pageproperties-parserfunction-form-title-label',
			'description' => 'pageproperties-parserfunction-form-title-description',
			'type' => 'string',
			'required' => true,
			'default' => '',
			'example' => 'pageproperties-parserfunction-form-title-example'
		],
		'action' => [
			'label' => 'pageproperties-parserfunction-form-action-label',
			'description' => 'pageproperties-parserfunction-form-action-description',
			'type' => 'string',
			'required' => true,
			'default' => 'create',
			'example' => 'pageproperties-parserfunction-form-action-example'
		],
		'view' => [
			'label' => 'pageproperties-parserfunction-form-view-label',
			'description' => 'pageproperties-parserfunction-form-view-description',
			'type' => 'string',
			'required' => true,
			'default' => 'inline',
			'example' => 'pageproperties-parserfunction-form-view-example'
		],
		'layout' => [
			'label' => 'pageproperties-parserfunction-form-layout-label',
			'description' => 'pageproperties-parserfunction-form-layout-description',
			'type' => 'string',
			'required' => true,
			'default' => 'tabs',
			'example' => 'pageproperties-parserfunction-form-layout-example'
		],
		'callback' => [
			'label' => 'pageproperties-parserfunction-form-callback-label',
			'description' => 'pageproperties-parserfunction-form-callback-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-form-callback-example'
		],
		'edit-page' => [
			'label' => 'pageproperties-parserfunction-form-edit-page-label',
			'description' => 'pageproperties-parserfunction-form-edit-page-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-form-edit-page-example'
		],
		'preload' => [
			'label' => 'pageproperties-parserfunction-form-preload-label',
			'description' => 'pageproperties-parserfunction-form-preload-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-form-preload-example'
		],
		'return-page' => [
			'label' => 'pageproperties-parserfunction-form-return-page-label',
			'description' => 'pageproperties-parserfunction-form-return-page-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-form-return-page-example'
		],
		'popup-size' => [
			'label' => 'pageproperties-parserfunction-form-popup-size-label',
			'description' => 'pageproperties-parserfunction-form-popup-size-description',
			'type' => 'string',
			'required' => false,
			'default' => 'medium',
			'example' => 'pageproperties-parserfunction-form-popup-size-example'
		],
		'css-class' => [
			'label' => 'pageproperties-parserfunction-form-css-class-label',
			'description' => 'pageproperties-parserfunction-form-css-class-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-form-css-class-example'
		],
		'pagename-formula' => [
			'label' => 'pageproperties-parserfunction-form-pagename-formula-label',
			'description' => 'pageproperties-parserfunction-form-pagename-formula-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-form-pagename-formula-example'
		],
		'edit-freetext' => [
			'label' => 'pageproperties-parserfunction-form-edit-freetext-label',
			'description' => 'pageproperties-parserfunction-form-edit-freetext-description',
			'type' => 'boolean',
			'required' => false,
			'default' => '0',
			'example' => 'pageproperties-parserfunction-form-edit-freetext-example'
		],
		'edit-categories' => [
			'label' => 'pageproperties-parserfunction-form-edit-categories-label',
			'description' => 'pageproperties-parserfunction-form-edit-categories-description',
			'type' => 'boolean',
			'required' => false,
			'default' => '0',
			'example' => 'pageproperties-parserfunction-form-edit-categories-example'
		],
		'edit-content-model' => [
			'label' => 'pageproperties-parserfunction-form-edit-content-model-label',
			'description' => 'pageproperties-parserfunction-form-edit-content-model-description',
			'type' => 'boolean',
			'required' => false,
			'default' => '0',
			'example' => 'pageproperties-parserfunction-form-edit-content-model-example'
		],
		'target-slot' => [
			'label' => 'pageproperties-parserfunction-form-target-slot-label',
			'description' => 'pageproperties-parserfunction-form-target-slot-description',
			'type' => 'string',
			'required' => false,
			'default' => 'pageproperties',
			'example' => 'pageproperties-parserfunction-form-target-slot-example'
		],
		'default-categories' => [
			'label' => 'pageproperties-parserfunction-form-default-categories-label',
			'description' => 'pageproperties-parserfunction-form-default-categories-description',
			'type' => 'array',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-form-default-categories-example'
		],
		'default-content-model' => [
			'label' => 'pageproperties-parserfunction-form-default-content-model-label',
			'description' => 'pageproperties-parserfunction-form-default-content-model-description',
			'type' => 'string',
			'required' => false,
			'default' => 'wikitext',
			'example' => 'pageproperties-parserfunction-form-default-content-model-example'
		],
		'layout-align' => [
			'label' => 'pageproperties-parserfunction-form-layout-align-label',
			'description' => 'pageproperties-parserfunction-form-layout-align-description',
			'type' => 'string',
			'required' => false,
			'default' => 'top',
			'example' => 'pageproperties-parserfunction-form-layout-align-example'
		],
		'popup-help' => [
			'label' => 'pageproperties-parserfunction-form-popup-help-label',
			'description' => 'pageproperties-parserfunction-form-popup-help-description',
			'type' => 'boolean',
			'required' => false,
			'default' => '0',
			'example' => 'pageproperties-parserfunction-form-popup-help-example'
		],
		'submit-button-text' => [
			'label' => 'pageproperties-parserfunction-form-submit-button-text-label',
			'description' => 'pageproperties-parserfunction-form-submit-button-text-description',
			'type' => 'string',
			'required' => false,
			'default' => 'submit',
			'example' => 'pageproperties-parserfunction-form-submit-button-text-example'
		],
		'validate-button-text' => [
			'label' => 'pageproperties-parserfunction-form-validate-button-text-label',
			'description' => 'pageproperties-parserfunction-form-validate-button-text-description',
			'type' => 'string',
			'required' => false,
			'default' => 'validate',
			'example' => 'pageproperties-parserfunction-form-validate-button-text-example'
		]
	];

	/** @var array */
	public static $PagepropertiesQueryDefaultParameters = [
		'schema' => [
			'label' => 'pageproperties-parserfunction-query-schema-label',
			'description' => 'pageproperties-parserfunction-query-schema-description',
			'type' => 'string',
			'required' => true,
			'default' => '',
			'example' => 'pageproperties-parserfunction-query-schema-example'
		],
		'separator' => [
			'label' => 'pageproperties-parserfunction-query-separator-label',
			'description' => 'pageproperties-parserfunction-query-separator-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-query-separator-example'
		],
		'values-separator' => [
			'label' => 'pageproperties-parserfunction-query-values-separator-label',
			'description' => 'pageproperties-parserfunction-query-values-separator-description',
			'type' => 'string',
			'required' => false,
			'default' => ', ',
			'example' => 'pageproperties-parserfunction-query-values-separator-example'
		],
		'template' => [
			'label' => 'pageproperties-parserfunction-query-template-label',
			'description' => 'pageproperties-parserfunction-query-template-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-query-template-example'
		],
		'limit' => [
			'label' => 'pageproperties-parserfunction-query-limit-label',
			'description' => 'pageproperties-parserfunction-query-limit-description',
			'type' => 'integer',
			'required' => false,
			'default' => '100',
			'example' => 'pageproperties-parserfunction-query-limit-example'
		],
		'offset' => [
			'label' => 'pageproperties-parserfunction-query-offset-label',
			'description' => 'pageproperties-parserfunction-query-offset-description',
			'type' => 'integer',
			'required' => false,
			'default' => '0',
			'example' => 'pageproperties-parserfunction-query-offset-example'
		],
		'order' => [
			'label' => 'pageproperties-parserfunction-query-order-label',
			'description' => 'pageproperties-parserfunction-query-order-description',
			'type' => 'string',
			'required' => false,
			'default' => '',
			'example' => 'pageproperties-parserfunction-query-order-example'
		],
		'format' => [
			'label' => 'pageproperties-parserfunction-query-format-label',
			'description' => 'pageproperties-parserfunction-query-format-description',
			'type' => 'string',
			'required' => true,
			'default' => '',
			'example' => 'pageproperties-parserfunction-query-format-example'
		],
		'pagetitle' => [
			'label' => 'pageproperties-parserfunction-query-pagetitle-label',
			'description' => 'pageproperties-parserfunction-query-pagetitle-description',
			'type' => 'boolean',
			'required' => false,
			'default' => '1',
			'example' => 'pageproperties-parserfunction-query-pagetitle-example'
		],
		'pagetitle-name' => [
			'label' => 'pageproperties-parserfunction-query-pagetitle-name-label',
			'description' => 'pageproperties-parserfunction-query-pagetitle-name-description',
			'type' => 'string',
			'required' => false,
			'default' => 'pagetitle',
			'example' => 'pageproperties-parserfunction-query-pagetitle-name-example'
		],
		'articleid-name' => [
			'label' => 'pageproperties-parserfunction-query-articleid-name-label',
			'description' => 'pageproperties-parserfunction-query-articleid-name-description',
			'type' => 'string',
			'required' => false,
			'default' => 'articleid',
			'example' => 'pageproperties-parserfunction-query-articleid-name-example'
		]
	];

	/**
	 * @return void
	 */
	public static function initialize() {
		self::$Logger = LoggerFactory::getInstance( 'PageProperties' );
		self::$User = RequestContext::getMain()->getUser();
		self::$userGroupManager = MediaWikiServices::getInstance()->getUserGroupManager();
		self::$schemaProcessor = new SchemaProcessor();

		// @FIXME	// defined( 'SMW_VERSION' );
		self::$SMW = false;
		if ( self::$SMW ) {
			SemanticMediawiki::initSMW();
		}
		if ( !array_key_exists( 'wgPagePropertiesShowSlotsNavigation', $GLOBALS )
			&& self::$User->isAllowed( 'pageproperties-canmanageschemas' ) ) {
			$GLOBALS['wgPagePropertiesShowSlotsNavigation'] = true;
		}

		$GLOBALS['wgPagePropertiesResultPrinterClasses'] = [
			'table' => 'TableResultPrinter',
			'datatable' => 'DatatableResultPrinter',
			'datatables' => 'DatatableResultPrinter',
			// 'list' => 'ListResultPrinter',
			'json' => 'JsonResultPrinter',
			'template' => 'TemplateResultPrinter',
			'templates' => 'TemplateResultPrinter',
			'query' => 'QueryResultPrinter',
			'json-raw' => 'JsonRawResultPrinter',
		];
	}

	/**
	 * @param string $pageName
	 * @param array $value
	 * @return array
	 */
	public static function createTemplateContent( $pageName, $value ) {
		$mapDescription = [
			'PagePropertiesForm' => 'pageproperties-parserfunction-form-description',
			// 'PagePropertiesQuery' => 'pageproperties-parserfunction-query-description',
			'PagePropertiesButton' => 'pageproperties-parserfunction-button-description',
			'PagePropertiesPrint' => 'pageproperties-parserfunction-print-description'
		];

		$ret = "<noinclude>
<pre>
{{{$pageName}
";

		foreach ( $value as $key => $values ) {
			$ret .= "|$key = \n";
		}

		$ret .= '}}
</pre>

';

		$ret .= wfMessage( 'pageproperties-parserfunction-template-notice-visual-editor-newlines' )->parse();

		$ret .= '
<templatedata>
';

		$params = [];
		foreach ( $value as $key => $values ) {
			$values['label'] = wfMessage( $values['label'] )->text();
			$values['description'] = wfMessage( $values['description'] )->text();
			$values['example'] = wfMessage( $values['example'] )->text();

			if ( $values['type'] === 'integer' ) {
				$values['type'] = 'number';
			}

			if ( $values['type'] === 'array' ) {
				$values['type'] = 'string';
				$values['default'] = '';
			}

			$params[$key] = $values;
		}

		$json = [
			'description' => wfMessage( $mapDescription[$pageName] )->text(),
			'params' => $params
		];

		$ret .= json_encode( $json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );

		$ret .= '
</templatedata>
</noinclude>
<includeonly>{{#' . strtolower( $pageName ) . ':';

		$ret .= '{{{' . key( $value ) . '}}}';
		array_shift( $value );

		foreach ( $value as $key => $values ) {
			if ( empty( $values['default'] ) ) {
				$values['default'] = '';
			}
			$ret .= "|$key = {{{{$key}|{$values['default']}}}}";
		}

		$ret .= ' }}
</includeonly>
';

		return $ret;
	}

	/**
	 * @param Parser $parser
	 * @param mixed ...$argv
	 * @return array
	 */
	public static function parserFunctionPagepropertiesButton( Parser $parser, ...$argv ) {
		$parserOutput = $parser->getOutput();
		$parserOutput->setExtensionData( 'pagepropertiesbutton', true );
		$title = $parser->getTitle();

/*
{{#pagepropertiesbutton: Get folders
|callback = ContactManager.formAction
|preload = Data:ContactManager/MailboxInfo/Preload
}}
*/
		$defaultParameters = self::$PagepropertiesButtonDefaultParameters;

		array_walk( $defaultParameters, static function ( &$value, $key ) {
			$value = [ $value['default'], $value['type'] ];
		} );

		[ $values, $options ] = self::parseParameters( $argv, array_keys( $defaultParameters ) );

		if ( !count( $values ) || empty( $values[0] ) ) {
			return 'no label';
		}

		$label = $values[0];

		$params = self::applyDefaultParams( $defaultParameters, $options );

		$params['label'] = $label;

		$buttonID = ++self::$buttonIndex;

		self::$pageButtons[$buttonID] = $params;

		$parserOutput->setExtensionData( 'pagepropertiesbuttons', self::$pageButtons );

		return [
			'<div class="PagePropertiesButton" id="pagepropertiesbutton-wrapper-' . $buttonID . '">'
				. wfMessage( 'pageproperties-parserfunction-button-placeholder' )->text() . '</div>',
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
		$parserOutput = $parser->getOutput();
		$parserOutput->setExtensionData( 'pagepropertiesform', true );
		$title = $parser->getTitle();

/*
{{#pagepropertiesform: Form a
|title =
|action = create / edit
|return-page =
|edit-page = [page to edit]
|view = inline / popup
|popup-size = medium / larger
|css-class =
|pagename=formula =
|edit-freetext = true / false
|edit-categories = true / false
|edit-content-model = true / false
|default-categories =
|default-content-model = wikitext / ...
|layout-align = top / left / right / inline
|popup-help = true / false
|submit-button-text =
|layout = stacked / booklet / tabs / steps
|email-to =
|navigation-next =
|navigation-back =
|show-progress =
}}
*/
		$defaultParameters = self::$PagepropertiesFormDefaultParameters;
		array_walk( $defaultParameters, static function ( &$value, $key ) {
			$value = [ $value['default'], $value['type'] ];
		} );

		[ $values, $options ] = self::parseParameters( $argv, array_keys( $defaultParameters ) );

		if ( !count( $values ) || empty( $values[0] ) ) {
			return 'no schemas';
		}

		$schemas = preg_split( '/\s*,\s*/', $values[0], -1, PREG_SPLIT_NO_EMPTY );

		$params = self::applyDefaultParams( $defaultParameters, $options );

		$databaseManager = new DatabaseManager();

		$schemas = array_filter( $schemas, static function ( $val ) use( $databaseManager ) {
			return $databaseManager->schemaExists( $val );
		} );

		$formID = self::formID( $title, $schemas, ++self::$formIndex );

		self::$pageForms[$formID] = [
			'schemas' => $schemas,
			'options' => $params
		];

		$parserOutput->setExtensionData( 'pagepropertiesforms', self::$pageForms );

		return [
			'<div class="PagePropertiesFormWrapper" id="pagepropertiesform-wrapper-' . $formID . '">'
				. wfMessage( 'pageproperties-parserfunction-form-placeholder' )->text() . '</div>',
			'noparse' => true,
			'isHTML' => true
		];
	}

	/**
	 * @param array $defaultParams
	 * @param array $params
	 * @return array
	 */
	public static function applyDefaultParams( $defaultParams, $params ) {
		$ret = [];
		foreach ( $defaultParams as $key => $value ) {
			[ $defaultValue, $type ] = $value;
			$val = $defaultValue;
			if ( array_key_exists( $key, $params ) ) {
				$val = $params[$key];
			}

			switch ( $type ) {
				case 'bool':
				case 'boolean':
					$val = filter_var( $val, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
					if ( $val === null ) {
						$val = filter_var( $defaultValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
					}
					settype( $val, "bool" );
					break;

				case 'array':
					$val = array_filter(
						preg_split( '/\s*,\s*/', $val, -1, PREG_SPLIT_NO_EMPTY ) );
					break;

				case 'number':
					$val = filter_var( $val, FILTER_VALIDATE_FLOAT, FILTER_NULL_ON_FAILURE );
					settype( $val, "float" );
					break;

				case 'int':
				case 'integer':
					$val = filter_var( $val, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE );
					settype( $val, "integer" );
					break;

				default:
			}

			$ret[$key] = $val;
		}

		return $ret;
	}

	/**
	 * @param Parser $parser
	 * @param mixed ...$argv
	 * @return array
	 */
	public static function parserFunctionPagepropertiesPrint( Parser $parser, ...$argv ) {
		$title = $parser->getTitle();
/*
{{#pagepropertiesprint: {{FULLPAGENAME}}
|?File
|?Caption
|template=DisplayPictures
|template?File=DisplayPicture
|values-separator=,<nowiki> </nowiki>
|separator=<br>
}}
*/
		$title_ = Title::newFromText( array_shift( $argv ) );
		if ( !$title_ || !$title_->isKnown() ) {
			$title_ = $title;
		}

		$argv[] = 'function=print';

		$query = '[[' . $title_->getFullText() . ']]';
		// array_unshift( $argv, $query );

		return self::parserFunctionPagepropertiesQuery( $parser, ...[ $query, ...$argv ] );
		// return forward_static_call_array(
		// 	[\PageProperties::class, 'parserFunctionPagepropertiesQuery'],
		// 	[ $parser, ...$argv ]
		// );
	}

	/**
	 * @param Parser $parser
	 * @param mixed ...$argv
	 * @return array
	 */
	public static function parserFunctionPagepropertiesQuery( Parser $parser, ...$argv ) {
		$parserOutput = $parser->getOutput();
		$title = $parser->getTitle();
		$parserOutput->setExtensionData( 'pagepropertiesquery', true );

		$parserOutput->addModules( [ 'ext.PageProperties.PrintResults' ] );
/*
{{#pagepropertiesquery: [[approved::true]][[display_date::{{#time: Y-m-d }}]]
|?display_date
|?blurb
|?display_order
|schema=Curated page
|limit=
|sort=
|template=Curated page
|template?subitem=Curated page Sub
}}
*/
		$query = array_shift( $argv );

		$defaultParameters = self::$PagepropertiesQueryDefaultParameters;

		array_walk( $defaultParameters, static function ( &$value, $key ) {
			$value = [ $value['default'], $value['type'] ];
		} );

		$defaultParameters['function'] = [ 'query', 'string' ];

		[ $values, $params ] = self::parseParameters( $argv, array_keys( $defaultParameters ) );

		$params = self::applyDefaultParams( $defaultParameters, $params );

		$printouts = [];

		// root template
		$templates = [ '' => $params['template'] ];

		// default printer format
		if ( empty( $params['format'] ) ) {
			if ( !empty( $params['template'] ) ) {
				$params['format'] = 'template';
			} elseif ( $params['function'] === 'print' || $params['limit'] === 1 ) {
				$params['format'] = 'json';
			} else {
				$params['format'] = 'table';
			}
		}

		foreach ( $values as $val ) {
			// $templates
			if ( preg_match( '/^template(\?(.+))?=(.+)/', $val, $match ) ) {
				$templates[$match[2]] = $match[3];
				continue;
			}

			if ( strpos( $val, '?' ) === 0 ) {
				$printouts[substr( $val, 1 )] = null;
				continue;
			}
		}

		$returnError = static function ( $error ) {
			return [ $error,
				'isHTML' => false
			];
		};

		if ( empty( $params['schema'] ) ) {
			return $returnError( 'schema not set' );
		}

		if ( !self::$schemaProcessor ) {
			self::initialize();
		}

		if ( !array_key_exists( $params['format'], $GLOBALS['wgPagePropertiesResultPrinterClasses'] ) ) {
			return 'format not supported';
		}

		$databaseManager = new DatabaseManager();

		$parserOutput->setExtensionData( 'pagepropertiesquerydata', $params );

		if ( !$databaseManager->schemaExists( $params['schema'] ) ) {
			return $returnError( 'schema does not exist' );
		}

		$printouts = array_keys( $printouts );

		$output = RequestContext::getMain()->getOutput();

		[ $ret, $isHtml ] = self::getResults(
			$parser,
			$output,
			$query,
			$templates,
			$printouts,
			$params
		);

		return [ $ret, 'isHTML' => $isHtml ];
	}

	/**
	 * @param Parser $parser
	 * @param Output $output
	 * @param string $query
	 * @param array $templates
	 * @param array $printouts
	 * @param array $params
	 * @return bool|array
	 */
	public static function getResults(
		$parser,
		$output,
		$query,
		$templates,
		$printouts,
		$params
	) {
		if ( empty( $params['schema'] ) || empty( $params['format'] ) ) {
			return false;
		}
		$schema = self::getSchema( $output, $params['schema'] );
		if ( !$schema ) {
			return false;
		}
		if ( !array_key_exists( $params['format'], $GLOBALS['wgPagePropertiesResultPrinterClasses'] ) ) {
			return false;
		}
		$className = $GLOBALS['wgPagePropertiesResultPrinterClasses'][$params['format']];
		$class = "MediaWiki\Extension\PageProperties\ResultPrinters\\{$className}";
		$queryProcessor = new QueryProcessor( $schema, $query, $printouts, $params );
		$resultsPrinter = new $class( $parser, $output, $queryProcessor, $schema, $templates, $params, $printouts );

		return [ $resultsPrinter->getResults(), $resultsPrinter->isHtml() ];
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
				[ $k, $v ] = explode( '=', $value, 2 );
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

		$revision = self::revisionRecordFromTitle( $title );

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
		$dbr = wfGetDB( DB_REPLICA );

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
	 * @param Title $title
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

		$dbr = wfGetDB( DB_MASTER );
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
	 * @param Title $title
	 * @param OutputPage $outputPage
	 * @return void
	 */
	public static function setMetaAndTitle( $title, $outputPage ) {
		global $wgSitename;
		$meta = [];
		$mainPage = Title::newMainPage();

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

		} else {
			$page_title = $title->getText();
			if ( !empty( $GLOBALS['wgPagePropertiesDisplayAlwaysUnprefixedTitles'] ) ) {
				$outputPage->setPageTitle( $page_title );
			}
		}

		// page_title can be null
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
	 * @param Title $title
	 * @return false|array
	 */
	public static function getJsonData( $title ) {
		// @ATTENTION!
		// $page_id is 0 for newly created pages
		// $title->getArticleID();
		$key = $title->getFullText();

		// read from cache
		if ( array_key_exists( $key, self::$cachedJsonData ) ) {
			return self::$cachedJsonData[ $key ];
		}

		if ( !$title->canExist() ) {
			return false;
		}
		self::$cachedJsonData[ $key ] = false;

		$wikiPage = self::getWikiPage( $title );

		if ( !$wikiPage ) {
			return false;
		}

		$slots = self::getSlots( $title );

		if ( !$slots ) {
			return false;
		}

		$content = null;
		foreach ( $slots as $role => $slot ) {
			$content = $slots[$role]->getContent();
			$modelId = $content->getContentHandler()->getModelID();
			if ( $role === SLOT_ROLE_PAGEPROPERTIES
				|| $modelId === CONTENT_MODEL_PAGEPROPERTIES_JSONDATA ) {
				break;
			}
		}

		if ( empty( $content ) ) {
			return false;
		}

		$contents = $content->getNativeData();

		$ret = json_decode( $contents, true );

		if ( empty( $ret ) ) {
			return false;
		}

		self::$cachedJsonData[ $key ] = $ret;
		return $ret;
	}

	/**
	 * @param Output $output
	 * @param string $name
	 * @return array|null
	 */
	public static function getSchema( $output, $name ) {
		self::setSchemas( $output, [ $name ] );
		if ( array_key_exists( $name, self::$schemas )
			&& !empty( self::$schemas[$name] ) ) {
			return self::$schemas[$name];
		}
		return null;
	}

	/**
	 * @param Output $output
	 * @param array $schemas
	 * @param bool $loadData
	 * @return array
	 */
	public static function getSchemas( $output, $schemas, $loadData = true ) {
		self::setSchemas( $output, $schemas, $loadData );
		return self::$schemas;
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
	 * @param array $schemas
	 * @param string $defaultSlot
	 * @param array &$errors
	 * @return bool
	 */
	public static function updateCreateSchemas(
		$user,
		$title,
		$schemas,
		$defaultSlot,
		&$errors = []
	) {
		$jsonData = self::getJsonData( $title );

		if ( !$jsonData ) {
			$jsonData = [];
		}

		if ( !isset( $jsonData['schemas'] ) ) {
			$jsonData['schemas'] = [];
		}

		$jsonData['schemas'] = array_merge( $jsonData['schemas'], $schemas );

		$targetSlot = self::getTargetSlot( $title, $defaultSlot );

		$slots = [
			$targetSlot => [
				'model' => CONTENT_MODEL_PAGEPROPERTIES_JSONDATA,
				'content' => $jsonData
			]
		];

		return self::setJsonData(
			$user,
			$title,
			$slots,
			$errors,
		);
	}

	/**
	 * @param User $user
	 * @param Title $title
	 * @param array $slotsData
	 * @param array &$errors
	 * @return bool
	 */
	public static function setJsonData(
		$user,
		$title,
		$slotsData,
		&$errors = []
	) {
		$canWrite = self::checkWritePermissions( $user, $title, $errors );

		if ( !$canWrite ) {
			return false;
		}

		$pageProperties = [];
		foreach ( $slotsData as $slotName => $value ) {
			if ( $value['model'] === CONTENT_MODEL_PAGEPROPERTIES_JSONDATA ) {
				$keys = [ 'schemas', 'schemas-data', 'categories' ];
				foreach ( $keys as $key ) {
					if ( empty( $value['content'][$key] ) ) {
						unset( $value['content'][$key] );
					}
				}

				if ( empty( $value['content'] ) ) {
					$slotsData[$slotName]['content'] = null;
				} else {
					$pageProperties = $value['content'];
					$slotsData[$slotName]['content'] = json_encode( $value['content'] );
				}
			}
		}

		// *** this needs to be set before $pageUpdater->saveRevision
		// to ensure onContentAlterParserOutput has updated data
		$key = $title->getFullText();
		self::$cachedJsonData[ $key ] = $pageProperties;

		return self::recordSlots( $user, $title, $slotsData );
	}

	/**
	 * // phpcs:ignore MediaWiki.Commenting.FunctionAnnotations.UnrecognizedAnnotation
	 * @credits WSSlots MediaWiki extension - Wikibase Solutions
	 * @param User $user
	 * @param Title $title
	 * @param array $slotsData
	 * @param bool $doNullEdit false
	 * @return bool
	 */
	private static function recordSlots( $user, $title, $slotsData, $doNullEdit = false ) {
		$wikiPage = self::getWikiPage( $title );
		$services = MediaWikiServices::getInstance();
		$oldRevisionRecord = $wikiPage->getRevisionRecord();
		$slotRoleRegistry = $services->getSlotRoleRegistry();
		$contentHandlerFactory = $services->getContentHandlerFactory();
		$contentModels = $contentHandlerFactory->getContentModels();
		// $knownRoles = $slotRoleRegistry->getKnownRoles();

		// delete article if the current slots are empty
		// and there aren't more slots on the page
		if ( $oldRevisionRecord ) {
			$existingSlots = $oldRevisionRecord->getSlots()->getSlots();
			$emptySlots = true;
			foreach ( $slotsData as $slotName => $value ) {
				if ( !empty( $value['content'] ) ) {
					$emptySlots = false;
					break;
				}
			}

			if ( $emptySlots && !count( array_diff( array_keys( $existingSlots ),
				array_keys( $slotsData ) ) ) ) {
				$reason = '';
				self::deletePage( $wikiPage, $user, $reason );
				return;
			}
		}

		$pageUpdater = $wikiPage->newPageUpdater( $user );

		// The 'main' content slot MUST be set when creating a new page
		if ( $oldRevisionRecord === null && !array_key_exists( MediaWiki\Revision\SlotRecord::MAIN, $slotsData ) ) {
			$newMainSlot = true;
			$main_content = ContentHandler::makeContent( '', $title );
			$pageUpdater->setContent( SlotRecord::MAIN, $main_content );
		}

		foreach ( $slotsData as $slotName => $value ) {
			$text = $value['content'];

			if ( !isset( $value['model'] ) || !in_array( $value['model'], $contentModels ) ) {
				if ( $oldRevisionRecord !== null && $oldRevisionRecord->hasSlot( $slotName ) ) {
					$modelId = $oldRevisionRecord->getSlot( $slotName )->getContent()->getContentHandler()->getModelID();

				} else {
					$modelId = $slotRoleRegistry->getRoleHandler( $slotName )->getDefaultModel( $title );
				}
			} else {
				$modelId = $value['model'];
			}

			// remove slot if content is empty
			// and isn't main slot
			if ( empty( $text ) && $slotName !== SlotRecord::MAIN ) {
				$pageUpdater->removeSlot( $slotName );
				continue;
			}

			// back-compatibility
			if ( $slotName === SLOT_ROLE_PAGEPROPERTIES && $modelId === 'json' ) {
				$pageUpdater->removeSlot( $slotName );
				continue;
			}
			$slotContent = ContentHandler::makeContent( $text, $title, $modelId );
			$pageUpdater->setContent( $slotName, $slotContent );
		}

		// *** this ensures that onContentAlterParserOutput relies
		// on updated data
		if ( method_exists( MediaWiki\Storage\PageUpdater::class, 'prepareUpdate' ) ) {
			$derivedDataUpdater = $pageUpdater->prepareUpdate();
			$slots = $derivedDataUpdater->getSlots()->getSlots();
			self::setSlots( $title, $slots );
		}
		$summary = "PageProperties update";
		$flags = EDIT_INTERNAL;
		$comment = CommentStoreComment::newUnsavedComment( $summary );
		$RevisionRecord = $pageUpdater->saveRevision( $comment, $flags );

		// Perform an additional null-edit if requested
		if ( $doNullEdit && !$pageUpdater->isUnchanged() ) {
			$comment = CommentStoreComment::newUnsavedComment( "" );
			$pageUpdater = $wikiPage->newPageUpdater( $user );
			$pageUpdater->saveRevision( $comment, EDIT_SUPPRESS_RC | EDIT_AUTOSUMMARY );
		}

		// or !$pageUpdater->isUnchanged()
		return $RevisionRecord !== null;
	}

	/**
	 * @param Title $title
	 * @param string $targetSlot
	 * @return string
	 */
	public static function getTargetSlot( $title, $targetSlot = 'pageproperties' ) {
		if ( !$title || !$title->isKnown() ) {
			return $targetSlot;
		}
		$slots = self::getSlots( $title );

		if ( !$slots ) {
			return $targetSlot;
		}

		foreach ( $slots as $role => $slot ) {
			$content = $slots[$role]->getContent();
			$modelId = $content->getContentHandler()->getModelID();
			if ( $role === SLOT_ROLE_PAGEPROPERTIES
				|| $modelId === CONTENT_MODEL_PAGEPROPERTIES_JSONDATA ) {
					return $role;
			}
		}
		return $targetSlot;
	}

	/**
	 * @param Title $title
	 * @param Content $content
	 * @param array &$errors
	 */
	public static function rebuildArticleDataFromSlot( $title, $content, &$errors ) {
		if ( empty( $content ) ) {
			return;
		}

		$contents = $content->getNativeData();

		$data = json_decode( $contents, true );

		if ( empty( $data['schemas'] ) ) {
			return;
		}

		$schemas = array_keys( $data['schemas'] );
		$context = RequestContext::getMain();

		$output = $context->getOutput();

		// @FIXME this will also process schamas, but it
		// is not required since we need only type and format
		$schemas = self::getSchemas( $output, $schemas, true );

		$databaseManager = new DatabaseManager();
		$flatten = [];
		self::$schemaProcessor->setOutput( $output );

		foreach ( $data['schemas'] as $schemaName => $value ) {
			if ( !array_key_exists( $schemaName, $schemas ) ) {
				$schema = self::$schemaProcessor->generateFromData( $value, $schemaName );

				$title_ = Title::makeTitleSafe( NS_PAGEPROPERTIESSCHEMA, $schemaName );
				$statusOK = self::saveRevision( self::$User, $title_, json_encode( $schema ) );
				if ( !$statusOK ) {
					self::$Logger->error( 'rebuildArticleDataFromSlot cannot save schema' );
					continue;
				}
				$schemas[$schemaName] = self::$schemaProcessor->processSchema( $schema, $schemaName );
			}

			$flatten = array_merge( $flatten, $databaseManager->prepareData( $schemas[$schemaName], $value ) );
		}

		$databaseManager->recordProperties( 'rebuildArticleDataFromSlot', $title, $flatten, $errors );
	}

	/**
	 * @param Title $title
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
		$pageProperties = self::getPageProperties( $title );
		// display title can be null
		if ( $pageProperties !== false
			&& $pageProperties['display_title'] !== null ) {
			return $pageProperties['display_title'];
		}
		return false;
	}

	/**
	 * @param Title $title
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
	 * @param string $titletText
	 * @return Title|null
	 */
	private static function getTitleIfKnown( $titletText ) {
		$title_ = Title::newFromText( $titletText );
		if ( $title_ && $title_->isKnown() ) {
			return $title_;
		}
		return null;
	}

	/**
	 * @param Title $title
	 * @param array $pageForms
	 * @param array $config
	 * @return array
	 */
	private static function processPageForms( $title, $pageForms, $config ) {
		if ( $config['context'] !== 'EditSemantic' ) {
			$databaseManager = new DatabaseManager();
		}

		foreach ( $pageForms as $formID => $value ) {
			$schemas = $pageForms[$formID]['schemas'];

			if ( $config['context'] !== 'EditSemantic' ) {
				$databaseManager->storeLink( $title, 'form', $schemas );
			}

			$jsonData = [];
			$freetext = null;
			$categories = [];
			$editTitle = null;

			if ( !empty( $value['options']['preload'] ) ) {
				$jsonData = self::getPreloadData( $value['options']['preload'] );
			}

			if ( $value['options']['action'] === 'edit' ) {
				if ( $title && $title->isKnown() ) {
					$editTitle = $title;
				}

				if ( !empty( $value['options']['edit-page'] ) ) {
					$editTitle = self::getTitleIfKnown( $value['options']['edit-page'] );
				}

				if ( $editTitle ) {
					$pageForms[$formID]['options']['edit-page'] = $editTitle->getFullText();

					if ( empty( $jsonData ) ) {
						$jsonData = self::getJsonData( $editTitle );
					}
				}
			}

			if ( $value['options']['edit-categories'] === true && $editTitle ) {
				$categories = self::getCategories( $editTitle );
			}

			if ( $value['options']['edit-freetext'] === true && $editTitle ) {
				$freetext = self::getWikipageContent( $editTitle );

				// if ( ExtensionRegistry::getInstance()->isLoaded( 'VEForAll' ) ) {
				//	$out->addModules( 'ext.veforall.main' );
				// }
			}

			$formData = &$pageForms[$formID];

			$formData['jsonData'] = ( !empty( $jsonData ) ? $jsonData : [] );
			$formData['categories'] = $categories;
			$formData['freetext'] = $freetext;
			$formData['errors'] = [];

			// show errors (SubmitForm)
			if ( !array_key_exists( 'origin-url', $value['options'] ) ) {
				$pageForms[$formID]['options']['origin-url'] = $title->getLocalURL();
			}

			// otherwise return-url is the target title
			// @see SubmitForm
			if ( !array_key_exists( 'return-url', $value['options'] )
				&& !empty( $value['options']['return-page'] ) ) {
				$title_ = self::getTitleIfKnown( $value['options']['return-page'] );

				if ( $title_ ) {
					$pageForms[$formID]['options']['return-url'] = $title_->getLocalURL();
				}
			}
		}

		return $pageForms;
	}

	/**
	 * @param string $titleText
	 * @param Title|null &$title
	 * @return array
	 */
	public static function getPreloadData( $titleText, &$title = null ) {
		$title = self::getTitleIfKnown( $titleText );
		if ( !$title ) {
			return [];
		}
		$jsonData = self::getJsonData( $title );
		if ( $jsonData !== false ) {
			return $jsonData;
		}
		return [];
	}

	/**
	 * @param OutputPage $out
	 * @param array $obj
	 * @return void
	 */
	public static function addJsConfigVars( $out, $obj ) {
		$title = $out->getTitle();
		$loadedData = [];

		if ( isset( $obj['pageForms'] ) ) {
			// this will populate self::$schemas with data
			foreach ( $obj['pageForms'] as $value ) {
				self::setSchemas( $out, $value['schemas'] );
			}

			// *** this accounts also of forms inside forms
			$obj['pageForms'] = array_merge( $obj['pageForms'], self::$pageForms );
			$obj['pageForms'] = self::processPageForms( $title, $obj['pageForms'], $obj['config'] );
		}

		if ( isset( $_SESSION ) && !empty( $_SESSION['pagepropertiesform-submissiondata'] ) ) {
			foreach ( $_SESSION['pagepropertiesform-submissiondata'] as $formData ) {
				self::setSchemas( $out, $formData['schemas'] );
			}
		}

		if ( self::$User->isAllowed( 'pageproperties-caneditschemas' )
			|| self::$User->isAllowed( 'pageproperties-canmanageschemas' ) ) {
			$loadedData[] = 'schemas';
			// this will retrieve all schema pages without contents
			// without content @TODO set a limit
			$schemasArr = self::getAllSchemas();
			self::setSchemas( $out, $schemasArr, false );
		}

		$obj['schemas'] = self::$schemas;

		$schemaUrl = self::getFullUrlOfNamespace( NS_PAGEPROPERTIESSCHEMA );

		// this is required as long as a 'OO.ui.SelectFileWidget'
		// is added to a schema
		$allowedMimeTypes = [];
		if ( self::$schemaProcessor ) {
			$allowedMimeTypes = self::$schemaProcessor->getAllowedMimeTypes();
		}

		$VEForAll = false;
		if ( ExtensionRegistry::getInstance()->isLoaded( 'VEForAll' ) ) {
			$VEForAll = true;
			$out->addModules( 'ext.veforall.main' );
		}
		$default = [
			'schemas' => [],
			'pageForms' => [],
			'categories' => [],
			'config' => [
				'PagePropertiesSchemaUrl' => $schemaUrl,
				'actionUrl' => SpecialPage::getTitleFor( 'PagePropertiesSubmit', $title->getPrefixedDBkey() )->getLocalURL(),
				'isNewPage' => $title->getArticleID() === 0 || !$title->isKnown(),

				// *** keep commented to prevent array_merge_recursive
				// creating an array instead of a single value
				// 'context' => null,

				'loadedData' => $loadedData,
				'allowedMimeTypes' => $allowedMimeTypes,
				'caneditschemas' => self::$User->isAllowed( 'pageproperties-caneditschemas' ),
				'canmanagesemanticproperties' => self::$User->isAllowed( 'pageproperties-canmanagesemanticproperties' ),
				'canmanageschemas' => self::$User->isAllowed( 'pageproperties-canmanageschemas' ),
				// 'canmanageforms' => self::$User->isAllowed( 'pageproperties-canmanageforms' ),
				'contentModels' => array_flip( self::getContentModels() ),
				'contentModel' => $title->getContentModel(),
				'SMW' => self::$SMW,
				'VEForAll' => $VEForAll
			],
		];

		$config = $obj['config'];
		$obj = array_merge( $default, $obj );
		$obj['config'] = array_merge_recursive( $default['config'], $config );

		$groups = [ 'sysop', 'bureaucrat', 'pageproperties-admin' ];
		$showOutdatedVersion = empty( $GLOBALS['wgPagePropertiesDisableVersionCheck'] )
			&& (
				self::$User->isAllowed( 'canmanageschemas' )
				|| count( array_intersect( $groups, self::getUserGroups() ) )
			);

		$out->addJsConfigVars( [
			// @see VEForAll ext.veforall.target.js -> getPageName
			'wgPageFormsTargetName' => ( $title && $title->canExist() ? $title
				: Title::newMainPage() )->getFullText(),

			'pageproperties-schemas' => json_encode( $obj['schemas'], true ),
			'pageproperties-pageforms' => json_encode( $obj['pageForms'], true ),
			'pageproperties-config' => json_encode( $obj['config'], true ),
			'pageproperties-show-notice-outdated-version' => $showOutdatedVersion
		] );
	}

	/**
	 * @param int $ns
	 * @return string
	 */
	public static function getFullUrlOfNamespace( $ns ) {
		global $wgArticlePath;

		$formattedNamespaces = MediaWikiServices::getInstance()
			->getContentLanguage()->getFormattedNamespaces();
		$namespace = $formattedNamespaces[$ns];

		$schemaUrl = str_replace( '$1', "$namespace:", $wgArticlePath );
		return wfExpandUrl( $schemaUrl );
	}

	/**
	 * @param Title $title
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
	 * @param Title $title
	 * @param array $schemas
	 * @param int $index
	 * @return string
	 */
	public static function formID( $title, $schemas, $index ) {
		// *** must be deterministic, to handle session data
		return hash( 'md5', $title->getFullText() . implode( $schemas ) . $index );
	}

	/**
	 * @param Output $output
	 * @param array $schemas
	 * @param bool $loadSchemas
	 * @return array
	 */
	public static function setSchemas( $output, $schemas, $loadSchemas = true ) {
		// @FIXME this seems required with
		// visual editor $wgVisualEditorEnableWikitext
		if ( !self::$schemaProcessor ) {
			self::initialize();
		}

		if ( !$output->getTitle() ) {
			$output->setTitle( Title::newMainPage() );
		}

		self::$schemaProcessor->setOutput( $output );
		$ret = [];
		foreach ( $schemas as $value ) {
			$title = Title::newFromText( $value, NS_PAGEPROPERTIESSCHEMA );

			if ( !$title || !$title->isKnown() ) {
				continue;
			}

			$titleText = $title->getText();

			if ( array_key_exists( $titleText, self::$schemas )
				&& !empty( self::$schemas[$titleText] ) ) {
				continue;
			}

			// load only schemas actually in the page
			if ( $loadSchemas === false ) {
				self::$schemas[$titleText] = [];
				continue;
			}

			$text = self::getWikipageContent( $title );
			if ( !empty( $text ) ) {
				$json = json_decode( $text, true );
				if ( $json ) {
					self::$schemas[$titleText] = self::$schemaProcessor->processSchema( $json, $titleText );
				}
			}
		}
	}

	/**
	 * @see https://github.com/SemanticMediaWiki/SemanticResultFormats/blob/master/formats/datatables/DataTables.php#L695
	 * @param array $items
	 * @param string $token
	 * @return array
	 */
	public static function plainToNested( $items, $token = '/' ) {
		$ret = [];
		// @see https://stackoverflow.com/questions/49563864/how-to-convert-a-string-to-a-multidimensional-recursive-array-in-php
		foreach ( $items as $key => $value ) {
			$ref = &$ret;
			$parts = explode( $token, $key );
			$last = array_pop( $parts );
			foreach ( $parts as $part ) {
				$ref[$part][''] = null;
				$ref = &$ref[$part];
				unset( $ref[''] );
			}
			$ref[$last] = $value;
		}
		return $ret;
	}

	/**
	 * @return array
	 */
	public static function getAllSchemas() {
		$arr = self::getPagesWithPrefix( null, NS_PAGEPROPERTIESSCHEMA );
		$ret = [];
		foreach ( $arr as $title_ ) {
			$ret[] = $title_->getText();
		}
		return $ret;
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
		$services = MediaWiki\MediaWikiServices::getInstance();
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
	 * @param Title $title
	 * @return array
	 */
	public static function getCategories( $title ) {
		if ( !$title || !$title->isKnown() ) {
			return [];
		}
		$wikiPage = self::getWikiPage( $title );
		$ret = [];
		$arr = $wikiPage->getCategories();
		foreach ( $arr as $title ) {
			$ret[] = $title->getText();
		}
		return $ret;
	}

	/**
	 * @return array
	 */
	public static function getAllCategories() {
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
	 * @return Importer|Importer1_35
	 */
	public static function getImporter() {
		$services = MediaWikiServices::getInstance();

		if ( version_compare( MW_VERSION, '1.36', '>' ) ) {
			include_once __DIR__ . '/importer/PagePropertiesImporter.php';

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
			$title_ = Title::newFromText( $growinglink );
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
	 * @todo use to invalidate cache holding parserFunctionPagepropertiesPrint
	 * or parserFunctionPagepropertiesQuery and pages containing those as templates
	 * *** invalidate cache of all pages in which this page has been transcluded
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageOwnership/+/refs/heads/master/includes/PageOwnership.php
	 * @param Title $title
	 * @return void
	 */
	public static function invalidateCacheOfPagesWithTemplateLinksTo( $title ) {
		$context = RequestContext::getMain();
		$config = $context->getConfig();
		$options = [ 'LIMIT' => $config->get( 'PageInfoTransclusionLimit' ) ];

		if ( version_compare( MW_VERSION, '1.39', '<' ) ) {
			$transcludedTargets = self::getLinksTo( $title, $options, 'templatelinks', 'tl' );
		} else {
			$transcludedTargets = $title->getTemplateLinksTo( $options );
		}

		foreach ( $transcludedTargets as $title_ ) {
			// $title_->invalidateCache();
			$wikiPage_ = self::getWikiPage( $title_ );
			if ( $wikiPage_ ) {
				$wikiPage_->doPurge();
			}
		}
	}

	/**
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageOwnership/+/7f9723dfd9d7cc3669d8530b8a098c0e13076c6e/includes/PageOwnership.php
	 * @param Title $title
	 * @param array $options
	 * @param string $table
	 * @param string $prefix
	 * @return void
	 */
	public static function getLinksTo( $title, $options = [], $table = 'pagelinks', $prefix = 'pl' ) {
		if ( count( $options ) > 0 ) {
			$db = wfGetDB( DB_PRIMARY );
		} else {
			$db = wfGetDB( DB_REPLICA );
		}

		$res = $db->select(
			[ 'page', $table ],
			LinkCache::getSelectFields(),
			[
				"{$prefix}_from=page_id",
				// ***edited
				"{$prefix}_namespace" => $title->getNamespace(),
				"{$prefix}_title" => $title->getDBkey() ],
			__METHOD__,
			$options
		);

		$retVal = [];
		if ( $res->numRows() ) {
			// $linkCache = MediaWikiServices::getInstance()->getLinkCache();
			foreach ( $res as $row ) {
				// ***edited
				// $titleObj = self::makeTitle( $row->page_namespace, $row->page_title );
				$titleObj = Title::newFromID( $row->page_id );
				if ( $titleObj ) {
					// $linkCache->addGoodLinkObjFromRow( $titleObj, $row );
					$retVal[] = $titleObj;
				}
			}
		}
		return $retVal;
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
				// @see here https://doc.wikimedia.org/mediawiki-core/
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
			if ( array_key_exists( $from_text, self::$cachedJsonData ) ) {
				self::$cachedJsonData[ $to->getFullText() ] = self::$cachedJsonData[ $from_text ];
				unset( self::$cachedJsonData[ $from_text ] );
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
	 * @param User $user
	 * @param Title $title
	 * @param string $text
	 * @return bool
	 */
	public static function saveRevision( $user, $title, $text ) {
		$wikiPage = self::getWikiPage( $title );
		$pageUpdater = $wikiPage->newPageUpdater( $user );
		$slotRoleRegistry = MediaWikiServices::getInstance()->getSlotRoleRegistry();
		$modelId = $slotRoleRegistry->getRoleHandler( SlotRecord::MAIN )->getDefaultModel( $title );

		$slotContent = ContentHandler::makeContent( $text, $title, $modelId );
		$pageUpdater->setContent( MediaWiki\Revision\SlotRecord::MAIN, $slotContent );

		$summary = '';
		$flags = EDIT_INTERNAL;
		$comment = CommentStoreComment::newUnsavedComment( $summary );
		$newRevision = $pageUpdater->saveRevision( $comment, $flags );
		$status = $pageUpdater->getStatus();

		return $status->isOK();
	}

	/**
	 * @param Title $title
	 * @return string|null
	 */
	public static function getWikipageContent( $title ) {
		$wikiPage = self::getWikiPage( $title );
		if ( !$wikiPage ) {
			return null;
		}
		$content = $wikiPage->getContent( \MediaWiki\Revision\RevisionRecord::RAW );
		if ( !$content ) {
			return null;
		}
		return $content->getNativeData();
	}

	/**
	 * @param Title $title
	 * @return MediaWiki\Revision\RevisionRecord|null
	 */
	public static function revisionRecordFromTitle( $title ) {
		$wikiPage = self::getWikiPage( $title );

		if ( $wikiPage ) {
			return $wikiPage->getRevisionRecord();
		}
		return null;
	}

	/**
	 * @param array $arr
	 * @see https://stackoverflow.com/questions/173400/how-to-check-if-php-array-is-associative-or-sequential
	 * @return bool
	 */
	public static function isList( $arr ) {
		if ( function_exists( 'array_is_list' ) ) {
			return array_is_list( $arr );
		}
		if ( $arr === [] ) {
			return true;
		}
		return array_keys( $arr ) === range( 0, count( $arr ) - 1 );
	}

	/**
	 * @param string &$html
	 * @param string $className
	 */
	public static function moveTableHeaders( &$html, $className ) {
		if ( empty( $html ) ) {
			return;
		}

		libxml_use_internal_errors( true );
		$dom = new DOMDocument;
		$dom->loadHTML( mb_convert_encoding( $html, 'HTML-ENTITIES', 'UTF-8' ) );

		$tables = $dom->getElementsByTagName( 'table' );

		if ( !count( $tables ) ) {
			return;
		}

		$childNodesWithTag = static function ( $el, $tagName ) {
			$ret = [];
			$childNodes = $el->childNodes;
			foreach ( $childNodes as $childNode ) {
				if ( $childNode->nodeType === XML_ELEMENT_NODE
					&& $childNode->tagName === $tagName ) {
					$ret[] = $childNode;
				}
			}
			return $ret;
		};

		foreach ( $tables as $table ) {
			$tableClass = $table->getAttribute( 'class' );
			$classes = preg_split( '/\s+/', $tableClass, -1, PREG_SPLIT_NO_EMPTY );

			if ( !in_array( $className, $classes ) ) {
				continue;
			}

			$existingThead = $table->getElementsByTagName( 'thead' )->item( 0 );
			$thead = !$existingThead ? $dom->createElement( 'thead' )
				: $existingThead;

			$tbody = $table->getElementsByTagName( 'tbody' )->item( 0 );
			$rows = $childNodesWithTag( $tbody, 'tr' );
			foreach ( $rows as $row ) {
				$headings = $childNodesWithTag( $row, 'th' );

				if ( !count( $headings ) ) {
					continue;
				}
				$theadRow = $dom->createElement( 'tr' );
				$thead->appendChild( $theadRow );
				foreach ( $headings as $th ) {
					$theadRow->appendChild( $th->cloneNode( true ) );
				}
				$tbody->removeChild( $row );
			}

			if ( !$existingThead ) {
				$table->insertBefore( $thead, $tbody );
			}

			if ( !$thead->hasChildNodes() ) {
				$table->removeChild( $thead );
			}
		}

		$html = $dom->saveHTML();
	}

}
