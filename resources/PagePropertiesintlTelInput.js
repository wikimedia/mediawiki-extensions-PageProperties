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

		// required when handled by OO.ui.TagMultiselectWidget -> inputWidget: inputWidget
		this.$input = input;

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

		self.fixConfigCountries( config );

		self.iti = window.intlTelInput( input.get( 0 ), $.extend( {
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
		}, config ) );
	};

	OO.inheritClass( PagePropertiesIntlTelInput, OO.ui.Widget );
	OO.mixinClass( PagePropertiesIntlTelInput, OO.EventEmitter );

	PagePropertiesIntlTelInput.prototype.getValue = function () {
		if ( typeof this.iti === 'object' && typeof intlTelInputUtils === 'object' ) {
			// @TODO show a proper validation message
			// @see here https://github.com/jackocnr/intl-tel-input/blob/master/src/js/utils.js
			// isPossibleNumber, then add the pattern to the scheme
			// https://github.com/leodido/i18n.phonenumbers.js?files=1
			return this.iti.isValidNumber() ?
				this.iti.getNumber( intlTelInputUtils.numberFormat.INTERNATIONAL ) :
				'';
		}
		return this.config.value;
	};

	PagePropertiesIntlTelInput.prototype.setValue = function () {
		this.input.val( '' );
	};

	PagePropertiesIntlTelInput.prototype.fixConfigCountries = function ( config ) {
		// excludeCountries, initialCountry, onlyCountries, preferredCountries
		var configCountries = [ 'excludeCountries', 'initialCountry', 'onlyCountries', 'preferredCountries' ];

		if ( !Object.keys( config ).filter( ( x ) => configCountries.indexOf( x ) !== -1 ).length ) {
			return;
		}

		// first get all countries to handle the error
		// "No country data for ... "
		// eslint-disable-next-line new-cap
		var iso2 = ( new window.intlTelInput( this.input.get( 0 ) ) )
			.countries.map( ( x ) => x.iso2 );

		for ( var i of configCountries ) {
			if ( i in config ) {
				if ( i === 'initialCountry' ) {
					config[ i ] = config[ i ].toLowerCase();
					if ( iso2.indexOf( config[ i ] ) === -1 ) {
						// eslint-disable-next-line no-console
						console.error( config[ i ] + ' is not a valid country code' );
						delete config[ i ];
					}
					continue;
				}
				var values = [];
				for ( var ii of config[ i ] ) {
					if ( iso2.indexOf( ii ) === -1 ) {
						// eslint-disable-next-line no-console
						console.error( ii + ' is not a valid country code' );
						values.splice( ii, 1 );
					}
				}
				config[ i ] = values;
			}
		}
	};

}() );
