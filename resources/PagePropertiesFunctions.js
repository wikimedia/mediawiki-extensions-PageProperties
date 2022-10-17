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

// eslint-disable-next-line no-unused-vars
const PagePropertiesFunctions = ( function () {

	function sortObjectByKeys( object ) {
		var ret = {};
		Object.keys( object )
			.sort()
			.forEach( function ( key ) {
				ret[ key ] = object[ key ];
			} );
		return ret;
	}

	// https://stackoverflow.com/questions/4647817/javascript-object-rename-key
	function renameObjectKey( o, oldKey, newKey ) {
		delete jQuery.extend( o, { [ newKey ]: o[ oldKey ] } )[ oldKey ];
	}

	function createTool(
		group,
		name,
		icon,
		title,
		onSelect,
		flags,
		narrowConfig,
		init,
		// eslint-disable-next-line no-unused-vars
		displayBothIconAndLabel
	) {
		var Tool = function () {
			Tool.super.apply( this, arguments );
			this.toggled = false;
			if ( init ) {
				init.call( this );
			}
		};

		OO.inheritClass( Tool, OO.ui.Tool );

		Tool.prototype.onSelect = function () {
			if ( onSelect ) {
				onSelect.call( this );
			} else {
				this.toggled = !this.toggled;
				this.setActive( this.toggled );
			}
			// toolbars[ toolbar ].emit( 'updateState' );
		};
		Tool.prototype.onUpdateState = function () {};

		Tool.static.name = name;
		Tool.static.group = group;
		Tool.static.icon = icon;
		Tool.static.title = title;
		Tool.static.flags = flags;
		Tool.static.narrowConfig = narrowConfig;
		Tool.static.displayBothIconAndLabel = true; // !!displayBothIconAndLabel;
		return Tool;
	}

	function createToolGroup( toolFactory, name, tools ) {
		tools.forEach( function ( tool ) {
			var args = tool.slice();
			args.splice( 0, 0, name );
			toolFactory.register( createTool.apply( null, args ) );
		} );
	}

	return {
		createToolGroup,
		sortObjectByKeys,
		renameObjectKey
	};

}() );
