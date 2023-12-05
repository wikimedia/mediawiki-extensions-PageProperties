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

// @credits: mw.widgets.CategoryMultiselectWidget

( function () {
	/**
	 *
	 * @class PagePropertiesMenuTagSearchMultiselect
	 * @uses mw.Api
	 * @extends OO.ui.MenuTagMultiselectWidget
	 * @mixins OO.ui.mixin.PendingElement
	 *
	 * @constructor
	 * @param {Object} [config] Configuration options
	 * @cfg {number} [limit=10] Maximum number of results to load
	 */

	// eslint-disable-next-line no-implicit-globals
	PagePropertiesMenuTagSearchMultiselect = function ( config ) {
		// Config initialization
		this.limit = config.limit;

		// Parent constructor
		PagePropertiesMenuTagSearchMultiselect.parent.call(
			this,
			$.extend( true, {}, config, {
				menu: {
					filterFromInput: false
				},
				placeholder: mw.msg( 'pageproperties-menutagmultiselect-placeholder' ),
				// This allows the user to both select non-existent categories, and prevents the selector from
				// being wiped from #onMenuItemsChange when we change the available options in the dropdown
				allowArbitrary: false
			} )
		);

		// Mixin constructors
		OO.ui.mixin.PendingElement.call(
			this,
			$.extend( {}, config, { $pending: this.$handle } )
		);

		// Event handler to call the autocomplete methods
		this.input.$input.on(
			'change input cut paste',
			OO.ui.debounce( this.updateMenuItems.bind( this ), 100 )
		);

		// Initialize
		// @TODO
		this.api = { abort: function () {} }; // config.api || new mw.Api();
		this.searchCache = {};
	};

	/* Setup */

	OO.inheritClass(
		PagePropertiesMenuTagSearchMultiselect,
		OO.ui.MenuTagMultiselectWidget
	);
	OO.mixinClass(
		PagePropertiesMenuTagSearchMultiselect,
		OO.ui.mixin.PendingElement
	);

	/* Methods */

	/**
	 * Gets new items based on the input by calling
	 * {@link #getNewMenuItems getNewItems} and updates the menu
	 * after removing duplicates based on the data value.
	 *
	 * @private
	 * @method
	 */
	PagePropertiesMenuTagSearchMultiselect.prototype.updateMenuItems =
		function () {
			this.getMenu().clearItems();
			this.getNewMenuItems( this.input.$input.val() ).then(
				function ( items ) {
					var existingItems,
						menu = this.getMenu();

					// Never show the menu if the input lost focus in the meantime
					if ( !this.input.$input.is( ':focus' ) ) {
						return;
					}

					// Array of strings of the data of OO.ui.MenuOptionsWidgets
					existingItems = menu.getItems().map( function ( item ) {
						return item.data;
					} );

					// Remove if items' data already exists
					for ( var i in items ) {
						if ( existingItems.indexOf( i ) !== -1 ) {
							delete items[ i ];
						}
					}

					// Map to an array of OO.ui.MenuOptionWidgets
					var ret = [];
					for ( var i in items ) {
						ret.push(
							new OO.ui.MenuOptionWidget( {
								data: i,
								label: items[ i ]
							} )
						);
					}

					menu.addItems( ret ).toggle( true );
				}.bind( this )
			);
		};

	/**
	 * @inheritdoc
	 */
	PagePropertiesMenuTagSearchMultiselect.prototype.clearInput = function () {
		PagePropertiesMenuTagSearchMultiselect.parent.prototype.clearInput.call(
			this
		);
		// Abort all pending requests, we won't need their results
		this.api.abort();
	};

	/**
	 * Searches for categories based on the input.
	 *
	 * @private
	 * @method
	 * @param {string} input The input used to prefix search categories
	 * @return {jQuery.Promise} Resolves with an array of categories
	 */
	PagePropertiesMenuTagSearchMultiselect.prototype.getNewMenuItems = function (
		input
	) {
		var deferred = $.Deferred();

		if ( input.trim() === '' ) {
			deferred.resolve( [] );
			return deferred.promise();
		}

		// Abort all pending requests, we won't need their results
		this.api.abort();

		this.pushPending();

		return this.searchItems( input ).always( this.popPending.bind( this ) );
	};

	/**
	 * @private
	 * @method
	 * @param {string} value The input value
	 * @return {jQuery.Promise} Resolves with an array of items
	 */
	PagePropertiesMenuTagSearchMultiselect.prototype.searchItems = function (
		value
	) {
		var deferred = $.Deferred(),
			cacheKey = value;

		// Check cache
		if ( cacheKey in this.searchCache ) {
			return this.searchCache[ cacheKey ];
		}

		this.data.performQuery( this.data, value ).then( ( data ) => {
			deferred.resolve( data );
		} );

		// Cache the result
		this.searchCache[ cacheKey ] = deferred.promise();

		return deferred.promise( { abort: function () {} } );
	};
}() );
