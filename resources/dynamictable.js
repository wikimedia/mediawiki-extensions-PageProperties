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
	var msg1 = mw.config.get( 'pageproperties-js-alert-1' );
	var msg2 = mw.config.get( 'pageproperties-js-alert-2' );
	var propertiesTypes = JSON.parse( mw.config.get( 'pageproperties-propertiesTypes' ) );

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
		var output_el;

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

	$( '.pageproperties_dynamictable_add_button' ).click( function () {
		var $parent_el = $( this ).parents( 'div[id^="form-section-"]' ).first();
		var semantic_properties = ( $parent_el.attr( 'id' ) === 'form-section-semantic-properties' );

		let $table = $( this ).closest( '.pageproperties_dynamictable table' );

		// search table
		if ( !$table.length ) {
			$table = closest( this, '.pageproperties_dynamictable' );
			if ( !$table.length ) {
				// eslint-disable-next-line no-console
				console.log( 'cannot find related pageproperties_dynamictable' );
				return;
			}
			var $tr_first = $table.find( 'tr:first' );
			var $tr_last = $table.find( 'tr:last' );

		} else {
			var $tr_first = $( this ).closest( 'tr:first' );
			var $tr_last = $( this ).closest( 'tr:last' );
		}

		// clone latest row
		const $clone = $tr_last.clone( true, true );

		for ( var attr of [ 'name', 'id' ] ) {
			$clone.find( '[' + attr + ']' )
				// eslint-disable-next-line no-loop-func
				.each( function () {
					if ( $( this ).prop( attr ) ) {
						$( this ).attr( attr, increment_name( $( this ).prop( attr ), 1 ) );
					}
				} );
		}

		function getNewInput( ooui_el, input_el, that ) {
			var options = [];
			switch ( ooui_el.constructor.name ) {
				case 'OoUiComboBoxInputWidget': {
					const menu_items = ooui_el.menu.items; // ooui_el.getMenu()

					for ( const menu_item of menu_items ) {
						if ( menu_item.constructor.name === 'OoUiMenuOptionWidget' ) {
							options.push( {
								label: menu_item.label,
								data: menu_item.data
							} );
						} else if (
							menu_item.constructor.name === 'OoUiMenuSectionOptionWidget'
						) {
							options.push( {
								optgroup: menu_item.label
							} );
						}
					}

					return new OO.ui.ComboBoxInputWidget( {
						name: increment_name( input_el.prop( 'name' ), 1 ),
						options: options
					} );

				}

				case 'OoUiDropdownInputWidget': {
					let optgroup = null;

					$( that )
						.find( 'option' )
						.each( function () {
							// eslint-disable-next-line no-underscore-dangle
							const optgroup_ = $( this ).closest( 'optgroup' ).attr( 'label' );

							if ( optgroup_ && optgroup_ !== optgroup ) {
								optgroup = optgroup_;
								options.push( {
									optgroup: optgroup
								} );
							}

							options.push( {
								label: $( this ).text(),
								data: $( this ).val()
							} );
						} );

					return new OO.ui.DropdownInputWidget( {
						options: options,
						name: increment_name( input_el.prop( 'name' ), 1 )
					} );

				}

				case 'OoUiTextInputWidget':
					return new OO.ui.TextInputWidget( {
						value: '',
						name: increment_name( input_el.prop( 'name' ), 1 )
					} );

			}

		}

		var input_value = null;
		for ( let selector of [ 'td.pageproperties_dynamictable_key_cell', 'td.pageproperties_dynamictable_value_cell' ] ) {
			var $cell_first_row = $tr_first.find( selector ).eq( 0 );

			// PHP rendered elements
			// eslint-disable-next-line no-loop-func
			$cell_first_row.find( '[data-ooui]' ).each( function () {
				var ooui_el = OO.ui.infuse( $( this ) );

				if ( !ooui_el || !ooui_el.constructor.name ) {
					return;
				}

				// input_el of last cell
				var $cell_last_row = $tr_last.find( selector ).eq( 0 );
				var $input_el = $cell_last_row.find( ':input' ).first();
				var new_element = getNewInput( ooui_el, $input_el, this );

				if ( !new_element ) {
					return;
				}

				if ( semantic_properties ) {
					switch ( selector ) {
						case 'td.pageproperties_dynamictable_key_cell':
							input_value = new_element.value;
							var name = new_element.$input.attr( 'name' ).replace( '_key_', '_value_' );

							new_element.on( 'change', function ( value ) {
								var $el = $( '[name="' + name + '"]' );
								$el.attr( 'placeholder', propertiesTypes[ value ] );
							} );
							break;

						case 'td.pageproperties_dynamictable_value_cell':
							new_element.$input.attr( 'placeholder', propertiesTypes[ input_value ] );
							break;
					}
				}

				$clone.find( selector )
					.eq( 0 )
					.html( new_element.$element );

			} );

		}

		$tr_last.after( $clone );

	} );

	function removeOrResetRow( $tr ) {
		var $table = $( $tr ).closest( 'table' );
		if ( $table.find( 'tr' ).length > 1 ) {
			var row_index = $tr.index();
			if ( row_index === 0 ) {
				// copy the values of next one to the current
				// and delete the next one
				var $next_tr = $table.find( 'tr' ).eq( row_index + 1 );
				for ( var selector of [ 'td.pageproperties_dynamictable_key_cell', 'td.pageproperties_dynamictable_value_cell' ] ) {
					var $next_row_cell = $next_tr.find( selector ).eq( 0 );
					var $el = $next_row_cell.find( ':input' ).first();
					var input_value = $el.val().trim();
					var $cell = $tr.find( selector ).eq( 0 );
					var $el = $cell.find( ':input' ).first();
					$el.val( input_value );
				}
				$next_tr.remove();

			} else {
				$tr.remove();
			}

		} else {
			$tr.find( ':text' ).val( '' );
		}
	}

	$( '.pageproperties_dynamictable_cancel_button' ).click( function () {
		var input_value = false;
		var cell_selector = null;
		var $tr = $( this ).parents( '.pageproperties_dynamictable_row' ).eq( 0 );

		if ( $( this ).parents( '#form-section-semantic-manage-properties' ).get( 0 ) ) {
			cell_selector = 'td.pageproperties_dynamictable_key_cell';

		} else if ( $( this ).parents( '#form-section-semantic-properties' ).get( 0 ) ) {
			cell_selector = 'td.pageproperties_dynamictable_value_cell';

		// match id with section
		} else if ( $( this ).parents( 'div[id^="form-section-semantic-manage-properties/"]' ).get( 0 ) ) {
			cell_selector = 'td.pageproperties_dynamictable_key_cell';

		// if encoded
		} else if ( $( this ).parents( 'div[id^="form-section-semantic-manage-properties.2F"]' ).get( 0 ) ) {
			cell_selector = 'td.pageproperties_dynamictable_key_cell';
		}
		if ( cell_selector ) {
			var $cell = $tr.find( cell_selector ).eq( 0 );
			var $el = $cell.find( ':input' ).first();
			input_value = $el.val().trim();
		}
		if ( input_value ) {
			// eslint-disable-next-line no-alert
			if ( !confirm( msg1 ) ) {
				return false;
			}
		}

		removeOrResetRow( $tr );
		var $el = $( '#SEO_meta_robots_noindex_nofollow input' );
		update_noindex_nofollow( $el, false );

	} );

	// eslint-disable-next-line no-unused-vars
	function update_noindex_nofollow( $el, toggle ) {
		const checked = $el.is( ':checked' );
		var $table = closest( $el, '.pageproperties_dynamictable' );

		var found = false;
		var name;

		/*
		$table.find( 'tr' ).each( function () {
			var $cell = $( this ).find( 'td.pageproperties_dynamictable_key_cell' ).eq( 0 );
			var $el = $cell.find( ':input' ).first()
			var input_value = $el.val().trim()

			if ( input_value === 'robots' ) {
				found = true;
				return false;
			}
		})
*/
		$( $table ).find( 'input' ).each( function () {
			name = $( this ).attr( 'name' );
			if ( name.indexOf( '_key_' ) !== -1 && $( this ).val().trim() === 'robots' ) {
				found = true;
				return false;
			}

		} );

		if ( !found ) {
			$table.find( 'input' ).each( function () {
				name = $( this ).attr( 'name' );
				if ( name.indexOf( '_key_' ) !== -1 && $( this ).val().trim() === '' &&
					$table.find( '[name=' + name.replace( '_key_', '_value_' ) + ']' ).eq( 0 ).val().trim() === ''
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
			// add row
			$table.find( '.pageproperties_dynamictable_add_button' ).click();
			var $el = $table.find( 'tr:last input' ).eq( 0 );
			name = $el.attr( 'name' );
			$el.val( 'robots' );
		}

		var $el = $table.find( '[name=' + name.replace( '_key_', '_value_' ) + ']' ).eq( 0 );
		const value = $el.val().trim();

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
			$el.val( values.join( ', ' ) );

		} else {
			removeOrResetRow( $el.closest( 'tr' ) );
		}

	}

	$( '#SEO_meta_robots_noindex_nofollow input' ).change( function () {
		update_noindex_nofollow( $( this ), true );
	} );

	// eslint-disable-next-line no-unused-vars
	$( '#form-section-semantic-properties tr' ).each( function ( index ) {
		for ( let selector of [ 'td.pageproperties_dynamictable_key_cell', 'td.pageproperties_dynamictable_value_cell' ] ) {
			let input_value = null;
			var $cell = $( this ).find( selector ).eq( 0 );

			// PHP rendered elements
			$cell.find( '[data-ooui]' ).each( function () {
				var ooui_el = OO.ui.infuse( $( this ) );

				if ( !ooui_el || !ooui_el.constructor.name ) {
					return;
				}
				switch ( selector ) {
					case 'td.pageproperties_dynamictable_key_cell':
						input_value = ooui_el.value;
						var name = ooui_el.$input.attr( 'name' ).replace( '_key_', '_value_' );

						ooui_el.on( 'change', function ( value ) {
							var $el = $( '[name="' + name + '"]' );
							$el.attr( 'placeholder', propertiesTypes[ value ] );
						} );
						break;

					case 'td.pageproperties_dynamictable_value_cell':
						ooui_el.$input.attr( 'placeholder', propertiesTypes[ input_value ] );
						break;
				}
			} );
		}
	} );

	$( '#pageproperties-form' ).submit( function () {
		var $input = $( 'input[name=confirm_delete_semantic_properties]' );

		if ( $input.get( 0 ) && $input.val() === '1' ) {
			// eslint-disable-next-line no-alert
			if ( !confirm( msg2 ) ) {
				return false;
			}
		}

	} );

} );
