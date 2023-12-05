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

( function () {
	// eslint-disable-next-line no-implicit-globals
	PagePropertiesButtonMultiselectWidget = function ( config ) {
		config = config || {};

		if ( !( 'classes' in config ) ) {
			config.classes = [];
		}

		this.options = {};
		for ( var value of config.options ) {
			this.options[ [ value.data ] ] = value.label;
		}

		// ***important, add position: relative to display
		// property native validation
		config.classes.push( 'pageproperties-button-multiselect-widget' );

		PagePropertiesButtonMultiselectWidget.super.call( this, config );

		var self = this;
		this.items = {};
		for ( var i in this.options ) {
			this.items[ i ] = new OO.ui.ToggleButtonWidget( {
				data: i,
				label: this.options[ i ],
				value: $.inArray( this.options[ i ], config.selected ) !== -1
			} );

			this.items[ i ].on( 'change', function () {
				self.emit( 'change', self.getValue().join().trim() );
			} );
		}

		for ( var i in this.items ) {
			this.$element.append( this.items[ i ].$element );
		}
	};

	OO.inheritClass( PagePropertiesButtonMultiselectWidget, OO.ui.Widget );
	OO.mixinClass( PagePropertiesButtonMultiselectWidget, OO.EventEmitter );

	PagePropertiesButtonMultiselectWidget.prototype.getValue = function () {
		var ret = [];
		for ( var i in this.items ) {
			if ( this.items[ i ].getValue() ) {
				ret.push( this.options[ i ] );
			}
		}
		return ret;
	};
}() );
