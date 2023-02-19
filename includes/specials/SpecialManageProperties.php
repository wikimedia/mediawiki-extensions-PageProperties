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
 * @copyright Copyright ©2021-2022, https://wikisphere.org
 */

include_once __DIR__ . '/OOUIHTMLFormTabs.php';

class SpecialManageProperties extends FormSpecialPage {

	protected $user;
	protected $semanticProperties;

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

		if ( !defined( 'SMW_VERSION' ) ) {
			$this->displayRestrictionError();
			return;
		}

		$this->addHelpLink( 'Extension:PageProperties' );

		$canManageSemanticProperties = $user->isAllowed( 'pageproperties-canmanagesemanticproperties' );

		if ( !$canManageSemanticProperties ) {
			$this->displayRestrictionError();
			return;
		}

		$this->outputHeader();

		$context = $this->getContext();

		$context->getOutput()->enableOOUI();

		$out->setPageTitle( $this->msg( 'manageproperties' )->text() );

		$out->addModules( 'ext.PageProperties.ManageProperties' );

		$out->addModuleStyles( [ 'mediawiki.special.preferences.styles.ooui' ] );

		$allSemanticProperties = \PageProperties::getAllProperties();
		$this->semanticProperties = \PageProperties::formatSemanticProperties( $allSemanticProperties );

		\PageProperties::addJsConfigVars( $out, [
			'semanticProperties' => $this->semanticProperties,
			'categories' => \PageProperties::getCategoriesSemantic(),
			'forms' => \PageProperties::getAllForms( $this->semanticProperties ),
			'config' => [
				'context' => 'ManageProperties',
				'loadedData' => [ 'semantic-properties', 'forms', 'categories' ],
				// @see UploadWizard -> UploadWizard.config.php
				'maxPhpUploadSize' => UploadBase::getMaxPhpUploadSize(),
				'maxMwUploadSize' => UploadBase::getMaxUploadSize( 'file' ),
				// 'wgMaxArticleSize' => $GLOBALS['wgMaxArticleSize'],
			]
		] );

		// @TODO use a Javascript-only solution
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

		$formDescriptor['forms'] = [
			'section' => 'form-section-forms',
			'type' => 'hidden',
			'append_html' => '<div id="forms-wrapper"></div>'
		];

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
