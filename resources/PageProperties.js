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

	// eslint-disable-next-line no-unused-vars
	var CanManageProperties;
	var Model;
	var OuterStack;
	var ManagePropertiesSpecialPage;
	var DialogSearchName = 'dialogSearch';
	var WindowManagerSearch;
	var Forms;
	var SetForms;
	var TargetPage;
	var PropertiesStack;
	var IsNewPage;
	var PageContent;
	var PageCategories;
	var processDialogSearch;

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

	function getInputWidget( inputName, property, index, value, required ) {
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
			value: value,
			required: required
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

	function getSetForms() {
		return SetForms;
	}

	function getPageCategories() {
		return PageCategories;
	}

	function getModel( submit ) {
		var ret = {};

		var propertiesInForms = getPropertiesInForms();
		for ( var property in Model ) {
			if ( !submit && property.indexOf( '__' ) === 0 ) {
				continue;
			}
			// ignore deleted properties
			if ( !inArray( property, propertiesInForms ) && !( property in Properties ) ) {
				continue;
			}
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
						// } else if ( prefix || isMultiselect( inputName ) ) {
					} else {
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

	function getPropertiesInForms() {
		var ret = [];

		for ( var form of SetForms ) {
			for ( var i in Forms[ form ].fields ) {
				ret.push( i );
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

			var length = this.getItems().length;

			if ( length > 1 ) {
				this.removeItems( [ itemWidget ] );
				delete Model[ itemWidget.parentWidget.property ][ itemWidget.index ];
			} else {
				Model[ itemWidget.parentWidget.property ][ itemWidget.index ].setValue( '' );
			}

			if ( length === 0 ) {
				itemWidget.parentWidget.onDeleteButtonClick();
			}
			return;
		}

		// currently unused (deletion of single properties through delete icon)
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

		var deleteButton = new OO.ui.ButtonWidget( {
			icon: 'close'
			// flags: ["destructive"],
		} );

		var required =
			config.form &&
			'required' in Forms[ config.form ].fields[ config.property ] &&
			Forms[ config.form ].fields[ config.property ].required === true;

		var inputWidget = getInputWidget(
			config.inputName,
			config.property,
			config.index,
			config.value,
			required
		);

		Model[ config.property ][ config.index ] = inputWidget;

		var helpMessage = '';
		if ( config.last ) {
			if (
				config.form &&
				'help-message' in Forms[ config.form ].fields[ config.property ]
			) {
				var source = Forms[ config.form ].fields[ config.property ];
				if ( source[ 'help-message-result' ] ) {
					helpMessage = source[ 'help-message-result' ];
				} else {
					helpMessage = source[ 'help-message' ];

					if ( Array.isArray( helpMessage ) ) {
						helpMessage = helpMessage[ 0 ];
					}
				}
			} else if ( SemanticProperties[ config.property ].description ) {
				helpMessage = SemanticProperties[ config.property ].description;
			}
		}

		var widget = config.multiple ?
			new OO.ui.ActionFieldLayout( inputWidget, deleteButton, {
				label: '',
				align: 'top',
				help: helpMessage,
				helpInline: true,
				// This can produce:
				// * inputName-mw.widgets.DateInputWidget
				// * inputName-mw.widgets...
				classes: [ 'inputName-' + config.inputName ]
			} ) :
			new OO.ui.FieldLayout( inputWidget, {
				label: '',
				align: 'top',
				help: helpMessage,
				helpInline: true,
				// This can produce:
				// * inputName-mw.widgets.DateInputWidget
				// * inputName-mw.widgets...
				classes: [ 'inputName-' + config.inputName ]
			} );

		this.$element.append( widget.$element );

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

		var deleteButton = new OO.ui.ButtonWidget( {
			icon: 'trash',
			flags: [ 'destructive' ]
		} );

		var propertyObj = SemanticProperties[ config.property ];

		var inputName;

		if (
			'form' in config &&
			'preferred-input' in Forms[ config.form ].fields[ config.property ]
		) {
			inputName = Forms[ config.form ].fields[ config.property ][ 'preferred-input' ];
		} else if ( '__pageproperties_preferred_input' in propertyObj.properties ) {
			inputName = ManageProperties.inputNameFromLabel(
				// eslint-disable-next-line no-underscore-dangle
				propertyObj.properties.__pageproperties_preferred_input[ 0 ]
			);
		} else {
			inputName = ManageProperties.inputNameFromLabel(
				ManageProperties.getAvailableInputs( propertyObj.type )[ 0 ]
			);
		}

		var multiple = false;

		if (
			'form' in config &&
			'multiple' in Forms[ config.form ].fields[ config.property ] &&
			Forms[ config.form ].fields[ config.property ].multiple !== ''
		) {
			multiple = Forms[ config.form ].fields[ config.property ].multiple;
		} else if (
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

		Model[ config.property ] = {};

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
						index: optionsList.items.length,
						multiple: multiple,
						form: config.form,
						last: i === values.length - 1
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
					index: optionsList.items.length,
					multiple: false,
					form: config.form,
					last: i === values.length - 1
				} )
			] );
		}

		// if (CanManageProperties) {
		// eslint-disable-next-line no-constant-condition
		if ( false ) {
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
						index: optionsList.items.length,
						multiple: multiple,
						last: true
					} )
				] );
			} );
			items.push( addOption );
		}

		// fieldset.addItems(items);

		for ( var item of items ) {
			this.$element.append( item.$element );
		}

		deleteButton.connect( this, {
			click: 'onDeleteButtonClick'
		} );
	};

	OO.inheritClass( ItemWidget, OO.ui.Widget );
	OO.mixinClass( ItemWidget, OO.ui.mixin.GroupWidget );

	ItemWidget.prototype.onDeleteButtonClick = function () {
		this.emit( 'delete' );
	};

	// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/classes/SearchWidgetDialog.js
	function ProcessDialogSearch( config ) {
		ProcessDialogSearch.super.call( this, config );
	}
	OO.inheritClass( ProcessDialogSearch, OO.ui.ProcessDialog );
	ProcessDialogSearch.static.name = DialogSearchName;
	ProcessDialogSearch.static.title = mw.msg(
		'pageproperties-jsmodule-forms-selectfield'
	);
	ProcessDialogSearch.prototype.initialize = function () {
		ProcessDialogSearch.super.prototype.initialize.apply( this, arguments );
		var self = this;
		var isSelected;
		var values;
		function getItems( value ) {
			switch ( self.data.toolName ) {
				case 'addremoveproperties':
					values = Object.keys( SemanticProperties );
					values = values.filter( ( x ) => !inArray( x, getPropertiesInForms() ) );
					isSelected = function ( value_ ) {
						return value_ in Properties;
					};
					break;
				case 'addremoveforms':
					values = Object.keys( Forms );
					isSelected = function ( value_ ) {
						return inArray( value_, SetForms );
					};
					break;
			}

			if ( value ) {
				var valueLowerCase = value.toLowerCase();
				values = values.filter(
					( x ) => x.toLowerCase().indexOf( valueLowerCase ) !== -1
				);
			}

			return values.map( ( x ) => {
				var menuOptionWidget = new OO.ui.MenuOptionWidget( {
					data: x,
					label: x,
					selected: isSelected( x )
				} );

				if ( self.data.toolName === 'addremoveproperties' ) {
					menuOptionWidget.$element.append(
						$(
							'<span class="oo-ui-labelElement-label right">' +
								SemanticProperties[ x ].typeLabel +
								'</span>'
						)
					);
				}
				return menuOptionWidget;
			} );
		}

		var searchWidget = new OO.ui.SearchWidget( {
			id: 'pageproperties-import-search-widget'
		} );

		searchWidget.results.addItems( getItems() );
		var self = this;

		// searchWidget.getResults() is a SelectWidget
		// https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.SelectWidget

		this.selectWidget = searchWidget.getResults();

		this.selectWidget.multiselect = true;
		/*
		this.selectWidget.on("press", function (widget) {
			if (!widget) {
				return;
			}
		});
*/
		searchWidget.onQueryChange = function ( value ) {
			searchWidget.results.clearItems();
			searchWidget.results.addItems( getItems( value ) );
		};

		this.$body.append( [ searchWidget.$element ] );
	};

	ProcessDialogSearch.prototype.getBodyHeight = function () {
		return 300;
	};

	ProcessDialogSearch.static.actions = [
		{
			action: 'save',
			modes: 'edit',
			label: mw.msg( 'pageproperties-jsmodule-forms-searchdialog-save' ),
			flags: [ 'primary', 'progressive' ]
		},
		{
			// modes: "edit",
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-cancel' ),
			flags: [ 'safe', 'close' ]
		}
	];
	ProcessDialogSearch.prototype.getActionProcess = function ( action ) {
		var dialog = this;

		if ( action === 'save' ) {
			var items = processDialogSearch.selectWidget.findSelectedItems();
			var values = items.map( ( x ) => x.data );

			switch ( this.data.toolName ) {
				case 'addremoveproperties':
					// remove unselected properties
					for ( var i in Properties ) {
						if ( !inArray( i, values ) ) {
							delete Properties[ i ];
						}
					}

					// add new properties
					for ( var label of values ) {
						if ( !( label in Properties ) ) {
							Properties[ label ] = [ '' ];
						}
					}

					// PropertiesPanel.populateFieldset();
					break;
				case 'addremoveforms':
					var propertiesInForms = getPropertiesInForms();
					for ( var property of propertiesInForms ) {
						if ( !inArray( property, values ) ) {
							delete Properties[ property ];
						}
					}

					SetForms = values;
					break;
			}

			updatePanels();
		}

		return new OO.ui.Process( function () {
			dialog.close( { action: action } );
		} );

		// return ProcessDialog.super.prototype.getActionProcess.call( this, action );
	};
	ProcessDialogSearch.prototype.getTeardownProcess = function ( data ) {
		return ProcessDialogSearch.super.prototype.getTeardownProcess
			.call( this, data )
			.first( function () {
				WindowManagerSearch.removeWindows( [ DialogSearchName ] );
			}, this );
	};

	function openSearchDialog( toolName ) {
		processDialogSearch = new ProcessDialogSearch( {
			size: 'medium',
			classes: [ 'pageproperties-import-dialog' ],
			data: { toolName: toolName }
		} );

		WindowManagerSearch.addWindows( [ processDialogSearch ] );

		WindowManagerSearch.openWindow( processDialogSearch );
	}

	// https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.Toolbar

	function createToolbar() {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
		} );

		var onSelect = function () {
			var toolName = this.getName();

			switch ( toolName ) {
				case 'addremoveforms':
				case 'addremoveproperties':
					openSearchDialog( toolName );
					break;
			}

			this.setActive( false );
		};

		var toolGroup = [
			{
				name: 'addremoveforms',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-pageproperties-addremoveforms' ),
				onSelect: onSelect
			},
			{
				name: 'addremoveproperties',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-forms-addremoveproperties' ),
				onSelect: onSelect
			}
		];
		PagePropertiesFunctions.createToolGroup( toolFactory, 'group', toolGroup );

		toolbar.setup( [
			{
				name: 'my-group',
				// type: "bar",
				// label: "Create property",
				include: [ { group: 'group' } ]
			}
		] );

		return toolbar;
	}

	function createActionToolbar() {
		// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/refs/tags/v0.40.4/demos/pages/toolbars.js

		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: false
		} );

		var onSelectSwitch = function () {
			var selected = this.getName();

			var panels = OuterStack.getItems();
			for ( var panel of panels ) {
				if ( panel.getData().name === selected ) {
					break;
				}
			}

			OuterStack.setItem( panel );

			this.setActive( false );
		};

		var toolGroup = [
			{
				name: 'pageproperties',
				icon: null,
				title: mw.msg( 'pageproperties-jsmodule-pageproperties-page-properties' ),
				onSelect: onSelectSwitch
			},
			{
				name: 'manageproperties',
				icon: null,
				title: mw.msg(
					'pageproperties-jsmodule-pageproperties-manage-properties'
				),
				onSelect: onSelectSwitch
			},
			{
				name: 'managecategories',
				icon: null,
				title: mw.msg(
					'pageproperties-jsmodule-pageproperties-manage-categories'
				),
				onSelect: onSelectSwitch
			},
			{
				name: 'manageforms',
				icon: null,
				title: mw.msg( 'pageproperties-jsmodule-pageproperties-manage-forms' ),
				onSelect: onSelectSwitch
			}
			// ["forms", "null", "Forms", onSelectSwitch],
		];
		PagePropertiesFunctions.createToolGroup(
			toolFactory,
			'selectSwitch',
			toolGroup
		);

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

	function PanelLayout( config ) {
		PanelLayout.super.call( this, config );

		/*
		this.messageWidget = new OO.ui.MessageWidget({
			type: "notice",
			label: new OO.ui.HtmlSnippet(
				mw.msg("pageproperties-jsmodule-pageproperties-no-properties")
			),
		});
*/

		this.fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		this.populateFieldset();

		this.$element.append(
			'<h3 style="margin-top:0;padding-top:0"><b>' +
				config.data.label +
				'</b></h3>'
		);
		this.$element.append( this.fieldset.$element );
		// this.$element.append(this.messageWidget.$element);
	}

	OO.inheritClass( PanelLayout, OO.ui.PanelLayout );
	PanelLayout.prototype.populateFieldset = function () {
		this.fieldset.clearItems();
		var data = this.data;

		var items = [];
		if ( 'properties' in data && data.properties === true ) {
			var propertiesInForms = getPropertiesInForms();
			Properties = PagePropertiesFunctions.sortObjectByKeys( Properties );

			for ( var i in Properties ) {
				if ( inArray( i, propertiesInForms ) ) {
					continue;
				}
				items.push(
					new ItemWidget( {
						classes: [ 'ItemWidget' ],
						property: i
					} )
				);
			}
		} else if ( 'form' in data ) {
			var formName = data.form;
			var form = Forms[ formName ];

			for ( var i in form.fields ) {
				items.push(
					new ItemWidget( {
						classes: [ 'ItemWidget' ],
						property: i,
						form: formName
					} )
				);
			}
		} else if ( 'pagenameFormula' in data ) {
			var userDefinedInput;
			var userDefinedField;
			if ( data.userDefined ) {
				var inputName = 'mw.widgets.TitleInputWidget';
				userDefinedInput = new mw.widgets.TitleInputWidget( {
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__title' + '-' + '0',
					required: true
				} );

				// eslint-disable-next-line no-underscore-dangle
				Model.__title = { 0: userDefinedInput };

				userDefinedField = new OO.ui.FieldLayout( userDefinedInput, {
					label: mw.msg( 'pageproperties-jsmodule-forms-pagename' ),
					align: 'top',

					// help: new OO.ui.HtmlSnippet("&nbsp;"),
					// helpInline: true,
					// The following classes are used here:
					// * inputName-mw.widgets.TitleInputWidget
					// * inputName-mw.widgets...
					classes: [ 'ItemWidget', 'inputName-' + inputName ]
				} );
			}

			// show radio
			// userdefined (default) with title input
			// pagenameFormula of form x (for each defined pagenameFormula)
			var options = [];
			if (
				Object.keys( data.pagenameFormula ).length > 1 ||
				( data.userDefined && Object.keys( data.pagenameFormula ).length )
			) {
				if ( data.userDefined ) {
					options.push( {
						data: '',
						label: mw.msg( 'pageproperties-jsmodule-forms-userdefined' )
					} );
				}

				for ( var i in data.pagenameFormula ) {
					options.push( {
						data: data.pagenameFormula[ i ],
						label: 'pagename formula of ' + i // mw.msg("pageproperties-jsmodule-forms-userdefined"),
					} );
				}

				var selectPagenameInput = new OO.ui.RadioSelectInputWidget( {
					options: options,
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__pagename-formula' + '-' + '0'
				} );

				Model[ '__pagename-formula' ] = { 0: selectPagenameInput };

				selectPagenameInput.on( 'change', function ( value ) {
					userDefinedField.toggle( value === '' );
					userDefinedInput.setRequired( value === '' );
				} );

				items.push(
					new OO.ui.FieldLayout( selectPagenameInput, {
						label: mw.msg( 'pageproperties-jsmodule-forms-pagename' ),
						align: 'top',
						classes: [ 'ItemWidget' ]
					} )
				);
			}

			if ( data.userDefined ) {
				items.push( userDefinedField );
			}

			if ( data.freeText ) {
				// @todo add editor
				// @see PageForms-5.5.1/includes/forminputs/PF_TextAreaInput.php
				// libs/PF_wikieditor.js

				var inputName = 'OO.ui.MultilineTextInputWidget';
				var inputWidget = new OO.ui.MultilineTextInputWidget( {
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__freetext' + '-' + '0',
					autosize: true,
					rows: 6,
					value: PageContent
				} );

				// eslint-disable-next-line no-underscore-dangle
				Model.__freetext = { 0: inputWidget };

				items.push(
					new OO.ui.FieldLayout( inputWidget, {
						label: mw.msg( 'pageproperties-jsmodule-formedit-freetext' ),
						align: 'top',

						// The following classes are used here:
						// * inputName-mw.widgets.TitleInputWidget
						// * inputName-mw.widgets...
						classes: [ 'ItemWidget', 'inputName-' + inputName ]
					} )
				);
			}
			if ( data.categories ) {
				var categories = data.categories;
				var categoriesInput = new mw.widgets.CategoryMultiselectWidget( {
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__pagecategories' + '-' + '0'
					// value: categories,
				} );

				// eslint-disable-next-line no-underscore-dangle
				Model.__pagecategories = { 0: categoriesInput };

				// ***prevents error "Cannot read properties of undefined (reading 'apiUrl')"
				for ( var category of categories ) {
					categoriesInput.addTag( category, category );
				}
				items.push(
					new OO.ui.FieldLayout( categoriesInput, {
						label: mw.msg( 'pageproperties-jsmodule-forms-categories' ),
						align: 'top',
						classes: [ 'ItemWidget' ]
					} )
				);
			}
		}

		this.fieldset.addItems( items );
	};

	PanelLayout.prototype.addProperty = function ( property ) {
		if ( !( property in Properties ) ) {
			Properties[ property ] = [ '' ];
		}

		this.populateFieldset();
	};

	function updateData( data ) {
		Properties = getModel();

		switch ( data[ 'result-action' ] ) {
			case 'update':
				break;
			case 'delete':
				for ( var property of data[ 'deleted-properties' ] ) {
					// delete Model[property];
					delete Properties[ property ];
				}
				for ( var form in Forms ) {
					for ( var property of data[ 'deleted-properties' ] ) {
						delete Forms[ form ].fields[ property ];
					}
				}
				break;

			case 'create':
				for ( var property in data[ 'semantic-properties' ] ) {
					Properties[ property ] = [ '' ];
				}
				break;

			case 'rename':
				if ( data[ 'previous-label' ] in Properties ) {
					PagePropertiesFunctions.renameObjectKey(
						Properties,
						data[ 'previous-label' ],
						data.label
					);
				}
				for ( var form in Forms ) {
					PagePropertiesFunctions.renameObjectKey(
						Forms[ form ].fields,
						data[ 'previous-label' ],
						data.label
					);
				}
				break;
		}

		if ( !ManagePropertiesSpecialPage ) {
			initialize();
			PagePropertiesCategories.initialize();
			PagePropertiesForms.initialize();
		}
		return true;
	}

	function updateVariables( semanticProperties ) {
		SemanticProperties = semanticProperties;
	}

	function getPropertiesPanels() {
		var panels = [];

		// create panels for forms
		var pagenameFormula = {};
		var userDefined = false;
		var freeText = false;
		var formProperties = [];
		var formCategories = [];
		for ( var form of SetForms ) {
			if ( !TargetPage ) {
				if ( Forms[ form ][ 'pagename-formula' ] ) {
					pagenameFormula[ form ] = Forms[ form ][ 'pagename-formula' ];
				} else {
					userDefined = true;
				}
			}

			if (
				Forms[ form ][ 'freetext-input' ] === 'show always' ||
				( !TargetPage && Forms[ form ][ 'freetext-input' ] === 'show on create' )
			) {
				freeText = true;
			}

			for ( var i in Forms[ form ].fields ) {
				formProperties.push( i );
			}

			if ( Forms[ form ].categories ) {
				for ( var i of Forms[ form ].categories ) {
					formCategories.push( i );
				}
			}

			panels.push(
				new PanelLayout( {
					expanded: false,
					padded: true,
					framed: false,
					classes: [ 'PanelProperties-panel-section' ],
					data: {
						label: form, // mw.msg
						form: form
					}
				} )
			);
		}

		if ( !SetForms.length ) {
			if ( !TargetPage || IsNewPage ) {
				freeText = true;
			}
			if ( !TargetPage ) {
				userDefined = true;
			}
		}

		// create scattered properties panel
		if (
			Object.keys( Properties ).filter( ( x ) => !inArray( x, formProperties ) ).length
		) {
			panels.push(
				new PanelLayout( {
					padded: true,
					framed: false,
					classes: [ 'PanelProperties-panel-section' ],
					data: {
						label: 'properties', // mw.msg
						expanded: false,
						properties: true
					}
				} )
			);
		}

		formCategories = formCategories
			.concat( PageCategories )
			.filter( function onlyUnique( value, index, self ) {
				return self.indexOf( value ) === index;
			} );

		// create title and free text input
		if (
			Object.keys( pagenameFormula ).length ||
			userDefined ||
			freeText ||
			formCategories
		) {
			panels.push(
				new PanelLayout( {
					expanded: false,
					padded: true,
					framed: false,
					classes: [ 'PanelProperties-panel-section' ],
					data: {
						label: 'wiki', // mw.msg
						pagenameFormula: pagenameFormula,
						userDefined: userDefined,
						freeText: freeText,
						categories: formCategories
					}
				} )
			);
		}

		return panels;
	}

	function updatePanels() {
		PropertiesStack.clearItems();
		PropertiesStack.addItems( getPropertiesPanels() );

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader( 'form' );
		}, 30 );
	}

	function updateForms( forms ) {
		Forms = forms;
		updatePanels();
	}

	function initialize(
		managePropertiesSpecialPage,
		canManageProperties,
		semanticProperties,
		properties,
		forms,
		setForms,
		targetPage,
		isNewPage,
		pageContent,
		pageCategories,
		windowManagerSearch
	) {
		Model = {};

		$( '#semantic-properties-wrapper' ).empty();

		if ( arguments.length ) {
			ManagePropertiesSpecialPage = managePropertiesSpecialPage;
			CanManageProperties = canManageProperties;
			SemanticProperties = semanticProperties;
			Properties = properties;
			Forms = forms;
			SetForms = setForms;
			TargetPage = targetPage;
			IsNewPage = isNewPage;
			PageContent = pageContent;
			PageCategories = pageCategories;
			WindowManagerSearch = windowManagerSearch;
		}

		PropertiesStack = new OO.ui.StackLayout( {
			items: getPropertiesPanels(),
			continuous: true,
			classes: [ 'PanelProperties' ]
		} );

		var toolbarA = createToolbar();

		var frameA = new OO.ui.PanelLayout( {
			$content: [ toolbarA.$element, PropertiesStack.$element ],
			expanded: false,
			framed: false,
			data: { name: 'pageproperties' }
		} );

		// https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/layouts.js

		var toolbarB = ManageProperties.createToolbar();

		var contentFrameB = new OO.ui.PanelLayout( {
			$content: $(
				'<table id="pageproperties-datatable-manage" class="pageproperties-datatable display" width="100%"></table>'
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

		var toolbarC = PagePropertiesCategories.createToolbar();

		var contentFrameC = new OO.ui.PanelLayout( {
			$content: $(
				'<table id="pageproperties-categories-datatable" class="pageproperties-datatable display" width="100%"></table>'
			),
			expanded: false,
			padded: true
		} );

		var frameC = new OO.ui.PanelLayout( {
			$content: [ toolbarC.$element, contentFrameC.$element ],
			expanded: false,
			framed: true,
			data: { name: 'managecategories' }
		} );

		var toolbarD = PagePropertiesForms.createToolbarA();

		var contentFrameD = new OO.ui.PanelLayout( {
			$content: $(
				'<table id="pageproperties-forms-datatable" class="pageproperties-datatable display" width="100%"></table>'
			),
			expanded: false,
			padded: true
		} );

		var frameD = new OO.ui.PanelLayout( {
			$content: [ toolbarD.$element, contentFrameD.$element ],
			expanded: false,
			framed: true,
			data: { name: 'manageforms' }
		} );

		OuterStack = new OO.ui.StackLayout( {
			items: [ frameA, frameB, frameC, frameD ],
			expanded: true,
			continuous: false
		} );

		var actionToolbar = createActionToolbar();
		toolbarA.$actions.append( actionToolbar.$element );

		actionToolbar = createActionToolbar();
		toolbarB.$actions.append( actionToolbar.$element );

		actionToolbar = createActionToolbar();
		toolbarC.$actions.append( actionToolbar.$element );

		actionToolbar = createActionToolbar();
		toolbarD.$actions.append( actionToolbar.$element );

		$( '#semantic-properties-wrapper' ).append( OuterStack.$element );

		toolbarA.initialize();
		// toolbarA.emit( 'updateState' );
		toolbarB.initialize();
		toolbarC.initialize();
		toolbarD.initialize();

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader( 'form' );
		}, 30 );
	}

	return {
		initialize,
		updateData,
		getModel,
		getSetForms,
		getPageCategories,
		updateForms,
		updateVariables
	};
}() );

$( document ).ready( function () {
	var managePropertiesSpecialPage = mw.config.get(
		'pageproperties-managePropertiesSpecialPage'
	);

	// console.log( 'managePropertiesSpecialPage', managePropertiesSpecialPage );

	var categories = JSON.parse( mw.config.get( 'pageproperties-categories' ) );
	// console.log( 'categories', categories );

	var semanticProperties = JSON.parse(
		mw.config.get( 'pageproperties-semanticProperties' )
	);
	// console.log( semanticProperties );

	var properties = JSON.parse( mw.config.get( 'pageproperties-properties' ) );
	// console.log( 'properties', properties );

	var canManageProperties = !!mw.config.get(
		'pageproperties-canManageProperties'
	);

	// console.log( 'canManageProperties', canManageProperties );

	var forms = JSON.parse( mw.config.get( 'pageproperties-forms' ) );
	// console.log( 'forms', forms );

	// the order is important !!
	var windowManagerForms = PagePropertiesFunctions.createWindowManager();
	var windowManagerSearch = PagePropertiesFunctions.createWindowManager();
	var windowManagerManageProperties =
		PagePropertiesFunctions.createWindowManager();

	if ( !managePropertiesSpecialPage ) {
		var pageContent = mw.config.get( 'pageproperties-pageContent' );
		var targetPage = mw.config.get( 'pageproperties-target-page' );
		var isNewPage = mw.config.get( 'pageproperties-is-newpage' );

		var pageCategories = JSON.parse(
			mw.config.get( 'pageproperties-page-categories' )
		);
		// console.log( 'pageCategories', pageCategories );
		var setForms = JSON.parse( mw.config.get( 'pageproperties-set-forms' ) );
		// console.log( 'setForms', setForms );

		PageProperties.initialize(
			managePropertiesSpecialPage,
			canManageProperties,
			semanticProperties,
			properties,
			forms,
			setForms,
			targetPage,
			isNewPage,
			pageContent,
			pageCategories,
			windowManagerSearch
		);
	}

	ManageProperties.initialize(
		windowManagerManageProperties,
		semanticProperties,
		managePropertiesSpecialPage
	);

	PagePropertiesCategories.initialize( categories );

	PagePropertiesForms.initialize(
		managePropertiesSpecialPage,
		windowManagerForms,
		windowManagerSearch,
		forms,
		semanticProperties
	);

	if ( managePropertiesSpecialPage ) {
		var maxPhpUploadSize = mw.config.get( 'maxPhpUploadSize' );
		var maxMwUploadSize = mw.config.get( 'maxMwUploadSize' );

		ImportProperties.initialize(
			semanticProperties,
			maxPhpUploadSize,
			maxMwUploadSize
		);
	}

	if ( canManageProperties ) {
		// load importedVocabularies
		ManageProperties.loadData( semanticProperties );
	}

	$( '#pageproperties-form' ).submit( function () {

		var obj = PageProperties.getModel( true );

		// eslint-disable-next-line no-underscore-dangle
		var setForms_ = PageProperties.getSetForms();

		var formName = null;
		for ( var i in setForms_ ) {
			$( '<input>' )
				.attr( {
					type: 'hidden',
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__setforms' + '-' + i,
					value: setForms_[ i ]
				} )
				.appendTo( '#pageproperties-form' );
			formName = setForms_[ i ];
		}

		// eslint-disable-next-line no-underscore-dangle
		if ( !targetPage && !obj.__title && !obj[ '__pagename-formula' ] ) {
			$( '<input>' )
				.attr( {
					type: 'hidden',
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__pagename-formula' + '-' + '0',

					// there should be only one form
					value: forms[ formName ][ 'pagename-formula' ]
				} )
				.appendTo( '#pageproperties-form' );
		}

		// return false;
	} );

	// display every 3 days
	if (
		managePropertiesSpecialPage &&
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
