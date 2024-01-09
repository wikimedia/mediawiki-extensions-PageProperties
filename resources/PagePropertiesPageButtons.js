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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with PageProperties. If not, see <http://www.gnu.org/licenses/>.
 *
 * @file
 * @author thomas-topway-it <support@topway.it>
 * @copyright Copyright © 2021-2024, https://wikisphere.org
 */

/* eslint-disable no-tabs */
/* eslint-disable no-unused-vars */
/* eslint-disable no-underscore-dangle */

const PagePropertiesPageButtons = function ( buttonID, pageButton ) {

	function initialize( pageProperties ) {
		var button = new OO.ui.ButtonWidget( {
			icon: pageButton.icon,
			flags: [ 'primary', 'progressive' ],
			label: pageButton.label
		} );

		button.on( 'click', function () {
			PagePropertiesFunctions.executeFunctionByName( pageButton.callback, window, [ pageButton.value, pageButton.data ] );
		} );

		$( '#pagepropertiesbutton-wrapper-' + buttonID ).html( button.$element );
	}

	return {
		initialize
	};
};

$( function () {
	var pageButtons = JSON.parse( mw.config.get( 'pageproperties-pageButtons' ) );
	// console.log("pageButtons", pageButtons);

	for ( var buttonID in pageButtons ) {
		var button = pageButtons[ buttonID ];

		button = $.extend(
			{
				label: '',
				callback: '',
				value: '',
				data: {}
			},
			button
		);

		var instance = new PagePropertiesPageButtons( buttonID, button );
		instance.initialize();
	}
} );
