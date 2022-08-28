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
		$current_user = User::newFromId( $this->params['user_id'] );
/*
		$permissionManager = MediaWikiServices::getInstance()->getPermissionManager();
		if ( !$permissionManager->userCan(
			'replacetext', $current_user, $this->title
		) ) {
			$this->error = 'replacetext: permission no longer valid';
			// T279090#6978214
			return true;
		}
*/
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
		$isAuthorized = \PageProperties::isAuthorized( $current_user, $title, 'Admins' );

		if ( !$isAuthorized ) {
			$this->error = 'PageProperties: not authorized';
			return false;
		}

		if ( !array_key_exists( 'values', $this->params ) || !array_key_exists( 'new_values', $this->params ) ) {
			$this->error = 'PageProperties: internal error';
			return false;
		}

		$page_properties = \PageProperties::getPageProperties( $title );
		$values = $this->params['values'];
		$new_values = $this->params['new_values'];

		if ( $page_properties === false || empty( $page_properties[ 'semantic_properties' ] ) ) {
			$this->error = 'PageProperties: nothing to update';
			return false;
		}

		foreach ( $page_properties[ 'semantic_properties' ] as $key_ => $value_ ) {
			// $value_[0] is the property label
			if ( array_key_exists( $value_[0], $values ) ) {
				$action = $values[ $value_[0] ];
				switch ( $action ) {
					case 'rename':
						$page_properties[ 'semantic_properties' ][ $key_ ][0] = $new_values[ $value_[0] ];
						break;
					case 'delete':
						unset( $page_properties[ 'semantic_properties' ][ $key_ ] );
						break;
				}
			}
		}
		\PageProperties::setPageProperties( $current_user, $title, $page_properties );

		return true;
	}
}
