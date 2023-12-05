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

/* eslint-disable no-tabs */

const PagePropertiesFunctions = ( function () {
	/*
		AVAILABLE INPUTS ...
		"OO.ui.TextInputWidget",
		"OO.ui.TagMultiselectWidget",
		"OO.ui.ToggleSwitchWidget",
		"OO.ui.RadioSelectWidget",
		"OO.ui.NumberInputWidget",
		"OO.ui.ComboBoxInputWidget",
		"OO.ui.MultilineTextInputWidget",
		"OO.ui.MultiselectWidget",
		"OO.ui.ButtonSelectWidget",
		"OO.ui.CheckboxMultiselectInputWidget",
		"OO.ui.DropdownInputWidget",
		"mw.widgets.DateInputWidget",
		"mw.widgets.datetime.DateTimeInputWidget",
		"mw.widgets.CategoryMultiselectWidget",
		"mw.widgets.TitleInputWidget",
		"mw.widgets.TitlesMultiselectWidget",
		"mw.widgets.UserInputWidget",
		"mw.widgets.UsersMultiselectWidget",
		'ButtonMultiselectWidget',
		'OO.ui.MenuTagMultiselectWidget',
		'intl-tel-input',
		'RatingWidget',
		MenuTagSearchMultiselect
*/

	var labelFormulaInputs = [
		'OO.ui.DropdownInputWidget',
		'OO.ui.MenuTagMultiselectWidget',
		'ButtonMultiselectWidget',
		'OO.ui.RadioSelectInputWidget',
		'OO.ui.CheckboxMultiselectInputWidget',
		'MenuTagSearchMultiselect'
	];

	var optionsInputs = [
		'OO.ui.DropdownInputWidget',
		'OO.ui.ComboBoxInputWidget',
		'OO.ui.MenuTagMultiselectWidget',
		'ButtonMultiselectWidget',

		// should also be in the list ? https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.ButtonSelectWidget
		// "OO.ui.ButtonSelectWidget"
		'OO.ui.RadioSelectInputWidget',
		'OO.ui.CheckboxMultiselectInputWidget'
	];

	// var multiselectInputs = [
	// 	'OO.ui.TagMultiselectWidget',
	// 	'ButtonMultiselectWidget',
	// 	'mw.widgets.TitlesMultiselectWidget',
	// 	'mw.widgets.UsersMultiselectWidget',
	// 	'mw.widgets.CategoryMultiselectWidget'
	// ];

	var lookupInputs = [ 'LookupElement', 'MenuTagSearchMultiselect' ];

	function matchLoadedData( config, dataToLoad ) {
		return dataToLoad.filter( ( x ) => !inArray( x, config.loadedData ) );
	}

	function castType( value, type ) {
		switch ( type ) {
			case 'string':
				value = String( value || '' );
				break;
			case 'number':
				value = Number( value );
				break;
			case 'integer':
				value = parseInt( value );
				break;
			case 'boolean':
				value = !!value;
				break;
		}

		return value;
	}

	function loadData( config, dataToLoad ) {
		// eslint-disable-next-line compat/compat
		return new Promise( ( resolve, reject ) => {
			var payload = {
				action: 'pageproperties-load-data',
				dataset: dataToLoad.join( '|' ),
				format: 'json'
			};
			mw.loader.using( 'mediawiki.api', function () {
				new mw.Api()
					.postWithToken( 'csrf', payload )
					.done( function ( res ) {
						if ( payload.action in res ) {
							var data = res[ payload.action ];
							for ( var i in data ) {
								data[ i ] = JSON.parse( data[ i ] );
							}
							config.loadedData = config.loadedData.concat( dataToLoad );
							resolve( data );
						} else {
							reject();
						}
					} )
					.fail( function ( res ) {
						// eslint-disable-next-line no-console
						console.error( 'pageproperties-load-data error', res );
						reject( res );
					} );
			} );
		} );
	}

	function inputNameFromLabel( inputName ) {
		var ret = inputName;
		var parts = ret.split( ' ' );
		if ( parts.length > 1 ) {
			// eslint-disable-next-line no-useless-escape
			ret = parts[ 0 ] + '.' + parts.pop().replace( /[\(\)]/g, '' );
		}
		return ret;
	}

	function getAvailableInputs( type, format ) {
		var ret = [];
		switch ( type ) {
			case 'string':
				switch ( format ) {
					case 'color':
						ret = [ 'OO.ui.TextInputWidget (color)' ];
						break;
					case 'date':
						ret = [ 'mw.widgets.DateInputWidget' ];
						break;
					case 'datetime':
						ret = [ 'mw.widgets.datetime.DateTimeInputWidget' ];
						break;
					case 'datetime-local':
						ret = [ 'mw.widgets.datetime.DateTimeInputWidget' ];
						break;
					case 'email':
						ret = [ 'OO.ui.TextInputWidget (email)' ];
						break;
					case 'month':
						ret = [ 'mw.widgets.DateInputWidget (precision month)' ];
						break;
					case 'password':
						ret = [ 'OO.ui.TextInputWidget (password)' ];
						break;
					case 'number':
						ret = [
							'OO.ui.NumberInputWidget',
							'OO.ui.TextInputWidget (number)',
							'RatingWidget'
						];
						break;
					case 'range':
						// @TODO add range input
						ret = [ 'OO.ui.TextInputWidget' ];
						break;
					case 'tel':
						ret = [
							'intl-tel-input',
							'OO.ui.TextInputWidget (tel)',
							'OO.ui.TagMultiselectWidget'
						];
						break;
					case 'text':
						ret = [
							'OO.ui.TextInputWidget',
							'OO.ui.TagMultiselectWidget',
							'OO.ui.MultilineTextInputWidget',
							'LookupElement',
							'MenuTagSearchMultiselect',
							'mw.widgets.TitlesMultiselectWidget',
							'mw.widgets.TitleInputWidget',
							'mw.widgets.UsersMultiselectWidget',
							'mw.widgets.UserInputWidget',
							'OO.ui.SelectFileWidget',
							'mw.widgets.CategoryMultiselectWidget'
						];
						break;
					case 'textarea':
						ret = [ 'OO.ui.MultilineTextInputWidget' ];
						break;
					case 'time':
						ret = [ 'mw.widgets.datetime.DateTimeInputWidget' ];
						break;
					case 'url':
						ret = [ 'OO.ui.TextInputWidget (url)' ];
						break;
					case 'week':
						ret = [ 'OO.ui.TextInputWidget' ];
						break;
				}

				break;

			case 'number':
			case 'integer':
				ret = [
					'OO.ui.NumberInputWidget',
					'OO.ui.TextInputWidget (number)',
					'RatingWidget'
				];

				break;
			case 'boolean':
				ret = [ 'OO.ui.ToggleSwitchWidget' ];
				break;

			// select rather a type and toggle "multiple values"
			case 'array':
				break;
		}

		var filterType = [ 'boolean' ];
		var filterFormat = [ 'password' ];
		if (
			!inArray( type, filterType ) &&
			( type !== 'string' || !inArray( format, filterFormat ) )
		) {
			ret = ret.concat( optionsInputs );
		}

		return ret;
	}

	function isMultiselect( inputName ) {
		// return inArray(inputName, ManageProperties.multiselectInputs))
		return inputName.indexOf( 'Multiselect' ) !== -1;
	}

	function inputInstanceFromName( inputName, config ) {
		var arr = inputName.split( '.' );
		var constructor = null;
		var tags = [];

		// *** we cannot use the native
		// required validation since a schema tab
		// could be hidden, a solution could be
		// to apply the required attribute dynamically
		// and to toggle tab/schema visibility
		// on form submission, however this may
		// be not necessary (a similar solution
		// is used in CIForms to handle native
		// validation with steps) @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/CIForms/+/cda22fd8bb664beeee7fdac97aba9b2c5dbcf730/resources/validation.js
		var required = config.required;
		if ( required ) {
			config.indicator = 'required';
			config.required = false;
		}

		if ( isMultiselect( inputName ) && !( 'selected' in config ) ) {
			config.selected = config.value;
		}

		switch ( inputName ) {
			case 'OO.ui.NumberInputWidget':
				if ( !( 'type' in config ) ) {
					config.type = 'number';
				}
				break;
			case 'mw.widgets.datetime.DateTimeInputWidget':
				constructor = mw.widgets.datetime.DateTimeInputWidget;
				break;
			case 'intl-tel-input':
				constructor = PagePropertiesIntlTelInput;
				break;
			case 'ButtonMultiselectWidget':
				constructor = PagePropertiesButtonMultiselectWidget;
				break;
			case 'LookupElement':
				constructor = PagePropertiesLookupElement;
				break;
			case 'MenuTagSearchMultiselect':
				constructor = PagePropertiesMenuTagSearchMultiselect;
				break;
			case 'RatingWidget':
				constructor = PagePropertiesRatingWidget;
				break;
			case 'mw.widgets.CategoryMultiselectWidget':
				// ***prevents error "Cannot read properties of undefined (reading 'apiUrl')"
				tags = config.selected;
				delete config.selected;
				delete config.value;
				break;
			case 'OO.ui.SelectFileWidget':
				// prevents error "Failed to set the 'value' property on 'HTMLInputElement':
				// This input element accepts a filename, which may only be programmatically
				// set to the empty string"
				delete config.value;
				// *** we handle the filename with a custom
				// implemention
				config.buttonOnly = true;
				if ( !( 'showDropTarget' in config ) || config.showDropTarget !== true ) {
					config.button = {
						flags: [ 'progressive' ],
						icon: 'upload',
						// classes: [ 'pageproperties-SelectFileWidget-button' ],
						label: mw.msg( 'pageproperties-jsmodule-pageproperties-upload' )
					};
				}
				break;

			case 'OO.ui.MultilineTextInputWidget':
				if ( !( 'autosize' in config ) ) {
					config.autosize = true;
				}
				if ( !( 'rows' in config ) ) {
					config.rows = 2;
				}
				break;

			case 'OO.ui.TagMultiselectWidget':
				if ( !( 'allowArbitrary' in config ) ) {
					config.allowArbitrary = true;
				}
				break;

			default:
				// @TODO find a better solution
				if ( arr.length === 4 ) {
					var value = arr.pop();
					switch ( arr[ 2 ] ) {
						case 'TitleInputWidget':
						case 'TitlesMultiselectWidget':
							// titleNamespace( value );
							config.namespace = parseInt(
								PagePropertiesFunctions.getKeyByValue(
									mw.config.get( 'wgFormattedNamespaces' ),
									value
								)
							);
							break;
						case 'TextInputWidget':
							if ( !( 'type' in config ) ) {
								config.type = value;
							}
							break;
						case 'DateInputWidget':
							if ( !( 'precision' in config ) ) {
								config.precision = value;
							}
							break;
					}
				}
		}

		if ( !constructor ) {
			constructor =
				inputName.indexOf( 'OO.ui' ) === 0 ? OO.ui[ arr[ 2 ] ] : mw.widgets[ arr[ 2 ] ];
		}

		// fallback
		if ( typeof constructor !== 'function' ) {
			return new OO.ui.TextInputWidget( config );
		}

		if ( inputName === 'OO.ui.HiddenInputWidget' ) {
			constructor.prototype.getValue = function () {
				return config.value;
			};
		}
		// var widget = new constructor( config );
		var widget = addRequiredMixin( constructor, config, required );

		if ( Array.isArray( tags ) ) {
			for ( var value of tags ) {
				widget.addTag( value );
			}
		}

		return widget;
	}

	function addRequiredMixin( constructor, config, required ) {
		if ( !required ) {
			return new constructor( config );
		}
		var Input = function ( configInput ) {
			Input.super.call(
				this,
				jQuery.extend( configInput, { indicator: 'required' } )
			);
			this.constructorName = constructor.name;
		};

		OO.inheritClass( Input, constructor );
		OO.mixinClass( Input, OO.ui.mixin.IndicatorElement );

		return new Input( config );
	}

	function getPreferredInput( schema ) {
		if ( !( 'wiki' in schema ) ) {
			schema.wiki = {};
		}

		if ( 'preferred-input' in schema.wiki ) {
			return schema.wiki[ 'preferred-input' ];
		}

		var SMWProperty = getSMWProperty( schema.wiki );

		if ( SMWProperty ) {
			return PagePropertiesSMW.getAvailableInputs( SMWProperty.type )[ 0 ];
		}

		if ( 'type' in schema && schema.type !== '' ) {
			return getAvailableInput( schema.type, schema.format || null )[ 0 ];
		}

		// fall-back
		return 'OO.ui.TextInputWidget';
	}

	function inArray( val, arr ) {
		return arr.indexOf( val ) !== -1;
	}

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

	function renameObjectKey( obj, oldKey, newKey ) {
		// delete jQuery.extend( o, { [ newKey ]: o[ oldKey ] } )[ oldKey ];
		// var keys = Object.keys( obj );
		// var res = keys.reduce( ( acc, key ) => {
		// 	var value = obj[ key ];
		// 	if ( key === oldKey ) {
		// 		key = newKey;
		// 	}
		// 	acc[ key ] = value;
		// 	return acc;
		// }, {} );
		var ret = {};
		for ( var i in obj ) {
			var k = i !== oldKey ? i : newKey;
			ret[ k ] = obj[ i ];
			delete obj[ i ];
		}
		for ( var i in ret ) {
			obj[ i ] = ret[ i ];
		}
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
		return path.reduce( ( xs, x ) => ( xs && xs[ x ] ? xs[ x ] : null ), obj );
	}

	function isObject( obj ) {
		return obj !== null && typeof obj === 'object' && !Array.isArray( obj );
	}

	// https://stackoverflow.com/questions/5072136/javascript-filter-for-objects
	function filterObject( obj, predicate ) {
		return (
			Object.keys( obj )
				.filter( ( key ) => predicate( obj[ key ] ) )
				// eslint-disable-next-line no-sequences
				.reduce( ( res, key ) => ( ( res[ key ] = obj[ key ] ), res ), {} )
		);
	}

	function OOUIAlert( text, options, callback, args ) {
		var windowManager = createWindowManager();
		windowManager.addWindows( [ new OO.ui.MessageDialog() ] );

		var obj = { message: text };

		if ( !callback ) {
			obj.actions = [ OO.ui.MessageDialog.static.actions[ 0 ] ];
		}

		// @TODO or return promise
		return windowManager
			.openWindow( 'message', $.extend( obj, options ) )
			.closed.then( function ( action ) {
				return action.action === 'accept' && callback ?
					callback.apply( this, args ) :
					undefined;
			} );
	}

	function decodeHTMLEntities( text ) {
		var el = document.createElement( 'textarea' );
		el.innerHTML = text;
		return el.value;
	}

	function createNewKey( obj, msg ) {
		var n = 0;
		var msg = msg.replace( / /g, '_' ).toLowerCase();
		do {
			var str = msg;
			if ( n > 0 ) {
				str = str + '_' + n;
			}
			n++;
		} while ( str in obj );

		return str;
	}

	function createNewLabel( obj, msg ) {
		var n = 0;
		do {
			var label = msg;
			if ( n > 0 ) {
				label = label + ' (' + n + ')';
			}
			n++;
		} while ( label in obj );

		return label;
	}

	function MockupOOUIClass( value ) {
		var Value = value;
		function getValue() {
			return Value;
		}
		function setValue( val ) {
			Value = val;
		}
		return {
			getValue,
			setValue
		};
	}

	function createDropDownOptions( array, config ) {
		var config = jQuery.extend( { key: 'key', value: 'value' }, config || {} );
		var ret = [];
		for ( var i in array ) {
			var label = config.value === 'value' ? array[ i ] : i;
			var key = config.key === 'key' ? i : array[ i ];
			if ( key === '' ) {
				// zero width space
				label = '​';
			}
			ret.push( {
				data: key,
				label: label
			} );
		}
		return ret;
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
		filterObject,
		isObject,
		OOUIAlert,
		createNewLabel,
		createNewKey,
		MockupOOUIClass,
		createDropDownOptions,
		inputNameFromLabel,
		optionsInputs,
		getAvailableInputs,
		inputInstanceFromName,
		isMultiselect,
		matchLoadedData,
		loadData,
		getPreferredInput,
		lookupInputs,
		labelFormulaInputs,
		castType,
		decodeHTMLEntities
	};
}() );
