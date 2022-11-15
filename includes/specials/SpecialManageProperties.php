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

class SpecialManageProperties extends FormSpecialPage {
	protected $canEditProperties;
	protected $canManageProperties;

	/** @inheritDoc */
	public function __construct() {
		$listed = defined( 'SMW_VERSION' );

		// https://www.mediawiki.org/wiki/Manual:Special_pages
		parent::__construct( 'ManageProperties', '', $listed );
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

		// $this->setParameter( $par );
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

		if ( !defined( 'SMW_VERSION' ) ) {
			$this->displayRestrictionError();
			return;
		}

		$this->addHelpLink( 'Extension:PageProperties' );

		$this->canEditProperties = $user->isAllowed( 'pageproperties-caneditproperties' );
		$this->canManageProperties = $user->isAllowed( 'pageproperties-canmanageproperties' );

		if ( !$this->canEditProperties && !$this->canManageProperties ) {
			$this->displayRestrictionError();
			return;
		}

		$this->outputHeader();

		$out = $this->getOutput();

		$context = $this->getContext();

		$context->getOutput()->enableOOUI();

		$out->setPageTitle( $this->msg( 'manageproperties' )->text() );
		$this->getFormValues();

		$out->addModules( 'ext.PageProperties' );

		$out->addModuleStyles(
			[
				// 'mediawiki.special',
				'mediawiki.special.preferences.styles.ooui',
			]
		);

		$out->addModuleStyles( 'oojs-ui-widgets.styles' );

		// if ( defined( 'SMW_VERSION' ) ) {
			$out->addModules( 'ext.PageProperties.Semantic' );
			$this->getFormValuesSMW( $par, $out );
		// }

		$form_descriptor = $this->formDescriptor();

		$htmlForm = new \OOUIHTMLFormTabs( $form_descriptor, $context, 'pageproperties' );

		$htmlForm->suppressDefaultSubmit();

		$htmlForm->setId( 'pageproperties-form' );

		$htmlForm->setSubmitCallback( [ $this, 'onSubmit' ] );

		// @see includes/htmlform/HTMLForm.php
		if ( $htmlForm->showAlways() ) {
			$this->onSuccess();
		}
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
					// echo $dataValue->getImportReference();
					$ret[$label]['properties']['_IMPO'][] = $dataValue->getWikiValue();
				}
			}
		}

		return $ret;
	}

	/**
	 * @param string $par
	 * @param OutputPage $out
	 * @return void
	 */
	private function getFormValuesSMW( $par, $out ) {
		$semanticProperties = \PageProperties::getSemanticProperties();
		$pageProperties = [];
		$categories = $this->getCategories();

		$out->addJsConfigVars( [
			'pageproperties-selectedPage' => $par,
			'pageproperties-managePropertiesSpecialPage' => true,
			'pageproperties-canManageProperties' => $this->canManageProperties,
			'pageproperties-categories' => json_encode( $categories, true ),
			'pageproperties-semanticProperties' => json_encode( $semanticProperties, true ),
			'pageproperties-properties' => json_encode( $pageProperties, true ),

			// @see UploadWizard -> UploadWizard.config.php
			'maxPhpUploadSize' => UploadBase::getMaxPhpUploadSize(),
			'maxMwUploadSize' => UploadBase::getMaxUploadSize( 'file' ),
			// 'wgMaxArticleSize' => $GLOBALS['wgMaxArticleSize'],
		] );
	}

	/**
	 * @return array
	 */
	private function formDescriptor() {
		$formDescriptor = [];

		$formDescriptor['properties'] = [
			'section' => 'form-section-properties',
			'type' => 'hidden',
			'append_html' => '<div id="semantic-properties-wrapper"></div>'
		];

		$formDescriptor['categories'] = [
			'section' => 'form-section-categories',
			'type' => 'hidden',
			'append_html' => '<div id="categories-wrapper"></div>'
		];

		// $formDescriptor['forms'] = [
		// 	'section' => 'form-section-forms',
		// 	'type' => 'hidden',
		// 	'append_html' => '<div id="forms-wrapper"></div>'
		// ];

		$formDescriptor['import'] = [
			'section' => 'form-section-import',
			'type' => 'hidden',
			'append_html' => '<div id="import-wrapper"></div>'
		];

		return $formDescriptor;
	}

	/**
	 * @see includes/specialpage/FormSpecialPage.php
	 * @param array $data
	 * @return bool
	 */
	public function onSubmit( $data ) {
		return true;
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
