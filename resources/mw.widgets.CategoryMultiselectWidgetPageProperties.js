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

/* eslint-disable max-len */
( function () {
	mw.widgets.CategoryMultiselectWidgetPageProperties = function MWCategoryMultiselectWidgetPageProperties( config ) {

		// API init
		this.api = config.api || new mw.Api();

		// Parent constructor
		mw.widgets.CategoryMultiselectWidgetPageProperties.parent.call( this, $.extend( {}, config, {} ) );

		if ( 'name' in config ) {
			// Use this instead of <input type="hidden">, because hidden inputs do not have separate
			// 'value' and 'defaultValue' properties. The script on Special:Preferences
			// (mw.special.preferences.confirmClose) checks this property to see if a field was changed.
			this.$hiddenInput = $( '<textarea>' )
				.addClass( 'oo-ui-element-hidden' )
				.attr( 'name', config.name )
				.appendTo( this.$element );
			// Update with preset values
			this.updateHiddenInput();
			// Set the default value (it might be different from just being empty)
			this.$hiddenInput.prop( 'defaultValue', this.getSelectedUsernames().join( '\n' ) );
		}

		// Events
		// When list of selected usernames changes, update hidden input
		this.connect( this, {
			change: 'onMultiselectChange'
		} );

	};

	/* Setup */

	OO.inheritClass( mw.widgets.CategoryMultiselectWidgetPageProperties, mw.widgets.CategoryMultiselectWidget );

	/**
	 * Get currently selected usernames
	 *
	 * @return {string[]} usernames
	 */
	mw.widgets.CategoryMultiselectWidgetPageProperties.prototype.getSelectedUsernames = function () {
		return this.getValue();
	};

	mw.widgets.CategoryMultiselectWidgetPageProperties.prototype.onInputChange = function () {
		mw.widgets.CategoryMultiselectWidgetPageProperties.parent.prototype.onInputChange.apply( this, arguments );

		this.updateMenuItems();
	};

	/**
	 * If used inside HTML form, then update hiddenInput with list of
	 * newline-separated usernames.
	 *
	 * @private
	 */
	mw.widgets.CategoryMultiselectWidgetPageProperties.prototype.updateHiddenInput = function () {
		if ( '$hiddenInput' in this ) {
			this.$hiddenInput.val( this.getSelectedUsernames().join( '\n' ) );
			// Trigger a 'change' event as if a user edited the text
			// (it is not triggered when changing the value from JS code).
			this.$hiddenInput.trigger( 'change' );
		}
	};

	/**
	 * React to the 'change' event.
	 *
	 * Updates the hidden input and clears the text from the text box.
	 */
	mw.widgets.CategoryMultiselectWidgetPageProperties.prototype.onMultiselectChange = function () {
		this.updateHiddenInput();
		this.input.setValue( '' );
	};

}() );
