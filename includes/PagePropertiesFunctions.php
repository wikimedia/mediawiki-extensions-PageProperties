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
 * @copyright Copyright ©2021, https://wikisphere.org
 */


use MediaWiki\MediaWikiServices;

class PagePropertiesFunctions {


	/**
	 * @var UserGroupManager
	 */
	private static $userGroupManager;


	public function __constructStatic()
	{
		self::$userGroupManager = MediaWikiServices::getInstance()->getUserGroupManager();
	}


	/**
	 * @return array
	 */
	public static function getUserGroups( $user, $replace_asterisk = false ) {

		$user_groups = self::$userGroupManager->getUserEffectiveGroups( $user );
		$user_groups[] = $user->getName();

		if ( array_search( '*', $user_groups ) === false ) {
			$user_groups[] = '*';
		}

		if ( $replace_asterisk ) {
			$key = array_search( '*', $user_groups );
			$user_groups[ $key ] = 'all';
		}

		return $user_groups;

	}



	public static function isAuthorized( $user, $title )
	{
		global $wgPagePropertiesAuthorizedEditors;

		$allowed_groups = [ 'sysop' ];
		
		if ( is_array( $wgPagePropertiesAuthorizedEditors ) ) {
			$allowed_groups = array_unique (array_merge ( $allowed_groups, $wgPagePropertiesAuthorizedEditors) );
		}

		$user_groups = self::getUserGroups( $user );

		$isAuthorized = sizeof( array_intersect( $allowed_groups, $user_groups ) );

		if ( !$isAuthorized && $title && class_exists( 'PageOwnership' )) {

			list( $role, $permissions ) = \PageOwnership::permissionsOfPage( $title, $user );
			
			if ( ( $role == 'editor' || $role == 'admin') && in_array( 'manage properties', $permissions ) ) {
				return true;
			}

		}

		return $isAuthorized;

	}


	public static function page_ancestors( $title, $exclude_current = true )
	{
		$output = [];
		
		$title_parts = explode( '/', $title->getText() );

		if ( $exclude_current ) {
			array_pop( $title_parts );
		}

		$path = [];

		foreach ( $title_parts as $value ) {
			$path[] = $value;
			$title_text = implode( '/', $path );

			if ( $title->getText() == $title_text ) {
				$output[] = $title;

			} else {
				$title_ = Title::newFromText( $title_text );
				if ($title_->isKnown() ) {
					$output[] = $title_;
				}
			
			}
				
		}

		return $output;
	}


	public static function array_last( $array )
	{
		return ( sizeof( $array ) ? $array[ array_key_last( $array ) ] : null );
	}


}

PagePropertiesFunctions::__constructStatic();


