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

// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/toolbars.js

const PageProperties = ( function () {
	var SemanticProperties;
	var Properties;
	var CanManageProperties;

	var Model;
	var PanelProperties;
	var DataTable;
	var myStack;

	function inArray( val, arr ) {
		return jQuery.inArray( val, arr ) !== -1;
	}

	function isMultiselect( inputName ) {
		// return inArray(inputName, ManageProperties.multiselectInputs))
		return inputName.indexOf( 'Multiselect' ) !== -1;
	}

	function getPropertyValue( property ) {
		if ( property in Model ) {
			var ret = [];
			for ( var i in Model[ property ] ) {
				var inputWidget = Model[ property ][ i ];
				var value = inputWidget.getValue();
				if ( Array.isArray( value ) ) {
					return value;
				}
				ret.push( value );
			}
			return ret;
		}
		return Properties[ property ];
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

	function inputIsEmpty( inputWidget ) {
		var value = inputWidget.getValue();

		if ( Array.isArray( value ) ) {
			for ( var i in value ) {
				if ( value[ i ].trim() === '' ) {
					delete value[ i ];
				}
			}
			return value.length === 0;
		}

		if ( typeof value === 'string' ) {
			value = value.trim() !== '';
		}

		return value === false;
	}

	function getInputWidget( inputName, property, index, value ) {
		if ( Array.isArray( value ) ) {
			for ( var i in value ) {
				if ( value[ i ].trim() === '' ) {
					delete value[ i ];
				} else if ( inputName === 'mw.widgets.UsersMultiselectWidget' ) {
					// @todo, use localized namespace
					value[ i ] = value[ i ].replace( /^User:/, '' );
				}
			}
		} else if ( inputName === 'mw.widgets.UserInputWidget' ) {
			// @todo, use localized namespace
			value = value.replace( /^User:/, '' );
		}

		switch ( inputName ) {
			case 'OO.ui.ToggleSwitchWidget':
				value = value === '1';
				break;
		}

		var config = {
			// workaround for this issue https://www.php.net/manual/en/language.variables.external.php
			// otherwise we don't kwnow when to remove underscores ...
			name:
				'semantic-properties-input-' +
				encodeURIComponent( property ) +
				'-' +
				index,
			value: value
		};

		if ( isMultiselect( inputName ) ) {
			config.selected = value;
			config.allowArbitrary = true;
		}

		// see here https://www.semantic-mediawiki.org/wiki/Help:Special_property_Allows_value
		// SemanticMediaWiki/src/DataValues/ValueValidator/AllowsListConstraintValueValidator.php
		if ( inArray( inputName, ManageProperties.optionsInputs ) ) {
			if ( '_PVAL' in SemanticProperties[ property ].properties ) {
				config.options = ManageProperties.createInputOptions(
					// eslint-disable-next-line no-underscore-dangle
					SemanticProperties[ property ].properties._PVAL,
					{
						key: 'value'
					}
				);
			}
		}

		return ManageProperties.inputInstanceFromName( inputName, config );
	}

	function getModel( submit ) {
		var ret = {};

		for ( var property in Model ) {
			ret[ property ] = [];
			for ( var i in Model[ property ] ) {
				var value = Model[ property ][ i ].getValue();

				if ( Array.isArray( value ) ) {
					ret[ property ] = value;
				} else {
					ret[ property ].push( value );
				}

				// replace multi values inputs with single inputs
				// for each value
				if ( submit ) {
					// OoUiTagMultiselectWidget => OO.ui.TagMultiselectWidget
					// MwWidgetsUsersMultiselectWidget => mw.widgets.UsersMultiselectWidget

					var inputNameAttr =
						'semantic-properties-input-' + encodeURIComponent( property ) + '-';

					var inputEl = $( ":input[name='" + ( inputNameAttr + i ) + "']" );

					var inputName = Model[ property ][ i ].constructor.name
						.replace( /^OoUi/, 'OO.ui.' )
						.replace( /^MwWidgets/, 'mw.widgets.' );

					let prefix = '';
					switch ( inputName ) {
						case 'mw.widgets.UsersMultiselectWidget':
						case 'mw.widgets.UserInputWidget':
							// @todo, use localized namespace
							prefix = 'User:';
							break;
					}

					if ( typeof value === 'boolean' ) {
						value = value ? 1 : 0;
					}

					var inputValue = Array.isArray( value ) ?
						value.map( ( x ) => prefix + x ) :
						prefix + value;

					var inputVal = Array.isArray( inputValue ) ? inputValue[ 0 ] : inputValue;

					if ( !inputEl.get( 0 ) ) {
						$( '<input>' )
							.attr( {
								type: 'hidden',
								name: inputNameAttr + i,
								value: inputVal
							} )
							.appendTo( '#pageproperties-form' );

						// override the value of the existing input
					} else if ( prefix || isMultiselect( inputName ) ) {
						inputEl.val( inputVal );
					}

					// create inputs for all other values
					if ( isMultiselect( inputName ) && inputValue.length > 1 ) {
						for ( var ii = 1; ii < inputValue.length; ii++ ) {
							$( '<input>' )
								.attr( {
									type: 'hidden',
									name: inputNameAttr + ii,
									value: inputValue[ ii ]
								} )
								.appendTo( '#pageproperties-form' );
						}
					}
				}
			}
		}

		return ret;
	}

	var ListWidget = function ListWidget( config ) {
		config = config || {};

		// Call parent constructor
		ListWidget.super.call( this, config );

		OO.ui.mixin.GroupWidget.call(
			this,
			$.extend(
				{
					$group: this.$element
				},
				config
			)
		);

		this.aggregate( {
			delete: 'itemDelete'
		} );

		this.connect( this, {
			itemDelete: 'onItemDelete'
		} );
	};

	OO.inheritClass( ListWidget, OO.ui.Widget );
	OO.mixinClass( ListWidget, OO.ui.mixin.GroupWidget );

	ListWidget.prototype.onItemDelete = function ( itemWidget ) {
		if ( itemWidget.parentWidget ) {
			if (
				!inputIsEmpty(
					Model[ itemWidget.parentWidget.property ][ itemWidget.index ]
				) &&
				// eslint-disable-next-line no-alert
				!confirm(
					mw.msg( 'pageproperties-jsmodule-pageproperties-delete-confirm' )
				)
			) {
				return;
			}

			this.removeItems( [ itemWidget ] );
			delete Model[ itemWidget.parentWidget.property ][ itemWidget.index ];
			// delete Properties[itemWidget.parentWidget.property][itemWidget.index];

			if ( this.getItems().length === 0 ) {
				itemWidget.parentWidget.onDeleteButtonClick();
			}
			return;
		}

		if (
			( itemWidget.optionsList && !itemWidget.optionsList.getItems().length ) ||
			// eslint-disable-next-line no-alert
			confirm( mw.msg( 'pageproperties-jsmodule-pageproperties-delete-confirm' ) )
		) {
			this.removeItems( [ itemWidget ] );
			delete Model[ itemWidget.property ];
			delete Properties[ itemWidget.property ];
			PanelProperties.messageWidget.toggle(
				!PanelProperties.optionsList.getItems().length
			);
		}
	};

	ListWidget.prototype.addItems = function ( items, index ) {
		if ( !items || !items.length ) {
			return this;
		}

		OO.ui.mixin.GroupWidget.prototype.addItems.call( this, items, index );
		this.emit(
			'add',
			items,
			index === undefined ? this.items.length - items.length - 1 : index
		);

		return this;
	};

	ListWidget.prototype.removeItems = function ( items ) {
		OO.ui.mixin.GroupWidget.prototype.removeItems.call( this, items );
		this.emit( 'remove', items );
		return this;
	};

	ListWidget.prototype.clearItems = function () {
		var items = this.items.slice();
		OO.ui.mixin.GroupWidget.prototype.clearItems.call( this );
		this.emit( 'remove', items );
		return this;
	};

	var InnerItemWidget = function ( config ) {
		config = config || {};
		InnerItemWidget.super.call( this, config );

		this.parentWidget = config.parentWidget;
		this.index = config.index;

		OO.ui.mixin.GroupWidget.call(
			this,
			$.extend(
				{
					$group: this.$element
				},
				config
			)
		);

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		var deleteButton = new OO.ui.ButtonWidget( {
			icon: 'trash',
			flags: [ 'destructive' ]
		} );

		var inputWidget = getInputWidget(
			config.inputName,
			config.property,
			config.index,
			config.value
		);

		Model[ config.property ][ config.index ] = inputWidget;

		fieldset.addItems( [
			// eslint-disable-next-line mediawiki/class-doc
			new OO.ui.ActionFieldLayout( inputWidget, deleteButton, {
				label: '',
				align: 'top',

				// The following classes are used here:
				// * inputName-mw.widgets.DateInputWidget
				classes: [ 'inputName-' + config.inputName ]
			} )
		] );

		this.$element.append( fieldset.$element );

		deleteButton.connect( this, {
			click: 'onDeleteButtonClick'
		} );
	};

	OO.inheritClass( InnerItemWidget, OO.ui.Widget );
	OO.mixinClass( InnerItemWidget, OO.ui.mixin.GroupWidget );

	InnerItemWidget.prototype.onDeleteButtonClick = function () {
		this.emit( 'delete' );
	};

	var ItemWidget = function ( config ) {
		config = config || {};
		ItemWidget.super.call( this, config );

		OO.ui.mixin.GroupWidget.call(
			this,
			$.extend(
				{
					$group: this.$element
				},
				config
			)
		);

		this.property = config.property;

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		var deleteButton = new OO.ui.ButtonWidget( {
			icon: 'trash',
			flags: [ 'destructive' ]
		} );

		var propertyObj = SemanticProperties[ config.property ];

		var inputName;

		if ( '__pageproperties_preferred_input' in propertyObj.properties ) {
			inputName = inputNameFromLabel(
				// eslint-disable-next-line no-underscore-dangle
				propertyObj.properties.__pageproperties_preferred_input[ 0 ]
			);
		} else {
			inputName = inputNameFromLabel(
				ManageProperties.getAvailableInputs( propertyObj.type )[ 0 ]
			);
		}

		var multiple = false;
		if (
			!ManageProperties.disableMultipleFields( propertyObj.type, inputName ) &&
			'__pageproperties_allows_multiple_values' in propertyObj.properties &&
			// eslint-disable-next-line no-underscore-dangle
			propertyObj.properties.__pageproperties_allows_multiple_values
		) {
			multiple = true;
		}

		var optionsList = new ListWidget();
		this.optionsList = optionsList;

		if (
			!( config.property in Properties ) ||
			!Properties[ config.property ].length
		) {
			Properties[ config.property ] = [ '' ];
		}

		var values = getPropertyValue( config.property );

		// if (!(config.property in Model)) {
		Model[ config.property ] = {};
		// }

		if ( !isMultiselect( inputName ) ) {
			for ( var i in values ) {
				optionsList.addItems( [
					new InnerItemWidget( {
						classes: [ 'InnerItemWidget' ],
						property: config.property,
						inputName: inputName,
						// Properties[ config.property ][ i ],
						value: values[ i ],
						parentWidget: this,
						index: optionsList.items.length
					} )
				] );
			}
		} else {
			optionsList.addItems( [
				new InnerItemWidget( {
					classes: [ 'InnerItemWidget' ],
					property: config.property,
					inputName: inputName,
					// Properties[ config.property ],
					value: values,
					parentWidget: this,
					index: optionsList.items.length
				} )
			] );
		}

		if ( CanManageProperties ) {
			var editButton = new OO.ui.ButtonWidget( {
				icon: 'settings',
				flags: [ 'progressive' ]
			} );

			editButton.on( 'click', function () {
				ManageProperties.openDialog( config.property );
			} );

			var items = [
				// eslint-disable-next-line mediawiki/class-doc
				new OO.ui.ActionFieldLayout( optionsList, editButton, {
					label: config.property,
					align: 'top',

					// The following classes are used here:
					// * inputName-mw.widgets.DateInputWidget
					classes: [ 'inputName-' + inputName ]
				} )
			];
		} else {
			var items = [
				// eslint-disable-next-line mediawiki/class-doc
				new OO.ui.FieldLayout( optionsList, {
					label: config.property,
					align: 'top',

					// The following classes are used here:
					// * inputName-mw.widgets.DateInputWidget
					classes: [ 'inputName-' + inputName ]
				} )
			];
		}

		if ( multiple ) {
			var addOption = new OO.ui.ButtonWidget( {
				// label: "add field",
				icon: 'add'
			} );

			var that = this;
			addOption.on( 'click', function () {
				optionsList.addItems( [
					new InnerItemWidget( {
						classes: [ 'InnerItemWidget' ],
						property: config.property,
						inputName: inputName,
						value: '',
						parentWidget: that,
						index: optionsList.items.length
					} )
				] );
			} );
			items.push( addOption );
		}

		fieldset.addItems( items );

		this.$element.append( fieldset.$element );

		deleteButton.connect( this, {
			click: 'onDeleteButtonClick'
		} );
	};

	OO.inheritClass( ItemWidget, OO.ui.Widget );
	OO.mixinClass( ItemWidget, OO.ui.mixin.GroupWidget );

	ItemWidget.prototype.onDeleteButtonClick = function () {
		this.emit( 'delete' );
	};

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

	// https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.Toolbar

	function createToolbarA() {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
		} );

		var onSelectProperty = function () {
			var selectedProperty = this.getTitle();

			PanelProperties.addProperty( selectedProperty );

			this.setActive( false );
		};

		var accelerator = {};
		var toolGroup = [];
		for ( var i in SemanticProperties ) {
			var value = SemanticProperties[ i ];
			// name, icon, title, onSelect, flags, narrowConfig, init,displayBothIconAndLabel
			toolGroup.push( [ value.key, null, i, onSelectProperty ] );
			accelerator[ value.key ] = value.typeLabel;
		}

		toolbar.getToolAccelerator = function getToolAccelerator( name ) {
			return accelerator[ name ];
		};

		createToolGroup( toolFactory, 'groupA', toolGroup );

		var onSelect = function () {
			var toolName = this.getName();

			switch ( toolName ) {
				case 'createproperty':
					ManageProperties.openDialog();
					break;
			}

			this.setActive( false );
		};

		if ( CanManageProperties ) {
			var toolGroup = [
				[
					'createproperty',
					'add',
					mw.msg( 'pageproperties-jsmodule-pageproperties-create-property' ),
					onSelect
				]
			];
			createToolGroup( toolFactory, 'groupB', toolGroup );
		}

		// Finally define which tools and in what order appear in the toolbar. Each tool may only be
		// used once (but not all defined tools must be used).
		toolbar.setup( [
			{
				type: 'list',
				label: mw.msg( 'pageproperties-jsmodule-pageproperties-add-property' ),
				include: [ { group: 'groupA' } ]
			},
			{
				include: [ { group: 'groupB' } ]
			}

			// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/toolbars.js
			/*
{
			name: 'editorSwitch',
			align: 'after',
			type: 'list',
			label: 'Switch editor',
			invisibleLabel: true,
			icon: 'edit',
			include: [ { group: 'editorSwitchTools' } ]
		},
*/
		] );

		return toolbar;
	}

	function createToolbarB() {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
		} );

		var onSelect = function () {
			var toolName = this.getName();

			switch ( toolName ) {
				case 'createproperty':
					ManageProperties.openDialog();
					break;
			}

			this.setActive( false );
		};

		var toolGroup = [
			[
				'createproperty',
				'add',
				mw.msg( 'pageproperties-jsmodule-pageproperties-create-property' ),
				onSelect
			]
		];
		createToolGroup( toolFactory, 'group', toolGroup );

		toolbar.setup( [
			{
				// name: "format",
				// type: "bar",
				// label: "Create property",
				include: [ { group: 'group' } ]
			}
		] );

		return toolbar;
	}

	function createActionToolbar( panel ) {
		// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/refs/tags/v0.40.4/demos/pages/toolbars.js

		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: false
		} );

		var onSelectSwitch = function () {
			var selected = this.getName();

			if ( panel.getData().name === selected ) {
				myStack.setItem( panel );
			}

			this.setActive( false );
		};

		var toolGroup = [
			[
				'pageproperties',
				null,
				mw.msg( 'pageproperties-jsmodule-pageproperties-page-properties' ),
				onSelectSwitch
			],
			[
				'manageproperties',
				null,
				mw.msg( 'pageproperties-jsmodule-pageproperties-manage-properties' ),
				onSelectSwitch
			]
			// ["forms", "null", "Forms", onSelectSwitch],
		];
		createToolGroup( toolFactory, 'selectSwitch', toolGroup );

		toolbar.setup( [
			// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/toolbars.js
			{
				name: 'editorSwitch',
				align: 'after',
				type: 'list',
				label: 'Switch editor',
				invisibleLabel: true,
				icon: 'edit',
				include: [ { group: 'selectSwitch' } ]
			}
		] );

		return toolbar;
	}

	function PanelLayout( name, config ) {
		PanelLayout.super.call( this, name, config );

		this.messageWidget = new OO.ui.MessageWidget( {
			type: 'notice',
			label: new OO.ui.HtmlSnippet(
				mw.msg( 'pageproperties-jsmodule-pageproperties-no-properties' )
			)
		} );
		this.optionsList = new ListWidget();
		this.populateFieldset();

		this.$element.append( this.optionsList.$element );
		this.$element.append( this.messageWidget.$element );
	}

	OO.inheritClass( PanelLayout, OO.ui.PanelLayout );
	PanelLayout.prototype.populateFieldset = function () {
		this.optionsList.clearItems();

		Properties = sortObjectByKeys( Properties );

		for ( var i in Properties ) {
			this.optionsList.addItems( [
				new ItemWidget( {
					classes: [ 'ItemWidget' ],
					property: i
				} )
			] );
		}

		this.messageWidget.toggle( !this.optionsList.getItems().length );
	};

	PanelLayout.prototype.addProperty = function ( property ) {
		if ( !( property in Properties ) ) {
			Properties[ property ] = [ '' ];
		}

		this.populateFieldset();
	};

	function updatePropertiesPanel( data ) {
		Properties = getModel();

		switch ( data[ 'result-action' ] ) {
			case 'update':
				SemanticProperties = jQuery.extend(
					SemanticProperties,
					data[ 'semantic-properties' ]
				);
				break;
			case 'delete':
				for ( var property of data[ 'deleted-properties' ] ) {
					delete SemanticProperties[ property ];
					// delete Model[property];
					delete Properties[ property ];
				}
				break;

			case 'create':
				for ( var property in data[ 'semantic-properties' ] ) {
					Properties[ property ] = [ '' ];
				}
				SemanticProperties = jQuery.extend(
					SemanticProperties,
					data[ 'semantic-properties' ]
				);
				SemanticProperties = sortObjectByKeys( SemanticProperties );
				break;

			case 'rename':
				delete SemanticProperties[ data[ 'previous-label' ] ];
				// delete Model[data["previous-label"]];

				SemanticProperties = jQuery.extend(
					SemanticProperties,
					data[ 'semantic-properties' ]
				);
				SemanticProperties = sortObjectByKeys( SemanticProperties );
				if ( data[ 'previous-label' ] in Properties ) {
					renameObjectKey( Properties, data[ 'previous-label' ], data.label );
				}
				break;
		}

		// update toolbar
		// ...
		// PanelProperties.populateFieldset();

		ManageProperties.loadData( SemanticProperties );
		initialize();

		return true;
	}

	function initializeDataTable() {
		var data = [];

		for ( var i in SemanticProperties ) {
			var value = SemanticProperties[ i ];
			data.push( [
				i,
				value.typeLabel,
				'_IMPO' in value.properties ?
					// eslint-disable-next-line no-underscore-dangle
					value.properties._IMPO.slice( -1 )[ 0 ] :
					'',
				value.description
			] );
		}

		DataTable = $( '#pageproperties-datatable' ).DataTable( {
			order: 1,
			pageLength: 20,

			// https://datatables.net/reference/option/dom
			dom: '<"pageproperties-datatable-left"f><"pageproperties-datatable-right"l>rtip',

			lengthMenu: [ 10, 20, 50, 100, 200 ],
			// lengthChange: false,
			data: data,
			stateSave: true,
			columns: mw
				.msg( 'pageproperties-jsmodule-pageproperties-columns' )
				.split( /\s*,\s*/ )
				.map( function ( x ) {
					return { title: x };
				} )
			// buttons: ["copy", "excel", "pdf"],
			// select: true,
		} );

		DataTable.on( 'click', 'tr', function () {
			var index = DataTable.row( this ).index();
			var label = data[ index ][ 0 ];

			ManageProperties.openDialog( label );
		} );
	}

	function initialize( canManageProperties, semanticProperties, properties ) {
		var selectedPanelName = null;
		Model = {};

		if ( myStack ) {
			selectedPanelName = myStack.getCurrentItem().getData().name;
			$( '#semantic-properties-wrapper' ).empty();
		}

		if ( arguments.length ) {
			CanManageProperties = canManageProperties;
			SemanticProperties = semanticProperties;
			Properties = properties;
		}

		PanelProperties = new PanelLayout( {
			expanded: false,
			padded: true,
			classes: [ 'PanelProperties' ]
		} );

		var toolbarA = createToolbarA();

		var frameA = new OO.ui.PanelLayout( {
			$content: [ toolbarA.$element, PanelProperties.$element ],
			expanded: false,
			framed: true,
			data: { name: 'pageproperties' }
		} );

		// https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/layouts.js

		var toolbarB = createToolbarB();

		var contentFrameB = new OO.ui.PanelLayout( {
			$content: $(
				'<table id="pageproperties-datatable" class="display" width="100%"></table>'
			),
			expanded: false,
			padded: true
		} );

		var frameB = new OO.ui.PanelLayout( {
			$content: [ toolbarB.$element, contentFrameB.$element ],
			expanded: false,
			framed: true,
			data: { name: 'manageproperties' }
		} );

		myStack = new OO.ui.StackLayout( {
			items: [ frameA, frameB ],
			expanded: true,
			continuous: false
		} );

		if ( selectedPanelName === 'manageproperties' ) {
			myStack.setItem( frameB );
		}

		if ( CanManageProperties ) {
			var actionToolbar = createActionToolbar( frameB );

			toolbarA.$actions.append( actionToolbar.$element );

			var actionToolbar = createActionToolbar( frameA );
			toolbarB.$actions.append( actionToolbar.$element );
		}

		// myStack.addItems([frameA, frameB])

		$( '#semantic-properties-wrapper' ).append( myStack.$element );

		toolbarA.initialize();
		toolbarA.emit( 'updateState' );

		toolbarB.initialize();
		toolbarB.emit( 'updateState' );

		initializeDataTable();
	}

	return {
		initialize,
		updatePropertiesPanel,
		inputNameFromLabel,
		getModel
	};
}() );

$( document ).ready( function () {
	var semanticProperties = JSON.parse(
		mw.config.get( 'pageproperties-semanticProperties' )
	);
	var properties = JSON.parse( mw.config.get( 'pageproperties-properties' ) );

	var canManageProperties = !!mw.config.get(
		'pageproperties-canManageProperties'
	);

	// console.log(semanticProperties);
	// console.log(properties);

	PageProperties.initialize(
		canManageProperties,
		semanticProperties,
		properties
	);

	if ( canManageProperties ) {
		ManageProperties.loadData( semanticProperties );
	}

	$( '#pageproperties-form' ).submit( function () {
		// *** the following isn't necessary, since the inputs
		// are already appended to the form
		// see function getInputWidget()

		// eslint-disable-next-line no-unused-vars
		var obj = PageProperties.getModel( true );

		/*
		var obj = PageProperties.getModel()

		var n = 0
		// create legacy data structure
		for( var property in obj ) {
			for( var ii in obj[property] ) {
				$('<input>').attr({
					type: 'hidden',
					name: 'dynamictable_semantic-properties_key_' + n,
					value: property
				}).appendTo('#pageproperties-form');

				$('<input>').attr({
					type: 'hidden',
					name: 'dynamictable_semantic-properties_value_' + n,
					value: obj[property][ii]
				}).appendTo('#pageproperties-form');

				n++
			}

		}

		console.log("obj", obj);
		*/

		// return false;
	} );

	// display every 3 days
	if (
		canManageProperties &&
		!mw.cookie.get( 'pageproperties-check-latest-version' )
	) {
		mw.loader.using( 'mediawiki.api', function () {
			new mw.Api()
				.postWithToken( 'csrf', {
					action: 'pageproperties-check-latest-version'
				} )
				.done( function ( res ) {
					if ( 'pageproperties-check-latest-version' in res ) {
						if ( res[ 'pageproperties-check-latest-version' ].result === 2 ) {
							var messageWidget = new OO.ui.MessageWidget( {
								type: 'warning',
								label: new OO.ui.HtmlSnippet(
									mw.msg(
										'pageproperties-jsmodule-pageproperties-outdated-version'
									)
								),
								// *** this does not work before ooui v0.43.0
								showClose: true
							} );
							var closeFunction = function () {
								var three_days = 3 * 86400;
								mw.cookie.set( 'pageproperties-check-latest-version', true, {
									path: '/',
									expires: three_days
								} );
								$( messageWidget.$element ).parent().remove();
							};
							messageWidget.on( 'close', closeFunction );
							$( '#pageproperties-form' ).prepend(
								$( '<div><br/></div>' ).prepend( messageWidget.$element )
							);
							if (
								!messageWidget.$element.hasClass(
									'oo-ui-messageWidget-showClose'
								)
							) {
								messageWidget.$element.addClass(
									'oo-ui-messageWidget-showClose'
								);
								var closeButton = new OO.ui.ButtonWidget( {
									classes: [ 'oo-ui-messageWidget-close' ],
									framed: false,
									icon: 'close',
									label: OO.ui.msg( 'ooui-popup-widget-close-button-aria-label' ),
									invisibleLabel: true
								} );
								closeButton.on( 'click', closeFunction );
								messageWidget.$element.append( closeButton.$element );
							}
						}
					}
				} );
		} );
	}
} );
