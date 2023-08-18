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
 * @copyright Copyright © 2021-2023, https://wikisphere.org
 */

/* eslint-disable no-tabs */

// eslint-disable-next-line no-unused-vars
const PagePropertiesForms = ( function () {
	var PageProperties;
	// var PagePropertiesInputConfig;
	var PagePropertiesFormFieldInst;
	var PagePropertiesContentBlockInst;
	var Config;
	var Model = {};
	var SelectedForm;
	var Forms;
	var DataTable;
	var DataTableB;
	var DialogName = 'dialogForms';
	var WindowManager;

	function getPropertyValue( property ) {
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
			options: PagePropertiesFunctions.createDropDownOptions( {
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
			options: PagePropertiesFunctions.createDropDownOptions(
				Config.contentModels
			),
			$overlay: this.$overlay,
			value: contentModelValue || 'wikitext'
		} );

		Model[ 'content-model' ] = contentModelsInput;

		var fieldAlignInput = new OO.ui.DropdownInputWidget( {
			options: PagePropertiesFunctions.createDropDownOptions( {
				top: mw.msg(
					'pageproperties-jsmodule-forms-align-top'
				),
				left: mw.msg(
					'pageproperties-jsmodule-forms-freetext-left'
				),
				right: mw.msg(
					'pageproperties-jsmodule-forms-freetext-right'
				),
				inline: mw.msg(
					'pageproperties-jsmodule-forms-freetext-inline'
				)
			} ),
			// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/classes/DialogWithDropdowns.js
			$overlay: this.$overlay,
			value: getPropertyValue( 'field-align' ) || 'top'
		} );

		Model[ 'field-align' ] = fieldAlignInput;

		var popupHelpInput = new OO.ui.ToggleSwitchWidget( {
			value: getPropertyValue( 'popup-help' ) || false
		} );

		Model[ 'popup-help' ] = popupHelpInput;

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
			} ),

			new OO.ui.FieldLayout( fieldAlignInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-fieldalign-label' ),
				align: 'top',
				help: mw.msg( 'pageproperties-jsmodule-forms-fieldalign-help' ),
				helpInline: true
			} ),

			new OO.ui.FieldLayout( popupHelpInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-popuphelp-label' ),
				align: 'top',
				help: mw.msg( 'pageproperties-jsmodule-forms-popuphelp-help' ),
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

	function orderFields( fields ) {
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

		function getType( property ) {
			if ( property.type !== 'property' ) {
				return property.type;
			}
			var format =
				property[ 'property-model' ] === 'smw-property' ?
					property[ 'SMW-property' ] :
					property[ 'jsonSchema-type' ] === 'string' ?
						property[ 'jsonSchema-format' ] :
						property[ 'jsonSchema-type' ];
			return property[ 'property-model' ] + ' (' + format + ')';
		}

		var data = [];
		var n = 0;
		for ( var i in SelectedForm.fields ) {
			data.push( [
				n,
				// name
				i,
				// type
				getType( SelectedForm.fields[ i ] ),
				// input
				'preferred-input' in SelectedForm.fields[ i ] ?
					SelectedForm.fields[ i ][ 'preferred-input' ] :
					'n/a',
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
			columns: [ '' ].concat(
				mw
					.msg( 'pageproperties-jsmodule-pageproperties-columns-forms-dialog' )
					.split( /\s*,\s*/ )
					.map( function ( x ) {
						return { title: x };
					} )
			)
		} );

		$( '#pageproperties-forms-datatable-dialog .buttons-wrapper' ).each(
			function () {
				var buttonWidgetEdit = new OO.ui.ButtonWidget( {
					icon: 'edit'
					// flags: ["progressive"],
				} );

				var label = $( this ).data().property;

				buttonWidgetEdit.on( 'click', function () {
					if ( !( 'type' in SelectedForm.fields[ label ] ) ) {
						SelectedForm.fields[ label ].type = 'property';
					}
					switch ( SelectedForm.fields[ label ].type ) {
						case 'property':
							PagePropertiesFormFieldInst.openDialog(
								initializeDataTableB,
								SelectedForm.fields,
								label
							);
							break;

						case 'content-block':
							PagePropertiesContentBlockInst.openDialog(
								initializeDataTableB,
								SelectedForm.fields,
								label
							);
							break;
					}
				} );

				var buttonWidgetDelete = new OO.ui.ButtonWidget( {
					icon: 'close',
					flags: [ 'destructive' ]
				} );

				buttonWidgetDelete.on( 'click', function () {
					PagePropertiesFunctions.OOUIAlert(
						new OO.ui.HtmlSnippet(
							mw.msg( 'pageproperties-jsmodule-pageproperties-delete-confirm' )
						),
						{ size: 'medium' },
						function () {
							delete SelectedForm.fields[ label ];
							// *** or delete the row manually
							initializeDataTableB();
						}
					);
				} );

				$( this ).append( [
					buttonWidgetEdit.$element,
					buttonWidgetDelete.$element
				] );
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
			'form-fields': {},
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
						} else if (
							SelectedForm.label === '' &&
							formFields.formName in Forms
						) {
							alert = mw.msg(
								'pageproperties-jsmodule-manageproperties-existing-form'
							);
						} else if ( !Object.keys( SelectedForm.fields ).length ) {
							alert = mw.msg( 'pageproperties-jsmodule-forms-alert-fields' );
						}

						if ( alert ) {
							PagePropertiesFunctions.OOUIAlert( new OO.ui.HtmlSnippet( alert ), {
								size: 'medium'
							} );

							return ProcessDialog.super.prototype.getActionProcess.call(
								this,
								action
							);
						}

						payload.fields = orderFields( SelectedForm.fields );
						payload[ 'form-fields' ] = formFields;

					// eslint-disable no-fallthrough
					case 'delete':
						payload[ 'form-fields' ] = JSON.stringify( payload[ 'form-fields' ] );
						payload.fields = JSON.stringify( payload.fields );

						var callApi = function ( postData, resolve, reject ) {

							new mw.Api()
								.postWithToken( 'csrf', postData )
								.done( function ( res ) {
									// console.log( 'res', res );
									resolve();
									if ( 'pageproperties-manageproperties-saveform' in res ) {
										var data = res[ 'pageproperties-manageproperties-saveform' ];
										if ( data[ 'result-action' ] === 'error' ) {
											PagePropertiesFunctions.OOUIAlert(
												new OO.ui.HtmlSnippet( data.error ),
												{
													size: 'medium'
												}
											);
										} else {
											if ( 'jobs-count-warning' in data ) {
												PagePropertiesFunctions.OOUIAlert(
													mw.msg(
														'pageproperties-jsmodule-create-jobs-alert',
														parseInt( data[ 'jobs-count-warning' ] )
													),
													{ size: 'medium' },
													callApi,
													[

														$.extend( postData, { 'confirm-job-execution': true } ),
														resolve,
														reject
													]
												);
											} else {
												if ( parseInt( data[ 'jobs-count' ] ) ) {
													PagePropertiesFunctions.OOUIAlert(
														mw.msg(
															'pageproperties-jsmodule-created-jobs',
															parseInt( data[ 'jobs-count' ] )
														),
														{ size: 'medium' }
													);
												}
												if ( updateData( data ) === true ) {
													WindowManager.removeActiveWindow();
												}
											}
										}
									} else {
										PagePropertiesFunctions.OOUIAlert( 'unknown error', {
											size: 'medium'
										} );
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
									PagePropertiesFunctions.OOUIAlert( mw.msg( msg ), {
										size: 'medium'
									} );
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
				WindowManager.removeActiveWindow();
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
		var processDialog = new ProcessDialog( {
			size: 'larger',
			id: 'pageproperties-ProcessDialogEditForm'
		} );

		WindowManager.newWindow(
			processDialog,
			mw.msg(
				// The following messages are used here:
				// * pageproperties-jsmodule-forms-defineform
				// * pageproperties-jsmodule-forms-defineform - [name]
				'pageproperties-jsmodule-forms-defineform'
			) + ( label ? ' - ' + label : '' )
		);

		// instance.opening.then( function () {
		// 	initializeDataTableB();
		// } );
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
				case 'add-block-content':
					PagePropertiesContentBlockInst.openDialog(
						initializeDataTableB,
						SelectedForm.fields
					);
					break;

				case 'add-field':
					PagePropertiesFormFieldInst.openDialog(
						initializeDataTableB,
						SelectedForm.fields
					);
					break;
			}

			this.setActive( false );
		};

		var toolGroup = [
			{
				name: 'add-field',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-forms-add-field' ),
				onSelect: onSelect
			},
			{
				name: 'add-block-content',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-forms-add-block-content' ),
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

	function preInitialize( config, windowManager ) {
		Config = config;
		WindowManager = windowManager;
		PagePropertiesFormFieldInst = new PagePropertiesFormField(
			windowManager
			// pagePropertiesInputConfig
		);
		PagePropertiesContentBlockInst = new PagePropertiesContentBlock(
			windowManager
		);
	}

	function initialize(
		pageProperties,
		forms
	) {
		if ( arguments.length ) {
			PageProperties = pageProperties;
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
		createToolbarA,
		initializeDataTable,
		preInitialize,
		openDialog
	};
}() );
