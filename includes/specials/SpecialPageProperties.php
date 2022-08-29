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

include_once __DIR__ . '/OOUIHTMLFormTabs.php';

use MediaWiki\Content\IContentHandlerFactory;
use MediaWiki\MediaWikiServices;
use MediaWiki\Page\ContentModelChangeFactory;
use SMW\MediaWiki\MediaWikiNsContentReader;

class SpecialPageProperties extends FormSpecialPage {

	/** @var WikiPageFactory */
	private $wikiPageFactory;
	protected $title;
	protected $content_model_error;
	protected $move_page_error = [];
	protected $pageProperties = [];
	protected $manageProperties = [];
	protected $wikiPage;
	protected $processedManageProperties = [];
	protected $semanticPropertiesOptions = [];
	protected $propertiesTypes = [];
	protected $showManagePropertiesAsTab = false;
	protected $importedPropertiesTypes = [];

	/**
	 * @param IContentHandlerFactory $contentHandlerFactory
	 * @param ContentModelChangeFactory $contentModelChangeFactory
	 * @param WikiPageFactory|PermissionManager $wikiPageFactory
	 */
	public function __construct(
		IContentHandlerFactory $contentHandlerFactory,
		ContentModelChangeFactory $contentModelChangeFactory,

		// *** without class name WikiPageFactory, because on
		// MW < 1.36 we are passing another class (PermissionManager)
		$wikiPageFactory
	) {
		$listed = defined( 'SMW_VERSION' );

		// https://www.mediawiki.org/wiki/Manual:Special_pages
		parent::__construct( 'PageProperties', '', $listed );

		$this->contentHandlerFactory = $contentHandlerFactory;
		$this->contentModelChangeFactory = $contentModelChangeFactory;
		$this->wikiPageFactory = ( method_exists( MediaWikiServices::class, 'getWikiPageFactory' ) ? $wikiPageFactory : null );
	}

	/** @inheritDoc */
	protected function getGroupName() {
	}

	/** @inheritDoc */
	protected function getFormFields() {
	}

	/** @inheritDoc */
	public function execute( $par ) {
		$this->requireLogin();

		$this->setParameter( $par );
		$this->setHeaders();

		$user = $this->getUser();

		$this->user = $user;

		// This will throw exceptions if there's a problem
		$this->checkExecutePermissions( $user );

		$securityLevel = $this->getLoginSecurityLevel();

		if ( $securityLevel !== false && !$this->checkLoginSecurityLevel( $securityLevel ) ) {
			$this->displayRestrictionError();
			return;
		}

		$this->addHelpLink( 'Extension:PageProperties' );

		$title = null;

		if ( $par ) {
			// NS_MAIN is ignored if $par is prefixed
			$title = Title::newFromText( $par, NS_MAIN );
			$this->title = $title;

			if ( !$title || !$title->isKnown() ) {
				// @todo show proper error
				$this->displayRestrictionError();
				return;
			}

			$this->wikiPage = ( $this->wikiPageFactory ? $this->wikiPageFactory->newFromTitle( $title ) : WikiPage::factory( $title ) );
		}

		if ( !$title && !defined( 'SMW_VERSION' ) ) {
			$this->displayRestrictionError();
			return;
		}

		$isAuthorized = \PageProperties::isAuthorized( $user, $title, ( $title ? 'Editors' : 'Admins' ) );

		if ( !$isAuthorized ) {
			$this->displayRestrictionError();
			return;
		}

		$this->outputHeader();

		$out = $this->getOutput();

		$context = $this->getContext();

		$context->getOutput()->enableOOUI();

		if ( $title ) {
			$this->getFormValues();
		}

		if ( defined( 'SMW_VERSION' ) ) {
			$this->getFormValuesSMW();
		}

		// if $this->propertiesTypes relies on
		// $this->getManagePropertiesOptions() should
		// be called after it is called
		$out->addJsConfigVars( [
			'pageproperties-propertiesTypes' => json_encode( $this->propertiesTypes, true )
		] );

		$hidden_inputs = [];

		$default_of_display_title = $default_of_language = null;

		if ( $title ) {
			$form_descriptor = $this->formDescriptor( $hidden_inputs, $default_of_display_title, $default_of_language );

		} elseif ( defined( 'SMW_VERSION' ) ) {
			$form_descriptor = [];
			$this->formDescriptorManageProperties( $form_descriptor, $hidden_inputs );
		}
		$htmlForm = new \OOUIHTMLFormTabs( $form_descriptor, $context, 'pageproperties' );

		$htmlForm->setId( 'pageproperties-form' );

		foreach ( $hidden_inputs as $key => $value ) {
			$htmlForm->addHiddenField( $key, $value );
		}

		if ( !defined( 'SMW_VERSION' ) && !$this->getRequest()->wasPosted() && !empty( $this->pageProperties[ 'semantic_properties' ] ) ) {
			$htmlForm->addHiddenField( 'confirm_delete_semantic_properties', 1 );
		}

		$htmlForm->setSubmitCallback( [ $this, 'onSubmit' ] );

		$htmlForm->setFormIdentifier( 'blocklist' );

		// @todo: try to load required scripts from BeforePageDisplay
		// *** (mw and ooui not loading)
		$out->addModules( 'ext.PageProperties' );

		$out->addModuleStyles(
			[
				// 'mediawiki.special',
				'mediawiki.special.preferences.styles.ooui',
			]
		);

		if ( $title ) {
			$return_title = \PageProperties::array_last( explode( "/", $title->getText() ) );
			$out->addWikiMsg( 'pageproperties-return', $title->getText(), $return_title );
			$out->addHTML( '<br>' );
		}

		// @see includes/htmlform/HTMLForm.php
		//if ( $htmlForm->showAlways() ) {
		if ( $this->showAlways( $htmlForm, $default_of_display_title, $default_of_language ) ) {
			$this->onSuccess();
		}
	}

	/**
	 * @see includes/htmlform/HTMLForm.php
	 * @param HTMLForm $htmlForm
	 * @param string $default_of_display_title
	 * @param string $default_of_language
	 * @return bool|Status
	 */
	private function showAlways( $htmlForm, $default_of_display_title, $default_of_language ) {
		$htmlForm->prepareForm();

		$result = $htmlForm->tryAuthorizedSubmit();

		if ( $this->title ) {
			// *** is it a MediaWiki bug ? $this->mFieldData remains empty
			// while 'hide-if' needs them for evaluation
			// @see includes/htmlform/HTMLFormField.php getNearestFieldValue
			// called from getErrorsRaw <- getOOUI <- ... fields/HTMLFormFieldCloner.php ...
			$htmlForm->mFieldData = [
				'page_properties_display_title_select' => $default_of_display_title,
				'page_properties_language_select' => $default_of_language
			];
		}

		$htmlForm->displayForm( $result );

		return $result;
	}

	/**
	 * @see includes/htmlform/HTMLForm.php
	 * @param string $value
	 * @return Message
	 */
	protected function getMessage( $value ) {
		return Message::newFromSpecifier( $value )->setContext( $this->getContext() );
	}

	/**
	 * @return void
	 */
	private function getFormValues() {
		$request = $this->getRequest();

		// page properties
		$mainPage = Title::newMainPage();

		if ( $request->wasPosted() ) {
			$dynamic_values = $this->getDynamictableValues( $_POST );
			$page_properties = [];

			if ( $request->getVal( 'page_properties_display_title_select' ) === 'override' ) {
				$page_properties['page_properties']['display_title'] = $request->getVal( 'page_properties_display_title_input' );
			}

			if ( $request->getVal( 'page_properties_language_select' ) === 'override' ) {
				$page_properties['page_properties']['language'] = $request->getVal( 'page_properties_language_input' );
			}

			$page_properties['page_properties']['model'] = $request->getVal( 'page_properties_model' );

			$meta = [];
			if ( array_key_exists( 'SEO_meta', $dynamic_values ) ) {
				foreach ( $dynamic_values['SEO_meta'] as $value ) {
					$meta[ $value[0] ] = $value[1];
				}
			}
			$page_properties['SEO']['meta'] = $meta;

			$page_properties['SEO']['subpages'] = $request->getVal( 'SEO_subpages' );
			if ( $mainPage->getPrefixedText() == $this->title->getPrefixedText() ) {
				$page_properties['SEO']['entire_site'] = $request->getVal( 'SEO_entire_site' );
			}

		} else {
			$default_values = [
				'page_properties' => [
					// 'display_title' => null,
					// 'language' => $page_language,
					'model' => $this->title->getContentModel(),
				],
				'semantic_properties' => [],
				'SEO' => [
					'meta' => [],
					'subpages' => true,
					// 'entire_site' => null,
				]
			];

			if ( $mainPage->getPrefixedText() == $this->title->getPrefixedText() ) {
				$default_values['SEO']['entire_site'] = true;
			}

			$page_properties = \PageProperties::getPageProperties( $this->title );
			if ( $page_properties === false ) {
				$page_properties = [];
			}

			$page_properties = array_replace_recursive( $default_values, $page_properties );
		}

		$this->pageProperties = $page_properties;
	}

	/**
	 * @return void
	 */
	private function getFormValuesSMW() {
		$request = $this->getRequest();

		// this will set $this->options_user_defined,
		// $this->options_predefined and $this->semanticPropertiesOptions
		$this->setSemanticPropertiesOptions();
		$showManageProperties = ( !$this->title || $this->showManagePropertiesAsTab );

		if ( $request->wasPosted() ) {
			$dynamic_values = $this->getDynamictableValues( $_POST );

			if ( $showManageProperties ) {
				if ( !array_key_exists( 'manage_properties', $dynamic_values ) ) {
					$dynamic_values['manage_properties'] = [];
				}

				foreach ( $dynamic_values['manage_properties'] as $key => $value ) {
					$dynamic_values['manage_properties'][ $key ][0] = Title::makeTitleSafe( SMW_NS_PROPERTY, $value[0] )->getText();
				}

				$this->manageProperties = $dynamic_values['manage_properties'];

				$userDefinedPropertiesValues = [];
				foreach ( $this->manageProperties as $value ) {
					$userDefinedPropertiesValues[ $value[0] ] = $value[1];
				}

				// replace $this->options_user_defined
				// with submitted properties
				$this->semanticPropertiesOptions = $userDefinedPropertiesValues + [ 'predefined' => $this->options_predefined ];

				$this->processManageProperties();
			}

		} else {
			if ( $showManageProperties ) {
				$importedProperties = $this->getImportedProperties();

				foreach ( $this->options_user_defined as $key => $value ) {
					$this->manageProperties[] = [ Title::makeTitleSafe( SMW_NS_PROPERTY, $value )->getText(), ( !empty( $importedProperties[ $key ] ) ? $importedProperties[ $key ] : $this->propertiesTypes[ $key ] ) ];
				}
			}
		}

		if ( !$this->title ) {
			return;
		}

		$page_properties = $this->pageProperties;

		if ( $request->wasPosted() ) {
			if ( !array_key_exists( 'semantic_properties', $dynamic_values ) ) {
				$dynamic_values['semantic_properties'] = [];
			}

			foreach ( $dynamic_values['semantic_properties'] as $val ) {
				list( $label, $value ) = $val;
				if ( !empty( $this->processedManageProperties['renamed'] ) && array_key_exists( $label, $this->processedManageProperties['renamed'] ) ) {
					$label = $this->processedManageProperties[ 'renamed' ][ $label ];
				}
				$page_properties['semantic_properties'][] = [ $label, $value ];
			}

		} else {
			// show rather an error through validation
/*
			$semantic_properties = \PageProperties::getSemanticData( $this->title );
			$page_properties['semantic_properties'] = array_filter( $semantic_properties, static function ( $value ) use( $options ) {
				return in_array( $value[0], $options ) || in_array( $value[0], $options[ 'predefined' ] );
			} );
*/
		}

		if ( empty( $page_properties['semantic_properties'] ) ) {
			$page_properties['semantic_properties'][] = [ key( is_array( reset( $this->semanticPropertiesOptions ) ) ? $this->semanticPropertiesOptions['predefined'] : $this->semanticPropertiesOptions ), "" ];
		}

		$this->pageProperties = $page_properties;
	}

	/**
	 * @return OOUI\ButtonWidget
	 */
	private function clearFieldButton() {
		return new OOUI\ButtonWidget(
			[
				'classes' => [ 'pageproperties_dynamictable_cancel_button' ],
				'icon' => 'close'
			]
		);
	}

	/**
	 * @return OOUI\ButtonWidget
	 */
	private function addFieldButton() {
		return new OOUI\ButtonWidget(
			[
				'classes' => [ 'pageproperties_dynamictable_add_button' ],
				'label' => $this->msg( 'pageproperties_dynamictable_addfield' )->text(),
				'icon' => 'add'
			]
		);
	}

	/**
	 * @param array &$hidden_inputs
	 * @param string &$default_of_display_title
	 * @param string &$default_of_language
	 * @return OOUI\ButtonWidget
	 */
	private function formDescriptor( &$hidden_inputs, &$default_of_display_title, &$default_of_language ) {
		$pageProperties = $this->pageProperties[ 'page_properties' ];
		$SEO = $this->pageProperties[ 'SEO' ];

		$formDescriptor = [];

		/********** display title */

		// select
		$default_of_display_title = $default = ( !array_key_exists( 'display_title', $pageProperties ) ? 'default' : 'override' );
		$display_title_default = ( array_key_exists( 'display_title', $pageProperties ) ? $pageProperties[ 'display_title' ] : "" );

		$formDescriptor[ 'page_properties_display_title_select' ] = [
			'label-message' => 'pageproperties-form-displaytitle-label',
			// 'help-message' => 'pageproperties-form-displaytitle-help',
			'name' => 'page_properties_display_title_select',
			'type' => 'select',
			'options' => [
				$this->msg( 'pageproperties_form-displaytitle-option-default' )->text() => 'default',
				$this->msg( 'pageproperties_form-displaytitle-option-override' )->text() => 'override'
			],
			'default' => $default,
			'infusable' => true,
			'section' => 'form-section-main',
		];

		$formDescriptor[ 'page_properties_display_title_input' ] = [
			// 'label-message' => 'pageproperties-form-displaytitle-label',
			'help-message' => 'pageproperties-form-displaytitle-help',
			'name' => 'page_properties_display_title_input',
			// https://www.mediawiki.org/wiki/HTMLForm
			'hide-if' => [ '===', 'page_properties_display_title_select', 'default' ],
			'type' => 'text',
			'section' => 'form-section-main',
			'default' => $display_title_default,
		];

		/********** language */

		$default_of_language = $default = ( !array_key_exists( 'language', $pageProperties ) ? 'default' : 'override' );

		$formDescriptor[ 'page_properties_language_select' ] = [
			'label-message' => 'pagelang-language',
			'name' => 'page_properties_language_select',
			// 'help-message' => 'pageproperties-form-displaytitle-help',
			"id" => "page_properties_language_select",
			'type' => 'select',
			'options' => [
				$this->msg( 'pageproperties_form-displaytitle-option-default' )->text() => 'default',
				$this->msg( 'pageproperties_form-displaytitle-option-override' )->text() => 'override'
			],
			'default' => $default,
			'infusable' => true,
			'section' => 'form-section-main',
		];

		$options = $this->getLanguageOptions();

		$default = ( array_key_exists( 'language', $pageProperties ) ?
			$pageProperties[ 'language' ] :
				$this->getRequest()->getCookie( 'pageproperties_latest_set_language' )
					// $this->getLanguage()->getCode()
					?? MediaWikiServices::getInstance()->getContentLanguage()->getCode() );

		$formDescriptor['page_properties_language_input'] = [
			'id' => 'mw-pl-languageselector',
			'name' => 'page_properties_language_input',
			'section' => 'form-section-main',
			// https://www.mediawiki.org/wiki/HTMLForm
			'hide-if' => [ '===', 'page_properties_language_select', 'default' ],
			'type' => 'select',
			'options' => $options,
			// 'label-message' => 'pagelang-language',
			'default' => $default,
		];

		/********** content model */

		$options = $this->getOptionsForTitle( $this->title );

		$formDescriptor['page_properties_model'] = [
			'name' => 'page_properties_model',
			'label-message' => 'pageproperties-form-model-label',
			'help-message' => 'pageproperties-form-model-help',
			'section' => 'form-section-main',
			'type' => 'select',
			'options' => $options,
			'validation-callback' => function () {
				if ( $this->content_model_error ) {
					// see includes/htmlform/OOUIHTMLForm.php
					$errors = $this->content_model_error->getErrorsByType( 'error' );
					foreach ( $errors as &$error ) {
						$error = $this->getMessage( array_merge( [ $error['message'] ], $error['params'] ) )->parse();
					}
					return $error;
				}
				return true;
			},
			'default' => $pageProperties['model'],
		];

		/********** semantic properties */

		if ( defined( 'SMW_VERSION' ) ) {
			$semanticProperties = $this->pageProperties[ 'semantic_properties' ];

			// @todo, create an interface to save forms set!
			/*
			$formDescriptor['dynamictable_properties_abc'] = [
					'section' => 'form-section-semantic-properties/a',
					'type' => 'text',
					'infusable' => true,
				];
			*/

			$n = 0;
			foreach ( $semanticProperties as $val ) {
				list( $label, $value ) = $val;

				$prepend_html = '';
				if ( $n == 0 ) {
					$prepend_html .= '<table class="pageproperties_dynamictable" style="width:100%;margin-bottom:12px">';
				}

				$prepend_html .= '<tr class="pageproperties_dynamictable_row"><td class="pageproperties_dynamictable_key_cell">';

				$formDescriptor['dynamictable_semantic_properties_key_' . $n] = [
					'name' => 'dynamictable_semantic_properties_key_' . $n,
					'prepend_html' => $prepend_html,
					'append_html' => '</td>',
					// ***see above, add a subsection like: "/b"
					'section' => 'form-section-semantic-properties',
					'type' => 'select',
					// **** !important, otherwise data will be loaded from the request!
					'nodata' => true,
					// make optgroup, see includes/xml/Xml.php _> listDropDownOptionsOoui()
					'options' => $this->semanticPropertiesOptions,
					'default' => $label,
					'infusable' => true,
				];

				$prepend_html = '<td class="pageproperties_dynamictable_value_cell">';
				$append_html = '</td><td class="pageproperties_dynamictable_cancel_cell">' . $this->clearFieldButton() . '</td></tr>';

				if ( $n == count( $semanticProperties ) - 1 ) {
					$append_html .= '</table>';
					$append_html .= $this->addFieldButton();
				}

				$formDescriptor['dynamictable_semantic_properties_value_' . $n] = [
					'name' => 'dynamictable_semantic_properties_value_' . $n,
					'prepend_html' => $prepend_html,
					'append_html' => $append_html,
					// **** !important, otherwise data will be loaded from the request!
					'nodata' => true,
					// ***see above, add a subsection like: "/b"
					'section' => 'form-section-semantic-properties',
					'type' => 'text',
					'placeholder' => $this->propertiesTypes[$label],
					'default' => $value,
				];

				$n++;
			}

			/********** manage semantic properties */

			$isAuthorized = \PageProperties::isAuthorized( $this->user, $this->title, 'Admins' );

			if ( $this->showManagePropertiesAsTab && $this->title && $isAuthorized ) {
				$this->formDescriptorManageProperties( $formDescriptor, $hidden_inputs );
			}
		}

		/********** SEO */

		$options = [];
		if ( class_exists( 'MediaWiki\Extension\WikiSEO\WikiSEO' ) ) {
			$options = json_decode( file_get_contents( __DIR__ . '/WikiSEO_parameters.json' ), true );
		}

		$n = 0;
		$tags = [ 'description' => 'textarea' ];
		foreach ( $tags as $key => $input_type ) {
			$hidden_inputs['dynamictable_SEO_meta_key_' . $n] = $key;

			$formDescriptor['dynamictable_SEO_meta_value_' . $n] = [
				'name' => 'dynamictable_SEO_meta_value_' . $n,
				'label-message' => 'pageproperties-form-meta_' . $key . '-label',
				'help-message' => 'pageproperties-form-meta_' . $key . '-help',
				'type' => $input_type,
				'rows' => '3',
				'section' => 'form-section-seo',
				'default' => ( $SEO['meta'][ $key ] ?? null ),
			];

			unset( $SEO['meta'][ $key ] );
			$n++;
		}

		if ( empty( $SEO['meta'] ) ) {
			$SEO['meta'] = [ array_key_first( $options ) => '' ];
		}

		$meta_robots_noindex_nofollow = false;

		foreach ( $SEO['meta'] as $key => $value ) {
			$prepend_html = '';

			if ( $n == count( $tags ) ) {
				$prepend_html .= '<table cellpadding="0" cellspacing="0" class="pageproperties_dynamictable" style="width:100%;margin-bottom:12px">';
			}

			$prepend_html .= '<tr class="pageproperties_dynamictable_row"><td style="padding:2px 2px 2px 0" class="pageproperties_dynamictable_key_cell">';

			$formDescriptor['dynamictable_SEO_meta_key_' . $n] = [
				'name' => 'dynamictable_SEO_meta_key_' . $n,
				'prepend_html' => $prepend_html,
				'append_html' => '</td>',
				'section' => 'form-section-seo',
				'type' => ( count( $options ) ? 'combobox' : 'text' ),

				// **** !important, otherwise data will be loaded from the request!
				'nodata' => true,
				'default' => $key,
				'infusable' => true,
			];

			if ( count( $options ) ) {
				// make optgroup, see includes/xml/Xml.php _> listDropDownOptionsOoui()
				$formDescriptor['dynamictable_SEO_meta_key_' . $n]['options'] = $options;
			}

			$prepend_html = '<td style="padding:2px 2px 2px 2px" class="pageproperties_dynamictable_value_cell">';
			$append_html = '</td><td style="padding:2px 0 2px 2px" class="pageproperties_dynamictable_cancel_cell">' . $this->clearFieldButton() . '</td></tr>';

			if ( $n == count( $SEO['meta'] ) - 1 + count( $tags ) ) {
				$append_html .= '</table>';
				$append_html .= $this->addFieldButton();
			}

			$formDescriptor['dynamictable_SEO_meta_value_' . $n] = [
				'name' => 'dynamictable_SEO_meta_value_' . $n,
				'prepend_html' => $prepend_html,
				'append_html' => $append_html,
				'section' => 'form-section-seo',
				'type' => 'text',

				// **** !important, otherwise data will be loaded from the request!
				'nodata' => true,
				'default' => $value,
			];

			$n++;

			if ( $key == 'robots' ) {
				$arr = preg_split( "/\s*,\s*/", $value );
				if ( in_array( 'noindex', $arr ) && in_array( 'nofollow', $arr ) ) {
					$meta_robots_noindex_nofollow = true;
				}
			}

		}

		$formDescriptor['SEO_meta_robots_noindex_nofollow'] = [
			'type' => 'toggle',
			'id' => 'SEO_meta_robots_noindex_nofollow',
			'label-message' => 'pageproperties-form-meta_robots_noindex_nofollow-label',
			'help-message' => 'pageproperties-form-meta_robots_noindex_nofollow-help',
			'section' => 'form-section-seo',
			'default' => $meta_robots_noindex_nofollow,
		];

		$formDescriptor['SEO_subpages'] = [
			'type' => 'toggle',
			'name' => 'SEO_subpages',
			'label-message' => 'pageproperties-form-seo_subpages-label',
			'help-message' => 'pageproperties-form-seo_subpages-help',
			'section' => 'form-section-seo',
			'default' => $SEO['subpages'],
		];

		$mainPage = Title::newMainPage();

		if ( $mainPage->getPrefixedText() == $this->title->getPrefixedText() ) {
			$formDescriptor['SEO_entire_site'] = [
				'type' => 'toggle',
				'name' => 'SEO_entire_site',
				'label-message' => 'pageproperties-form-seo_entire_wiki-label',
				'help-message' => 'pageproperties-form-seo_entire_wiki-help',
				'section' => 'form-section-seo',
				'default' => $SEO['entire_site'],
			];
		}

		return $formDescriptor;
	}

	/**
	 * @param array &$formDescriptor
	 * @param array &$hidden_inputs
	 * @return void
	 */
	private function formDescriptorManageProperties( &$formDescriptor, &$hidden_inputs ) {
		$manage_properties = $this->manageProperties;
		$manage_properties_options = $this->getManagePropertiesOptions();

		if ( empty( $manage_properties ) ) {
			$manage_properties = [ [ "", reset( $manage_properties_options ) ] ];
		}

		// available properties (user defined)
		$options = $this->options_user_defined;

		$hidden_inputs['dynamictable_manage_properties_before'] = json_encode( $manage_properties );

		$n = 0;
		foreach ( $manage_properties as $value_ ) {
			list( $key, $value ) = $value_;

			$prepend_html = '';

			if ( $n == 0 ) {
				$prepend_html .= '<table class="pageproperties_dynamictable" style="width:100%;margin-bottom:12px">';
			}

			$prepend_html .= '<tr class="pageproperties_dynamictable_row"><td class="pageproperties_dynamictable_key_cell">';

			$formDescriptor['dynamictable_manage_properties_key_' . $n] = [
				'name' => 'dynamictable_manage_properties_key_' . $n,
				'prepend_html' => $prepend_html,
				'append_html' => '</td>',
				'section' => 'form-section-semantic-manage-properties' . ( !$this->title ? '/inner-section' : '' ),
				'type' => 'combobox',

				// **** !important, otherwise data will be loaded from the request!
				'nodata' => true,
				'validation-callback' => function ( $key ) {
					if ( array_key_exists( $key, $this->move_page_error ) ) {
						// see includes/htmlform/OOUIHTMLForm.php
						$errors = $this->move_page_error[ $key ]->getErrorsByType( 'error' );
						foreach ( $errors as &$error ) {
							$error = $this->getMessage( array_merge( [ $error['message'] ], $error['params'] ) )->parse();
						}
						return $error;
					}
					return true;
				},

				// make optgroup, see includes/xml/Xml.php _> listDropDownOptionsOoui()
				'options' => $options,
				'default' => $key,
				'infusable' => true,
			];

			$prepend_html = '<td class="pageproperties_dynamictable_value_cell">';
			$append_html = '</td><td class="pageproperties_dynamictable_cancel_cell">' . $this->clearFieldButton() . '</td></tr>';

			if ( $n == count( $manage_properties ) - 1 ) {
				$append_html .= '</table>';
				$append_html .= $this->addFieldButton();
			}

			$formDescriptor['dynamictable_manage_properties_value_' . $n] = [
				'name' => 'dynamictable_manage_properties_value_' . $n,
				'prepend_html' => $prepend_html,
				'append_html' => $append_html,

				// **** !important, otherwise data will be loaded from the request!
				'nodata' => true,

				'section' => 'form-section-semantic-manage-properties' . ( !$this->title ? '/inner-section' : '' ),
				'type' => 'select',

				// **** !important, otherwise data will be loaded from the request!
				'nodata' => true,
				'options' => $manage_properties_options,
				'default' => $value,
				'infusable' => true,
			];

			$n++;
		}
	}

	/**
	 * *** alternatively get all property subjects of
	 * *** imported properties and match with $this->options_user_defined ?
	 * @return array
	 */
	private function getImportedProperties() {
		$ret = [];
		foreach ( $this->options_user_defined as $value ) {
			$subject = new SMW\DIWikiPage( $value, SMW_NS_PROPERTY );
			$semanticData = \PageProperties::$SMWStore->getSemanticData( $subject );

			// consider latest declaration
			$imported_property = null;
			foreach ( $semanticData->getProperties() as $property ) {
				if ( $property->getKey() === '_IMPO' ) {
					$imported_property = $property;
				}
			}

			if ( !$imported_property ) {
				continue;
			}

			$propertyValues = $semanticData->getPropertyValues( $imported_property );
			foreach ( $propertyValues  as $dataItem ) {
				$dataValue = \PageProperties::$SMWDataValueFactory->newDataValueByItem( $dataItem, $imported_property );

				if ( $dataValue instanceof SMW\DataValues\ImportValue ) {
					$importReference = $dataValue->getImportReference();
					// e.g. [Prop a] => foaf:phone
					$ret[ $value ] = $dataValue->getNSID() . ':' . $dataValue->getLocalName();
				}
			}
		}

		return $ret;
	}

	/**
	 * @return array
	 */
	private function getManagePropertiesOptions() {
		// see PageForms/includes/PF_Utils.php
		$datatypeLabels = ( function_exists( 'smwfContLang' ) ? smwfContLang() : $GLOBALS['smwgContLang'] )->getDatatypeLabels();
		$property_options = array_combine( array_values( $datatypeLabels ), array_values( $datatypeLabels ) );

		$IMPORT_PREFIX = SMW\DataValues\ImportValue::IMPORT_PREFIX;
		$imported_vocabularies = \PageProperties::getPagesWithPrefix( $IMPORT_PREFIX, NS_MEDIAWIKI );

		// see SemanticMediawiki/src/DataValues/ValueParsers/ImportValueParser.php
		$mediaWikiNsContentReader = new MediaWikiNsContentReader;
		foreach ( $imported_vocabularies as $title ) {
			$controlledVocabulary = $mediaWikiNsContentReader->read(
				$title->getText()
			);

			$namespace = substr( $title->getText(), strlen( $IMPORT_PREFIX ) );
			list( $uri, $name, $typelist ) = $this->doParse( $controlledVocabulary );

			preg_match( '/\[([^\[\]]+)\]/', $name, $match );
			$vocabulary_label = preg_replace( '/^[^\s]+\s/', '', $match[1] );

			$property_options[$vocabulary_label] = [];
			foreach ( $typelist as $key => $value ) {
				if ( $value !== 'Category' && $value !== 'Type:Category' ) {
					$label_value = $namespace . ':' . $key;
					$property_options[$vocabulary_label][$label_value] = $label_value;
					$this->importedPropertiesTypes[$label_value] = str_replace( 'Type:', '', $value );
				}
			}
		}

		return $property_options;
	}

	/**
	 *  @see extensions/SemanticMediaWiki/src/DataValues/ValueParsers/ImportValueParser.php (the method is private)
	 * @param array $controlledVocabulary
	 * @return array
	 */
	private function doParse( $controlledVocabulary ) {
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
	 * @return void
	 */
	protected function getLanguageOptions() {
		// https://www.mediawiki.org/wiki/Manual:Language
		// see specials/SpecialPageLanguage.php

		// Building a language selector
		$userLang = $this->getLanguage()->getCode();

		$languages = MediaWikiServices::getInstance()
			->getLanguageNameUtils()
			->getLanguageNames( $userLang, 'mwfile' );

		$options = [];
		foreach ( $languages as $code => $name ) {
			$options["$code - $name"] = $code;
		}

		return $options;
	}

	/**
	 * @return void
	 */
	private function setSemanticPropertiesOptions() {
		$this->options_user_defined = [];
		$this->options_predefined = [];

		$this->getSemanticProperties( \PageProperties::getUsedProperties() );
		$this->getSemanticProperties( \PageProperties::getUnusedProperties() );
		$this->getSemanticProperties( \PageProperties::getSpecialProperties() );

		ksort( $this->options_user_defined );
		ksort( $this->options_predefined );

		$this->semanticPropertiesOptions = $this->options_user_defined + [ 'predefined' => $this->options_predefined ];
	}

	/**
	 * @param array $properties
	 * @return void
	 */
	private function getSemanticProperties( $properties ) {
		$dataValueFactory = SMW\DataValueFactory::getInstance();
		$dataTypeRegistry = SMW\DataTypeRegistry::getInstance();
		$propertyRegistry = SMW\PropertyRegistry::getInstance();

		foreach ( $properties as $property ) {
			if ( !method_exists( $property, 'getKey' ) ) {
				continue;
			}

			if ( in_array( $property->getKey(), \PageProperties::$exclude ) ) {
				continue;
			}

			if ( $property->isUserAnnotable() ) {

				// see src/Factbox/Factbox.php => createRows()
				// *** use instead PropertyRegistry::getInstance()->isVisible( $this->m_key ) ?
				$propertyDv = $dataValueFactory->newDataValueByItem( $property, null );

				if ( !$propertyDv->isVisible() ) {
					continue;
				}
				$canonicalLabel = $property->getCanonicalLabel();
				// $preferredLabel = $property->getPreferredLabel();

				$property_key = $property->getKey();
				$label = $property->getLabel();

				if ( $property->isUserDefined() ) {
					// @todo remove this condition as long as
					// we can guarantee that deleting a property page
					// also deletes entries from propertyStatisticsStore
					// see SemanticMediaWiki/src/SQLStore/Lookup/PropertyUsageListLookup.php
					if ( !Title::makeTitleSafe( SMW_NS_PROPERTY,  $label )->isKnown() ) {
						continue;
					}

					// *** use $canonicalLabel as value ?
					$this->options_user_defined[ $label ] = $label;

				} else {
					// *** use $canonicalLabel as value ?
					$this->options_predefined[ $label ] = $label;
				}

				if ( !array_key_exists( $label, $this->propertiesTypes ) ) {
					$typeID = $property->findPropertyTypeID();
					$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );
					// $canonicalLabelById = $dataTypeRegistry->findCanonicalLabelById( $typeID );
					// $typeByLabel = $dataTypeRegistry->findTypeByLabel( $label );	// returns null
					$this->propertiesTypes[ $label ] = ( !empty( $typeLabel ) ? $typeLabel : $label );
				}
			}
		}
	}

	/**
	 * @see includes/specials/SpecialChangeContentModel.php
	 * @param Title|null $title
	 * @return array
	 */
	private function getOptionsForTitle( Title $title = null ) {
		$models = $this->contentHandlerFactory->getContentModels();
		$options = [];

		foreach ( $models as $model ) {
			$handler = $this->contentHandlerFactory->getContentHandler( $model );

			if ( !$handler->supportsDirectEditing() ) {
				continue;
			}

			if ( $title ) {
				if ( !$handler->canBeUsedOn( $title ) ) {
					continue;
				}
			}

			$options[ ContentHandler::getLocalizedName( $model ) ] = $model;
		}

		return $options;
	}

	// https://www.mediawiki.org/wiki/Manual:Language
	// see includes/specials/SpecialPageLanguage.php

	/**
	 * @param IContextSource $context
	 * @param Title $title
	 * @param string $newLanguage Language code
	 * @param string $reason Reason for the change
	 * @param array $tags Change tags to apply to the log entry
	 * @return Status
	 */
	public static function changePageLanguage(
		IContextSource $context,
		Title $title,
		$newLanguage,
		$reason,
		array $tags = []
	) {
		// Get the default language for the wiki
		$defLang = $context->getConfig()->get( 'LanguageCode' );

		$pageId = $title->getArticleID();

		// Check if article exists
		if ( !$pageId ) {
			return Status::newFatal(
				'pagelang-nonexistent-page',
				wfEscapeWikiText( $title->getPrefixedText() )
			);
		}

		// Load the page language from DB
		$dbw = wfGetDB( DB_MASTER );
		$oldLanguage = $dbw->selectField(
			'page',
			'page_lang',
			[ 'page_id' => $pageId ],
			__METHOD__
		);

		// Check if user wants to use the default language
		if ( $newLanguage === 'default' ) {
			$newLanguage = null;
		}

		// No change in language
		if ( $newLanguage === $oldLanguage ) {
			// Check if old language does not exist
			if ( !$oldLanguage ) {
				return Status::newFatal(
					ApiMessage::create(
						[
							'pagelang-unchanged-language-default',
							wfEscapeWikiText( $title->getPrefixedText() )
						],
						'pagelang-unchanged-language'
					)
				);
			}
			return Status::newFatal(
				'pagelang-unchanged-language',
				wfEscapeWikiText( $title->getPrefixedText() ),
				$oldLanguage
			);
		}

		// Hardcoded [def] if the language is set to null
		$logOld = $oldLanguage ?: $defLang . '[def]';
		$logNew = $newLanguage ?: $defLang . '[def]';

		// Writing new page language to database
		$dbw->update(
			'page',
			[ 'page_lang' => $newLanguage ],
			[
				'page_id' => $pageId,
				'page_lang' => $oldLanguage
			],
			__METHOD__
		);

		if ( !$dbw->affectedRows() ) {
			return Status::newFatal( 'pagelang-db-failed' );
		}

		$logid = null;

		// ***edited
		// phpcs:ignore Generic.CodeAnalysis.UnconditionalIfStatement.Found
		if ( false ) {
		// Logging change of language
			$logParams = [
				'4::oldlanguage' => $logOld,
				'5::newlanguage' => $logNew
			];
			$entry = new ManualLogEntry( 'pagelang', 'pagelang' );
			$entry->setPerformer( $context->getUser() );
			$entry->setTarget( $title );
			$entry->setParameters( $logParams );
			$entry->setComment( $reason );
			$entry->addTags( $tags );

			$logid = $entry->insert();
			$entry->publish( $logid );
		}
		// Force re-render so that language-based content (parser functions etc.) gets updated
		$title->invalidateCache();

		return Status::newGood(
			(object)[
				'oldLanguage' => $logOld,
				'newLanguage' => $logNew,
				'logId' => $logid,
			]
		);
	}

	/**
	 * @see includes/specials/SpecialChangeContentModel.php
	 * @param Title $title
	 * @param string $model
	 * @return Status
	 */
	protected function changeContentModel( $title, $model ) {
		// ***edited
		//$page = $this->wikiPageFactory->newFromTitle( $title );
		$page = $this->wikiPage;

		// ***edited
		$performer = ( method_exists( RequestContext::class, 'getAuthority' ) ? $this->getContext()->getAuthority() : $this->getUser() );

		$changer = $this->contentModelChangeFactory->newContentModelChange(
			// ***edited
			$performer,
			$page,

			// ***edited
			$model
		);

		// MW 1.36+
		if ( method_exists( ContentModelChange::class, 'authorizeChange' ) ) {
			$permissionStatus = $changer->authorizeChange();
			if ( !$permissionStatus->isGood() ) {
				$out = $this->getOutput();
				$wikitext = $out->formatPermissionStatus( $permissionStatus );
				// Hack to get our wikitext parsed
				return Status::newFatal( new RawMessage( '$1', [ $wikitext ] ) );
			}

		} else {
			$errors = $changer->checkPermissions();
			if ( $errors ) {
				$out = $this->getOutput();
				$wikitext = $out->formatPermissionsErrorMessage( $errors );
				// Hack to get our wikitext parsed
				return Status::newFatal( new RawMessage( '$1', [ $wikitext ] ) );
			}
		}

		// Can also throw a ThrottledError, don't catch it
		$status = $changer->doContentModelChange(
			$this->getContext(),

			// ***edited
			// $data['reason'],
			null,
			true
		);

		return $status;
	}

	/**
	 * @param array $data
	 * @return array
	 */
	private function getDynamictableValues( $data ) {
		$output = [];

		// see includes/htmlform/HTMLFormField.php
		// $this->mName = "wp{$params['fieldname']}";
		foreach ( $data as $key => $value ) {
			if ( strpos( $key, 'dynamictable_' ) === 0 ) {

				// dynamictable_properties_key_1
				preg_match( '/^dynamictable_(.+?)_key_([^_]+)$/', $key, $match );

				if ( $match ) {
					$key_of_value = str_replace( '_key_', '_value_', $key );

					if ( !empty( $value ) && !empty( $data[ $key_of_value ] ) ) {
						$output[ $match[1] ][ $match[2] ] = [ $value, $data[ $key_of_value ] ];

					}
				}
			}
		}

		return $output;
	}

	/**
	 * @see includes/specialpage/FormSpecialPage.php
	 * @param array $data
	 * @return bool
	 */
	public function onSubmit( $data ) {
		if ( $this->title ) {
			$this->savePageProperties( $data );
		}

		$showManageProperties = ( !$this->title || $this->showManagePropertiesAsTab );
		if ( $showManageProperties ) {
			$this->setManageProperties();
		}

		return true;
	}

	/**
	 * @param array $data
	 * @return void
	 */
	private function savePageProperties( $data ) {
		$title = $this->title;
		$pageProperties = $this->pageProperties['page_properties'];

		if ( $title->getContentModel() != $pageProperties['model'] ) {
			$status = self::changeContentModel( $title, $pageProperties['model'] );
			if ( !$status->isOK() ) {
				$this->content_model_error = $status;
			}
		}

		if ( !empty( $pageProperties['language'] ) ) {
			$newLanguage = $pageProperties['language'];

			$res_ = self::changePageLanguage(
				$this->getContext(),
				$title,
				$newLanguage,
				$data['reason'] ?? ''
			);

			$request = $this->getRequest();
			$request->response()->setCookie( 'pageproperties_latest_set_language', $newLanguage );
		}

		$update_obj = $this->pageProperties;

		// display title is added to the page_props table
		// through the hook onMultiContentSave
		\PageProperties::setPageProperties( $this->user, $title, $update_obj );
	}

	/**
	 * @return void
	 */
	private function processManageProperties() {
		$managed_properties = $this->manageProperties;
		$dynamictable_manage_properties_before = json_decode( $this->getRequest()->getVal( 'dynamictable_manage_properties_before' ), true );

		$deleted = [];
		$renamed = [];
		$edited = [];
		$current_properties = [];
		$map = [];
		foreach ( $dynamictable_manage_properties_before as $key => $value ) {
			$map[$value[0]] = $value[1];

			if ( empty( $value[0] ) ) {
				continue;
			}

			if ( !array_key_exists( $key, $managed_properties ) ) {
				$deleted[] = $value[0];
				continue;
			}

			$current_properties[] = $value[0];

			$new_value = $managed_properties[$key];

			if ( $value[0] != $new_value[0] ) {
				// old page name, new page name
				$renamed[$value[0]] = $new_value[0];
			}

			if ( $value[1] != $new_value[1] ) {
				$edited[ $value[0] ] = $new_value[1];
			}
		}

		$added = array_filter( $managed_properties, static function ( $value ) use( $renamed ) {
			return !in_array( $value[0], $renamed );
		} );

		$added = array_filter( $added, static function ( $value ) use( $current_properties, $map, &$edited, $deleted ) {
			// added an existing property
			if ( in_array( $value[0], $current_properties ) ) {
				// update with the last value
				if ( $map[$value[0]] != $value[1] ) {
					$edited[ $value[0] ] = $value[1];
				}
				return false;
			}
			// deleted, then readded
			if ( in_array( $value[0], $deleted ) ) {
				if ( $map[$value[0]] != $value[1] ) {
					$edited[ $value[0] ] = $value[1];
				}
				return false;
			}

			return true;
		} );

		$deleted = array_filter( $deleted, static function ( $value ) use( $edited ) {
			return !array_key_exists( $value, $edited );
		} );

		$this->processedManageProperties = [ 'deleted' => $deleted, 'renamed' => $renamed, 'edited' => $edited, 'added' => $added ];
	}

	/**
	 * @param string $imported_label
	 * @param string $has_type_label
	 * @param string $value
	 * @return array
	 */
	private function createPropValue( $imported_label, $has_type_label, $value ) {
		if ( strpos( $value, ':' ) === false ) {
			return [ $has_type_label => $value ];
		}
		return [
			$imported_label => $value,
			$has_type_label => $this->importedPropertiesTypes[ $value ]
		];
	}

	/**
	 * @return void
	 */
	private function setManageProperties() {
		$deleted = $this->processedManageProperties['deleted'];
		$renamed = $this->processedManageProperties['renamed'];
		$edited = $this->processedManageProperties['edited'];
		$added = $this->processedManageProperties['added'];

		$editPropertySubjects = [];
		foreach ( $deleted as $value ) {
			$title_ = Title::makeTitleSafe( SMW_NS_PROPERTY, $value );
			$wikiPage_ = ( $this->wikiPageFactory ? $this->wikiPageFactory->newFromTitle( $title_ ) : WikiPage::factory( $title_ ) );
			$reason = '';
			\PageProperties::deletePage( $wikiPage_, $this->user, $reason );

			// delete all the property values in related pages
			$editPropertySubjects[ $value ] = 'delete';
		}

		$imported_label = ( new SMW\DIProperty( '_IMPO' ) )->getLabel();
		$has_type_label = ( new SMW\DIProperty( '_TYPE' ) )->getLabel();

		foreach ( $edited as $value => $newValue ) {
			$title_ = Title::makeTitleSafe( SMW_NS_PROPERTY, $value );
			\PageProperties::setPageProperties( $this->user, $title_, [
				'semantic_properties' => $this->createPropValue( $imported_label, $has_type_label, $newValue )
			] );
		}

		// @todo use getTitlesForEditingWithContext (see below)
		// to replace properties names directly
		// annotated on the page
		foreach ( $renamed as $value => $newValue ) {
			// property name could be prefixed, using makeTitleSafe
			// instead of newFromText
			$title_from = Title::makeTitleSafe( SMW_NS_PROPERTY, $value );
			$title_to = Title::makeTitleSafe( SMW_NS_PROPERTY, $newValue );
			$move_result = \PageProperties::movePage( $this->user, $title_from, $title_to );

			if ( !$move_result->isOK() ) {
				$this->move_page_error[ $newValue ] = $move_result;
				continue;
			}

			$editPropertySubjects[ $value ] = 'rename';
		}

		foreach ( $added as $value ) {
			$title_ = Title::makeTitleSafe( SMW_NS_PROPERTY, $value[0] );

			\PageProperties::setPageProperties( $this->user, $title_, [
				'semantic_properties' => $this->createPropValue( $imported_label, $has_type_label, $value[1] )
			] );
		}

		$titles_map = [];
		// get all pages using this property
		$options = new SMW\RequestOptions();
		$update_pages = [];
		foreach ( $editPropertySubjects as $value => $action ) {
			$property = SMW\DIProperty::newFromUserLabel( $value );
			$dataItems = \PageProperties::$SMWStore->getAllPropertySubjects( $property, $options );

			if ( $dataItems instanceof \Traversable ) {
				$dataItems = iterator_to_array( $dataItems );
			}

			foreach ( $dataItems as $page ) {
				$title_ = $page->getTitle();
				$title_text = $title_->getFullText();
				$titles_map[ $title_text ] = $title_;
				if ( !array_key_exists( $title_text, $update_pages ) ) {
					$update_pages[ $title_text ] = [];
				}
				if ( !array_key_exists( $value, $update_pages[ $title_text ] ) || $action === 'delete' ) {
					$update_pages[ $title_text ][ $value ] = $action;
				}
			}
		}

		$user_id = $this->user->getId();
		if ( count( $update_pages ) ) {
			$jobs = [];
			foreach ( $update_pages as $title_text => $values ) {
				$title_ = $titles_map[ $title_text ];
				$jobs[] = new PagePropertiesJob( $title_, [ 'user_id' => $user_id, 'values' => $values, 'new_values' => $renamed ] );
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
	 * // this could be used in case properties
	 * // have been annotated directly on the page
	 * // see ReplaceText/src/SpecialReplaceText.php
	 * @param string $target
	 * @param array $selected_namespaces
	 * @param string $category
	 * @param string $prefix
	 * @param bool $use_regex
	 * @return array
	 */
	function getTitlesForEditingWithContext( $target, $selected_namespaces, $category, $prefix, $use_regex ) {
		$titles_for_edit = [];

		$res = Search::doSearchQuery(
			// original text
			$target,
			// filter namespace
			$selected_namespaces,
			// filter category
			$category,
			// filter pages with prefix
			$prefix,
			// whether target is a regular expression
			$use_regex
		);

		foreach ( $res as $row ) {
			$title = Title::makeTitleSafe( $row->page_namespace, $row->page_title );
			if ( $title == null ) {
				continue;
			}

			// @phan-suppress-next-line SecurityCheck-ReDoS target could be a regex from user
			$context = $this->extractContext( $row->old_text, $this->target, $this->use_regex );
			$role = $this->extractRole( (int)$row->slot_role_id );
			$titles_for_edit[] = [ $title, $context, $role ];
		}

		return $titles_for_edit;
	}

	/**
	 * @return void
	 */
	public function onSuccess() {
	}

	/**
	 * @return void
	 */
	protected function getDisplayFormat() {
		return 'ooui';
	}

}
