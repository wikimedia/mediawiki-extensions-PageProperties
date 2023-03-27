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
	PagePropertiesIntlTelInput = function ( config ) {
		PagePropertiesIntlTelInput.super.call( this, config );

		var self = this;
		this.config = config;

		var input = $( '<input>' ).attr( {
			type: 'tel',
			name: config.name,
			value: config.value,
			class: 'oo-ui-inputWidget-input'
		} );

		this.input = input;

		input.on( 'input', function () {
			self.config.value = self.getValue();
			self.emit( 'change', self.config.value );
		} );

		this.$element = $( '<div>' )
			.attr(
				'class',
				'oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-textInputWidget oo-ui-textInputWidget-type-text'
			)
			.append( input );

		self.iti = window.intlTelInput( input.get( 0 ), {
			utilsScript:
				'https://cdn.jsdelivr.net/npm/intl-tel-input@16.0.3/build/js/utils.js',
			initialCountry: 'auto',
			geoIpLookup: function ( callback ) {
				$.get( 'https://ipinfo.io', function () {}, 'jsonp' ).always( function (
					resp
				) {
					var countryCode = resp && resp.country ? resp.country : 'us';
					callback( countryCode );
				} );
			}
		} );
	};

	OO.inheritClass( PagePropertiesIntlTelInput, OO.ui.Widget );
	OO.mixinClass( PagePropertiesIntlTelInput, OO.EventEmitter );

	PagePropertiesIntlTelInput.prototype.getValue = function () {
		if ( typeof this.iti === 'object' && typeof intlTelInputUtils === 'object' ) {
			// @TODO show a proper validation message
			return this.iti.isValidNumber() ?
				this.iti.getNumber( intlTelInputUtils.numberFormat.INTERNATIONAL ) :
				'';
		}
		return this.config.value;
	};

	PagePropertiesIntlTelInput.prototype.setValue = function () {
		this.input.val( '' );
	};

}() );
