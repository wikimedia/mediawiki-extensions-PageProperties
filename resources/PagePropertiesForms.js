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
 * @author thomas-topway-it <business@topway.it>
 * @copyright Copyright © 2021-2022, https://wikisphere.org
 */

/* eslint-disable no-tabs */

// eslint-disable-next-line no-unused-vars
const PagePropertiesForms = ( function () {
	var PageProperties;
	var Config;
	var Model = {};
	var SelectedForm;
	var Forms;
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
	var WindowManagerAlert;

	function inArray( val, arr ) {
		return jQuery.inArray( val, arr ) !== -1;
	}

	function getPropertyValue( property, field ) {
		if ( !field ) {
			if ( property in Model ) {
				return 'getValue' in Model[ property ] ?
					Model[ property ].getValue() :
					Object.keys( Model[ property ] )
						.map( function ( k ) {
							return Model[ property ][ k ];
						} )
						.map( ( x ) => x.getValue() );
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
				Object.keys( Model.fields[ property ][ field ] )
					.map( function ( k ) {
						return Model.fields[ property ][ field ][ k ];
					} )
					.map( ( x ) => x.getValue() );
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
		var fields = SelectedForm.fields;
		var property = SelectedProperty.label;

		fields[ property ] = {};

		for ( var field of [
			'required',
			'default',
			'label',
			'help-message',
			'preferred-input',
			'multiple',
			'on-create-only',
			'value-formula',
			'options-values',
			'options-wikilist',
			'options-askquery',
			'askquery-printouts',
			'askquery-subject',
			'options-formula',
			'mapping-formula',
			'options-limit',
			'alternate-input'
		] ) {
			switch ( field ) {
				case 'help-message':
					if (
						Model.fields[ property ].selectHelpInput.getValue() === 'override'
					) {
						fields[ property ][ field ] =
							getPropertyValue( property, field ) || [];
					}
					continue;
				case 'label':
					if (
						Model.fields[ property ].selectLabelInput.getValue() === 'override'
					) {
						fields[ property ][ field ] =
							getPropertyValue( property, field ) || [];
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

			// clear unused options (necessary to determine the used method)
			if (
				inArray( field, [
					'options-values',
					'options-wikilist',
					'options-askquery'
				] ) &&
				property in Model.fields &&
				Model.fields[ property ].selectOptionsFrom.getValue() !== field
			) {
				fields[ property ][ field ] = '';
			}
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

		if ( Config.context !== 'ManageProperties' ) {
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

		var displayCategoriesInputValue = getPropertyValue( 'show-categories-input' );

		var displayCategoriesInputInput = new OO.ui.ToggleSwitchWidget( {
			value: displayCategoriesInputValue
		} );

		Model[ 'show-categories-input' ] = displayCategoriesInputInput;

		var categories = getPropertyValue( 'categories' );
		var categoriesInput = new mw.widgets.CategoryMultiselectWidget( {
			// value: categories,
		} );
		// ***prevents error "Cannot read properties of undefined (reading 'apiUrl')"
		for ( var category of categories ) {
			categoriesInput.addTag( category, category );
		}

		Model.categories = categoriesInput;

		var fieldCategoriesInput = new OO.ui.FieldLayout( categoriesInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-categories' ),
			align: 'top',
			help: mw.msg( 'pageproperties-jsmodule-forms-categories-help' ),
			helpInline: true
		} );

		// eslint-disable-next-line no-unused-vars
		displayCategoriesInputInput.on( 'change', function ( value ) {
			// fieldCategoriesInput.toggle( value );
		} );

		var contentModelValue = getPropertyValue( 'content-model' );

		var contentModelsInput = new OO.ui.DropdownInputWidget( {
			options: ManageProperties.createInputOptions( Config.contentModels ),
			$overlay: this.$overlay,
			value: contentModelValue || 'wikitext'
		} );

		Model[ 'content-model' ] = contentModelsInput;

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

			new OO.ui.FieldLayout( displayCategoriesInputInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-displaycategories' ),
				// help: mw.msg( 'pageproperties-jsmodule-manageproperties-multiple-fields-help' ),
				helpInline: true,
				align: 'top'
			} ),

			fieldCategoriesInput,

			new OO.ui.FieldLayout( contentModelsInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-contentmodels' ),
				align: 'top',
				help: mw.msg( 'pageproperties-jsmodule-forms-contentmodels-help' ),
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
		// fieldCategoriesInput.toggle( displayCategoriesInputValue );
		// fieldPagenameRoot.toggle(!pageNameFormulaValue);
	}
	OO.inheritClass( PageOneLayout, OO.ui.PageLayout );
	PageOneLayout.prototype.setupOutlineItem = function () {
		this.outlineItem.setLabel(
			mw.msg( 'pageproperties-jsmodule-manageproperties-main' )
		);
	};

	function orderSelectedFormFields( fields ) {
		if ( !$.fn.DataTable.isDataTable( '#pageproperties-forms-datatable-dialog' ) ) {
			return fields;
		}
		var ret = {};
		// eslint-disable-next-line no-unused-vars, array-callback-return
		DataTableB.rows().every( function ( rowIdx, tableLoop, rowLoop ) {
			var data = this.data();
			var label = data[ 1 ];
			ret[ label ] = fields[ label ];
		} );

		return ret;
	}

	function initializeDataTableB() {
		PagePropertiesFunctions.destroyDataTable(
			'pageproperties-forms-datatable-dialog'
		);

		var data = [];

		var n = 0;
		for ( var i in SelectedForm.fields ) {
			// it has been deleted after rendering
			// @TODO if a property has been renamed or
			// deleted refresh forms table as well
			if ( !( i in SemanticProperties ) ) {
				continue;
			}

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
				n,
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
			n++;
		}

		if ( !data.length ) {
			return;
		}

		DataTableB = $( '#pageproperties-forms-datatable-dialog' ).DataTable( {
			// order: 1,
			// pageLength: 20,
			// https://datatables.net/reference/option/dom
			dom: '<"pageproperties-datatable-left"f><"pageproperties-datatable-right"l>rtip',

			// ***Attention!! this conflicts with "rowReorder"
			// use instead an hidden column and set orderable to false
			// for all visible columns
			// ordering: false,
			iDisplayLength: 100,
			searching: false,
			paging: false,
			info: false,
			rowReorder: {
				// update: false,
				// dataSrc: 0,
				selector: 'td:not(:last-child)'
			},
			scrollX: true,
			columnDefs: [
				{ targets: 0, orderable: true, visible: false },
				{ orderable: false, targets: '_all' },
				{
					targets: 5,
					// eslint-disable-next-line no-unused-vars
					render: function ( data_, type, row, meta ) {
						return (
							'<span class="buttons-wrapper" data-property="' +
							row[ 1 ] +
							'"></span>'
						);
					}
				}
			],

			// lengthMenu: [ 10, 20, 50, 100, 200 ],
			// lengthChange: false,
			data: data,
			// stateSave: true,
			columns: [ '' ].concat( mw
				.msg( 'pageproperties-jsmodule-pageproperties-columns-forms-dialog' )
				.split( /\s*,\s*/ )
				.map( function ( x ) {
					return { title: x };
				} ) )
		} );

		$( '#pageproperties-forms-datatable-dialog .buttons-wrapper' ).each(
			function () {
				var buttonWidgetEdit = new OO.ui.ButtonWidget( {
					icon: 'edit'
					// flags: ["progressive"],
				} );

				// @todo, uncomment if the other panels can be re-initialized
				// without affecting the view
				if ( Config.context === 'ManageProperties' ) {
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

				if ( Config.context === 'ManageProperties' ) {
					buttonWidgetSettings.on( 'click', function () {
						ManageProperties.openDialog( label );
					} );
				}
				// buttonWidgetDelete.on("click", function () {});

				$( this ).append(
					buttonWidgetEdit.$element
					// buttonWidgetDelete.$element
				);

				if ( Config.context === 'ManageProperties' ) {
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

		var self = this;
		this.selectedItems = Object.keys( SelectedForm.fields );

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
					selected: inArray( x, self.selectedItems )
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
		var searchWidgetResults = searchWidget.getResults();
		searchWidgetResults.multiselect = true;

		// this.searchWidgetResults = searchWidgetResults;

		// we don't rely anymore on searchWidgetResults.findSelectedItems()
		// to handle non-visible highlighted items
		searchWidgetResults.on( 'press', function ( value ) {
			if ( value === null ) {
				return;
			}
			if ( inArray( value.data, self.selectedItems ) ) {
				self.selectedItems.splice( self.selectedItems.indexOf( value.data ), 1 );
			} else {
				self.selectedItems.push( value.data );
			}
		} );

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
			// var items = dialog.searchWidgetResults.findSelectedItems();
			// var selectedItems = items.map( ( x ) => x.data );

			// remove unselected properties
			for ( var label in SelectedForm.fields ) {
				if ( !inArray( label, dialog.selectedItems ) ) {
					delete SelectedForm.fields[ label ];
				}
			}

			// add new properties
			for ( var label of dialog.selectedItems ) {
				if ( !( label in SelectedForm.fields ) ) {
					SelectedForm.fields[ label ] = {};
				}
			}

			initializeDataTableB();
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
			if (
				PagePropertiesFunctions.getNestedProp(
					[ SelectedProperty.label, config.field, config.index ],
					Model.fields
				)
			) {
				delete Model.fields[ SelectedProperty.label ][ config.field ][ config.index ];
			}
			if (
				PagePropertiesFunctions.getNestedProp(
					[ SelectedProperty.label, config.field, config.index ],
					SelectedForm.fields
				)
			) {

				delete SelectedForm.fields[ SelectedProperty.label ][ config.field ][
					config.index
				];
			}
		} );

		var inputWidget = new OO.ui.MultilineTextInputWidget( {
			value: config.value,
			autosize: true,
			rows: 2
		} );

		Model.fields[ SelectedProperty.label ][ config.field ][ config.index ] =
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
	// ProcessDialogEditField.static.title = mw.msg(
	// 	"pageproperties-jsmodule-forms-definefield"
	// );
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

		var defaultValueInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( null, 'default' )
		} );

		Model.fields[ SelectedProperty.label ].default = defaultValueInput;

		var toggleInputOnCreate = new OO.ui.ToggleSwitchWidget( {
			value: !!getPropertyValue( null, 'on-create-only' )
		} );

		Model.fields[ SelectedProperty.label ][ 'on-create-only' ] =
			toggleInputOnCreate;

		var valueFormulaInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( null, 'value-formula' )
		} );

		Model.fields[ SelectedProperty.label ][ 'value-formula' ] = valueFormulaInput;

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

		// /////////////////	label-message	//////////////

		var labelMessages = getPropertyValue( null, 'label' ) || [];

		Model.fields[ SelectedProperty.label ].label = {};

		let labelOptionsList = new ListWidget();

		var addLabelOption = new OO.ui.ButtonWidget( {
			// label: "add option",
			icon: 'add'
		} );

		addLabelOption.on( 'click', function () {
			labelOptionsList.addItems( [
				new InnerItemWidget( {
					classes: [ 'InnerItemWidget' ],
					field: 'label',
					value: '',
					index: labelOptionsList.items.length
				} )
			] );
		} );

		for ( var i in labelMessages ) {
			labelOptionsList.addItems( [
				new InnerItemWidget( {
					classes: [ 'InnerItemWidget' ],
					field: 'label',
					value: labelMessages[ i ],
					index: i
				} )
			] );
		}

		var selectLabelInput = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'fromproperty',
					label: mw.msg(
						'pageproperties-jsmodule-forms-inheritfromproperty'
					)
				},
				{
					data: 'override',
					label: mw.msg( 'pageproperties-jsmodule-forms-distinctvalue' )
				}
			],
			value: labelMessages.length ? 'override' : 'fromproperty'
		} );

		Model.fields[ SelectedProperty.label ].selectLabelInput = selectLabelInput;

		var fieldLabelOptionsList = new OO.ui.FieldLayout( labelOptionsList, {
			label: new OO.ui.HtmlSnippet(
				mw.msg( 'pageproperties-jsmodule-forms-field-label-message' )
			),
			align: 'top'
			// help: ""
			// helpInline: true,
		} );

		selectLabelInput.on( 'change', function ( value ) {
			fieldLabelOptionsList.toggle( value === 'override' );
			addLabelOption.toggle( value === 'override' );
		} );

		// /////////////////	help-message	//////////////

		var helpMessages = getPropertyValue( null, 'help-message' ) || [];

		Model.fields[ SelectedProperty.label ][ 'help-message' ] = {};

		let helpOptionsList = new ListWidget();

		var addHelpOption = new OO.ui.ButtonWidget( {
			// label: "add option",
			icon: 'add'
		} );

		addHelpOption.on( 'click', function () {
			helpOptionsList.addItems( [
				new InnerItemWidget( {
					classes: [ 'InnerItemWidget' ],
					field: 'help-message',
					value: '',
					index: helpOptionsList.items.length
				} )
			] );
		} );

		for ( var i in helpMessages ) {
			helpOptionsList.addItems( [
				new InnerItemWidget( {
					classes: [ 'InnerItemWidget' ],
					field: 'help-message',
					value: helpMessages[ i ],
					index: i
				} )
			] );
		}

		var selectHelpInput = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'fromproperty',
					label: mw.msg(
						'pageproperties-jsmodule-forms-inheritfromproperty'
					)
				},
				{
					data: 'override',
					label: mw.msg( 'pageproperties-jsmodule-forms-distinctvalue' )
				}
			],
			value: helpMessages.length ? 'override' : 'fromproperty'
		} );

		Model.fields[ SelectedProperty.label ].selectHelpInput = selectHelpInput;

		var fieldHelpOptionsList = new OO.ui.FieldLayout( helpOptionsList, {
			label: new OO.ui.HtmlSnippet(
				mw.msg( 'pageproperties-jsmodule-forms-field-help-message' )
			),
			align: 'top'
			// help: ""
			// helpInline: true,
		} );

		selectHelpInput.on( 'change', function ( value ) {
			fieldHelpOptionsList.toggle( value === 'override' );
			addHelpOption.toggle( value === 'override' );
		} );

		// /////////////////	preferred-input	//////////////

		var preferredInputValue = getPropertyValue( null, 'preferred-input' );

		var options = ManageProperties.createInputOptions(
			ManageProperties.getAvailableInputs( SelectedProperty.type ).concat(
				'OO.ui.HiddenInputWidget'
			),
			{
				key: 'value'
			}
		);

		// *** unfortunately the following does not work well in
		// nested dialogs, so we fall down to a standard select

		// var availableInputs = new OO.ui.DropdownInputWidget( {
		// 	options: options,
		// 	// @see https://www.mediawiki.org/wiki/OOUI/Concepts#Overlays
		// 	$overlay: true,
		// 	value: preferredInputValue,
		// 	classes: [ "pageproperties-overlay-dropdown" ],
		// } );

		var availableInputs = new PagePropertiesDropdownWidget( { value: preferredInputValue, options: options } );

		Model.fields[ SelectedProperty.label ][ 'preferred-input' ] = availableInputs;

		var fieldAvailableInputs = new OO.ui.FieldLayout( availableInputs, {
			label: '',	// mw.msg( 'pageproperties-jsmodule-manageproperties-preferred-input' ),
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

		// only for

		// ManageProperties.optionsInputs

		/*

		'OO.ui.DropdownInputWidget',
		'OO.ui.ComboBoxInputWidget',
		'OO.ui.MenuTagMultiselectWidget',
		'OO.ui.RadioSelectInputWidget',
		'OO.ui.CheckboxMultiselectInputWidget'
*/

		// /////////////////	options	//////////////

		var optionsAsdefinedValue = getPropertyValue( null, 'options-values' ) || [];

		var wikilistValue = getPropertyValue( null, 'options-wikilist' );
		var askqueryValue = getPropertyValue( null, 'options-askquery' );

		var selectOptionsFrom = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'property',
					label: mw.msg( 'pageproperties-jsmodule-forms-optionsfrom-property' )
				},
				{
					data: 'options-values',
					label: mw.msg(
						'pageproperties-jsmodule-forms-optionsfrom-optionsvalues'
					)
				},
				{
					data: 'options-wikilist',
					label: mw.msg(
						'pageproperties-jsmodule-forms-optionsfrom-optionswikilist'
					)
				},
				{
					data: 'options-askquery',
					label: mw.msg(
						'pageproperties-jsmodule-forms-optionsfrom-optionsaskquery'
					)
				}
			],
			value: optionsAsdefinedValue.length ?
				'options-values' :
				wikilistValue ?
					'options-wikilist' :
					askqueryValue ?
						'options-askquery' :
						'property'
		} );

		// used to clear "options-values", "options-wikilist", "options-askquery"
		Model.fields[ SelectedProperty.label ].selectOptionsFrom = selectOptionsFrom;

		var fieldSelectOptionsFrom = new OO.ui.FieldLayout( selectOptionsFrom, {
			label: new OO.ui.HtmlSnippet(
				mw.msg( 'pageproperties-jsmodule-forms-field-options-from' )
			),
			align: 'top'
			// help: ""
			// helpInline: true,
		} );

		var optionsAsdefinedInput = new OO.ui.TagMultiselectWidget( {
			selected: optionsAsdefinedValue,
			allowArbitrary: true,
			orientation: 'vertical'
		} );

		Model.fields[ SelectedProperty.label ][ 'options-values' ] =
			optionsAsdefinedInput;

		var fieldOptionsAsdefined = new OO.ui.FieldLayout( optionsAsdefinedInput, {
			label: '',
			help: mw.msg( 'pageproperties-jsmodule-forms-field-optionsasdefined' ),
			helpInline: true,
			align: 'top'
		} );

		var wikilistInput = new mw.widgets.TitleInputWidget( {
			value: wikilistValue
		} );

		Model.fields[ SelectedProperty.label ][ 'options-wikilist' ] = wikilistInput;

		var fieldWikilist = new OO.ui.FieldLayout( wikilistInput, {
			label: '',
			help: mw.msg( 'pageproperties-jsmodule-forms-field-wikilist' ),
			helpInline: true,
			align: 'top'
		} );

		var askqueryInput = new OO.ui.TextInputWidget( {
			value: askqueryValue
		} );

		Model.fields[ SelectedProperty.label ][ 'options-askquery' ] = askqueryInput;

		var fieldAskquery = new OO.ui.FieldLayout( askqueryInput, {
			label: '',
			help: mw.msg( 'pageproperties-jsmodule-forms-field-askquery' ),
			helpInline: true,
			align: 'top'
		} );

		var printoutsInputValue =
			getPropertyValue( null, 'askquery-printouts' ) || [];

		var printoutsInput = new mw.widgets.TitlesMultiselectWidget( {
			selected: printoutsInputValue,

			// https://www.semantic-mediawiki.org/wiki/Help:Namespaces
			namespace: 102
		} );

		Model.fields[ SelectedProperty.label ][ 'askquery-printouts' ] = printoutsInput;

		var fieldPrintouts = new OO.ui.FieldLayout( printoutsInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-printouts' ),
			help: mw.msg( 'pageproperties-jsmodule-forms-field-printouts-help' ),
			helpInline: true,
			align: 'top'
		} );

		var querysubjectInput = new OO.ui.ToggleSwitchWidget( {
			value: !!getPropertyValue( null, 'askquery-subject' )
		} );

		Model.fields[ SelectedProperty.label ][ 'askquery-subject' ] =
			querysubjectInput;

		var fieldQuerysubject = new OO.ui.FieldLayout( querysubjectInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-querysubject' ),
			help: mw.msg( 'pageproperties-jsmodule-forms-field-querysubject-help' ),
			helpInline: true,
			align: 'top'
		} );

		var optionFormulaInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( null, 'options-formula' )
		} );

		Model.fields[ SelectedProperty.label ][ 'options-formula' ] = optionFormulaInput;

		var fieldOptionFormula = new OO.ui.FieldLayout( optionFormulaInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-optionformula' ),
			help: mw.msg( 'pageproperties-jsmodule-forms-field-optionformula-help' ),
			helpInline: true,
			align: 'top'
		} );

		// @credits: WikiTeq
		var optionMappingInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( null, 'mapping-formula' )
		} );

		Model.fields[ SelectedProperty.label ][ 'mapping-formula' ] = optionMappingInput;

		var fieldOptionMapping = new OO.ui.FieldLayout( optionMappingInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-mappingformula' ),
			help: mw.msg( 'pageproperties-jsmodule-forms-field-mappingformula-help' ),
			helpInline: true,
			align: 'top'
		} );
		// ///////////////////////////

		var optionslimitInputValue = getPropertyValue( null, 'options-limit' );
		var optionslimitInput = new OO.ui.NumberInputWidget( {
			value: optionslimitInputValue || 100
		} );

		Model.fields[ SelectedProperty.label ][ 'options-limit' ] = optionslimitInput;

		var fieldOptionslimit = new OO.ui.FieldLayout( optionslimitInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-optionslimit' ),
			help: mw.msg( 'pageproperties-jsmodule-forms-field-optionslimit-help' ),
			helpInline: true,
			align: 'top'
		} );

		var options = ManageProperties.createInputOptions( {
			autocomplete: mw.msg(
				'pageproperties-jsmodule-forms-alternateinput-autocomplete'
			),
			'infinite-scroll': mw.msg(
				'pageproperties-jsmodule-forms-alternateinput-infinite-scroll'
			)
		} );

		// var alternateInput = new OO.ui.DropdownInputWidget( {
		// 	options: options,
		// 	// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/classes/DialogWithDropdowns.js
		// 	$overlay: true,
		// 	value: getPropertyValue( 'alternate-input' )
		// } );

		var alternateInput = new PagePropertiesDropdownWidget( { value: getPropertyValue( 'alternate-input' ), options: options } );

		Model.fields[ SelectedProperty.label ][ 'alternate-input' ] = alternateInput;

		var fieldAlternateInput = new OO.ui.FieldLayout( alternateInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-alternateinput' ),
			align: 'top',
			help: mw.msg( 'pageproperties-jsmodule-forms-field-alternateinput-help' ),
			helpInline: true
		} );

		// /////////////////	multiple-input	//////////////

		var selectMultipleValueValue = getPropertyValue( null, 'multiple' );

		var multipleValueInput = new OO.ui.ToggleSwitchWidget( {
			value: selectMultipleValueValue
		} );

		Model.fields[ SelectedProperty.label ].multiple = multipleValueInput;

		var fieldMultipleValue = new OO.ui.FieldLayout( multipleValueInput, {
			label: '',
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

		var fieldSelectMultipleValue = new OO.ui.FieldLayout( selectMultipleValue, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-multiplevalue' ),
			helpInline: true,
			align: 'top'
		} );

		fieldSelectMultipleValue.toggle(
			!ManageProperties.isMultiselect( preferredInputValue )
		);

		selectMultipleValue.on( 'change', function ( value ) {
			fieldMultipleValue.toggle( value === 'override' );
		} );

		function onToggleHiddenInput( selected ) {
			toggleInputRequired.setDisabled( selected );
			toggleInputOnCreate.setDisabled( selected );
			selectHelpInput.setDisabled( selected );
			fieldLabelOptionsList.toggle( !selected );
			fieldHelpOptionsList.toggle( !selected );
			addHelpOption.toggle( !selected );
			addLabelOption.toggle( !selected );
			selectMultipleValue.setDisabled( selected );
			fieldMultipleValue.toggle(
				!ManageProperties.isMultiselect( availableInputs.getValue() ) && !selected
			);
		}

		selectAvailableInputs.on( 'change', function ( value ) {
			fieldAvailableInputs.toggle( value === 'override' );
			onToggleHiddenInput(
				value === 'fromproperty' ?
					false :
					availableInputs.getValue() === 'OO.ui.HiddenInputWidget'
			);
		} );

		fieldset.addItems( [
			new OO.ui.FieldLayout( toggleInputRequired, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-required' ),
				helpInline: true,
				align: 'top'
			} ),

			new OO.ui.FieldLayout( defaultValueInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-default' ),
				help: mw.msg( 'pageproperties-jsmodule-forms-field-default-help' ),
				helpInline: true,
				align: 'top'
			} ),

			new OO.ui.FieldLayout( selectLabelInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-labelmessage-label' ),
				helpInline: true,
				align: 'top'
			} ),

			fieldLabelOptionsList,
			addLabelOption,

			new OO.ui.FieldLayout( selectHelpInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-help-label' ),
				helpInline: true,
				align: 'top'
			} ),

			fieldHelpOptionsList,
			addHelpOption,

			new OO.ui.FieldLayout( selectAvailableInputs, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-preferredinput' ),
				helpInline: true,
				align: 'top'
			} ),

			fieldAvailableInputs,

			fieldSelectOptionsFrom,
			fieldOptionsAsdefined,
			fieldWikilist,
			fieldAskquery,
			fieldPrintouts,
			fieldQuerysubject,
			fieldOptionFormula,
			fieldOptionMapping,
			fieldOptionslimit,
			fieldAlternateInput,

			fieldSelectMultipleValue,
			fieldMultipleValue,

			new OO.ui.FieldLayout( toggleInputOnCreate, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-oncreateonly' ),
				help: mw.msg( 'pageproperties-jsmodule-forms-field-oncreateonly-help' ),
				helpInline: true,
				align: 'top'

			} ),

			new OO.ui.FieldLayout( valueFormulaInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-valueformula' ),
				help: mw.msg( 'pageproperties-jsmodule-forms-field-valueformula-help' ),
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

		fieldLabelOptionsList.toggle( labelMessages.length );
		fieldHelpOptionsList.toggle( helpMessages.length );
		addLabelOption.toggle( selectLabelInput.getValue() === 'override' );
		addHelpOption.toggle( selectHelpInput.getValue() === 'override' );

		fieldAvailableInputs.toggle( preferredInputValue );
		fieldMultipleValue.toggle(
			!ManageProperties.isMultiselect( preferredInputValue ) &&
				selectMultipleValueValue !== ''
		);

		function onSelectAvailableInputs() {
			var availableInputsValue = availableInputs.getValue();
			var selectOptionsFromValue = selectOptionsFrom.getValue();

			fieldSelectOptionsFrom.toggle(
				inArray( availableInputsValue, ManageProperties.optionsInputs )
			);
			fieldOptionsAsdefined.toggle(
				inArray( availableInputsValue, ManageProperties.optionsInputs ) &&
					( !selectOptionsFromValue ||
						selectOptionsFromValue === 'options-values' )
			);
			fieldWikilist.toggle(
				inArray( availableInputsValue, ManageProperties.optionsInputs ) &&
					selectOptionsFromValue === 'options-wikilist'
			);
			fieldAskquery.toggle(
				inArray( availableInputsValue, ManageProperties.optionsInputs ) &&
					selectOptionsFromValue === 'options-askquery'
			);
			fieldPrintouts.toggle(
				inArray( availableInputsValue, ManageProperties.optionsInputs ) &&
					selectOptionsFromValue === 'options-askquery'
			);
			fieldQuerysubject.toggle(
				inArray( availableInputsValue, ManageProperties.optionsInputs ) &&
					selectOptionsFromValue === 'options-askquery'
			);
			fieldOptionFormula.toggle(
				inArray( availableInputsValue, ManageProperties.optionsInputs ) &&
					selectOptionsFromValue === 'options-askquery'
			);
			fieldOptionMapping.toggle(
				inArray( availableInputsValue, ManageProperties.optionsInputs )
			);
			fieldOptionslimit.toggle(
				inArray( availableInputsValue, ManageProperties.optionsInputs )
			);
			fieldAlternateInput.toggle(
				inArray( availableInputsValue, ManageProperties.optionsInputs )
			);
		}

		selectOptionsFrom.on( 'change', function ( value ) {
			fieldOptionsAsdefined.toggle( value === 'options-values' );
			fieldWikilist.toggle( value === 'options-wikilist' );
			fieldAskquery.toggle( value === 'options-askquery' );
			fieldPrintouts.toggle( value === 'options-askquery' );
			fieldQuerysubject.toggle( value === 'options-askquery' );
			fieldOptionFormula.toggle( value === 'options-askquery' );
		} );

		availableInputs.on( 'change', function ( value ) {
			onToggleHiddenInput( value === 'OO.ui.HiddenInputWidget' );

			fieldSelectMultipleValue.toggle( !ManageProperties.isMultiselect( value ) );

			onSelectAvailableInputs();
		} );

		if ( preferredInputValue === 'OO.ui.HiddenInputWidget' ) {
			onToggleHiddenInput( true );
		}

		onSelectAvailableInputs();

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

		SelectedForm.fields = orderSelectedFormFields( SelectedForm.fields );

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

		WindowManagerSearch.openWindow( processDialogEditField, {
			title:
				mw.msg(
					// The following messages are used here:
					// * pageproperties-jsmodule-manageproperties-define-property
					// * pageproperties-jsmodule-manageproperties-define-property - [name]
					'pageproperties-jsmodule-forms-definefield'
				) +
				' - ' +
				SelectedProperty.label
		} );
	}

	function ProcessDialog( config ) {
		ProcessDialog.super.call( this, config );
	}
	OO.inheritClass( ProcessDialog, OO.ui.ProcessDialog );

	ProcessDialog.static.name = DialogName;
	// ProcessDialog.static.title = mw.msg(
	// 	"pageproperties-jsmodule-forms-defineform"
	// );
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
			'dialog-action': action,
			'previous-label': SelectedForm.label,
			format: 'json',
			formfields: {},
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

						// @TODO use it within getPropertyValue
						formFields.formName = formFields.formName.trim();

						// @TODO sanitize label

						if ( Model.selectPagenameInput.getValue() === 'formula' ) {
							delete formFields[ 'pagename-root' ];
						} else {
							delete formFields[ 'pagename-formula' ];
						}

						var alert = null;
						if ( formFields.formName === '' ) {
							alert = mw.msg( 'pageproperties-jsmodule-forms-alert-formname' );

						} else if ( SelectedForm.label === '' && ( formFields.formName in Forms ) ) {
							alert = mw.msg( 'pageproperties-jsmodule-manageproperties-existing-form' );

						} else if ( !Object.keys( SelectedForm.fields ).length ) {
							alert = mw.msg( 'pageproperties-jsmodule-forms-alert-fields' );
						}

						if ( alert ) {
							PagePropertiesFunctions.OOUIAlert(
								WindowManagerAlert,
								new OO.ui.HtmlSnippet( alert ),
								{ size: 'medium' }
							);

							return ProcessDialog.super.prototype.getActionProcess.call(
								this,
								action
							);
						}

						payload.fields = orderSelectedFormFields( SelectedForm.fields );
						payload.formfields = formFields;

					// eslint-disable no-fallthrough
					case 'delete':
						payload.formfields = JSON.stringify( payload.formfields );
						payload.fields = JSON.stringify( payload.fields );

						var callApi = function ( postData, resolve, reject ) {
							// console.log( 'postData', postData );
							new mw.Api()
								.postWithToken( 'csrf', postData )
								.done( function ( res ) {
									// console.log( 'res', res );
									resolve();
									if ( 'pageproperties-manageproperties-saveform' in res ) {
										var data = res[ 'pageproperties-manageproperties-saveform' ];
										if ( data[ 'result-action' ] === 'error' ) {
											PagePropertiesFunctions.OOUIAlert(
												WindowManagerAlert,
												new OO.ui.HtmlSnippet( data.error ),
												{
													size: 'medium'
												}
											);
										} else {
											if ( 'jobs-count-warning' in data ) {
												PagePropertiesFunctions.OOUIAlert(
													WindowManagerAlert,
													mw.msg(
														'pageproperties-jsmodule-create-jobs-alert',
														parseInt( data[ 'jobs-count-warning' ] )
													),
													{ size: 'medium' },
													callApi,
													[
														// eslint-disable-next-line max-len
														$.extend( postData, { 'confirm-job-execution': true } ),
														resolve,
														reject
													]
												);
											} else {
												if ( parseInt( data[ 'jobs-count' ] ) ) {
													PagePropertiesFunctions.OOUIAlert(
														WindowManagerAlert,
														mw.msg(
															'pageproperties-jsmodule-created-jobs',
															parseInt( data[ 'jobs-count' ] )
														),
														{ size: 'medium' }
													);
												}
												if ( updateData( data ) === true ) {
													WindowManager.removeWindows( [ DialogName ] );
												}
											}
										}
									} else {
										PagePropertiesFunctions.OOUIAlert(
											WindowManagerAlert,
											'unknown error',
											{ size: 'medium' }
										);
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
									PagePropertiesFunctions.OOUIAlert(
										WindowManagerAlert,
										mw.msg( msg ),
										{ size: 'medium' }
									);
								} );
						};
						return new Promise( ( resolve, reject ) => {
							mw.loader.using( 'mediawiki.api', function () {
								callApi( payload, resolve, reject );
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

			// ensure it is an object
			for ( var i in SelectedForm.fields ) {
				SelectedForm.fields[ i ] = jQuery.extend( SelectedForm.fields[ i ], {} );
			}
		}

		Model = { fields: {} };

		SelectedProperty = {};
		var processDialog = new ProcessDialog( {
			size: 'larger',
			id: 'pageproperties-ProcessDialogEditForm'
		} );

		WindowManager.addWindows( [ processDialog ] );

		var instance = WindowManager.openWindow( processDialog, {
			title:
				mw.msg(
					// The following messages are used here:
					// * pageproperties-jsmodule-forms-defineform
					// * pageproperties-jsmodule-forms-defineform - [name]
					'pageproperties-jsmodule-forms-defineform'
				) + ( label ? ' - ' + label : '' )
		} );

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
			if ( index !== undefined ) {
				var label = data[ index ][ 0 ];
				openDialog( label );
			}
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

	function preInitialize(
		config,
		windowManager,
		windowManagerSearch,
		windowManagerAlert
	) {
		Config = config;
		WindowManager = windowManager;
		WindowManagerSearch = windowManagerSearch;
		WindowManagerAlert = windowManagerAlert;
	}

	function initialize( pageProperties, semanticProperties, forms ) {
		if ( arguments.length ) {
			PageProperties = pageProperties;
			SemanticProperties = semanticProperties;
			Forms = forms;
		}

		if ( Config.context === 'ManageProperties' ) {
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
		initializeDataTable,
		preInitialize
	};
}() );
