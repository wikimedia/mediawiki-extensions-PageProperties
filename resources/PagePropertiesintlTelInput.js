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

( function () {
	// eslint-disable-next-line no-implicit-globals
	PagePropertiesIntlTelInput = function ( config ) {
		PagePropertiesIntlTelInput.super.call( this, config );

		var self = this;
		this.config = config;

		// https://github.com/jackocnr/intl-tel-input/tree/master?tab=readme-ov-file
		if ( 'nationalMode' in this.config && this.config.nationalMode === true ) {
			this.config.showFlags = false;
			this.config.allowDropdown = false;
		}

		var input = $( '<input>' ).attr( {
			type: 'tel',
			name: config.name,
			value: config.value,
			class: 'oo-ui-inputWidget-input'
		} );

		this.input = input;

		// required when handled by OO.ui.TagMultiselectWidget -> inputWidget: inputWidget
		this.$input = input;

		// input.on("input", function () {
		// 	self.config.value = self.input.val();
		// 	self.emit("change", self.config.value);
		// });

		input.on( 'blur', function () {
			self.formatNumber();
		} );

		this.$element = $( '<div>' )
			.attr(
				'class',
				'oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-textInputWidget oo-ui-textInputWidget-type-text'
			)
			.append( input );

		self.fixConfigCountries( config );

		self.iti = window.intlTelInput(
			input.get( 0 ),
			$.extend(
				{
					utilsScript:
						'https://cdn.jsdelivr.net/npm/intl-tel-input@18.3.3/build/js/utils.js',
					initialCountry: 'auto',
					geoIpLookup: function ( callback ) {
						fetch( 'https://ipapi.co/json' )
							.then( function ( res ) {
								return res.json();
							} )
							.then( function ( data ) {
								callback( data.country_code );
							} )
							.catch( function () {
								callback( 'us' );
							} );
					}
				},
				config
			)
		);
	};

	OO.inheritClass( PagePropertiesIntlTelInput, OO.ui.Widget );
	OO.mixinClass( PagePropertiesIntlTelInput, OO.EventEmitter );

	PagePropertiesIntlTelInput.prototype.formatNumber = function () {
		// https://github.com/jackocnr/intl-tel-input/blob/master/src/js/utils.js#L109
		var numberFormat = intlTelInputUtils.numberFormat.E164;
		if ( 'nationalMode' in this.config && this.config.nationalMode === true ) {
			numberFormat = intlTelInputUtils.numberFormat.NATIONAL;
		}

		if ( typeof this.iti === 'object' && typeof intlTelInputUtils === 'object' ) {
			this.setValue(
				this.iti.getNumber( numberFormat )
			);
		}
	};

	PagePropertiesIntlTelInput.prototype.validateFunc = async function () {
		if ( this.getValue().trim() === '' ) {
			return true;
		}

		if ( !this.iti.isPossibleNumber() ) {
			// https://github.com/jackocnr/intl-tel-input/blob/master/src/js/utils.js#L148
			var error = this.iti.getValidationError();
			var msg = '';
			switch ( error ) {
				case 1:
					msg = 'invalid country code';
					break;
				case 2:
					msg = 'too short';
					break;
				case 3:
					msg = 'too long';
					break;
				case 4:
					msg = 'is possible local only';
					break;
				case 5:
					msg = 'invalid length';
					break;
			}

			return 'wrong number' + ( msg ? `: ${ msg }` : '' );
		}

		return true;
	};

	PagePropertiesIntlTelInput.prototype.getValue = function () {
		this.formatNumber();
		// return this.config.value;
		return this.input.val();
	};

	PagePropertiesIntlTelInput.prototype.setValue = function ( value ) {
		// this.config.value = value;
		this.input.val( value );
	};

	PagePropertiesIntlTelInput.prototype.fixConfigCountries = function ( config ) {
		// excludeCountries, initialCountry, onlyCountries, preferredCountries
		var configCountries = [
			'excludeCountries',
			'initialCountry',
			'onlyCountries',
			'preferredCountries'
		];

		if (
			!Object.keys( config ).filter( ( x ) => configCountries.indexOf( x ) !== -1 )
				.length
		) {
			return;
		}

		// first get all countries to handle the error
		// "No country data for ... "
		// eslint-disable-next-line new-cap
		var iso2 = new window.intlTelInput( this.input.get( 0 ) ).countries.map(
			( x ) => x.iso2
		);

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
