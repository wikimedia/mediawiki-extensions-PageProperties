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

	function getKeyByValue( obj, value ) {
		return Object.keys( obj ).find( ( key ) => obj[ key ] === value );
	}

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

	function createTool( obj, config ) {

		var Tool = function () {
			// Tool.super.apply( this, arguments );
			Tool.super.call( this, arguments[ 0 ], config );

			// OO.ui.mixin.PendingElement.call( this, {} );

			/*
			this.toggled = false;
			if ( init ) {
				init.call( this );
			}
*/
		};

		OO.inheritClass( Tool, OO.ui.Tool );
		// OO.mixinClass( Tool, OO.ui.mixin.PendingElement );
		Tool.prototype.onSelect = function () {
			// this.setPendingElement(this.$element)
			// this.pushPending();

			if ( obj.onSelect ) {
				obj.onSelect.call( this );
			} else {
				this.toggled = !this.toggled;
				this.setActive( this.toggled );
			}
			// Tool.emit( 'updateState' );
		};

		Tool.prototype.onUpdateState = function () {};

		/*
		Tool.static.group = group;
		Tool.static.name = name;
		Tool.static.icon = icon;
		Tool.static.title = title;
		Tool.static.flags = flags;
		// Tool.static.classes = ['oo-ui-actionWidget'];
		Tool.static.narrowConfig = narrowConfig;
		Tool.static.displayBothIconAndLabel = true; // !!displayBothIconAndLabel;
*/

		for ( var i in obj ) {
			Tool.static[ i ] = obj[ i ];
		}

		Tool.static.displayBothIconAndLabel = true;

		return Tool;
	}

	function createToolGroup( toolFactory, groupName, tools ) {
		tools.forEach( function ( tool ) {
			var obj = jQuery.extend( {}, tool );
			obj.group = groupName;
			var config = ( tool.config ? tool.config : {} );
			delete obj.config;
			toolFactory.register( createTool( obj, config ) );
		} );
	}

	return {
		createToolGroup,
		sortObjectByKeys,
		renameObjectKey,
		getKeyByValue
	};

}() );
