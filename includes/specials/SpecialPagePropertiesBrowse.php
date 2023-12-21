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

/**
 * A special page that lists protected pages
 *
 * @ingroup SpecialPage
 */
class SpecialPagePropertiesBrowse extends SpecialPage {

	/** @var user */
	public $user;

	/** @var request */
	public $request;

	/** @var par */
	public $par;

	/** @var databaseManager */
	public $databaseManager;

	/**
	 * @inheritDoc
	 */
	public function __construct() {
		$listed = false;
		parent::__construct( 'PagePropertiesBrowse', '', $listed );
	}

	/**
	 * @return string
	 */
	public function getDescription() {
		// if ( empty( $this->par ) ) {
		// 	return $this->msg( strtolower( $this->mName ) )->text();
		// }
		return $this->msg( 'pagepropertiesbrowse' . strtolower( $this->par ) )->text();
	}

	/**
	 * @inheritDoc
	 */
	public function execute( $par ) {
		// $this->requireLogin();

		if ( empty( $par ) ) {
			$par = 'Data';
		}

		$allowedItems = [ 'Data', 'Forms', 'Queries', 'Schemas' ];

		if ( !in_array( $par, $allowedItems ) ) {
			$this->displayRestrictionError();
			return;
		}

		$this->par = $par;

		$this->setHeaders();
		$this->outputHeader();

		$user = $this->getUser();

		if ( !$user->isAllowed( 'pageproperties-canmanageschemas' )
			&& !$user->isAllowed( 'pageproperties-caneditschema' ) ) {
			$this->displayRestrictionError();
			return;
		}

		$out = $this->getOutput();

		$out->addModuleStyles( 'mediawiki.special' );

		// $out->addModules( [ 'ext.PagePropertiesBrowse' ] );

		$this->addHelpLink( 'Extension:PageProperties' );

		$request = $this->getRequest();

		$this->request = $request;

		$this->user = $user;

		$this->databaseManager = new DatabaseManager();

		$this->addJsConfigVars( $out );

		$class = null;
		switch ( $this->par ) {
			case 'Forms':
				$class = 'FormsPager';
				break;
			case 'Schemas':
				$class = 'SchemasPager';
				break;
			case 'Queries':
				$class = 'QueriesPager';
				break;
			case 'Data':
				$class = 'DataPager';
				break;
		}
		$class = "MediaWiki\\Extension\\PageProperties\\Pagers\\$class";
		$pager = new $class(
			$this,
			$request,
			$this->getLinkRenderer()
		);

		$out->enableOOUI();

		$this->addNavigationLinks( $par );

		$out->addWikiMsg( 'pageproperties-special-browse-' . strtolower( $this->par ) . '-description' );

		$options = $this->showOptions( $request );

		if ( $options ) {
			$out->addHTML( '<br />' );
			$out->addHTML( $options );
			$out->addHTML( '<br />' );
		}

		if ( $pager->getNumRows() ) {
			// $out->addParserOutputContent( $pager->getFullOutput() );
			$out->addHTML(
				$pager->getBody() .
				$pager->getNavigationBar()
			);

		} else {
			$out->addWikiMsg( 'pageproperties-special-browse-table-empty' );
		}
	}

	/**
	 * @param Output $out
	 */
	protected function addJsConfigVars( $out ) {
		$context = $this->getContext();

		$out->addJsConfigVars( [
		] );
	}

	/**
	 * @see AbuseFilterSpecialPage
	 * @param string $pageType
	 */
	protected function addNavigationLinks( $pageType ) {
		$linkDefs = [
			'data' => 'PagePropertiesBrowse/Data',
			'forms' => 'PagePropertiesBrowse/Forms',
			'queries' => 'PagePropertiesBrowse/Queries',
			'schemas' => 'PagePropertiesBrowse/Schemas',
		];

		$links = [];

		foreach ( $linkDefs as $name => $page ) {
			// Give grep a chance to find the usages:
			// abusefilter-topnav-home, abusefilter-topnav-recentchanges, abusefilter-topnav-test,
			// abusefilter-topnav-log, abusefilter-topnav-tools, abusefilter-topnav-examine
			$msgName = "pagepropertiesbrowse$name";

			$msg = $this->msg( $msgName )->parse();

			if ( $name === $pageType ) {
				$links[] = Xml::tags( 'strong', null, $msg );
			} else {
				$links[] = $this->getLinkRenderer()->makeLink(
					new TitleValue( NS_SPECIAL, $page ),
					new HtmlArmor( $msg )
				);
			}
		}

		$linkStr = $this->msg( 'parentheses' )
			->rawParams( $this->getLanguage()->pipeList( $links ) )
			->text();
		$linkStr = $this->msg( 'pagepropertiesbrowsedata-topnav' )->parse() . " $linkStr";

		$linkStr = Xml::tags( 'div', [ 'class' => 'mw-pageproperties-browsedata-navigation' ], $linkStr );

		$this->getOutput()->setSubtitle( $linkStr );
	}

	/**
	 * @param Request $request
	 * @return string
	 */
	protected function showOptions( $request ) {
		$formDescriptor = [];

		$dbr = wfGetDB( DB_REPLICA );

		switch ( $this->par ) {
			case 'Schemas':
				return;
			case 'Forms':
			case 'Queries':
			case 'Data':
			default:
				$schemaname = $request->getVal( 'schemaname' );
				$formDescriptor['schema'] = [
					'label-message' => 'pageproperties-special-browse-form-search-schema-label',
					'type' => 'select',
					'name' => 'schemaname',
					'type' => 'title',
					'namespace' => NS_PAGEPROPERTIESSCHEMA,
					'relative' => true,
					'required' => false,
					'help-message' => 'pageproperties-special-browse-form-search-schema-help',
					'default' => $schemaname ?? null,
				];

		}

		$htmlForm = HTMLForm::factory( 'ooui', $formDescriptor, $this->getContext() );

		$htmlForm
			->setMethod( 'get' )
			->setWrapperLegendMsg( 'pageproperties-special-browse-form-search-legend' )
			->setSubmitText( $this->msg( 'pageproperties-special-browse-form-search-submit' )->text() );

		return $htmlForm->prepareForm()->getHTML( false );
	}

	/**
	 * @return string
	 */
	protected function getGroupName() {
		return 'pageproperties';
	}
}
