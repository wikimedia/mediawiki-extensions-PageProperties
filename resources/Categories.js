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
const Categories = ( function () {
	var Model = {};
	var processDialog;
	var SelectedItem;
	// eslint-disable-next-line no-shadow
	var Categories;
	var ImportedVocabulariesWidgetCategories;
	var DataTable;

	var windowManager = new OO.ui.WindowManager( {
		classes: [ 'pageproperties-ooui-window' ]
	} );

	$( document.body ).append( windowManager.$element );

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

	function updatePanel( data ) {
		switch ( data[ 'result-action' ] ) {
			case 'update':
				Categories = jQuery.extend(
					Categories,
					data.categories
				);
				break;
			case 'delete':
				for ( var property of data[ 'deleted-properties' ] ) {
					delete Categories[ property ];
				}
				break;

			case 'create':
				Categories = jQuery.extend(
					Categories,
					data.categories
				);
				Categories = PagePropertiesFunctions.sortObjectByKeys( Categories );
				break;

			case 'rename':
				delete Categories[ data[ 'previous-label' ] ];

				Categories = jQuery.extend(
					Categories,
					data.categories
				);
				Categories = PagePropertiesFunctions.sortObjectByKeys( Categories );
				break;
		}

		initialize( Categories, true );

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
	ProcessDialog.static.title = mw.msg(
		'pageproperties-jsmodule-manageproperties-define-category'
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

		var obj = {};
		switch ( action ) {
			case 'save':
				for ( var property in Model ) {
					obj[ property ] = getPropertyValue( property );
				}

			// eslint-disable no-fallthrough
			case 'delete':
				mw.loader.using( 'mediawiki.api', function () {
					new mw.Api()
						.postWithToken( 'csrf', {
							action: 'pageproperties-manageproperties-savecategory',
							dialogAction: action,
							previousLabel: SelectedItem.label,
							format: 'json',
							data: JSON.stringify( obj )
						} )
						.done( function ( res ) {
							if ( 'pageproperties-manageproperties-savecategory' in res ) {
								var data = res[ 'pageproperties-manageproperties-savecategory' ];
								if ( data[ 'result-action' ] === 'error' ) {
									OO.ui.alert( new OO.ui.HtmlSnippet( data.error ), {
										size: 'medium'
									} );
								} else {
									if ( updatePanel( data ) === true ) {
										windowManager.removeWindows( [ 'myDialog' ] );
									}
								}
							} else {
								OO.ui.alert( 'unknown error', { size: 'medium' } );
							}
						} );
				} );

				break;
		}

		return ProcessDialog.super.prototype.getActionProcess.call( this, action );
	};

	ProcessDialog.prototype.getTeardownProcess = function ( data ) {
		return ProcessDialog.super.prototype.getTeardownProcess
			.call( this, data )
			.first( function () {
				windowManager.removeWindows( [ 'myDialog' ] );
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

		/*
		if ( !DataLoaded ) {
			// eslint-disable-next-line no-console
			console.log( 'data not loaded' );
			return;
		}
*/

		Model = {};

		processDialog = new ProcessDialog( {
			size: 'larger'
		} );

		windowManager.addWindows( [ processDialog ] );

		windowManager.openWindow( processDialog );
	}

	function initializeDataTable() {
		var data = [];

		for ( var i in Categories ) {
			var value = Categories[ i ];
			data.push( [
				value.label,
				'_IMPO' in value.properties ?
					// eslint-disable-next-line no-underscore-dangle
					value.properties._IMPO.slice( -1 )[ 0 ] :
					''
			] );
		}

		DataTable = $( '#pageproperties-categories-datatable' ).DataTable( {
			order: 1,
			pageLength: 20,

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
			var label = data[ index ][ 0 ];

			openDialog( label );
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

	function initialize( categories ) {
		Categories = categories;
		$( '#categories-wrapper' ).empty();

		var contentFrame = new OO.ui.PanelLayout( {
			$content: $(
				'<table id="pageproperties-categories-datatable" class="display" width="100%"></table>'
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
		initialize
	};
}() );
