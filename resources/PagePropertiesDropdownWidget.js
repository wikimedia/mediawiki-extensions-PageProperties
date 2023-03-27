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
 * @author thomas-topway-it <business@topway.it>
 * @copyright Copyright © 2021-2022, https://wikisphere.org
 */

( function () {
	// eslint-disable-next-line no-implicit-globals
	PagePropertiesDropdownWidget = function ( config ) {
		config = config || {};

		if ( !( 'classes' in config ) ) {
			config.classes = [];
		}
		var self = this;

		config.classes.push( 'pageproperties-dropdown-widget' );

		PagePropertiesDropdownWidget.super.call( this, config );

		var options = config.options;

		var select = $( '<select>' ).attr( 'class', 'oo-ui-indicator-down' );
		for ( var option of options ) {
			select.append(
				$( '<option>' )
					.attr( { value: option.data, selected: option.data === config.value } )
					.text( option.label )
			);
		}

		this.select = select;

		select.on( 'change', function () {
			self.emit( ' change', self.getValue() );
		} );

		var div = $( '<div>' )
			.attr(
				'class',
				'oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-dropdownInputWidget'
			)

			.append( select );

		this.$element.append( div );
	};

	OO.inheritClass( PagePropertiesDropdownWidget, OO.ui.Widget );
	OO.mixinClass( PagePropertiesDropdownWidget, OO.EventEmitter );

	PagePropertiesDropdownWidget.prototype.getValue = function () {
		return this.select.val();
	};
}() );
