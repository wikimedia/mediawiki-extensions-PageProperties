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

			OO.ui.mixin.PendingElement.call( this, {} );

			if ( getNestedProp( [ 'data', 'disabled' ], config ) ) {
				// this.setPendingElement(this.$element)
				// this.pushPending();
				this.setDisabled( true );
			}

			if ( getNestedProp( [ 'data', 'pending' ], config ) ) {
				// this.setPendingElement(this.$element)
				this.pushPending();
			}

			// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/toolbars.js
			this.toggled = false;
			if ( config.init ) {
				config.init.call( this );
			}
		};

		OO.inheritClass( Tool, OO.ui.Tool );
		OO.mixinClass( Tool, OO.ui.mixin.PendingElement );

		Tool.prototype.onSelect = function () {
			if ( obj.onSelect ) {
				obj.onSelect.call( this );
			} else {
				this.toggled = !this.toggled;
				this.setActive( this.toggled );
			}
			// Tool.emit( 'updateState' );
		};

		Tool.prototype.onUpdateState = function () {
			this.popPending();
			this.setDisabled( false );
		};

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
			var config = tool.config ? tool.config : {};
			delete obj.config;
			toolFactory.register( createTool( obj, config ) );
		} );
	}

	function createDisabledToolGroup( toolGroupFactory, parent, name ) {
		var DisabledToolGroup = function () {
			DisabledToolGroup.super.call( this, parent, name );
			this.setDisabled( true );
		};
		OO.inheritClass( DisabledToolGroup, parent );
		DisabledToolGroup.static.name = name;
		DisabledToolGroup.prototype.onUpdateState = function () {
			this.setLabel( 'Disabled' );
		};
		toolGroupFactory.register( DisabledToolGroup );
	}

	function createWindowManager() {
		var windowManager = new OO.ui.WindowManager( {
			classes: [ 'pageproperties-ooui-window' ]
		} );
		$( document.body ).append( windowManager.$element );

		return windowManager;
	}

	// ***remove annoying &nbsp; on OOUI / Mediawiki 1.39 (~v0.44.3)
	// see vendor/oojs/oojs-ui/php/layouts/FieldsetLayout.php
	function removeNbspFromLayoutHeader( selector ) {
		$( selector + ' .oo-ui-fieldLayout-header' ).each( function () {
			var html = $( this ).html();
			if ( /<label [^>]+>&nbsp;<\/label>/.test( html ) ) {
				$( this ).html( '' );
			}
		} );
	}

	function destroyDataTable( id ) {
		if ( !$.fn.dataTable.isDataTable( '#' + id ) ) {
			return;
		}
		var table = $( '#' + id ).DataTable();

		// *** necessary, othwerwise dataTable.on("click", "tr"
		// gets called 2 times, and openDialog() will create 2 dialogs
		table.off( 'click' );

		table.destroy();
		$( '#' + id ).empty();
	}

	// https://medium.com/javascript-inside/safely-accessing-deeply-nested-values-in-javascript-99bf72a0855a
	function getNestedProp( path, obj ) {
		return path.reduce( ( xs, x ) => ( xs && xs[ x ] ) ? xs[ x ] : null, obj );
	}

	function OOUIAlert( windowManager, text, options, callback, args ) {
		windowManager.addWindows( [ new OO.ui.MessageDialog() ] );

		var obj = { message: text };

		if ( !callback ) {
			obj.actions = [ OO.ui.MessageDialog.static.actions[ 0 ] ];
		}

		// @TODO or return promise
		return windowManager.openWindow( 'message', $.extend( obj, options ) )
			.closed
			.then( function ( action ) {
				return action.action === 'accept' && callback ? callback.apply( this, args ) : undefined;
			} );
	}

	return {
		createToolGroup,
		createDisabledToolGroup,
		sortObjectByKeys,
		renameObjectKey,
		getKeyByValue,
		createWindowManager,
		removeNbspFromLayoutHeader,
		destroyDataTable,
		getNestedProp,
		OOUIAlert
	};
}() );
