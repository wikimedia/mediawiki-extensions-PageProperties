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
 * along with PageProperties. If not, see <http://www.gnu.org/licenses/>.
 *
 * @file
 * @author thomas-topway-it <support@topway.it>
 * @copyright Copyright © 2021-2023, https://wikisphere.org
 */

/* eslint-disable no-tabs */
/* eslint-disable no-unused-vars */

const PagePropertiesFunctions = ( function () {

	// ***remove annoying &nbsp; on OOUI / Mediawiki 1.39 (~v0.44.3)
	// see vendor/oojs/oojs-ui/php/layouts/FieldsetLayout.php
	function removeNbspFromLayoutHeader( selector ) {
		$( selector + ' .oo-ui-fieldLayout-header' ).each( function () {
			var html = $( this ).html();
			if ( /<label [^>]+>&nbsp;<\/label>/.test( html ) ) {
				$( this ).html( '' );
			}
			if ( /<label [^>]+><\/label>/.test( html ) ) {
				$( this ).find( 'label' ).css( 'display', 'inline' );
			}
		} );
	}

	return {
		removeNbspFromLayoutHeader
	};
}() );
