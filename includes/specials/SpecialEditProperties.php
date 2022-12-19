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

class SpecialEditProperties extends FormSpecialPage {

	protected $title;
	protected $wikiPage;
	protected $canEditProperties;
	protected $canManageProperties;

	/** @inheritDoc */
	public function __construct() {
		$listed = false;

		// https://www.mediawiki.org/wiki/Manual:Special_pages
		parent::__construct( 'EditProperties', '', $listed );
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

		$this->setHeaders();

		$user = $this->getUser();

		$this->user = $user;

		// This will throw exceptions if there's a problem
		// $this->checkExecutePermissions( $user );

		// $securityLevel = $this->getLoginSecurityLevel();

		// if ( $securityLevel !== false && !$this->checkLoginSecurityLevel( $securityLevel ) ) {
		// 	$this->displayRestrictionError();
		// 	return;
		// }

		if ( !defined( 'SMW_VERSION' ) ) {
			$this->displayRestrictionError();
			return;
		}

		$this->addHelpLink( 'Extension:PageProperties' );

		if ( $par ) {
			// NS_MAIN is ignored if $par is prefixed
			$title = Title::newFromText( $par, NS_MAIN );
			$this->title = $title;
			$this->wikiPage = \PageProperties::getWikiPage( $this->title );
		}

		$this->canEditProperties = $user->isAllowed( 'pageproperties-caneditproperties' );
		$this->canManageProperties = $user->isAllowed( 'pageproperties-canmanageproperties' );

		// $this->outputHeader();

		$request = $this->getRequest();

		if ( $request->wasPosted() ) {
			$formData = [];
			// e.g. semantic-properties-input-Carbon_copy-0
			foreach ( $_POST as $key => $value ) {
				if ( strpos( $key, 'semantic-properties-input-' ) === 0 ) {
					preg_match( '/^semantic\-properties\-input\-(.+?)\-\d+$/', $key, $match );

					// replace underscore with space
					// https://www.php.net/manual/en/language.variables.external.php
					$formData[ urldecode( $match[1] ) ][] = $value;
				}
			}

			$ret = $this->onSubmit( $formData );

			if ( $ret ) {
				return;
			}
		}

		$this->semanticProperties = \PageProperties::getSemanticProperties();

		$setForms = [];
		if ( $this->title && $this->title->isKnown() ) {
			$pageProperties = \PageProperties::getPageProperties( $this->title );
			if ( $pageProperties === false ) {
				$pageProperties = [];
			}

			$default_values = [
				'semantic-properties' => [],
				'semantic-forms' => [],
			];

			$pageProperties = array_replace_recursive( $default_values, $pageProperties );

			$semanticData = self::getSemanticData( $this->title, $pageProperties );

			if ( is_array( $pageProperties['semantic-forms'] ) ) {
				$setForms = $pageProperties['semantic-forms'];
			}

		} else {
			$semanticData = [];
		}

		$formVal = $request->getVal( 'form' );

		if ( $formVal ) {
			// '|' is forbidden in titles, so we use it as a separator
			$forms_ = array_reverse( explode( '|', $formVal ) );
			foreach ( $forms_ as $title_text_ ) {
				$title_ = Title::makeTitleSafe( NS_PAGEPROPERTIESFORM, $title_text_ );
				if ( $title_ && $title_->isKnown() ) {
					array_unshift( $setForms, $title_->getText() );
				}
			}
		}

		$forms = $this->getForms();
		foreach ( $setForms as $key => $value ) {
			if ( empty( $forms[$value] ) ) {
				unset( $setForms[$key] );
			}
		}

		$setForms = array_unique( $setForms );

		$pageContent = null;
		if ( $this->title && $this->title->isKnown() ) {
			$wikiPage = \PageProperties::getWikiPage( $this->title );
			foreach ( $setForms as $value ) {
				if ( !empty( $forms[$value]['freetext-input'] ) && $forms[$value]['freetext-input'] === "show always" ) {
					$pageContent = $wikiPage->getContent( \MediaWiki\Revision\RevisionRecord::RAW )->getNativeData();
					break;
				}
			}
		}

		$out = $this->getOutput();

		$context = $this->getContext();

		// $context->getOutput()->enableOOUI();

		$out->setPageTitle( $this->msg( 'pageproperties' )->text() );

		$out->addModules( 'ext.PageProperties.EditSemantic' );

		$out->addModuleStyles(
			[
				// 'mediawiki.special',
				'mediawiki.special.preferences.styles.ooui',
			]
		);

		$out->addModuleStyles( 'oojs-ui-widgets.styles' );

		// @todo load only data related to set properties, forms and categories
		// load all data through the Javascript api

		$categories = $this->getCategories();
		$out->addJsConfigVars( [
			'pageproperties-pageContent' => $pageContent,
			'pageproperties-is-newpage' => ( $this->title && !$this->title->isKnown() ),
			'pageproperties-set-forms' => json_encode( $setForms, true ),
			'pageproperties-forms' => json_encode( $forms, true ),
			'pageproperties-managePropertiesSpecialPage' => false,
			'pageproperties-canManageProperties' => $this->canManageProperties,
			'pageproperties-categories' => json_encode( $categories, true ),
			'pageproperties-page-categories' => json_encode( $this->getPageCategories(), true ),
			'pageproperties-semanticProperties' => json_encode( $this->semanticProperties, true ),
			'pageproperties-properties' => json_encode( $semanticData, true ),
			'pageproperties-target-page' => ( $this->title ? $this->title->getText() : null ),
		] );

		$form_descriptor = [];
		$form_descriptor['properties'] = [
			// 'type' => 'info',
			// 'raw' => true,
			// 'default' => '<div id="semantic-properties-wrapper"></div>'

			'section' => 'form-section-properties',
			'type' => 'hidden',
			'append_html' => '<div id="semantic-properties-wrapper"></div>'
		];

		$stickyFooter = false;
		$htmlForm = new \OOUIHTMLFormTabs( $form_descriptor, $context, 'pageproperties', $stickyFooter );

		$url = SpecialPage::getTitleFor( 'EditProperties' )->getLocalURL()
			. ( $this->title ? '/' . wfEscapeWikiText( $title->getPrefixedURL() ) : '' );

		if ( !empty( $formVal ) ) {
			$url = wfAppendQuery( $url, 'form=' . urlencode( $formVal ) );
		}

		$htmlForm->setAction( $url );

		$htmlForm->setId( 'pageproperties-form' );

		// $htmlForm->setSubmitCallback( [ $this, 'onSubmit' ] );

		$htmlForm->prepareForm();

		// $result = $htmlForm->tryAuthorizedSubmit();
		$htmlForm->displayForm( null );
	}

	/**
	 * @return array
	 */
	private function getPageCategories() {
		if ( !$this->title || !$this->title->isKnown() ) {
			return [];
		}
		$ret = [];
		$TitleArray = $this->wikiPage->getCategories();
		foreach ( $TitleArray as $title ) {
			$ret[] = $title->getText();
		}
		return $ret;
	}

	/**
	 * @return array
	 */
	private function getCategories() {
		$dbr = wfGetDB( DB_REPLICA );

		$res = $dbr->select(
			'category',
			[ 'cat_title', 'cat_pages' ],
			null,
			__METHOD__,
			[
				'USE INDEX' => 'cat_title',
			]
		);

		if ( !$res->numRows() ) {
			return [];
		}

		$ret = [];

		$dataValueFactory = SMW\DataValueFactory::getInstance();

		foreach ( $res as $row ) {
			$title_ = Title::newFromText( $row->cat_title, NS_CATEGORY );
			if ( !$title_ || !$title_->isKnown() ) {
				continue;
			}

			// $title = new TitleValue( NS_CATEGORY, $row->cat_title );
			$label = $title_->getText();

			$ret[$label] = [
				'label' => $label,
				'properties' => [],
			];

			$subject = new SMW\DIWikiPage( $title_->getText(), NS_CATEGORY );

			$semanticData = \PageProperties::$SMWStore->getSemanticData( $subject );

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

	/**
	 * @param Title $title
	 * @param array $pageProperties
	 * @return array
	 */
	private function getSemanticData( $title, $pageProperties ) {
		// this could contain properties manually annotated on the page
		$semanticData = \PageProperties::getSemanticData( $title );

		$registeredPageProperties = [];
		foreach ( $pageProperties['semantic-properties'] as $key => $value ) {
			$registeredPageProperties[$key] = ( is_array( $value ) ? $value : [ $value ] );
		}

		// merge with the recorded properties
		$semanticData = array_merge( $semanticData, $registeredPageProperties );

		// remove undeclared properties
		$semanticData = array_intersect_key( $semanticData, $this->semanticProperties );

		return $semanticData;
	}

	/**
	 * @return array
	 */
	private function getForms() {
		$arr = \PageProperties::getPagesWithPrefix( null, NS_PAGEPROPERTIESFORM );
		$ret = [];

		$langCode = RequestContext::getMain()->getLanguage()->getCode();
		$prop = new SMW\DIProperty( '_PDESC' );
		$dataValueFactory = SMW\DataValueFactory::getInstance();

		foreach ( $arr as $title ) {
			$wikiPage = \PageProperties::getWikiPage( $title );
			$text = $wikiPage->getContent( \MediaWiki\Revision\RevisionRecord::RAW )->getNativeData();
			if ( !empty( $text ) ) {
				$obj = json_decode( $text, true );
				$obj['fields'] = array_intersect_key( $obj['fields'], $this->semanticProperties );

				foreach ( $obj['fields'] as $label => $field ) {
					$helpMessages = [];
					if ( !empty( $field['help-message'] ) ) {
						$helpMessages = $field['help-message'];
						if ( !is_array( $helpMessages ) ) {
							$helpMessages = [ $helpMessages ];
						}
						$dataValues = [];
						foreach ( $helpMessages as $value_ ) {
							$dataValues[] = $dataValueFactory->newDataValueByProperty( $prop, $value_ );
						}
						$obj['fields'][ $label ][ 'help-message-result' ] = \PageProperties::getMonolingualText( $langCode, $dataValues );
					}
				}

				$ret[$title->getText()] = $obj;
			}
		}
		return $ret;
	}

	/**
	 * @see includes/specialpage/FormSpecialPage.php
	 * @param array $data
	 * @return bool
	 */
	public function onSubmit( $data ) {
		$arr = [ '__freetext' => null, '__title' => null, '__pagename-formula' => null ];
		foreach ( $arr as $key => $value ) {
			$arr[$key] = ( array_key_exists( $key, $data ) && count( $data[$key] ) ? $data[$key][0] : null );
		}

		// *** when null the main slot will not be handled
		// $freetext

		list( $freetext, $targetTitle, $pagenameFormula ) = array_values( $arr );

		$forms = ( $data['__setforms'] ?? [] );
		$categories = ( $data['__pagecategories'] ?? [] );

		$pageProperties = [];
		if ( $this->title ) {
			$pageProperties = \PageProperties::getPageProperties( $this->title );

			if ( $pageProperties === false ) {
				$pageProperties = [];
			}
		}

		$default_values = [
			'page-properties' => [],
			'semantic-properties' => [],
			'semantic-forms' => [],
		];

		$pageProperties = array_merge( $default_values, $pageProperties );

		unset( $data['__pagename-formula'], $data['__setforms'], $data['__freetext'], $data['__title'], $data['__pagecategories'] );

		$pageProperties['semantic-properties'] = $data;
		$pageProperties['semantic-forms'] = $forms;
		$pageProperties['page-properties']['categories'] = $categories;

		$title = ( $this->title ?? Title::newFromText( $targetTitle, NS_MAIN ) );

		if ( !$title && !empty( $pagenameFormula ) ) {
			preg_match_all( '/<\s*([^<>]+)\s*>/', $pagenameFormula, $pagenameMatches, PREG_PATTERN_ORDER );

			foreach ( $data as $property => $values ) {
				if ( in_array( $property, $pagenameMatches[1] ) ) {
					$pagenameFormula = preg_replace( '/\<\s*' . $property . '\s*\>/', \PageProperties::array_last( $values ), $pagenameFormula );
				}
			}

			$output = $this->getOutput();
			// *** or use trim(strip_tags())
			$pagenameFormula = Parser::stripOuterParagraph( $output->parseAsContent( $pagenameFormula ) );

			$title = Title::newFromText( $pagenameFormula );
		}

		// error
		if ( !$title ) {
			return false;
		}

		$update_obj = $pageProperties;

		// $canWrite = \PageProperties::checkWritePermissions( $this->user, $title );

		\PageProperties::setPageProperties( $this->user, $title, $update_obj, $freetext );

		header( 'Location: ' . $title->getFullURL() );

		return true;
	}

}
