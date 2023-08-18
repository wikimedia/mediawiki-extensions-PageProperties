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

// eslint-disable-next-line no-unused-vars
const PagePropertiesCategories = ( function () {
	var Model = {};
	var processDialog;
	var SelectedItem;
	var Categories;
	var ImportedVocabulariesWidgetCategories;
	var DataTable;
	var WindowManager;

	function getPropertyValue( property ) {
		if ( property in Model ) {
			return Model[ property ].getValue();
		}

		if ( !( property in SelectedItem.properties ) ) {
			return '';
		}

		var propertyValue = SelectedItem.properties[ property ];

		return propertyValue.slice( -1 )[ 0 ];
	}

	function updateData( data ) {
		switch ( data[ 'result-action' ] ) {
			case 'update':
				Categories = jQuery.extend( Categories, data.categories );
				break;
			case 'delete':
				for ( var property of data[ 'deleted-properties' ] ) {
					delete Categories[ property ];
				}
				break;

			case 'create':
				Categories = jQuery.extend( Categories, data.categories );
				Categories = PagePropertiesFunctions.sortObjectByKeys( Categories );
				break;

			case 'rename':
				delete Categories[ data[ 'previous-label' ] ];

				Categories = jQuery.extend( Categories, data.categories );
				Categories = PagePropertiesFunctions.sortObjectByKeys( Categories );
				break;
		}

		initialize();

		return true;
	}

	function PageOneLayout( name, config ) {
		PageOneLayout.super.call( this, name, config );

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		var textInputWidget = new OO.ui.TextInputWidget( {
			value: SelectedItem.label
		} );

		Model.label = textInputWidget;

		ImportedVocabulariesWidgetCategories =
			ManageProperties.getImportedVocabulariesWidgetCategories();

		ImportedVocabulariesWidgetCategories.setValue( getPropertyValue( '_IMPO' ) );

		// eslint-disable-next-line no-underscore-dangle
		Model._IMPO = ImportedVocabulariesWidgetCategories;

		fieldset.addItems( [
			new OO.ui.FieldLayout( textInputWidget, {
				label: mw.msg( 'pageproperties-jsmodule-manageproperties-name' ),
				align: 'top'
			} ),

			new OO.ui.FieldLayout(
				// OO.ui.SearchInputWidget
				ImportedVocabulariesWidgetCategories,
				{
					label: mw.msg( 'pageproperties-jsmodule-manageproperties-imported' ),
					align: 'top'
				}
			)
		] );

		this.content = new OO.ui.PanelLayout( {
			$content: fieldset.$element,
			padded: true,
			expanded: false
		} );

		this.$element.append( this.content.$element );
	}
	OO.inheritClass( PageOneLayout, OO.ui.PageLayout );
	PageOneLayout.prototype.setupOutlineItem = function () {
		this.outlineItem.setLabel(
			mw.msg( 'pageproperties-jsmodule-manageproperties-main' )
		);
	};

	function ProcessDialog( config ) {
		ProcessDialog.super.call( this, config );
	}
	OO.inheritClass( ProcessDialog, OO.ui.ProcessDialog );

	ProcessDialog.static.name = 'myDialog';
	// ProcessDialog.static.title = mw.msg(
	// 'pageproperties-jsmodule-manageproperties-define-category'
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

		var booklet = new OO.ui.BookletLayout( {
			outlined: true,
			expanded: true
		} );

		booklet.addPages( [ this.page1 ] );
		booklet.setPage( 'one' );

		this.$body.append( booklet.$element );
	};

	ProcessDialog.prototype.getActionProcess = function ( action ) {
		if (
			!action ||
			( action === 'delete' &&
				// eslint-disable-next-line no-alert
				!confirm(
					mw.msg( 'pageproperties-jsmodule-manageproperties-delete-confirm' )
				) )
		) {
			return ProcessDialog.super.prototype.getActionProcess.call( this, action );
		}

		// https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs#Action_sets
		return ProcessDialog.super.prototype.getActionProcess
			.call( this, action )
			.next( function () {
				var obj = {};
				switch ( action ) {
					case 'save':
						for ( var property in Model ) {
							obj[ property ] = getPropertyValue( property );
						}

						// @TODO use it within getPropertyValue
						obj.label = obj.label.trim();

						// @TODO sanitize label

						var alert = null;
						if ( obj.label === '' ) {
							alert = mw.msg(
								'pageproperties-jsmodule-forms-alert-categoryname'
							);
						} else if ( SelectedItem.label === '' && ( obj.label in Categories ) ) {
							alert = mw.msg(
								'pageproperties-jsmodule-manageproperties-existing-category'
							);
						}

						if ( alert ) {
							PagePropertiesFunctions.OOUIAlert(
								new OO.ui.HtmlSnippet( alert ),
								{ size: 'medium' }
							);

							return ProcessDialog.super.prototype.getActionProcess.call(
								this,
								action
							);
						}

					// eslint-disable no-fallthrough
					case 'delete':
						var callApi = function ( payload, resolve, reject ) {
							new mw.Api()
								.postWithToken( 'csrf', payload )
								.done( function ( res ) {
									if ( 'pageproperties-manageproperties-savecategory' in res ) {
										var data =
											res[ 'pageproperties-manageproperties-savecategory' ];
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
														// eslint-disable-next-line max-len
														$.extend( payload, { 'confirm-job-execution': true } ),
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
										PagePropertiesFunctions.OOUIAlert(
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
										mw.msg( msg ),
										{ size: 'medium' }
									);
								} );
						};
						return new Promise( ( resolve, reject ) => {
							mw.loader.using( 'mediawiki.api', function () {
								callApi( {
									action: 'pageproperties-manageproperties-savecategory',
									'dialog-action': action,
									'previous-label': SelectedItem.label,
									format: 'json',
									data: JSON.stringify( obj )
								}, resolve, reject );
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
			SelectedItem = { label: '', properties: [] };
		} else {
			SelectedItem = Categories[ label ];
		}

		Model = {};

		processDialog = new ProcessDialog( {
			size: 'larger'
		} );

		WindowManager.newWindow( processDialog, mw.msg(
			// The following messages are used here:
			// * pageproperties-jsmodule-manageproperties-define-category
			// * pageproperties-jsmodule-manageproperties-define-category - [name]
			'pageproperties-jsmodule-manageproperties-define-category'
		) + ( label ? ' - ' + label : '' ) );
	}

	function initializeDataTable() {
		PagePropertiesFunctions.destroyDataTable(
			'pageproperties-categories-datatable'
		);
		var data = [];

		for ( var i in Categories ) {
			var value = Categories[ i ];
			data.push( [
				value.label,
				'_IMPO' in value.properties ? // eslint-disable-next-line no-underscore-dangle
					value.properties._IMPO.slice( -1 )[ 0 ] :
					''
			] );
		}

		DataTable = $( '#pageproperties-categories-datatable' ).DataTable( {
			order: 1,
			pageLength: 20,
			scrollX: true,
			// https://datatables.net/reference/option/dom
			dom: '<"pageproperties-datatable-left"f><"pageproperties-datatable-right"l>rtip',

			lengthMenu: [ 10, 20, 50, 100, 200 ],
			// lengthChange: false,
			data: data,
			stateSave: true,
			columns: mw
				.msg( 'pageproperties-jsmodule-pageproperties-columns-categories' )
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

	function createToolbar() {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
		} );

		var onSelect = function () {
			var toolName = this.getName();

			switch ( toolName ) {
				case 'createcategory':
					openDialog();
					break;
			}

			this.setActive( false );
		};

		var toolGroup = [
			{
				name: 'createcategory',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-pageproperties-create-category' ),
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

	function preInitialize( windowManager ) {
		WindowManager = windowManager;
	}

	function initialize( categories ) {
		if ( arguments.length ) {
			Categories = categories;
		}

		$( '#categories-wrapper' ).empty();

		var contentFrame = new OO.ui.PanelLayout( {
			$content: $(
				'<table id="pageproperties-categories-datatable" class="pageproperties-datatable display" width="100%"></table>'
			),
			expanded: false,
			padded: true
		} );

		var toolbar = createToolbar();

		var frame = new OO.ui.PanelLayout( {
			$content: [ toolbar.$element, contentFrame.$element ],
			expanded: false,
			framed: true,
			data: { name: 'managecategories' }
		} );

		$( '#categories-wrapper' ).append( frame.$element );

		toolbar.initialize();
		toolbar.emit( 'updateState' );

		initializeDataTable();
	}

	return {
		initialize,
		createToolbar,
		preInitialize
	};
}() );
