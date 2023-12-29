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
 * @copyright Copyright © 2023, https://wikisphere.org
 */

( function () {
	// eslint-disable-next-line no-implicit-globals
	PagePropertiesLookupElement = function ( config ) {
		// Parent constructor
		OO.ui.TextInputWidget.call( this, config );
		// Mixin constructors
		OO.ui.mixin.LookupElement.call( this, config );
	};

	OO.inheritClass( PagePropertiesLookupElement, OO.ui.TextInputWidget );
	OO.mixinClass( PagePropertiesLookupElement, OO.ui.mixin.LookupElement );

	PagePropertiesLookupElement.prototype.getLookupRequest = function () {
		// @IMPORTANT, do not cache
		// mainly for the use of dependent inputs
		this.requestCache = {};

		var value = this.getValue(),
			deferred = $.Deferred();
		this.data.performQuery( this.data, value ).then( ( data ) => {
			deferred.resolve( data );
		} );

		return deferred.promise( { abort: function () {} } );
	};

	PagePropertiesLookupElement.prototype.getLookupCacheDataFromResponse =
		function ( response ) {
			return response || [];
		};

	PagePropertiesLookupElement.prototype.getLookupMenuOptionsFromData =
		function ( data ) {
			var items = [];
			for ( var i in data ) {
				items.push(
					new OO.ui.MenuOptionWidget( {
						data: i,
						label: data[ i ]
					} )
				);
			}
			return items;
		};
}() );
