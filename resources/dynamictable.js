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
 * @author thomas-topway-it <thomas.topway.it@mail.com>
 * @copyright Copyright © 2021-2022, https://wikisphere.org
 */

$( document ).ready( function () {

	function increment_name( value, increment ) {
		if ( !value ) {
			return '';
		}

		var num = parseInt( value.match( /\d+/ ) ) + increment;

		if ( isNaN( num ) ) {
			return value + '_' + increment;
		}

		return value.replace( /\d+/, num );
	}

	function closest( el, selector ) {

		let output_el;

		$( el ).parents().each( function () {
			// eslint-disable-next-line no-underscore-dangle
			const el_ = $( this ).has( selector ).first();

			if ( el_.length ) {
				output_el = el_;
				return false;
			}
		} );

		return output_el;
	}

	const OoUiDropdownInputWidget_options = [];
	const OoUiComboBoxInputWidget_options = [];

	$( '.pageproperties_dynamictable_add_button' ).click( function () {

		let $table = $( this ).closest( '.pageproperties_dynamictable table' );

		// search table

		if ( !$table.length ) {

			$table = closest( this, '.pageproperties_dynamictable' );

			if ( !$table.length ) {
				// eslint-disable-next-line no-console
				console.log( 'cannot find related pageproperties_dynamictable' );
				return;
			}

			var $tr_first = $( $table ).find( 'tr:first' );
			var $tr_last = $( $table ).find( 'tr:last' );

		} else {
			var $tr_first = $( this ).closest( 'tr:first' );
			var $tr_last = $( this ).closest( 'tr:last' );

		}

		// clone latest row

		const $clone = $tr_last.clone( true, true );

		for ( var attr of [ 'name', 'id' ] ) {
			$( $clone )
				.find( '[' + attr + ']' )
				// eslint-disable-next-line no-loop-func
				.each( function () {
					if ( $( this ).prop( attr ) ) {
						$( this ).attr( attr, increment_name( $( this ).prop( attr ), 1 ) );
					}
				} );
		}

		// left cell

		const cell_first = $( $tr_first ).find( 'td.pageproperties_dynamictable_key_cell' ).eq( 0 );
		const cell_last = $( $tr_last ).find( 'td.pageproperties_dynamictable_key_cell' ).eq( 0 );

		// var row_index = $tr_last.index();

		$( cell_first )
			.find( '[data-ooui]' )
			.each( function () {

				// if($(this).hasClass( 'oo-ui-widget' )) {
				const id = $( this ).attr( 'id' );
				const el = $( '#' + id );
				const ooui_el = OO.ui.infuse( el );
				// console.log(ooui_el.constructor.name);
				// console.log(ooui_el);

				switch ( ooui_el.constructor.name ) {
					case 'OoUiComboBoxInputWidget':

						if ( !OoUiComboBoxInputWidget_options.length ) {
							const menu_items = ooui_el.menu.items; // ooui_el.getMenu()

							for ( const menu_item of menu_items ) {
								if ( menu_item.constructor.name === 'OoUiMenuOptionWidget' ) {
									OoUiComboBoxInputWidget_options.push( {
										label: menu_item.label,
										data: menu_item.data
									} );
								} else if (
									menu_item.constructor.name === 'OoUiMenuSectionOptionWidget'
								) {
									OoUiComboBoxInputWidget_options.push( {
										optgroup: menu_item.label
									} );
								}
							}
						}

						// element with name "wp{$params['fieldname']}"
						// eslint-disable-next-line no-shadow
						var input_el = $( cell_last ).find( 'input[type=text]' );

						var new_element = new OO.ui.ComboBoxInputWidget( {
							name: increment_name( input_el.prop( 'name' ), 1 ),
							options: OoUiComboBoxInputWidget_options
						} );

						$( $clone )
							.find( '.pageproperties_dynamictable_key_cell' )
							.eq( 0 )
							.html( new_element.$element );

						break;

					case 'OoUiDropdownInputWidget':
						if ( !OoUiDropdownInputWidget_options.length ) {
							let optgroup = null;

							$( $tr_first )
								.find( 'option' )
								.each( function () {
									// eslint-disable-next-line no-underscore-dangle
									const optgroup_ = $( this ).closest( 'optgroup' ).attr( 'label' );

									if ( optgroup_ !== optgroup ) {
										optgroup = optgroup_;
										OoUiDropdownInputWidget_options.push( {
											optgroup: optgroup
										} );
									}

									OoUiDropdownInputWidget_options.push( {
										label: $( this ).text(),
										data: $( this ).val()
									} );
								} );
						}

						// element with name "wp{$params['fieldname']}"
						var input_el = $( cell_last ).find( 'select' );

						var new_element = new OO.ui.DropdownInputWidget( {
							options: OoUiDropdownInputWidget_options,
							name: increment_name( input_el.prop( 'name' ), 1 )
						} );

						$( $clone )
							.find( '.pageproperties_dynamictable_key_cell' )
							.eq( 0 )
							.html( new_element.$element );

						break;
				}
			} );

		// right cell

		// var found_text_input = $($tr).find("input[type=text]");

		const cell = $( $tr_last ).find( 'td.pageproperties_dynamictable_value_cell' ).eq( 0 );

		const input_el = $( cell ).find( 'input[type=text]' );

		const textInput = new OO.ui.TextInputWidget( {
			value: '',
			name: increment_name( input_el.prop( 'name' ), 1 )
			// id: increment_name(input_el.prop("id"),2),
		} );

		$( $clone )
			.find( '.pageproperties_dynamictable_value_cell' )
			.html( textInput.$element );

		$tr_last.after( $clone );
	} );

	$( '.pageproperties_dynamictable_cancel_button' ).click( function () {

		if ( $( this ).closest( 'table' ).find( 'tr' ).length > 1 ) {
			$( this ).closest( 'tr' ).remove();

		} else {
			$( this ).closest( 'table' ).find( 'tr' ).find( ':text' ).val( '' );
		}

		const el = $( '#meta_robots_noindex_nofollow input' );

		update_noindex_nofollow( el );

	} );

	function update_noindex_nofollow( el ) {

		const checked = $( el ).is( ':checked' );

		// eslint-disable-next-line no-implicit-globals
		$table = closest( el, '.pageproperties_dynamictable' );

		let found = false;
		var name;

		$( $table ).find( 'input' ).each( function () {

			name = $( this ).attr( 'name' );

			if ( name.indexOf( '_key_' ) !== -1 && $( this ).val().trim() === 'robots' ) {
				found = true;
				return false;
			}

		} );

		if ( !found ) {

			$( $table ).find( 'input' ).each( function () {

				name = $( this ).attr( 'name' );

				if ( name.indexOf( '_key_' ) !== -1 && $( this ).val().trim() === '' &&
					$( $table ).find( '[name=' + name.replace( '_key_', '_value_' ) + ']' ).eq( 0 ).val().trim() === ''
				) {
					$( this ).val( 'robots' );
					found = true;
					return false;
				}

			} );

		}

		if ( !found ) {

			if ( !checked ) {
				return;
			}

			$table.find( '.pageproperties_dynamictable_add_button' ).click();
			var el = $( $table ).find( 'tr:last input' ).eq( 0 );
			var name = el.attr( 'name' );
			el.val( 'robots' );

		}

		var el = $( $table ).find( '[name=' + name.replace( '_key_', '_value_' ) + ']' ).eq( 0 );
		const value = $( el ).val().trim();

		const values = ( value !== '' ? value.split( /\s*,\s*/ ) : [] );

		if ( checked ) {
			var parameters = { index: false, follow: false, noindex: true, nofollow: true };

		} else {
			var parameters = { noindex: false, nofollow: false };
		}

		for ( const i in parameters ) {

			if ( parameters[ i ] ) {
				if ( values.indexOf( i ) === -1 ) {
					values.push( i );
				}

			} else if ( values.indexOf( i ) > -1 ) {
				values.splice( values.indexOf( i ), 1 );
			}

		}

		if ( values.length ) {
			$( el ).val( values.join( ', ' ) );

		} else {
			// $(el).closest('tr').remove()

			if ( $table.find( 'tr' ).length > 1 ) {
				$( el ).closest( 'tr' ).remove();

			} else {
				$( el ).closest( 'tr' ).find( ':text' ).val( '' );
			}

		}

	}

	$( '#meta_robots_noindex_nofollow input' ).change( function () {

		update_noindex_nofollow( this );

	} );

} );
