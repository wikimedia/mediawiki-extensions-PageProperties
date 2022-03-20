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

use MediaWiki\MediaWikiServices;

use MediaWiki\Content\IContentHandlerFactory;
use MediaWiki\Page\ContentModelChangeFactory;
use MediaWiki\Page\WikiPageFactory;

use MediaWiki\Extension\WikiSEO;

class SpecialPageProperties extends FormSpecialPage
{

	private $wikiPageFactory;
	protected $record;
	protected $title;
	protected $record_exists;

	// see extensions/SemanticMediaWiki/import/groups/predefined.properties.json
	protected $exclude = [
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



	public function __construct(
		IContentHandlerFactory $contentHandlerFactory,
		ContentModelChangeFactory $contentModelChangeFactory,
		WikiPageFactory $wikiPageFactory
	)
	{


// https://www.mediawiki.org/wiki/Manual:Special_pages
		$listed = false;
		parent::__construct('PageProperties', '', $listed);

		$this->contentHandlerFactory = $contentHandlerFactory;
		$this->contentModelChangeFactory = $contentModelChangeFactory;
		$this->wikiPageFactory = $wikiPageFactory;
	}

	protected function getGroupName() {}
	protected function getFormFields() {}


	public function execute($par)
	{
		$this->requireLogin();

		$this->setParameter($par);
		$this->setHeaders();

		$user = $this->getUser();

		// This will throw exceptions if there's a problem
		$this->checkExecutePermissions( $user );

		$securityLevel = $this->getLoginSecurityLevel();

		if ( $securityLevel !== false && !$this->checkLoginSecurityLevel( $securityLevel ) ) {
			return;
		}

		$this->addHelpLink( 'Extension:PageProperties' );

		$title_text = $par;

		$title = Title::newFromText( $title_text, NS_MAIN );

		if ( !$title->isKnown() ) {
			return;
		}
		
		$this->title = $title;

		$wikiPage = WikiPage::factory($title);

		$creator_identity = $wikiPage->getCreator();

		$creator = User::newFromIdentity($creator_identity);

		$isAuthorized = \PageProperties::isAuthorized( $user, $title );

		if ( !$isAuthorized ) {
			return;
		}

		$this->outputHeader();

		$out = $this->getOutput();

		$context = $this->getContext();

		$context->getOutput()->enableOOUI();

		$page_id = $title->getArticleID();

		$dbr = wfGetDB(DB_REPLICA);

		$row = $dbr->selectRow(
			'page_properties',
			'*',
			['page_id' => $page_id],
			__METHOD__
		);

		$row = (array)$row;

		$this->record_exists = false;

		if ( !$row || $row == [ false ] ) {
			$row = [
				'display_title' => null,
				'language' => null,
				'properties' => null,
				'meta' => null,
				'meta_subpages' => null,
				'meta_entire_site' => null,
			];

		} else {
			$this->record_exists = true;
		}

		$this->record = $row;



		if ( empty( $_POST[ 'wpEditToken' ] ) ) {
			$values = [ 'meta' => ( empty( $row['meta'] ) ? [] : json_decode( $row['meta'], true ) ) ];


		} else {
			$values = $this->getDynamictableValues( $_POST );
			$meta = [];
			foreach( $values['meta'] as $value ) {
				$meta[ $value[0] ] = $value[1];
			}
			$values['meta'] = $meta;
			$this->dynamic_values = $values;
		}



		$hidden_inputs = [];
		$form_descriptor = $this->getFormDescriptor( $values, $hidden_inputs );

		
		$htmlForm = new \OOUIHTMLFormTabs( $form_descriptor, $context, 'pageproperties' );


		foreach ($hidden_inputs as $key => $value ) {
			$htmlForm->addHiddenField( $key, $value );
		}



		$htmlForm->setSubmitCallback( [ $this, 'onSubmit' ] );

		$htmlForm->setFormIdentifier( 'blocklist' );


		// @todo: try to load required scripts from BeforePageDisplay
		// *** (mw and ooui not loading)
		$out->addModules('ext.PageProperties');

		$out->addModuleStyles(
			[
				//'mediawiki.special',
				'mediawiki.special.preferences.styles.ooui',
			]
		);

		$out->addWikiMsg(
			'pageproperties-return',
			$title->getText(),
			( !empty( $display_title ) ? $display_title : \PageProperties::shownTitle( $title->getText() ) )
		);

		$out->addHTML('<br>');

		// see includes/htmlform/HTMLForm.php
		if ( $htmlForm->showAlways() ) {
			$this->onSuccess();
		}

	}


	// see includes/htmlform/HTMLForm.php
	protected function getMessage( $value ) {
		return Message::newFromSpecifier( $value )->setContext( $this->getContext() );
	}


	protected function getFormDescriptor( $values, &$hidden_inputs ) 
	{

		$formDescriptor = [];



		/********** display title **********/


		$display_title = $this->record[ 'display_title' ];

		if ( !$this->record_exists ) {
			$result_ = self::getDisplayTitle( $this->title, $display_title );

			if ( empty($display_title ) ) {
				$display_title = \PageProperties::shownTitle( $this->title->getText() );
			}
		}

		$formDescriptor[ 'display_title' ] = [
			'label-message' => 'pageproperties-form-displaytitle-label',
			'help-message' => 'pageproperties-form-displaytitle-help',
			'type' => 'text',
			'section' => 'form-section-main',
			'default' => $display_title,
		];




		/********** language **********/


		list( $language_code, $options) = $this->getLanguageData();


		$formDescriptor['language'] = [
			'id' => 'mw-pl-languageselector',
			'section' => 'form-section-main',
			'cssclass' => 'mw-languageselector',
			'type' => 'select',
			'options' => $options,
			'label-message' => 'pagelang-language',
			'default' => $language_code,
		];





		/********** content model **********/



		$options = $this->getOptionsForTitle( $this->title );

		$formDescriptor['model'] = [
			'label-message' => 'pageproperties-form-model-label',
			'help-message' => 'pageproperties-form-model-help',
			'section' => 'form-section-main',
			'type' => 'select',
			'options' => $options,

			'validation-callback' => function() {
				if ( $this->content_model_error ) {
				
					// see includes/htmlform/OOUIHTMLForm.php
					$errors = $this->content_model_error->getErrorsByType( 'error' );
					foreach ( $errors as &$error ) {
						$error = $this->getMessage(
						array_merge( [ $error['message'] ], $error['params'] ) )->parse();
					}
					return $error;
				}
				return true;
			},
			'default' => $this->title->getContentModel(),
		];




		/********** buttons **********/

		$clear_field_button = new OOUI\ButtonWidget(
			[
				'classes' => [ 'pageproperties_dynamictable_cancel_button' ],
				'icon' => 'close'
			]
		);

		$add_field_button = new OOUI\ButtonWidget(
			[
				'classes' => [ 'pageproperties_dynamictable_add_button' ],
				'label' => $this->msg( 'pf_createtemplate_addfield' )->text(),
				'icon' => 'add'
			]
		);



		/********** semantic properties **********/



		if ( class_exists( 'SemanticMediaWiki' ) ) {

			$options = $this->getSemanticPropertiesOptions();

			if ( empty( $_POST[ 'wpEditToken' ] ) ) {
				$values['properties']  = \PageProperties::getSemanticData( $this->title );

				$values['properties'] = array_filter( $values['properties'], function( $value ) use( $options ) {
					return in_array( $value[0], $options ) || in_array( $value[0], $options[ 'predefined' ] );
				});

			}


			if ( empty( $values['properties'] ) ) {
				$values['properties'][] = [ key( $options ), "" ];
			}


			$n = 0;
			foreach ( $values['properties'] as $val ) {

				list( $key, $value ) = $val;

				$prepend_html = '';

				if ( $n == 0 ) {
					$prepend_html .= '<table class="pageproperties_dynamictable" style="width:100%;margin-bottom:12px">';
				}

				$prepend_html .= '<tr class="pageproperties_dynamictable_row"><td class="pageproperties_dynamictable_key_cell">';


// $this->mName = "wp{$params['fieldname']}";
				$formDescriptor['dynamictable_properties_key_' . $n] = [
					'name' => 'dynamictable_properties_key_' . $n,
					'prepend_html' => $prepend_html,
					'append_html' => '</td>',
					'section' => 'form-section-semantic-properties',
					'type' => 'select',

					// **** !important, otherwise data will be loaded from the request!
					'nodata' => true,

				// make optgroup, see includes/xml/Xml.php _> listDropDownOptionsOoui()
					'options' => $options,
					'default' => $key,
					'infusable' => true,
				];

				$prepend_html = '<td class="pageproperties_dynamictable_value_cell">';
				$append_html = '</td><td class="pageproperties_dynamictable_cancel_cell">' . $clear_field_button . '</td></tr>';

				if ( $n == sizeof( $values['properties'] ) - 1) {
					$append_html .= '</table>';
					$append_html .= $add_field_button;
				}

				$formDescriptor['dynamictable_properties_value_' . $n] = [
					'name' => 'dynamictable_properties_value_' . $n,
					'prepend_html' => $prepend_html,
					'append_html' => $append_html,

					// **** !important, otherwise data will be loaded from the request!
					'nodata' => true,

					'section' => 'form-section-semantic-properties',
					'type' => 'text',
					'default' => $value,
				];

				$n++;
			}


		}




		/********** SEO **********/

		
		$options = [];

		if ( class_exists( 'MediaWiki\Extension\WikiSEO\WikiSEO' ) ) {
			$options = json_decode( file_get_contents( __DIR__ . '/WikiSEO_parameters.json' ), true );
		} 

	
		$tags = [ 'description' => 'textarea' ];

		$n = 0;

		foreach ( $tags as $key => $input_type ) {

/*
			$formDescriptor['dynamictable_meta_key_' . $n] = [
				'type' => 'hidden',
				'default' => $key,
			];
*/
			$hidden_inputs['dynamictable_meta_key_' . $n] = $key;



			$formDescriptor['dynamictable_meta_value_' . $n] = [
				'name' => 'dynamictable_meta_value_' . $n,
				'label-message' => 'pageproperties-form-meta_' . $key . '-label',
				'help-message' => 'pageproperties-form-meta_' . $key . '-help',
				'type' => $input_type,
				'rows' => '3',
				'section' => 'form-section-SEO',
				'default' => ( empty( $values[ 'meta' ][ $key ] ) ? null : $values[ 'meta' ][ $key ] ),
			];

			unset( $values[ 'meta' ][ $key ] );

			$n++;
		}


		if ( empty( $values['meta'] ) ) {
			$values['meta'] = [ array_key_first( $options ) => ''];
		}

		$meta_robots_noindex_nofollow = false;

		foreach ( $values['meta'] as $key => $value ) {

			$prepend_html = '';

			if ($n == sizeof( $tags ) ) {
				$prepend_html .= '<table cellpadding="0" cellspacing="0" class="pageproperties_dynamictable" style="width:100%;margin-bottom:12px">';
			}

			$prepend_html .= '<tr class="pageproperties_dynamictable_row"><td style="padding:2px 2px 2px 0" class="pageproperties_dynamictable_key_cell">';

			$formDescriptor['dynamictable_meta_key_' . $n] = [
				'name' => 'dynamictable_meta_key_' . $n,
				'prepend_html' => $prepend_html,
				'append_html' => '</td>',
				'section' => 'form-section-SEO',
				'type' => 'combobox',

				// **** !important, otherwise data will be loaded from the request!
				'nodata' => true,

				// make optgroup, see includes/xml/Xml.php _> listDropDownOptionsOoui()
				'options' => $options,
				'default' => $key,
				'infusable' => true,
			];

			$prepend_html = '<td style="padding:2px 2px 2px 2px" class="pageproperties_dynamictable_value_cell">';
			$append_html = '</td><td style="padding:2px 0 2px 2px" class="pageproperties_dynamictable_cancel_cell">' . $clear_field_button . '</td></tr>';

			if ( $n == sizeof( $values['meta'] ) - 1 + sizeof( $tags ) ) {
				$append_html .= '</table>';
				$append_html .= $add_field_button;
			}

			$formDescriptor['dynamictable_meta_value_' . $n] = [
				'name' => 'dynamictable_meta_value_' . $n,
				'prepend_html' => $prepend_html,
				'append_html' => $append_html,
				'section' => 'form-section-SEO',
				'type' => 'text',

				// **** !important, otherwise data will be loaded from the request!
				'nodata' => true,
				'default' => $value,
			];

			$n++;

			if ( $key == 'robots' ) {
				$arr = preg_split( "/\s*,\s*/", $value );
				if ( in_array( 'noindex', $arr) && in_array( 'nofollow', $arr ) ) {
					$meta_robots_noindex_nofollow = true;
				}
			}

		}


		$formDescriptor['meta_robots_noindex_nofollow'] = [
			'type' => 'toggle',
			'id' => 'meta_robots_noindex_nofollow',
			'label-message' => 'pageproperties-form-meta_robots_noindex_nofollow-label',
			'help-message' => 'pageproperties-form-meta_robots_noindex_nofollow-help',
			'section' => 'form-section-SEO',
			'default' => $meta_robots_noindex_nofollow,
		];


		$formDescriptor['meta_subpages'] = [
			'type' => 'toggle',
			'label-message' => 'pageproperties-form-meta_subpages-label',
			'help-message' => 'pageproperties-form-meta_subpages-help',
			'section' => 'form-section-SEO',
			'default' => $this->record['meta_subpages'],
		];

		$mainPage = Title::newMainPage();

		if ( $mainPage->getPrefixedText() == $this->title->getPrefixedText() ) {

			$formDescriptor['meta_entire_site'] = [
				'type' => 'toggle',
				'label-message' => 'pageproperties-form-meta_entire_wiki-label',
				'help-message' => 'pageproperties-form-meta_entire_wiki-help',
				'section' => 'form-section-SEO',
				'default' => $this->record['meta_entire_site'],
			];
		}

/*
		$formDescriptor['title'] = [
			'type' => 'hidden',
			'default' => $par,
		];
*/

		return $formDescriptor;

	}




	protected function getLanguageData()
	{	

		// https://www.mediawiki.org/wiki/Manual:Language
		// see specials/SpecialPageLanguage.php

		// Building a language selector
		$userLang = $this->getLanguage()->getCode();

		$languages = MediaWikiServices::getInstance()
			->getLanguageNameUtils()
			->getLanguageNames($userLang, 'mwfile');

		$options = [];
		foreach ($languages as $code => $name) {
			$options["$code - $name"] = $code;
		}

		$language_code = $this->record['language'];

		if ( empty( $language_code ) ) {
			$language_code = $this->title ? $this->title->getPageLanguage()->getCode() : $this->getConfig()->get( 'LanguageCode' );
		}


		return [ $language_code, $options ];

	}



	protected function getSemanticPropertiesOptions()
	{
		
		$this->options_user_defined = [];
		$this->options_predefined = [];

		$this->semanticPropertiesOptions( \PageProperties::getUsedProperties( $this->title ) );

		$this->semanticPropertiesOptions( \PageProperties::getUnusedProperties( $this->title ) );

		$this->semanticPropertiesOptions( \PageProperties::getSpecialProperties( $this->title ) );


		$this->options_predefined = array_filter( $this->options_predefined, function( $value ) {
			return !in_array( $value, $this->exclude);
		});

		ksort($this->options_user_defined);
		ksort($this->options_predefined);


		// remove annotated properties

		$annotatedProperties = \PageProperties::getAnnotatedProperties( $this->title );

		$this->options_user_defined = array_filter( $this->options_user_defined, function( $value ) use( $annotatedProperties ) {
			return !in_array( $value, $annotatedProperties);
		});

		$this->options_predefined = array_filter( $this->options_predefined, function( $value ) use( $annotatedProperties ) {
			return !in_array( $value, $annotatedProperties);
		});


		return $this->options_user_defined + [ 'predefined' => $this->options_predefined ];

	}


	protected function semanticPropertiesOptions( $properties )
	{

		$dataValueFactory = SMW\DataValueFactory::getInstance();

		foreach ( $properties as $property ) {

			if ( !method_exists( $property, 'getKey' ) ) {
				continue;
			}

			if ( in_array( $property->getKey(), $this->filterProperties ) ) {
				continue;
			}

			if ( $property->isUserAnnotable() ) {

				$propertyDv = $dataValueFactory->newDataValueByItem( $property, null );

				if ( !$propertyDv->isVisible() ) {
					continue;
				}
			
				$label = $property->getCanonicalLabel();
				$name = $property->getKey();

				if ( str_replace( '_', ' ', $name ) == $label) {
					$this->options_user_defined[ $label ] = $name;

				} else {
					$this->options_predefined[ $label ] = $name;
				}

			}
		}
	}


	//see includes/specials/SpecialChangeContentModel.php
	private function getOptionsForTitle( Title $title = null )
	{
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

			$options[ ContentHandler::getLocalizedName($model) ] = $model;
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
	)
	{
		// Get the default language for the wiki
		$defLang = $context->getConfig()->get('LanguageCode');

		$pageId = $title->getArticleID();

		// Check if article exists
		if (!$pageId) {
			return Status::newFatal(
				'pagelang-nonexistent-page',
				wfEscapeWikiText($title->getPrefixedText())
			);
		}

		// Load the page language from DB
		$dbw = wfGetDB(DB_MASTER);
		$oldLanguage = $dbw->selectField(
			'page',
			'page_lang',
			['page_id' => $pageId],
			__METHOD__
		);

		// Check if user wants to use the default language
		if ($newLanguage === 'default') {
			$newLanguage = null;
		}

		// No change in language
		if ($newLanguage === $oldLanguage) {
			// Check if old language does not exist
			if (!$oldLanguage) {
				return Status::newFatal(
					ApiMessage::create(
						[
							'pagelang-unchanged-language-default',
							wfEscapeWikiText($title->getPrefixedText())
						],
						'pagelang-unchanged-language'
					)
				);
			}
			return Status::newFatal(
				'pagelang-unchanged-language',
				wfEscapeWikiText($title->getPrefixedText()),
				$oldLanguage
			);
		}

		// Hardcoded [def] if the language is set to null
		$logOld = $oldLanguage ?: $defLang . '[def]';
		$logNew = $newLanguage ?: $defLang . '[def]';

		// Writing new page language to database
		$dbw->update(
			'page',
			['page_lang' => $newLanguage],
			[
				'page_id' => $pageId,
				'page_lang' => $oldLanguage
			],
			__METHOD__
		);

		if (!$dbw->affectedRows()) {
			return Status::newFatal('pagelang-db-failed');
		}

		$logid = null;

		// ***edited
		if (false) {
		// Logging change of language
			$logParams = [
				'4::oldlanguage' => $logOld,
				'5::newlanguage' => $logNew
			];
			$entry = new ManualLogEntry('pagelang', 'pagelang');
			$entry->setPerformer($context->getUser());
			$entry->setTarget($title);
			$entry->setParameters($logParams);
			$entry->setComment($reason);
			$entry->addTags($tags);

			$logid = $entry->insert();
			$entry->publish($logid);
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



	//see includes/specials/SpecialChangeContentModel.php 
	protected function changeContentModel($title, $model)
	{
		$page = $this->wikiPageFactory->newFromTitle($title);

		$changer = $this->contentModelChangeFactory->newContentModelChange(
			$this->getContext()->getAuthority(),
			$page,
		
			// ***edited
			$model
		);

		$permissionStatus = $changer->authorizeChange();
		if (!$permissionStatus->isGood()) {
			$out = $this->getOutput();
			$wikitext = $out->formatPermissionStatus($permissionStatus);
			// Hack to get our wikitext parsed
			return Status::newFatal(new RawMessage('$1', [$wikitext]));
		}

		// Can also throw a ThrottledError, don't catch it
		$status = $changer->doContentModelChange(
			$this->getContext(),
			$data['reason'],
			true
		);

		return $status;
	}

	protected function getDynamictableValues($data)
	{
		$output = [];

// see includes/htmlform/HTMLFormField.php
// $this->mName = "wp{$params['fieldname']}";
		foreach ( $data as $key => $value ) {
			if ( strpos( $key, 'dynamictable_' ) === 0) {

				// dynamictable_properties_key_1
				preg_match( '/dynamictable_([^_]+)_key_([^_]+)/', $key, $match );

				if ( $match ) {

					$key_of_value = str_replace( '_key_', '_value_', $key );

					if ( !empty( $data[ $key_of_value ] ) ) {
						$output[ $match[1] ][] = [ $value, $data[ $key_of_value ] ];

					} 

				}

			}
		}

		return $output;
	}


// see includes/specialpage/FormSpecialPage.php
	public function onSubmit($data)
	{

		// merge dynamically created inputs with
		// inputs from form descriptor

		$properties = $this->dynamic_values;


		$title = $this->title;

		if ( $title->getContentModel() != $data['model'] ) {
			$status = self::changeContentModel( $title, $data['model'] );

			if ( !$status->isOK() ) {
				$this->content_model_error = $status;
			}

		}

		$newLanguage = $data['language'];

		$res_ = self::changePageLanguage(
			$this->getContext(),
			$title,
			$newLanguage,
			$data['reason'] ?? ''
		);

		$data['title'] = str_replace( '_', ' ', $data[ 'title' ] );


 
		$date = date( 'Y-m-d H:i:s' );

		$update_obj = array_intersect_key( $data, $this->record );


		$update_obj['updated_at'] = $date;

		$update_obj['properties'] = ( !empty( $properties[ 'properties' ] ) ? json_encode( $properties[ 'properties' ] ) : null );

		$update_obj['meta'] = ( !empty( $properties[ 'meta' ] ) ? json_encode( $properties[ 'meta' ] ) : null );


		$page_id = $title->getArticleID();

		$dbr = wfGetDB(DB_MASTER);

		$row = $dbr->selectRow(
			'page_properties',
			'*',
			['page_id' => $page_id],
			__METHOD__
		);

		if ( !$row || $row == [ false ] ) {
			$update_obj['page_id'] = $page_id;
			$update_obj['created_at'] = $date;

			$row = $dbr->insert(
				'page_properties',
				$update_obj
			);

		} else {
			$row = $dbr->update(
				'page_properties',
				$update_obj,
				['page_id' => $page_id],
				__METHOD__
			);
		}

		\PageProperties::rebuildSemanticData( $title );


		return true;
	}




	public function onSuccess() { }



// https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/DisplayTitle/+/refs/heads/REL1_36/includes/DisplayTitleHooks.php
	private static function getDisplayTitle(
		Title $title,
		&$displaytitle,
		$wrap = false
	)
	{
		$title = $title->createFragmentTarget('');

		if (!$title->canExist()) {
			// If the Title isn't a valid content page (e.g. Special:UserLogin), just return.
			return false;
		}

		$originalPageName = $title->getPrefixedText();
		$wikipage = new WikiPage($title);
		$redirect = false;
		$redirectTarget = $wikipage->getRedirectTarget();
		if ($redirectTarget !== null) {
			$redirect = true;
			$title = $redirectTarget;
		}
		$id = $title->getArticleID();
		if ( method_exists( MediaWikiServices::class, 'getPageProps' ) ) {
			// MW 1.36+
			$values = MediaWikiServices::getInstance()->getPageProps()->getProperties($title, 'displaytitle');
		} else {
			$values = PageProps::getInstance()->getProperties($title, 'displaytitle');
		}
		if (array_key_exists($id, $values)) {
			$value = $values[$id];
			if (trim(str_replace('&#160;', '', strip_tags($value))) !== ''
				&& $value !== $originalPageName) {
				$displaytitle = $value;
				if ($wrap) {
					$displaytitle = new HtmlArmor($displaytitle);
				}
				return true;
			}
		} elseif ($redirect) {
			$displaytitle = $title->getPrefixedText();
			if ($wrap) {
				$displaytitle = new HtmlArmor($displaytitle);
			}
			return true;
		}
		return false;
	}



	protected function getDisplayFormat()
	{
		return 'ooui';
	}

}


