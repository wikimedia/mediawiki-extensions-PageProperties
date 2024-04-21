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

include_once __DIR__ . '/OOUIHTMLFormTabs.php';

use MediaWiki\Content\IContentHandlerFactory;
use MediaWiki\Languages\LanguageNameUtils;
use MediaWiki\MediaWikiServices;
use MediaWiki\Page\ContentModelChangeFactory;

// @TODO handle properties through database
// @see here https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/refs/heads/1.0.3/includes/PageProperties.php

class SpecialPageProperties extends FormSpecialPage {

	/** @var WikiPageFactory */
	private $wikiPageFactory;

	/** @var title */
	protected $title;

	/** @var content_model_error */
	protected $content_model_error;

	/** @var pageProperties */
	protected $pageProperties = [];

	/** @var wikiPage */
	protected $wikiPage;

	/**
	 * @param IContentHandlerFactory $contentHandlerFactory
	 * @param ContentModelChangeFactory $contentModelChangeFactory
	 * @param WikiPageFactory|PermissionManager $wikiPageFactory
	 */
	public function __construct(
		IContentHandlerFactory $contentHandlerFactory,
		ContentModelChangeFactory $contentModelChangeFactory,

		// *** omit class name WikiPageFactory, because on
		// MW < 1.36 we are passing another class (PermissionManager)
		$wikiPageFactory
	) {
		$listed = false;

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
		// $this->requireLogin();
		// $this->setParameter( $par );
		// $this->setHeaders();

		$out = $this->getOutput();
		$out->setArticleRelated( false );
		$out->setRobotPolicy( $this->getRobotPolicy() );

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

		$canEditPageProperties = $user->isAllowed( 'pageproperties-caneditpageproperties' );

		if ( !$canEditPageProperties ) {
			$this->displayRestrictionError();
			return;
		}

		if ( !$par ) {
			// @TODO show proper error
			$this->displayRestrictionError();
			return;
		}

		// NS_MAIN is ignored if $par is prefixed
		$title = Title::newFromText( $par, NS_MAIN );
		$this->title = $title;

		if ( !$title || !$title->isKnown() ) {
			$this->displayRestrictionError();
			return;
		}

		if ( !defined( 'SMW_VERSION' ) && $title->getNamespace() === NS_CATEGORY ) {
			$this->displayRestrictionError();
			return;
		}

		try {
			$this->wikiPage = ( $this->wikiPageFactory ? $this->wikiPageFactory->newFromTitle( $title )
				: WikiPage::factory( $title ) );

		} catch ( Exception $e ) {
			$out->addHTML( "<b>Internal error: </b>" . $e->getMessage() );
			return;
		}

		$this->outputHeader();

		$context = $this->getContext();

		$context->getOutput()->enableOOUI();

		$out->setPageTitle( $this->msg( 'pageproperties' )->text() );
		$this->getFormValues( $out );

		$out->addModules( 'ext.PageProperties' );

		$out->addModuleStyles(
			[
				// 'mediawiki.special',
				// *** this is required to render
				// the sticky submit button
				'mediawiki.special.preferences.styles.ooui',
			]
		);

		$out->addModuleStyles( 'oojs-ui-widgets.styles' );

		$this->addJsConfigVars( $out );

		$hidden_inputs = [];

		$default_of_display_title = $default_of_language = null;

		$form_descriptor = array_merge(
			$this->formDescriptorTabMain( $default_of_display_title, $default_of_language ),
			$this->formDescriptorTabSEO( $hidden_inputs )
		);

		$htmlForm = new \OOUIHTMLFormTabs( $form_descriptor, $context, 'pageproperties' );

		$htmlForm->setId( 'pageproperties-form' );

		$request = $this->getRequest();

		foreach ( $hidden_inputs as $key => $value ) {
			$htmlForm->addHiddenField( $key, $value );
		}

		$htmlForm->setSubmitCallback( [ $this, 'onSubmit' ] );

		$return_title = \PageProperties::currentSubpage( $title->getFullText() );

		$out->addWikiMsg( 'pageproperties-return', $title->getFullText(), $return_title );
		$out->addHTML( '<br>' );

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
	 * @param Output $out
	 */
	private function addJsConfigVars( $out ) {
		$groups = [ 'sysop', 'bureaucrat', 'pageproperties-admin' ];

		$showOutdatedVersion = empty( $GLOBALS['wgPagePropertiesDisableVersionCheck'] )
			&& (
				$this->user->isAllowed( 'caneditpageproperties' )
				|| count( array_intersect( $groups, \PageProperties::getUserGroups() ) )
			);
		$out->addJsConfigVars( [
			'pageproperties-show-notice-outdated-version' => $showOutdatedVersion
		] );
	}

	/**
	 * @param OutputPage $out
	 * @return void
	 */
	private function getFormValues( $out ) {
		$request = $this->getRequest();
		$mainPage = Title::newMainPage();

		$pageProperties = \PageProperties::getPageProperties( $this->title );

		if ( $pageProperties === false ) {
			$pageProperties = [
				'display_title' => null,
				// $page_language
				'language' => null,
				'meta' => null,
				'meta_subpages' => null,
				'meta_entire_site' => $mainPage->getPrefixedText() == $this->title->getPrefixedText(),
			];
		}

		$pageProperties[ 'model' ] = $this->title->getContentModel();

		if ( $request->wasPosted() ) {
			$dynamic_values = $this->getDynamictableValues( $_POST );

			if ( $request->getVal( 'page_properties_display_title_select' ) === 'override' ) {
				$pageProperties['display_title'] = $request->getVal( 'page_properties_display_title_input' );

			} else {
				$pageProperties['display_title'] = null;
			}

			if ( $request->getVal( 'page_properties_language_select' ) === 'override' ) {
				$pageProperties['language'] = $request->getVal( 'page_properties_language_input' );

			} else {
				$pageProperties['language'] = null;
			}

			$pageProperties['model'] = $request->getVal( 'page_properties_model' );

			$meta = [];
			if ( array_key_exists( 'SEO_meta', $dynamic_values ) ) {
				foreach ( $dynamic_values['SEO_meta'] as $value ) {
					$meta[ $value[0] ] = $value[1];
				}
			}

			$pageProperties['meta'] = $meta;

			$pageProperties['meta_subpages'] = $request->getVal( 'SEO_subpages' );
			if ( $mainPage->getPrefixedText() == $this->title->getPrefixedText() ) {
				$pageProperties['meta_entire_site'] = $request->getVal( 'SEO_entire_site' );
			}
		}

		$this->pageProperties = $pageProperties;
	}

	/**
	 * @param string &$default_of_display_title
	 * @param string &$default_of_language
	 * @return array
	 */
	private function formDescriptorTabMain( &$default_of_display_title, &$default_of_language ) {
		$ret = [];
		$pageProperties = $this->pageProperties;
		$default_of_display_title = $default = ( $pageProperties['display_title'] === null ? 'default' : 'override' );
		$display_title_default = ( $pageProperties['display_title'] !== null ? $pageProperties[ 'display_title' ] : '' );

		$ret[ 'page_properties_display_title_select' ] = [
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

		$ret[ 'page_properties_display_title_input' ] = [
			// 'label-message' => 'pageproperties-form-displaytitle-label',
			'help-message' => 'pageproperties-form-displaytitle-help',
			'name' => 'page_properties_display_title_input',
			// https://www.mediawiki.org/wiki/HTMLForm
			'hide-if' => [ '===', 'page_properties_display_title_select', 'default' ],
			'type' => 'text',
			'section' => 'form-section-main',
			// *** not working with 'hide-if'
			// 'infusable' => false,
			'default' => $display_title_default,
		];

		$default_of_language = $default = ( $pageProperties['language'] === null ? 'default' : 'override' );

		$ret[ 'page_properties_language_select' ] = [
			'label-message' => 'pagelang-language',
			'name' => 'page_properties_language_select',
			'id' => 'page_properties_language_select',
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

		$default = ( $pageProperties['language'] !== null ?
			$pageProperties[ 'language' ] :
				$this->getRequest()->getCookie( 'pageproperties_latest_set_language' )
					// $this->getLanguage()->getCode()
					?? MediaWikiServices::getInstance()->getContentLanguage()->getCode() );

		$ret['page_properties_language_input'] = [
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

		$options = $this->getOptionsForTitle( $this->title );

		$ret['page_properties_model'] = [
			'name' => 'page_properties_model',
			'label-message' => 'pageproperties-form-model-label',
			'help-message' => 'pageproperties-form-model-help',
			'section' => 'form-section-main',
			'type' => 'select',
			'options' => $options,
			'validation-callback' => function () {
				if ( $this->content_model_error ) {
					// @see includes/htmlform/OOUIHTMLForm.php
					$errors = $this->content_model_error->getErrorsByType( 'error' );
					// @FIXME this will show only the first error
					foreach ( $errors as &$error ) {
						return $this->getMessage( array_merge( [ $error['message'] ], $error['params'] ) )->parse();
					}
				}
				return true;
			},
			'default' => $pageProperties['model'],
		];

		return $ret;
	}

	/**
	 * @param string &$hidden_inputs
	 * @return array
	 */
	private function formDescriptorTabSEO( &$hidden_inputs ) {
		$ret = [];
		$pageProperties = $this->pageProperties;
		$SEO_meta = $pageProperties[ 'meta' ];
		$SEO_subpages = $pageProperties[ 'meta_subpages' ];
		$SEO_entire_site = $pageProperties[ 'meta_entire_site' ];

		$options = [];
		if ( class_exists( 'MediaWiki\Extension\WikiSEO\WikiSEO' ) ) {
			$options = json_decode( file_get_contents( __DIR__ . '/WikiSEO_parameters.json' ), true );
		}

		$n = 0;
		$tags = [ 'description' => 'textarea' ];
		foreach ( $tags as $key => $input_type ) {
			$hidden_inputs['dynamictable_SEO_meta_key_' . $n] = $key;

			$ret['dynamictable_SEO_meta_value_' . $n] = [
				'name' => 'dynamictable_SEO_meta_value_' . $n,
				'label-message' => 'pageproperties-form-meta_' . $key . '-label',
				'help-message' => 'pageproperties-form-meta_' . $key . '-help',
				'type' => $input_type,
				'rows' => '3',

				// @todo, handle dynamic table with OOUI widgets
				// 'append_html' => '<div id="pageproperties-form-meta-properties-wrapper"></div>',
				'section' => 'form-section-seo',
				'default' => ( $SEO_meta[ $key ] ?? null ),
			];

			unset( $SEO_meta[ $key ] );
			$n++;
		}

		if ( empty( $SEO_meta ) ) {
			$SEO_meta = [ array_key_first( $options ) => '' ];
		}

		$meta_robots_noindex_nofollow = false;

		// @todo, handle dynamic table with OOUI widgets
		foreach ( $SEO_meta as $key => $value ) {
			$prepend_html = '';

			if ( $n == count( $tags ) ) {
				$prepend_html .= '<table cellpadding="0" cellspacing="0" class="pageproperties_dynamictable">';
			}

			$prepend_html .= '<tr class="pageproperties_dynamictable_row"><td style="padding-left:0" class="pageproperties_dynamictable_key_cell">';

			$ret['dynamictable_SEO_meta_key_' . $n] = [
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
				$ret['dynamictable_SEO_meta_key_' . $n]['options'] = $options;
			}

			$prepend_html = '<td class="pageproperties_dynamictable_value_cell">';
			$append_html = '</td><td style="padding-right:0" class="pageproperties_dynamictable_cancel_cell">' . $this->clearFieldButton() . '</td></tr>';

			if ( $n == count( $SEO_meta ) - 1 + count( $tags ) ) {
				$append_html .= '</table>';
				$append_html .= $this->addFieldButton();
			}

			$ret['dynamictable_SEO_meta_value_' . $n] = [
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
				$arr = preg_split( '/\s*,\s*/', $value );
				if ( in_array( 'noindex', $arr ) && in_array( 'nofollow', $arr ) ) {
					$meta_robots_noindex_nofollow = true;
				}
			}
		}

		$ret['SEO_meta_robots_noindex_nofollow'] = [
			'type' => 'toggle',
			'id' => 'SEO_meta_robots_noindex_nofollow',
			'label-message' => 'pageproperties-form-meta_robots_noindex_nofollow-label',
			'help-message' => 'pageproperties-form-meta_robots_noindex_nofollow-help',
			'section' => 'form-section-seo',
			'default' => $meta_robots_noindex_nofollow,
		];

		$ret['SEO_subpages'] = [
			'type' => 'toggle',
			'name' => 'SEO_subpages',
			'label-message' => 'pageproperties-form-seo_subpages-label',
			'help-message' => 'pageproperties-form-seo_subpages-help',
			'section' => 'form-section-seo',
			'default' => $SEO_subpages,
		];

		$mainPage = Title::newMainPage();

		if ( $mainPage->getPrefixedText() == $this->title->getPrefixedText() ) {
			$ret['SEO_entire_site'] = [
				'type' => 'toggle',
				'name' => 'SEO_entire_site',
				'label-message' => 'pageproperties-form-seo_entire_wiki-label',
				'help-message' => 'pageproperties-form-seo_entire_wiki-help',
				'section' => 'form-section-seo',
				'default' => $SEO_entire_site,
			];
		}

		return $ret;
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
	 * @return void
	 */
	protected function getLanguageOptions() {
		// https://www.mediawiki.org/wiki/Manual:Language
		// see specials/SpecialPageLanguage.php

		// Building a language selector
		$userLang = $this->getLanguage()->getCode();

		$languages = MediaWikiServices::getInstance()
			->getLanguageNameUtils()
			->getLanguageNames( $userLang, LanguageNameUtils::SUPPORTED );

		$options = [];
		foreach ( $languages as $code => $name ) {
			$options["$code - $name"] = $code;
		}

		return $options;
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

		ksort( $options );

		return $options;
	}

	/**
	 * @see includes/specials/SpecialPageLanguage.php	// https://www.mediawiki.org/wiki/Manual:Language
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
		// phpcs:ignore MediaWiki.Usage.DeprecatedConstantUsage.DB_MASTER
		$dbw = \PageProperties::wfGetDB( version_compare( MW_VERSION, '1.36', '<' ) ? DB_MASTER : DB_PRIMARY );
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

		// Force re-render so that language-based content (parser functions etc.)
		// gets updated
		$wikipage = \PageProperties::getWikiPage( $title );
		$wikipage->doPurge();

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
	 * @param WikiPage $page
	 * @param string $model
	 * @return Status
	 */
	public function changeContentModel( $page, $model ) {
		// ***edited
		// $page = $this->wikiPageFactory->newFromTitle( $title );

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
			'',
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
		$title = $this->title;
		$pageProperties = $this->pageProperties;

		if ( $title->getContentModel() != $pageProperties['model'] ) {
			$status = self::changeContentModel( $this->wikiPage, $pageProperties['model'] );
			if ( !$status->isOK() ) {
				$this->content_model_error = $status;
				return Status::newFatal( 'formerror' );
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

		unset( $pageProperties['model'] );

		// display title is added to the page_props table
		// through the hook onMultiContentSave
		$errors = [];
		\PageProperties::setPageProperties( $title, $pageProperties, $errors );

		return !count( $errors ) ? true
			: Status::newFatal( 'formerror' );
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
