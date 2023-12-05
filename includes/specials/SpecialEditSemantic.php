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

// @TODO implement as form

class SpecialEditSemantic extends SpecialPage {

	/** @var title */
	protected $title;

	/** @var wikiPage */
	protected $wikiPage;

	/** @var user */
	protected $user;

	/** @inheritDoc */
	public function __construct() {
		$listed = false;

		// https://www.mediawiki.org/wiki/Manual:Special_pages
		parent::__construct( 'EditSemantic', '', $listed );
	}

	/**
	 * @return string
	 */
	public function getDescription() {
		if ( !$this->title || !$this->title->isKnown() ) {
			return $this->msg( "pageproperties-editsemantic-new-article" )->text();
		}

		return $this->msg( "pageproperties-editsemantic-edit", $this->title->getText() )->text();
	}

	/** @inheritDoc */
	public function execute( $par ) {
		$out = $this->getOutput();
		$out->setArticleRelated( false );
		$out->setRobotPolicy( $this->getRobotPolicy() );

		$user = $this->getUser();

		$this->user = $user;

		// This will throw exceptions if there's a problem
		// $this->checkExecutePermissions( $user );

		$securityLevel = $this->getLoginSecurityLevel();

		if ( $securityLevel !== false && !$this->checkLoginSecurityLevel( $securityLevel ) ) {
			$this->displayRestrictionError();
			return;
		}

		$this->addHelpLink( 'Extension:PageProperties' );

		if ( !$user->isAllowed( 'pageproperties-caneditschemas' ) ) {
			$this->displayRestrictionError();
			return;
		}

		if ( $par ) {
			// NS_MAIN is ignored if $par is prefixed
			$title = Title::newFromText( $par, NS_MAIN );
			$this->title = $title;
			$this->wikiPage = \PageProperties::getWikiPage( $this->title );
		}

		$this->setData( $out );

		$out->setPageTitle( $this->getDescription() );

		$out->addModules( 'ext.PageProperties.EditSemantic' );
	}

	/**
	 * @param OutputPage $out
	 * @return array
	 */
	private function setData( $out ) {
		$schemas = [];
		$categories = [];
		$pageProperties = [];

		if ( $this->title && $this->title->isKnown() ) {
			$pageProperties = \PageProperties::getPageProperties( $this->title );

			if ( $pageProperties === false ) {
				$pageProperties = [];
			}

			$categories = \PageProperties::getCategories( $this->title );
		}

		if ( !empty( $pageProperties['schemas'] ) ) {
			$schemas = array_keys( $pageProperties['schemas'] );
		}

		if ( !empty( $_GET['schemas'] ) ) {
			$schemas = array_merge( explode( '|', $_GET['schemas'] ) );
		}

		$schemas = array_unique( $schemas );
		\PageProperties::setSchemas( $out, $schemas, true );

		$this->schemas = $schemas;
		$freetext = null;
		$formID = \PageProperties::formID( $this->title ? $this->title : $out->getTitle(), $schemas, 1 );

		$formData = [
			'freetext' => $freetext,
			'properties' => $pageProperties,
			'categories' => $categories,
			'schemas' => $schemas,
			'errors' => [],
		];

		$options = [
			// success submission
			'return-url' => ( $this->title ? $this->title->getLocalURL() : '' ),

			// edited page
			'edit-page' => ( $this->title ? $this->title->getFullText() : '' ),

			// show errors
			'origin-url' => 'http' . ( isset( $_SERVER['HTTPS'] ) && $_SERVER['HTTPS'] === 'on' ? 's' : '' ) . "://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]"
		];

		$pageForms = [
			$formID => [
				'options' => $options,
				'data' => $formData,
			]
		];

		\PageProperties::addJsConfigVars( $out, [
			'pageForms' => $pageForms,
			'config' => [
				'context' => 'EditSemantic',
				'loadedData' => [],
			]
		] );

		// @see SpecialRecentChanges
		$loadingContainer = Html::rawElement(
			'div',
			[ 'class' => 'rcfilters-head mw-rcfilters-head', 'id' => 'mw-rcfilters-spinner-wrapper', 'style' => 'position: relative' ],
			Html::rawElement(
				'div',
				[ 'class' => 'mw-rcfilters-spinner', 'style' => 'margin-top: auto; top: 25%' ],
				Html::element(
					'div',
					[ 'class' => 'mw-rcfilters-spinner-bounce' ]
				)
			)
		);

		$out->addHTML( Html::rawElement( 'div', [
				'id' => 'pagepropertiesform-wrapper-' . $formID,
				'class' => 'PagePropertiesFormWrapper'
			], $loadingContainer )
		);
	}

}
