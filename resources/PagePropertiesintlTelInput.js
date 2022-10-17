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
 * @author thomas-topway-it <thomas.topway.it@mail.com>
 * @copyright Copyright © 2021-2022, https://wikisphere.org
 */

( function () {
	// eslint-disable-next-line no-implicit-globals
	PagePropertiesintlTelInput = function ( config ) {
		var that = this;
		this.$element = $( '<input>' ).attr( {
			type: 'tel',
			name: config.name,
			value: config.value,
			class: 'oo-ui-inputWidget-input'
		} );

		this.connect = function () {
		};

		this.getValue = function () {
			return that.iti.getNumber( intlTelInputUtils.numberFormat.INTERNATIONAL );
		};

		this.getInputId = function () {
			return null;
		};

		this.setLabelledBy = function ( id ) {
			if ( id ) {
				this.$element.attr( 'aria-labelledby', id );
			} else {
				this.$element.removeAttr( 'aria-labelledby' );
			}
		};

		this.isDisabled = function () {
			return false;
		};

		setTimeout( function () {
			that.iti = window.intlTelInput( $( "input[name='" + config.name + "']" ).get( 0 ), {
				utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@16.0.3/build/js/utils.js',
				initialCountry: 'auto',
				geoIpLookup: function ( callback ) {
					$.get( 'https://ipinfo.io', function () {}, 'jsonp' ).always( function ( resp ) {
						var countryCode = ( resp && resp.country ) ? resp.country : 'us';
						callback( countryCode );
					} );
				}
			} );
			// that.iti.setNumber(config.value);
			$( "input[name='" + config.name + "']" ).closest( '.iti' ).width( '100%' ).wrap( "<div class='oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-textInputWidget oo-ui-textInputWidget-type-text'></div>" );

		}, 10 );

	};

}() );
