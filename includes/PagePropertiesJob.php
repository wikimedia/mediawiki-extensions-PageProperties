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
 * @copyright Copyright ©2022, https://wikisphere.org
 */

use Wikimedia\ScopedCallback;

class PagePropertiesJob extends Job {
	/**
	 * Constructor.
	 * @param Title $title
	 * @param array|bool $params Cannot be === true
	 */
	function __construct( $title, $params = [] ) {
		parent::__construct( 'PageProperties', $title, $params );
	}

	/**
	 * Run a replaceText job
	 * @return bool success
	 */
	function run() {
		// T279090
		$user = User::newFromId( $this->params['user_id'] );

		if ( !$user->isAllowed( 'pageproperties-caneditproperties' ) && !$user->isAllowed( 'pageproperties-canmanageproperties' ) ) {
			$this->dieWithError( 'apierror-pageproperties-permissions-error' );
		}

		if ( isset( $this->params['session'] ) ) {
			$callback = RequestContext::importScopedSession( $this->params['session'] );
			$this->addTeardownCallback( static function () use ( &$callback ) {
				ScopedCallback::consume( $callback );
			} );
		}

		if ( $this->title === null ) {
			$this->error = "PageProperties: Invalid title";
			return false;
		}

		$title = $this->title;

		if ( !array_key_exists( 'values', $this->params ) ) {
			$this->error = 'PageProperties: internal error';
			return false;
		}

		$page_properties = \PageProperties::getPageProperties( $title );
		$values = $this->params['values'];

		if ( $page_properties === false || empty( $page_properties[ 'semantic-properties' ] ) ) {
			$this->error = 'PageProperties: nothing to update';
			return false;
		}

		foreach ( $values as $label => $newLabel ) {
			// not found
			if ( !array_key_exists( $label, $page_properties[ 'semantic-properties' ] ) ) {
				continue;
			}

			if ( !empty( $newLabel ) ) {
				$page_properties[ 'semantic-properties' ][$newLabel] = $page_properties[ 'semantic-properties' ][ $label ];
			}

			unset( $page_properties[ 'semantic-properties' ][ $label ] );
		}

		\PageProperties::setPageProperties( $user, $title, $page_properties );

		return true;
	}
}
