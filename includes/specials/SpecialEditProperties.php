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
	protected $setForms;
	protected $forms;

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

	/**
	 * @return string
	 */
	public function getDescription() {
		// $this->msg( 'pageproperties' )->text()
		return ( $this->title ? ( !$this->title->isKnown() ? $this->msg( "pageproperties-editsemantic-creating" )->text() : $this->msg( "pageproperties-editsemantic-editing" )->text() )
			. ' ' . $this->title . ' ' . $this->msg( "pageproperties-editsemantic-semantic" )->text() : $this->msg( "pageproperties-editsemantic-newpageforms", implode( ', ', $this->setForms ) )->text() );
	}

	/** @inheritDoc */
	public function execute( $par ) {
		// $this->requireLogin();
		// $this->setHeaders();

		$out = $this->getOutput();
		$out->setArticleRelated( false );
		$out->setRobotPolicy( $this->getRobotPolicy() );

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

		$this->semanticProperties = \PageProperties::getSemanticProperties();
		$this->forms = $this->getForms();

		$ret = null;
		$errors = [];
		if ( $request->wasPosted() ) {
			$ret = $this->onFormSubmit( $this->parseFormData(), $errors );

			// redirecting to relevant page
			if ( $ret === true ) {
				return;
			}
		}

		$setforms = [];
		$this->getAndSetData( $out, $ret, $errors, $setforms );

		$out->setPageTitle( $this->getDescription() );

		$context = $this->getContext();

		// $context->getOutput()->enableOOUI();

		$out->addModules( 'ext.PageProperties.EditSemantic' );

		$out->addModuleStyles(
			[
				// 'mediawiki.special',
				'mediawiki.special.preferences.styles.ooui',
			]
		);

		$out->addModuleStyles( 'oojs-ui-widgets.styles' );

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
			. ( $this->title ? '/' . wfEscapeWikiText( $this->title->getPrefixedURL() ) : '' );

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
	 * @param Output $out
	 * @param array $ret
	 * @param array $errors
	 * @return array
	 */
	private function getAndSetData( $out, $ret, $errors ) {
		if ( $ret ) {
			list( $update_obj, $freetext ) = $ret;

			$setForms = $update_obj['semantic-forms'];
			$semanticData = $update_obj['semantic-properties'];
			$pageContent = $freetext;

			$pageCategories = ( !empty( $update_obj['page-properties']['cateogories'] ) ? $update_obj['page-properties']['cateogories'] : [] );

		} else {
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

			$formVal = $this->getRequest()->getVal( 'form' );

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

			foreach ( $setForms as $key => $value ) {
				if ( empty( $this->forms[$value] ) ) {
					unset( $setForms[$key] );
				}
			}

			$setForms = array_unique( $setForms );

			$pageContent = null;
			if ( $this->title && $this->title->isKnown() ) {
				$wikiPage = \PageProperties::getWikiPage( $this->title );
				foreach ( $setForms as $value ) {
					if ( !empty( $this->forms[$value]['freetext-input'] ) && $this->forms[$value]['freetext-input'] === "show always" ) {
						$pageContent = $wikiPage->getContent( \MediaWiki\Revision\RevisionRecord::RAW )->getNativeData();
						break;
					}
				}
			}

			$pageCategories = $this->getPageCategories();
		}

		// @todo load only data related to set properties, forms and categories
		// load all data through the Javascript api

		$this->setForms = $setForms;

		$categories = $this->getCategories();
		$out->addJsConfigVars( [
			'pageproperties-errors' => json_encode( $errors, true ),
			'pageproperties-pageContent' => $pageContent,
			'pageproperties-is-newpage' => ( $this->title && !$this->title->isKnown() ),
			'pageproperties-set-forms' => json_encode( $setForms, true ),
			'pageproperties-forms' => json_encode( $this->forms, true ),
			'pageproperties-managePropertiesSpecialPage' => false,
			'pageproperties-canManageProperties' => $this->canManageProperties,
			'pageproperties-categories' => json_encode( $categories, true ),
			'pageproperties-page-categories' => json_encode( $pageCategories, true ),
			'pageproperties-semanticProperties' => json_encode( $this->semanticProperties, true ),
			'pageproperties-properties' => json_encode( $semanticData, true ),
			'pageproperties-target-page' => ( $this->title ? $this->title->getText() : null ),
		] );
	}

	/**
	 * @return array
	 */
	private function parseFormData() {
		$ret = [];
		// e.g. semantic-properties-input-Carbon_copy-0
		foreach ( $_POST as $key => $value ) {
			if ( strpos( $key, 'semantic-properties-input-' ) === 0 ) {
				preg_match( '/^semantic\-properties\-input\-(.+?)\-\d+$/', $key, $match );

				// replace underscore with space
				// https://www.php.net/manual/en/language.variables.external.php
				$ret[ urldecode( $match[1] ) ][] = $value;
			}
		}
		return $ret;
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

	/** @inheritDoc */
	public function onSubmit( $data ) {
	}

	/**
	 * @param array $data
	 * @param array $formula
	 * @return string
	 */
	private function replaceFormula( $data, $formula ) {
		preg_match_all( '/<\s*([^<>]+)\s*>/', $formula, $pagenameMatches, PREG_PATTERN_ORDER );

		foreach ( $data as $property => $values ) {
			if ( in_array( $property, $pagenameMatches[1] ) ) {
				$formula = preg_replace( '/\<\s*' . $property . '\s*\>/', \PageProperties::array_last( $values ), $formula );
			}
		}

		return $formula;
	}

	/**
	 * @see includes/specialpage/FormSpecialPage.php
	 * @param array $data
	 * @param array &$errors
	 * @return true|array
	 */
	public function onFormSubmit( $data, &$errors ) {
		$arr = [ '__freetext' => null, '__title' => null, '__pagename-formula' => null ];

		foreach ( $arr as $key => $value ) {
			$arr[$key] = ( array_key_exists( $key, $data ) && count( $data[$key] ) ? $data[$key][0] : null );
		}

		// *** when $freetext is null the main slot will not be handled
		list( $freetext, $targetTitle, $pagenameFormula ) = array_values( $arr );

		$setForms = ( $data['__setforms'] ?? [] );
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

		$valueFormulas = [];
		$createOnly = [];
		foreach ( $setForms as $value ) {
			foreach ( $this->forms[$value]['fields'] as $label => $field ) {

				if ( !empty( $field['value-formula'] ) ) {
					$valueFormulas[$label][] = $field['value-formula'];
				}

				if ( array_key_exists( 'on-create-only', $field ) && (bool)$field['on-create-only'] === true ) {
					$createOnly[] = $label;
				}
			}
		}

		$output = $this->getOutput();

		foreach ( $valueFormulas as $label => $values ) {
			foreach ( $data[$label] as $key => $field ) {
				foreach ( $values as $formula ) {
					$data[$label][$key] = $this->replaceFormula( $data, $formula );
				}
				// *** or use trim(strip_tags())
				$data[$label][$key] = Parser::stripOuterParagraph( $output->parseAsContent( $data[$label][$key] ) );
			}
		}

		$pageProperties['semantic-properties'] = $data;
		$pageProperties['semantic-forms'] = $setForms;
		$pageProperties['page-properties']['categories'] = $categories;

		$update_obj = $pageProperties;

		$title = ( $this->title ?? Title::newFromText( $targetTitle, NS_MAIN ) );

		if ( !$title && !empty( $pagenameFormula ) ) {
			$pagenameFormula = $this->replaceFormula( $data, $pagenameFormula );

			// *** or use trim(strip_tags())
			$pagenameFormula = Parser::stripOuterParagraph( $output->parseAsContent( $pagenameFormula ) );

			$title = Title::newFromText( $pagenameFormula );

			foreach ( $createOnly as $field ) {
				unset( $update_obj['semantic-properties'][$field] );
			}
		}

		if ( !$title ) {
			$errors[] = $this->msg( "pageproperties-editsemantic-titlenotset" )->text();
			return $pageProperties;
		}

		$ret = \PageProperties::setPageProperties( $this->user, $title, $update_obj, $errors, $freetext );

		if ( $ret ) {
			header( 'Location: ' . $title->getFullURL() );
			return true;
		}

		$errors[] = $this->msg( "pageproperties-editsemantic-contentsnotsaved" )->text();
		return [ $pageProperties, $freetext ];
	}

}
