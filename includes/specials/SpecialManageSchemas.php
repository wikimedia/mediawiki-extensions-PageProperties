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

include_once __DIR__ . '/OOUIHTMLFormTabs.php';

// @TODO remove implemenation as form

class SpecialManageSchemas extends FormSpecialPage {

	/** @var user */
	protected $user;

	/** @inheritDoc */
	public function __construct() {
		$listed = true;

		// https://www.mediawiki.org/wiki/Manual:Special_pages
		parent::__construct( 'ManageSchemas', '', $listed );
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

		$this->addHelpLink( 'Extension:PageProperties' );

		if ( !$user->isAllowed( 'pageproperties-canmanageschemas' )
			&& !$user->isAllowed( 'pageproperties-canmanagesemanticproperties' ) ) {
			$this->displayRestrictionError();
			return;
		}

		$this->outputHeader();

		$context = $this->getContext();

		$context->getOutput()->enableOOUI();

		$out->setPageTitle( $this->msg( 'manageschemas' )->text() );

		$out->addModules( 'ext.PageProperties.ManageSchemas' );

		$out->addModuleStyles( [ 'mediawiki.special.preferences.styles.ooui' ] );

		\PageProperties::addJsConfigVars( $out, [
			'config' => [
				'context' => 'ManageSchemas',
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

		// @TODO the form is not required, implement client-side OOUI

		$formDescriptor['schemas'] = [
			'section' => 'form-section-schemas',
			'type' => 'hidden',
			'append_html' => '<div id="schemas-wrapper"></div>'
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

	/**
	 * @return string
	 */
	protected function getGroupName() {
		return 'pageproperties';
	}

}
