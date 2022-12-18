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
const PagePropertiesForms = ( function () {
	var Model = {};
	var SelectedForm;

	var Forms;
	// var ImportedVocabulariesWidgetCategories;
	var DataTable;
	var DataTableB;
	var DialogName = 'dialogForms';
	var DialogSearchName = 'dialogSearch';
	var DialogEditFieldName = 'dialogEditField';
	var processDialogSearch;
	var SemanticProperties;
	var WindowManager;
	var WindowManagerSearch;
	var SelectedProperty;
	var ManagePropertiesSpecialPage;

	function inArray( val, arr ) {
		return jQuery.inArray( val, arr ) !== -1;
	}

	function getPropertyValue( property, field ) {
		if ( !field ) {
			if ( property in Model ) {
				return 'getValue' in Model[ property ] ?
					Model[ property ].getValue() :
					Object.keys( Model[ property ] ).map( function ( k ) {
						return Model[ property ][ k ];
					} ).map( ( x ) => x.getValue() );

			}

			if ( property in SelectedForm ) {
				return SelectedForm[ property ];
			}
			return '';
		}

		var property = property || SelectedProperty.label;

		if ( property in Model.fields && field in Model.fields[ property ] ) {
			return 'getValue' in Model.fields[ property ][ field ] ?
				Model.fields[ property ][ field ].getValue() :
				Object.keys( Model.fields[ property ][ field ] ).map( function ( k ) {
					return Model.fields[ property ][ field ][ k ];
				} ).map( ( x ) => x.getValue() );
		}

		if (
			property in SelectedForm.fields &&
			field in SelectedForm.fields[ property ]
		) {
			return SelectedForm.fields[ property ][ field ];
		}

		return '';
	}

	function getFieldsValues() {
		var properties = [];
		if ( $.fn.DataTable.isDataTable( '#pageproperties-forms-datatable-dialog' ) ) {
			// eslint-disable-next-line no-unused-vars, array-callback-return
			DataTableB.rows().every( function ( rowIdx, tableLoop, rowLoop ) {
				var data = this.data();
				properties.push( data[ 0 ] );
			} );
		} else {
			properties = Object.keys( SelectedForm.fields );
		}

		var fields = SelectedForm.fields;

		var property = SelectedProperty.label;

		for ( var field of [
			'required',
			'help-message',
			'preferred-input',
			'multiple',
			'on-create-only',
			'value-formula'
		] ) {
			switch ( field ) {
				case 'help-message':
					if (
						Model.fields[ property ].selectHelpInput.getValue() === 'override'
					) {
						fields[ property ][ field ] =
							getPropertyValue( property, 'help-message' ) || [];
					}
					continue;
				case 'preferred-input':
					if (
						Model.fields[ property ].selectAvailableInputs.getValue() !==
						'override'
					) {
						fields[ property ][ field ] = '';
						continue;
					}
					break;
				case 'multiple':
					if (
						Model.fields[ property ].selectMultipleValueInput.getValue() !==
						'override'
					) {
						fields[ property ][ field ] = '';
						continue;
					}
					break;
			}

			fields[ property ][ field ] = getPropertyValue( property, field );
		}

		return fields;
	}

	function updateData( data ) {
		switch ( data[ 'result-action' ] ) {
			case 'update':
				Forms = jQuery.extend( Forms, data.forms );
				break;
			case 'delete':
				for ( var formName of data[ 'deleted-items' ] ) {
					delete Forms[ formName ];
				}
				break;

			case 'create':
				Forms = jQuery.extend( Forms, data.forms );
				Forms = PagePropertiesFunctions.sortObjectByKeys( Forms );
				break;

			case 'rename':
				delete Forms[ data[ 'previous-label' ] ];

				Forms = jQuery.extend( Forms, data.forms );
				Forms = PagePropertiesFunctions.sortObjectByKeys( Forms );
				break;
		}

		if ( !ManagePropertiesSpecialPage ) {
			PageProperties.updateForms( Forms );
		}

		initialize();

		return true;
	}

	function PageOneLayout( name, config ) {
		PageOneLayout.super.call( this, name, config );

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		var formNameInput = new OO.ui.TextInputWidget( {
			value: SelectedForm.label
		} );

		Model.formName = formNameInput;

		var categories = getPropertyValue( 'categories' );
		var categoriesInput = new mw.widgets.CategoryMultiselectWidget( {
			// value: categories,
		} );
		// ***prevents error "Cannot read properties of undefined (reading 'apiUrl')"
		for ( var category of categories ) {
			categoriesInput.addTag( category, category );
		}

		Model.categories = categoriesInput;

		var pageNameFormulaValue = getPropertyValue( 'pagename-formula' );

		var selectPagenameInput = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'userdefined',
					label: mw.msg( 'pageproperties-jsmodule-forms-userdefined' )
				},
				{
					data: 'formula',
					label: mw.msg( 'pageproperties-jsmodule-forms-formula' )
				}
			],
			value: pageNameFormulaValue ? 'formula' : 'userdefined'
		} );

		Model.selectPagenameInput = selectPagenameInput;

		/*
		var pagenameRootInput = new mw.widgets.TitleInputWidget();

		Model["pagename-root"] = pagenameRootInput;

		var fieldPagenameRoot = new OO.ui.FieldLayout(pagenameRootInput, {
			// label: "Assign categories",
			align: "top",
			help: mw.msg("pageproperties-jsmodule-forms-rootpage-help"),
			helpInline: true,
		});
*/

		var pagenameFormulaInput = new OO.ui.TextInputWidget( {
			value: pageNameFormulaValue
		} );

		Model[ 'pagename-formula' ] = pagenameFormulaInput;

		var fieldpagenameFormula = new OO.ui.FieldLayout( pagenameFormulaInput, {
			align: 'top',
			help: mw.msg( 'pageproperties-jsmodule-forms-pagenameformula-help' ),
			helpInline: true
		} );

		selectPagenameInput.on( 'change', function ( value ) {
			// fieldPagenameRoot.toggle(value === "userdefined");
			fieldpagenameFormula.toggle( value === 'formula' );
		} );

		/*
		// allow the user to add other properties to the form
		var arbitraryInputsInput = new OO.ui.ToggleSwitchWidget({
			// value: getPropertyValue( '__pageproperties_allows_multiple_values' )
		});

		Model.arbitraryInputsInput = arbitraryInputsInput;
*/

		var displayFreeTextInputInput = new OO.ui.DropdownInputWidget( {
			options: ManageProperties.createInputOptions( {
				'do not show': mw.msg(
					'pageproperties-jsmodule-forms-freetext-donotshow'
				),
				'show on create': mw.msg(
					'pageproperties-jsmodule-forms-freetext-showoncreate'
				),
				'show always': mw.msg(
					'pageproperties-jsmodule-forms-freetext-showalways'
				)
			} ),
			// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/classes/DialogWithDropdowns.js

			$overlay: this.$overlay,
			value: getPropertyValue( 'freetext-input' )
		} );

		Model[ 'freetext-input' ] = displayFreeTextInputInput;

		fieldset.addItems( [
			new OO.ui.FieldLayout( formNameInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-formname' ),
				align: 'top'
			} ),

			new OO.ui.FieldLayout( selectPagenameInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-pagename' ),
				align: 'top'
			} ),

			// fieldPagenameRoot,
			fieldpagenameFormula,

			new OO.ui.FieldLayout( displayFreeTextInputInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-displayfreetext' ),
				// help: mw.msg( 'pageproperties-jsmodule-manageproperties-multiple-fields-help' ),
				helpInline: true,
				align: 'top'
			} ),

			/*
			new OO.ui.FieldLayout(arbitraryInputsInput, {
				label: mw.msg(
					"arbitrary inputs" //'pageproperties-jsmodule-manageproperties-multiple-fields'
				),
				help: "toggle on if you want allow the user to add other properties to the form",
				helpInline: true,
				align: "top",
			}),
*/

			new OO.ui.FieldLayout( categoriesInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-categories' ),
				align: 'top',
				help: mw.msg( 'pageproperties-jsmodule-forms-categories-help' ),
				helpInline: true
			} )
		] );

		this.content = new OO.ui.PanelLayout( {
			$content: fieldset.$element,
			padded: true,
			expanded: false
		} );

		this.$element.append( this.content.$element );

		fieldpagenameFormula.toggle( pageNameFormulaValue );
		// fieldPagenameRoot.toggle(!pageNameFormulaValue);
	}
	OO.inheritClass( PageOneLayout, OO.ui.PageLayout );
	PageOneLayout.prototype.setupOutlineItem = function () {
		this.outlineItem.setLabel(
			mw.msg( 'pageproperties-jsmodule-manageproperties-main' )
		);
	};

	function initializeDataTableB() {
		PagePropertiesFunctions.destroyDataTable(
			'pageproperties-forms-datatable-dialog'
		);
		var data = [];

		for ( var i in SelectedForm.fields ) {
			var preferredInput = '';
			if ( SelectedForm.fields[ i ][ 'preferred-input' ] ) {
				preferredInput = SelectedForm.fields[ i ][ 'preferred-input' ];
			} else if (
				'__pageproperties_preferred_input' in SemanticProperties[ i ].properties
			) {
				preferredInput =
					// eslint-disable-next-line no-underscore-dangle
					SemanticProperties[ i ].properties.__pageproperties_preferred_input[ 0 ]
						.split( '.' )
						.slice( -1 )[ 0 ];
			}

			data.push( [
				// name
				i,
				// type
				SemanticProperties[ i ].typeLabel,
				// input
				preferredInput,
				// required
				// The following messages are used here:
				// * pageproperties-jsmodule-forms-required
				// * pageproperties-jsmodule-forms-notrequired
				mw.msg(
					'pageproperties-jsmodule-forms-' +
						( SelectedForm.fields[ i ].required ? '' : 'not' ) +
						'required'
				),
				''
			] );
		}

		if ( !data.length ) {
			return;
		}

		DataTableB = $( '#pageproperties-forms-datatable-dialog' ).DataTable( {
			// order: 1,
			// pageLength: 20,
			// https://datatables.net/reference/option/dom
			dom: '<"pageproperties-datatable-left"f><"pageproperties-datatable-right"l>rtip',
			ordering: false,
			iDisplayLength: 100,
			searching: false,
			paging: false,
			info: false,
			rowReorder: true,
			scrollX: true,
			columnDefs: [
				{
					targets: 4,
					// eslint-disable-next-line no-unused-vars
					render: function ( data_, type, row, meta ) {
						return (
							'<span class="buttons-wrapper" data-property="' +
							row[ 0 ] +
							'"></span>'
						);
					}
				}
			],

			// lengthMenu: [ 10, 20, 50, 100, 200 ],
			// lengthChange: false,
			data: data,
			// stateSave: true,
			columns: mw
				.msg( 'pageproperties-jsmodule-pageproperties-columns-forms-dialog' )
				.split( /\s*,\s*/ )
				.map( function ( x ) {
					return { title: x };
				} )
		} );

		$( '#pageproperties-forms-datatable-dialog .buttons-wrapper' ).each(
			function () {
				var buttonWidgetEdit = new OO.ui.ButtonWidget( {
					icon: 'edit'
					// flags: ["progressive"],
				} );

				// @todo, uncomment if the other panels can be re-initialized
				// without affecting the view
				if ( ManagePropertiesSpecialPage ) {
					var buttonWidgetSettings = new OO.ui.ButtonWidget( {
						icon: 'settings',
						flags: [ 'progressive' ]
					} );
				}

				/*
				var buttonWidgetDelete = new OO.ui.ButtonWidget({
					icon: "trash",
					flags: ["destructive"],
				});
		*/
				var label = $( this ).data().property;

				buttonWidgetEdit.on( 'click', function () {
					SelectedProperty = jQuery.extend(
						{ label: label },
						SemanticProperties[ label ]
					);

					Model.fields[ SelectedProperty.label ] = {};

					openEditFieldDialog();
				} );

				if ( ManagePropertiesSpecialPage ) {
					buttonWidgetSettings.on( 'click', function () {
						ManageProperties.openDialog( label );
					} );
				}
				// buttonWidgetDelete.on("click", function () {});

				$( this ).append(
					buttonWidgetEdit.$element
					// buttonWidgetDelete.$element
				);

				if ( ManagePropertiesSpecialPage ) {
					$( this ).append( buttonWidgetSettings.$element );
				}
			}
		);

		/*
		DataTableB.on("click", "tr", function () {
			var index = DataTable.row(this).index();
			var label = data[index][0];

			openDialog(label);
		});
*/
	}

	function PageTwoLayout( name, config ) {
		PageTwoLayout.super.call( this, name, config );

		var toolbar = createToolbarB();

		var contentFrame = new OO.ui.PanelLayout( {
			$content: $(
				// display
				'<table id="pageproperties-forms-datatable-dialog" class="pageproperties-datatable" width="100%"></table>'
			), // this.fieldset.$element,
			expanded: false,
			padded: false,
			classes: [ 'pageproperties-forms-fields-contentframe' ]
		} );

		var frameA = new OO.ui.PanelLayout( {
			$content: [ toolbar.$element, contentFrame.$element ],
			expanded: false,
			// framed: false,
			padded: false,
			data: { name: 'manageforms' }
		} );

		this.$element.append( frameA.$element );

		// initializeDataTableB();
	}

	OO.inheritClass( PageTwoLayout, OO.ui.PageLayout );
	PageTwoLayout.prototype.setupOutlineItem = function () {
		this.outlineItem.setLabel( mw.msg( 'pageproperties-jsmodule-forms-fields' ) );
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

		function getItems( value ) {
			var values = Object.keys( SemanticProperties );
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
					selected: x in SelectedForm.fields
				} );
				menuOptionWidget.$element.append(
					$(
						'<span class="oo-ui-labelElement-label right">' +
							SemanticProperties[ x ].typeLabel +
							'</span>'
					)
				);
				return menuOptionWidget;
			} );
		}

		var searchWidget = new OO.ui.SearchWidget( {
			id: 'pageproperties-import-search-widget'
		} );

		searchWidget.results.addItems( getItems() );
		// searchWidget.getResults() is a SelectWidget
		// https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.SelectWidget

		this.selectWidget = searchWidget.getResults();

		this.selectWidget.multiselect = true;

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
			var properties = items.map( ( x ) => x.data );

			// remove unselected properties
			for ( var label in SelectedForm.fields ) {
				if ( !inArray( label, properties ) ) {
					delete SelectedForm.fields[ label ];
				}
			}

			// add new properties
			for ( var label of properties ) {
				if ( !( label in SelectedForm.fields ) ) {
					SelectedForm.fields[ label ] = {};
				}
			}

			initializeDataTableB();

			// SelectedForm.fields = getFieldsValues();
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

	function openSearchDialog() {
		processDialogSearch = new ProcessDialogSearch( {
			size: 'medium',
			classes: [ 'pageproperties-import-dialog' ]
			// data: { label: label }
		} );

		WindowManagerSearch.addWindows( [ processDialogSearch ] );

		WindowManagerSearch.openWindow( processDialogSearch );
	}

	var InnerItemWidget = function ( config ) {
		config = config || {};
		InnerItemWidget.super.call( this, config );

		if ( !( 'value' in config ) ) {
			config.value = '';
		}

		if ( !( 'index' in config ) ) {
			config.index = 0;
		}

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

		deleteButton.on( 'click', function () {
			delete Model[ config.property ][ config.index ];
		} );

		var inputWidget = new OO.ui.MultilineTextInputWidget( {
			value: config.value,
			autosize: true,
			rows: 2
		} );

		Model.fields[ SelectedProperty.label ][ 'help-message' ][ config.index ] =
			inputWidget;

		fieldset.addItems( [
			new OO.ui.ActionFieldLayout( inputWidget, deleteButton, {
				label: '',
				align: 'top'
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
		this.removeItems( [ itemWidget ] );
	};

	ListWidget.prototype.addItems = function ( items, index ) {
		if ( !items || !items.length ) {
			return this;
		}

		// Mixin method
		OO.ui.mixin.GroupWidget.prototype.addItems.call( this, items, index );

		// Always provide an index, even if it was omitted
		this.emit(
			'add',
			items,
			index === undefined ? this.items.length - items.length - 1 : index
		);

		return this;
	};

	ListWidget.prototype.removeItems = function ( items ) {
		// Mixin method
		OO.ui.mixin.GroupWidget.prototype.removeItems.call( this, items );

		this.emit( 'remove', items );

		return this;
	};

	ListWidget.prototype.clearItems = function () {
		var items = this.items.slice();

		// Mixin method
		OO.ui.mixin.GroupWidget.prototype.clearItems.call( this );

		this.emit( 'remove', items );

		return this;
	};

	function ProcessDialogEditField( config ) {
		ProcessDialogEditField.super.call( this, config );
	}
	OO.inheritClass( ProcessDialogEditField, OO.ui.ProcessDialog );

	ProcessDialogEditField.static.name = DialogEditFieldName;
	ProcessDialogEditField.static.title = mw.msg(
		'pageproperties-jsmodule-forms-definefield'
	);
	ProcessDialogEditField.static.actions = [
		/*
		{
			action: "delete",
			label: mw.msg("pageproperties-jsmodule-manageproperties-delete"),
			flags: "destructive",
		},
*/
		{
			action: 'save',
			label: mw.msg( 'pageproperties-jsmodule-forms-done' ),
			flags: [ 'primary', 'progressive' ]
		},
		{
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-cancel' ),
			flags: [ 'safe', 'close' ]
		}
	];

	ProcessDialogEditField.prototype.initialize = function () {
		ProcessDialogEditField.super.prototype.initialize.apply( this, arguments );

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		var toggleInputRequired = new OO.ui.ToggleSwitchWidget( {
			value: !!getPropertyValue( null, 'required' )
		} );

		Model.fields[ SelectedProperty.label ].required = toggleInputRequired;

		var toggleInputOnCreate = new OO.ui.ToggleSwitchWidget( {
			value: !!getPropertyValue( null, 'on-create-only' )
		} );

		Model.fields[ SelectedProperty.label ][ 'on-create-only' ] =
			toggleInputOnCreate;

		var valueFormulaInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( null, 'value-formula' )
		} );

		Model.fields[ SelectedProperty.label ][ 'value-formula' ] = valueFormulaInput;

		let optionsList = new ListWidget();

		var addOption = new OO.ui.ButtonWidget( {
			// label: "add option",
			icon: 'add'
		} );

		// @todo, add "populate with values from property"
		// for the inputs of type ManageProperties.optionsInputs
		// and ManageProperties.multiselectInputs

		/*
		'OO.ui.DropdownInputWidget',
		'OO.ui.ComboBoxInputWidget',
		'OO.ui.MenuTagMultiselectWidget',
		// 'OO.ui.RadioSelectInputWidget',
		// 'OO.ui.CheckboxMultiselectInputWidget'

		'OO.ui.TagMultiselectWidget',
*/

		// @todo, add "show if another field has a specific value"

		var helpMessages = getPropertyValue( null, 'help-message' ) || [];

		Model.fields[ SelectedProperty.label ][ 'help-message' ] = {};

		addOption.on( 'click', function () {
			optionsList.addItems( [
				new InnerItemWidget( {
					classes: [ 'InnerItemWidget' ],
					value: '',
					index: optionsList.items.length
				} )
			] );
		} );

		for ( var i in helpMessages ) {
			optionsList.addItems( [
				new InnerItemWidget( {
					classes: [ 'InnerItemWidget' ],
					value: helpMessages[ i ],
					index: i
				} )
			] );
		}

		var selectHelpInput = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'propertydescription',
					label: mw.msg(
						'pageproperties-jsmodule-forms-frompropertydescription'
					)
				},
				{
					data: 'override',
					label: mw.msg( 'pageproperties-jsmodule-forms-distinctvalue' )
				}
			],
			value: helpMessages.length ? 'override' : 'propertydescription'
		} );

		Model.fields[ SelectedProperty.label ].selectHelpInput = selectHelpInput;

		var fieldOptionsList = new OO.ui.FieldLayout( optionsList, {
			label: new OO.ui.HtmlSnippet(
				mw.msg( 'pageproperties-jsmodule-forms-field-help-message' )
			),
			align: 'top'
			// help: ""
			// helpInline: true,
		} );

		selectHelpInput.on( 'change', function ( value ) {
			fieldOptionsList.toggle( value === 'override' );
			addOption.toggle( value === 'override' );
		} );

		var preferredInputValue = getPropertyValue( null, 'preferred-input' );

		var availableInputs = new OO.ui.DropdownInputWidget( {
			options: ManageProperties.createInputOptions(
				ManageProperties.getAvailableInputs( SelectedProperty.type ),
				{
					key: 'value'
				}
			),
			// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/classes/DialogWithDropdowns.js

			$overlay: this.$overlay,
			value: preferredInputValue
		} );

		Model.fields[ SelectedProperty.label ][ 'preferred-input' ] = availableInputs;

		var fieldAvailableInputs = new OO.ui.FieldLayout( availableInputs, {
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-preferred-input' ),
			// help: 'Multiple values ...',
			// helpInline: true,
			align: 'top'
		} );

		var selectAvailableInputs = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'fromproperty',
					label: mw.msg(
						'pageproperties-jsmodule-forms-preferredinput-fromproperty'
					)
				},
				{
					data: 'override',
					label: mw.msg(
						'pageproperties-jsmodule-forms-preferredinput-override'
					)
				}
			],
			value: preferredInputValue ? 'override' : 'fromproperty'
		} );

		Model.fields[ SelectedProperty.label ].selectAvailableInputs =
			selectAvailableInputs;

		selectAvailableInputs.on( 'change', function ( value ) {
			fieldAvailableInputs.toggle( value === 'override' );
		} );

		var selectMultipleValueValue = getPropertyValue( null, 'multiple' );

		var multipleValueInput = new OO.ui.ToggleSwitchWidget( {
			value: selectMultipleValueValue
		} );

		Model.fields[ SelectedProperty.label ].multiple = multipleValueInput;

		var fieldMultipleValue = new OO.ui.FieldLayout( multipleValueInput, {
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-multiple-fields' ),
			help: mw.msg(
				'pageproperties-jsmodule-manageproperties-multiple-fields-help'
			),
			helpInline: true,
			align: 'top'
		} );

		var selectMultipleValue = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'fromproperty',
					label: mw.msg(
						'pageproperties-jsmodule-forms-preferredinput-fromproperty'
					)
				},
				{
					data: 'override',
					label: mw.msg(
						'pageproperties-jsmodule-forms-preferredinput-override'
					)
				}
			],
			// @todo this will not work if property toggle is true and this is false
			value: selectMultipleValueValue === '' ? 'fromproperty' : 'override'
		} );

		Model.fields[ SelectedProperty.label ].selectMultipleValueInput =
			selectMultipleValue;

		selectMultipleValue.on( 'change', function ( value ) {
			fieldMultipleValue.toggle( value === 'override' );
		} );

		fieldset.addItems( [
			new OO.ui.FieldLayout( toggleInputRequired, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-required' ),
				helpInline: true,
				align: 'top'
			} ),

			new OO.ui.FieldLayout( selectHelpInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-help-label' ),
				helpInline: true,
				align: 'top'
			} ),

			fieldOptionsList,

			// add option in optionsList
			addOption,

			new OO.ui.FieldLayout( selectAvailableInputs, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-preferredinput' ),
				helpInline: true,
				align: 'top'
			} ),

			fieldAvailableInputs,

			new OO.ui.FieldLayout( selectMultipleValue, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-multiplevalue' ),
				helpInline: true,
				align: 'top'
			} ),

			fieldMultipleValue,

			new OO.ui.FieldLayout( toggleInputOnCreate, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-oncreateonly' ),
				help: mw.msg( 'pageproperties-jsmodule-forms-field-oncreateonly-help' ),
				helpInline: true,
				align: 'top'
			} ),

			new OO.ui.FieldLayout( valueFormulaInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-altervalue' ),
				help: mw.msg( 'pageproperties-jsmodule-forms-field-altervalue-help' ),
				helpInline: true,
				align: 'top'
			} )
		] );

		var frame = new OO.ui.PanelLayout( {
			$content: [ fieldset.$element ],
			expanded: false,
			// framed: true,
			padded: true
			// data: { name: 'managecategories' }
		} );

		this.$body.append( frame.$element );

		fieldOptionsList.toggle( helpMessages.length );
		addOption.toggle( false );
		fieldAvailableInputs.toggle( preferredInputValue );
		fieldMultipleValue.toggle( selectMultipleValueValue !== '' );

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader(
				'#pageproperties-processDialogEditField'
			);
		}, 30 );
	};

	ProcessDialogEditField.prototype.getActionProcess = function ( action ) {
		var dialog = this;

		switch ( action ) {
			case 'save':
				// save model to SelectedForm.fields[SelectedProperty.label]
				SelectedForm.fields = getFieldsValues();
				break;
		}

		SelectedProperty = {};

		initializeDataTableB();

		return new OO.ui.Process( function () {
			dialog.close( { action: action } );
		} );
	};

	ProcessDialogEditField.prototype.getTeardownProcess = function ( data ) {
		return ProcessDialogEditField.super.prototype.getTeardownProcess
			.call( this, data )
			.first( function () {
				WindowManagerSearch.removeWindows( [ DialogEditFieldName ] );
			}, this );
	};

	/**
	 * Override getBodyHeight to create a tall dialog relative to the screen.
	 *
	 * @return {number} Body height
	 */
	ProcessDialogEditField.prototype.getBodyHeight = function () {
		// see here https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs
		// this.page1.content.$element.outerHeight( true );
		return window.innerHeight - 100;
	};

	function openEditFieldDialog() {
		var processDialogEditField = new ProcessDialogEditField( {
			size: 'large',
			classes: [ 'pageproperties-import-dialog' ],
			id: 'pageproperties-processDialogEditField'
			// data: { label: label }
		} );

		WindowManagerSearch.addWindows( [ processDialogEditField ] );

		WindowManagerSearch.openWindow( processDialogEditField );
	}

	function ProcessDialog( config ) {
		ProcessDialog.super.call( this, config );
	}
	OO.inheritClass( ProcessDialog, OO.ui.ProcessDialog );

	ProcessDialog.static.name = DialogName;
	ProcessDialog.static.title = mw.msg(
		'pageproperties-jsmodule-forms-defineform'
	);
	ProcessDialog.static.actions = [
		{
			action: 'delete',
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-delete' ),
			flags: 'destructive'
		},
		{
			action: 'save',
			modes: 'edit',
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-save' ),
			flags: [ 'primary', 'progressive' ]
		},
		{
			modes: 'edit',
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-cancel' ),
			flags: [ 'safe', 'close' ]
		}
	];

	ProcessDialog.prototype.initialize = function () {
		ProcessDialog.super.prototype.initialize.apply( this, arguments );
		this.page1 = new PageOneLayout( 'one', {} );
		this.page2 = new PageTwoLayout( 'two', {
			classes: [ 'pageproperties-forms-fields-panel' ]
		} );

		var booklet = new OO.ui.BookletLayout( {
			outlined: true,
			expanded: true,
			padded: false
		} );

		booklet.addPages( [ this.page1, this.page2 ] );
		booklet.setPage( 'one' );

		booklet.on( 'set', function ( value ) {
			if (
				value.name === 'two' &&
				!$.fn.DataTable.isDataTable( '#pageproperties-forms-datatable-dialog' )
			) {
				// $('#pageproperties-forms-datatable-dialog').DataTable().clear().draw();
				initializeDataTableB();
			}
		} );

		this.$body.append( booklet.$element );

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader(
				'#pageproperties-ProcessDialogEditForm'
			);
		}, 30 );
	};

	ProcessDialog.prototype.getActionProcess = function ( action ) {
		if (
			!action ||
			( action === 'delete' &&
				// eslint-disable-next-line no-alert
				!confirm( mw.msg( 'pageproperties-jsmodule-forms-delete-confirm' ) ) )
		) {
			return ProcessDialog.super.prototype.getActionProcess.call( this, action );
		}

		var payload = {
			action: 'pageproperties-manageproperties-saveform',
			dialogAction: action,
			previousLabel: SelectedForm.label,
			format: 'json',
			formFields: {},
			fields: {}
		};

		// https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs#Action_sets
		return ProcessDialog.super.prototype.getActionProcess
			.call( this, action )
			.next( function () {
				switch ( action ) {
					case 'save':
						var formFields = {};
						for ( var i in Model ) {
							if ( i !== 'fields' && !/Inputs?$/.test( i ) ) {
								formFields[ i ] = getPropertyValue( i );
							}
						}

						if ( Model.selectPagenameInput.getValue() === 'formula' ) {
							delete formFields[ 'pagename-root' ];
						} else {
							delete formFields[ 'pagename-formula' ];
						}

						if ( formFields.formName === '' ) {
							OO.ui.alert(
								mw.msg( 'pageproperties-jsmodule-forms-alert-formname' ),
								{
									size: 'medium'
								}
							);
							return ProcessDialog.super.prototype.getActionProcess.call(
								this,
								action
							);
						}

						if ( !Object.keys( SelectedForm.fields ).length ) {
							OO.ui.alert(
								mw.msg( 'pageproperties-jsmodule-forms-alert-fields' ),
								{
									size: 'medium'
								}
							);
							return ProcessDialog.super.prototype.getActionProcess.call(
								this,
								action
							);
						}

						// var fields = getFieldsValues();
						payload.formFields = formFields;
						payload.fields = SelectedForm.fields;

					// eslint-disable no-fallthrough
					case 'delete':
						payload.formFields = JSON.stringify( payload.formFields );
						payload.fields = JSON.stringify( payload.fields );
						// console.log( 'payload', payload );

						// eslint-disable-next-line compat/compat, no-unused-vars
						return new Promise( ( resolve, reject ) => {
							mw.loader.using( 'mediawiki.api', function () {
								new mw.Api()
									.postWithToken( 'csrf', payload )
									.done( function ( res ) {
										// console.log( 'res', res );
										resolve();
										if ( 'pageproperties-manageproperties-saveform' in res ) {
											var data =
												res[ 'pageproperties-manageproperties-saveform' ];
											if ( data[ 'result-action' ] === 'error' ) {
												OO.ui.alert( new OO.ui.HtmlSnippet( data.error ), {
													size: 'medium'
												} );
											} else {
												if ( updateData( data ) === true ) {
													WindowManager.removeWindows( [ DialogName ] );
												}
											}
										} else {
											OO.ui.alert( 'unknown error', { size: 'medium' } );
										}
									} )
									.fail( function ( res ) {
										// this will show a nice modal but is not necessary
										// reject();
										resolve();
										var msg = res;
										// The following messages are used here:
										// * pageproperties-permissions-error
										// * pageproperties-permissions-error-b
										OO.ui.alert( mw.msg( msg ), { size: 'medium' } );
									} );
							} );
						} ); // promise
				}
			} ); // .next

		// eslint-disable-next-line no-unreachable
		return ProcessDialog.super.prototype.getActionProcess.call( this, action );
	};

	ProcessDialog.prototype.getTeardownProcess = function ( data ) {
		return ProcessDialog.super.prototype.getTeardownProcess
			.call( this, data )
			.first( function () {
				WindowManager.removeWindows( [ DialogName ] );
			}, this );
	};

	/**
	 * Override getBodyHeight to create a tall dialog relative to the screen.
	 *
	 * @return {number} Body height
	 */
	ProcessDialog.prototype.getBodyHeight = function () {
		// see here https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs
		// this.page1.content.$element.outerHeight( true );
		return window.innerHeight - 100;
	};

	function openDialog( label ) {
		if ( !label ) {
			SelectedForm = { label: '', fields: {} };
		} else {
			SelectedForm = jQuery.extend( { label: label, fields: {} }, Forms[ label ] );
		}

		Model = { fields: {} };

		SelectedProperty = {};
		var processDialog = new ProcessDialog( {
			size: 'larger',
			id: 'pageproperties-ProcessDialogEditForm'
		} );

		WindowManager.addWindows( [ processDialog ] );

		var instance = WindowManager.openWindow( processDialog );

		instance.opening.then( function () {
			// initializeDataTableB();
		} );
	}

	function escape( s ) {
		return String( s )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	}

	function initializeDataTable() {
		PagePropertiesFunctions.destroyDataTable( 'pageproperties-forms-datatable' );

		var data = [];

		for ( var i in Forms ) {
			var value = Forms[ i ];

			if ( value[ 'pagename-formula' ] ) {
				var pageName = escape( value[ 'pagename-formula' ] );
			} else {
				var pageName = '';
				if ( value[ 'pagename-root' ] ) {
					pageName += escape( value[ 'pagename-root' ] ) + '/';
				}
				pageName +=
					'<i>' + mw.msg( 'pageproperties-jsmodule-forms-userdefined' ) + '</i>';
			}

			// *** or use https://datatables.net/manual/data/renderers#Text-helper
			data.push( [
				i,
				pageName,
				'fields' in value ? Object.keys( value.fields ).join( ', ' ) : ''
			] );
		}

		DataTable = $( '#pageproperties-forms-datatable' ).DataTable( {
			order: 1,
			pageLength: 20,

			// https://datatables.net/reference/option/dom
			dom: '<"pageproperties-datatable-left"f><"pageproperties-datatable-right"l>rtip',
			lengthMenu: [ 10, 20, 50, 100, 200 ],
			// lengthChange: false,
			data: data,
			stateSave: true,
			columns: mw
				.msg( 'pageproperties-jsmodule-pageproperties-columns-forms' )
				.split( /\s*,\s*/ )
				.map( function ( x ) {
					return { title: x };
				} )
		} );

		DataTable.on( 'click', 'tr', function () {
			var index = DataTable.row( this ).index();
			var label = data[ index ][ 0 ];

			openDialog( label );
		} );
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
				case 'addfield':
					openSearchDialog();
					break;
			}

			this.setActive( false );
		};

		var toolGroup = [
			{
				name: 'addfield',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-forms-addfield' ),
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

	function createToolbarA() {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
		} );

		var onSelect = function () {
			var toolName = this.getName();

			switch ( toolName ) {
				case 'createform':
					openDialog();
					break;
			}

			this.setActive( false );
		};

		var toolGroup = [
			{
				name: 'createform',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-forms-create-form' ),
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

	function updateVariables( semanticProperties ) {
		SemanticProperties = semanticProperties;
	}

	function initialize(
		managePropertiesSpecialPage,
		windowManager,
		windowManagerSearch,
		forms,
		semanticProperties
	) {
		if ( arguments.length ) {
			ManagePropertiesSpecialPage = managePropertiesSpecialPage;
			SemanticProperties = semanticProperties;
			WindowManager = windowManager;
			Forms = forms;
			WindowManagerSearch = windowManagerSearch;
		}

		if ( ManagePropertiesSpecialPage ) {
			$( '#forms-wrapper' ).empty();

			var contentFrame = new OO.ui.PanelLayout( {
				$content: $(
					'<table id="pageproperties-forms-datatable" class="pageproperties-datatable display" width="100%"></table>'
				),
				expanded: false,
				padded: true
			} );

			var toolbar = createToolbarA();

			var frame = new OO.ui.PanelLayout( {
				$content: [ toolbar.$element, contentFrame.$element ],
				expanded: false,
				framed: true,
				data: { name: 'manageforms' }
			} );

			$( '#forms-wrapper' ).append( frame.$element );

			toolbar.initialize();
			toolbar.emit( 'updateState' );
		}

		initializeDataTable();
	}

	return {
		initialize,
		updateVariables,
		createToolbarA,
		initializeDataTable
	};
}() );
