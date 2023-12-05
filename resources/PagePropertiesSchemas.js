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
 * @copyright Copyright ©2023, https://wikisphere.org
 */

/* eslint-disable no-tabs */
/* eslint-disable no-underscore-dangle */

const PagePropertiesSchemas = ( function () {
	var PagePropertiesFormFieldInst;
	var PagePropertiesContentBlockInst;
	var Config;
	var Models = [];
	var SelectedItems = [];
	var Schemas;
	var DataTable;
	var DialogName = 'dialogSchemas';
	var WindowManager;
	var PagePropertiesForms = [];

	function getModel() {
		return Models[ Models.length - 1 ];
	}

	function getWidgetValue( obj ) {
		var ret = '';
		if ( 'getValue' in obj ) {
			ret = obj.getValue();
			if ( typeof ret === 'string' ) {
				return ret.trim();
			} else if ( Array.isArray( ret ) ) {
				return ret.map( ( x ) => x.trim() );
			}
			return ret;
		}
		return Object.keys( obj )
			.map( ( i ) => {
				return obj[ i ];
			} )
			.map( ( x ) => x.getValue() );
	}

	function getPropertyValue( property, propName, self ) {
		if ( !self ) {
			var self = PagePropertiesSchemas;
		}
		var model = self.getModel();

		if ( propName ) {
			model = model[ propName ];
		}
		if ( property in model ) {
			return getWidgetValue( model[ property ] );
		}

		var currentItem = self.getCurrentItem();

		if ( !currentItem ) {
			return '';
		}

		// new item
		if ( propName && currentItem.type !== 'array' ) {
			return '';
		}

		if (
			!propName &&
			currentItem.type === 'array' &&
			PagePropertiesFunctions.isObject( currentItem.items )
		) {
			currentItem = currentItem.items;
		}

		if ( !( 'wiki' in currentItem ) ) {
			// eslint-disable-next-line no-console
			console.error( 'missing "wiki" key' );
			return '';
		}

		if ( property in currentItem.wiki ) {
			return currentItem.wiki[ property ];
		}
		return '';
	}

	function getDatatableId( panel ) {
		return `pageproperties-schemas-datatable-dialog-${SelectedItems.length}-${panel}`;
	}

	function getCurrentItem() {
		if ( !SelectedItems.length ) {
			return null;
		}
		return SelectedItems[ SelectedItems.length - 1 ];
	}

	function updateData( data ) {
		switch ( data[ 'result-action' ] ) {
			case 'update':
				Schemas = jQuery.extend( Schemas, data.schemas );
				break;

			case 'delete':
				for ( var schemaName of data[ 'deleted-items' ] ) {
					delete Schemas[ schemaName ];
				}
				break;

			case 'create':
				Schemas = jQuery.extend( Schemas, data.schemas );
				Schemas = PagePropertiesFunctions.sortObjectByKeys( Schemas );
				break;

			case 'rename':
				delete Schemas[ data[ 'previous-label' ] ];
				Schemas = jQuery.extend( Schemas, data.schemas );
				Schemas = PagePropertiesFunctions.sortObjectByKeys( Schemas );
				break;
		}

		if ( Config.context !== 'ManageSchemas' ) {
			for ( var instance of PagePropertiesForms ) {
				instance.updateSchemas( Schemas );
			}
		}

		initialize();

		return true;
	}

	function orderFields( fields, panel ) {
		if ( !$.fn.DataTable.isDataTable( '#' + getDatatableId( panel ) ) ) {
			return fields;
		}
		var datatable = $( '#' + getDatatableId( panel ) ).DataTable();
		var ret = {};
		// eslint-disable-next-line no-unused-vars, array-callback-return
		datatable.rows().every( function ( rowIdx, tableLoop, rowLoop ) {
			var key = Object.keys( fields )[ rowIdx ];
			if ( key in fields ) {
				ret[ key ] = fields[ key ];
			}
		} );
		var newItems = {};
		for ( var i in fields ) {
			if ( !( i in ret ) ) {
				newItems[ i ] = fields[ i ];
			}
			delete fields[ i ];
		}
		for ( var i in ret ) {
			fields[ i ] = ret[ i ];
		}
		for ( var i in newItems ) {
			fields[ i ] = newItems[ i ];
		}
	}

	function initializeNestedDataTable( panel ) {
		var currentItem = getCurrentItem();

		// array items can share the same schema for
		// all items, or to contain a tuple (to be an
		// array of items of fixed length)
		// in the first case, we consider the schema
		// being the child schema,
		// in the second case being the parent schema
		// (in the first case, we will provide an
		// editable panel with the properties of the
		// parent schema)
		if (
			currentItem.type === 'array' &&
			PagePropertiesFunctions.isObject( currentItem.items )
		) {
			currentItem = currentItem.items;
		}

		orderFields( currentItem[ panel ], panel );

		PagePropertiesFunctions.destroyDataTable( getDatatableId( panel ) );

		function getType( thisItem ) {
			var ret;
			switch ( thisItem.wiki.type ) {
				case 'schema':
					ret = mw.msg( 'pageproperties-jsmodule-schemas-subitem' );
					break;
				case 'property':
					ret =
						'SMW-property' in thisItem ?
							thisItem[ 'SMW-property' ] :
							thisItem.wiki[ 'jsonSchema-type' ] +
							( thisItem.wiki[ 'jsonSchema-type' ] !== 'string' ?
								'' :
								' (' + thisItem.wiki[ 'jsonSchema-format' ] + ')' );

					if ( !( 'preferred-input' in thisItem.wiki ) ) {
						thisItem.wiki[ 'preferred-input' ] =
							PagePropertiesFunctions.getPreferredInput( thisItem.wiki );
					}
					break;
				case 'content-block':
					ret = mw.msg( 'pageproperties-jsmodule-schemas-content-block' );
					break;
			}
			return ret;
		}

		// this returns a modified item, the object schema
		// or the array schema "subject" in case of
		// array, with name of parent schema
		function getItem( thisItem ) {
			var thisItem = JSON.parse( JSON.stringify( thisItem ) );
			if ( !( 'wiki' in thisItem ) ) {
				thisItem.wiki = { name: '' };
			}

			// handle from property panel
			// @TODO handle tuple
			if (
				thisItem.type === 'array' &&
				PagePropertiesFunctions.isObject( thisItem.items ) &&
				thisItem.items.type !== 'array'
			) {
				var ret = thisItem.items;
				ret.wiki.name = thisItem.wiki.name;
				return { item: ret, isArray: true };
			}
			return { item: thisItem, isArray: false };
		}

		var n = 0;
		var data = [];
		var propName = panel;

		for ( var i in currentItem[ propName ] ) {
			var { item, isArray } = getItem( currentItem[ propName ][ i ] );
			var required = '';
			// var input = '';
			var multiple = '';
			if ( item.wiki.type === 'property' ) {
				// input = item.wiki[ 'preferred-input' ];
				required = item.wiki.required ?
					mw.msg( 'pageproperties-jsmodule-formfield-required' ) :
					mw.msg( 'pageproperties-jsmodule-formfield-not-required' );
			} else {
				required = mw.msg( 'pageproperties-jsmodule-formfield-n/a' );
				// input = mw.msg( 'pageproperties-jsmodule-formfield-n/a' );
			}
			if ( isArray ) {
				multiple = mw.msg( 'pageproperties-jsmodule-schemas-multiple' );
			}
			var type = getType( item );
			data.push( [
				n,
				item.wiki.name,
				type,
				// input
				multiple,
				required,
				''
			] );

			n++;
		}

		if ( !data.length ) {
			return;
		}

		$( '#' + getDatatableId( panel ) ).DataTable( {
			// order: 1,
			// pageLength: 20,
			// https://datatables.net/reference/option/dom
			dom: '<"pageproperties-datatable-left"f><"pageproperties-datatable-right"l>rtip',

			// @ATTENTION! this conflicts with "rowReorder"
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
					render: function ( data_, thisType, row, meta ) {
						return (
							'<span class="buttons-wrapper" style="white-space:nowrap" data-row="' +
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
			columns: [ '' ].concat(
				mw
					.msg( 'pageproperties-jsmodule-pageproperties-columns-schemas-dialog' )
					.split( /\s*,\s*/ )
					.map( function ( x ) {
						return { title: x };
					} )
			)
		} );

		$( '#' + getDatatableId( panel ) + ' .buttons-wrapper' ).each( function () {
			var buttonWidgetEdit = new OO.ui.ButtonWidget( {
				icon: 'edit'
				// flags: ["progressive"],
			} );

			var row = $( this ).data().row;
			var key = Object.keys( currentItem[ propName ] )[ row ];

			// this is the modified item, the object schema
			// or the array schema "subject" in case of
			// array, with name of parent schema

			// eslint-disable-next-line no-unused-vars
			const { item: thisItem, isArray: thisIsArray } = getItem( currentItem[ propName ][ key ] );

			if ( !( 'type' in thisItem.wiki ) ) {
				thisItem.wiki.type = 'property';
			}

			var targetItem =
				currentItem.type !== 'array' ?
					currentItem[ propName ] :
					currentItem.items[ propName ];

			var callback = function () {
				initializeNestedDataTable( panel );
			};

			buttonWidgetEdit.on( 'click', function () {
				// switch by subschema type (if array)
				switch ( thisItem.wiki.type ) {
					case 'property':
						PagePropertiesFormFieldInst.openDialog( callback, targetItem, key );
						break;

					case 'content-block':
						PagePropertiesContentBlockInst.openDialog(
							callback,
							targetItem,
							key
						);
						break;

					case 'schema':
						// pass the child schema, we don't pass the target
						// item since the dialog must handle the parent schema
						// as well (in case of array)
						openDialog( currentItem[ propName ][ key ], propName );
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
						delete currentItem[ propName ][ key ];
						// *** or delete the row manually
						initializeNestedDataTable( panel );
					}
				);
			} );
			$( this ).append( [ buttonWidgetEdit.$element, buttonWidgetDelete.$element ] );
		} );

		// DataTables[DataTables.length - 1].draw();
	}

	function PageTwoLayout( name, config ) {
		PageTwoLayout.super.call( this, name, config );

		this.name = name;

		var toolbar = createToolbarB( name );

		var contentFrame = new OO.ui.PanelLayout( {
			$content: $(
				// display
				'<table id="' +
					getDatatableId( name ) +
					'" class="pageproperties-datatable" width="100%"></table>'
			), // this.fieldset.$element,
			expanded: false,
			padded: false,
			classes: [ 'pageproperties-schemas-properties-contentframe' ]
		} );

		var frameA = new OO.ui.PanelLayout( {
			$content: [ toolbar.$element, contentFrame.$element ],
			expanded: false,
			// framed: false,
			padded: false,
			data: { name: 'manage-schemas' }
		} );

		this.$element.append( frameA.$element );
	}

	OO.inheritClass( PageTwoLayout, OO.ui.PageLayout );
	PageTwoLayout.prototype.setupOutlineItem = function () {
		this.outlineItem.setLabel(
			// Messages that can be used here:
			// * pageproperties-jsmodule-schemas-panel-properties
			// * pageproperties-jsmodule-schemas-panel-oneOf
			mw.msg( 'pageproperties-jsmodule-schemas-panel-' + this.name )
		);
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
			label: mw.msg( 'pageproperties-jsmodule-dialog-delete' ),
			flags: 'destructive'
		},
		{
			action: 'save',
			modes: 'edit',
			label: mw.msg( 'pageproperties-jsmodule-dialog-save' ),
			flags: [ 'primary', 'progressive' ]
		},
		{
			modes: 'edit',
			label: mw.msg( 'pageproperties-jsmodule-dialog-cancel' ),
			flags: [ 'safe', 'close' ]
		}
	];

	ProcessDialog.prototype.initialize = function () {
		ProcessDialog.super.prototype.initialize.apply( this, arguments );
		this.page1 = new PageOneLayout( 'page1', {} );

		this.page2 = new PageTwoLayout( 'properties', {
			classes: [ 'pageproperties-schemas-panel-properties' ]
		} );

		// *** the following requires more brainstorming
		// specifically, anyOf and oneOf are expected to
		// be objects, not properties in the same schema
		// so addField should be disabled in this case
		// or should inherit the current schema ...
		/*
		this.page3 = new PageTwoLayout("anyOf", {
			classes: ["pageproperties-schemas-panel-properties"],
		});
		this.page4 = new PageTwoLayout("oneOf", {
			classes: ["pageproperties-schemas-panel-properties"],
		});
		// this.page5 = new PageTwoLayout("prefixItems", {
		// 	classes: ["pageproperties-schemas-panel-properties"],
		// });
		this.page5 = new PageTwoLayout("allOf", {
			classes: ["pageproperties-schemas-panel-properties"],
		});
		this.page6 = new PageTwoLayout("additionalProperties", {
			classes: ["pageproperties-schemas-panel-properties"],
		});
		*/

		var booklet = new OO.ui.BookletLayout( {
			outlined: true,
			expanded: true,
			padded: false
		} );

		booklet.addPages( [
			this.page1,
			this.page2
			// this.page3,
			// this.page4,
			// this.page5,
			// this.page6,
		] );
		booklet.setPage( 'page1' );

		booklet.on( 'set', function ( value ) {
			if (
				value.name !== 'page1' &&
				!$.fn.DataTable.isDataTable( '#' + getDatatableId( value.name ) )
			) {
				// $('#pageproperties-forms-datatable-dialog').DataTable().clear().draw();
				initializeNestedDataTable( value.name );
			}
		} );

		this.$body.append( booklet.$element );

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader(
				'#pageproperties-ProcessDialogEditSchemas'
			);
		}, 30 );
	};

	ProcessDialog.prototype.getActionProcess = function ( action ) {
		if (
			!action ||
			( action === 'delete' &&
				// eslint-disable-next-line no-alert
				!confirm( mw.msg( 'pageproperties-jsmodule-schemas-delete-confirm' ) ) )
		) {
			return ProcessDialog.super.prototype.getActionProcess.call( this, action );
		}

		var currentItem = getCurrentItem();

		var payload = {
			action: 'pageproperties-save-schema',
			'dialog-action': action,
			'previous-label': currentItem.wiki.name,
			'target-page': Config.targetPage,
			format: 'json',
			schema: {}
		};
		// https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs#Action_sets
		return ProcessDialog.super.prototype.getActionProcess
			.call( this, action )
			.next( function () {
				switch ( action ) {
					case 'save':
						var obj = { type: 'schema' };
						var model = Models[ 0 ];

						// var propName = currentItem.type === 'array' ? 'items': 'properties'

						for ( var i in model ) {
							obj[ i ] = getPropertyValue( i );
						}

						// @TODO sanitize label

						var alert = null;
						if ( obj.name === '' ) {
							alert = mw.msg( 'pageproperties-jsmodule-schemas-alert-noname' );
						} else if ( currentItem.wiki.name === '' && obj.name in Schemas ) {
							alert = mw.msg(
								'pageproperties-jsmodule-schemas-alert-existing-schema'
							);
						} else if (
							!Object.keys( currentItem.properties ).length
							//  && !Object.keys(currentItem.allOf).length &&
							// !Object.keys(currentItem.anyOf).length &&
							// !Object.keys(currentItem.oneOf).length
						) {
							alert = mw.msg(
								'pageproperties-jsmodule-schemas-alert-no-properties'
							);
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

						delete obj.parentSchema;
						payload.schema.wiki = obj;
						payload.schema.type = 'object';

						for ( var panel of [
							'properties'
							// "anyOf",
							// "oneOf",
							// "additionalProperties",
						] ) {
							if ( Object.keys( currentItem[ panel ] ).length ) {
								payload.schema[ panel ] = currentItem[ panel ];
								orderFields( payload.schema[ panel ], panel );
							} else {
								delete payload.schema[ panel ];
							}
						}

					// eslint-disable-next-line no-fallthrough
					case 'delete':
						// console.log("payload", JSON.parse(JSON.stringify(payload)));
						payload.schema = JSON.stringify( payload.schema );

						// return;
						var callApi = function ( postData, resolve, reject ) {
							new mw.Api()
								.postWithToken( 'csrf', postData )
								.done( function ( res ) {
									resolve();
									if ( payload.action in res ) {
										var data = res[ payload.action ];
										if ( 'schemas' in data ) {
											data.schemas = JSON.parse( data.schemas );
										}
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
														$.extend( postData, {
															'confirm-job-execution': true
														} ),
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
													Models.pop();
													SelectedItems.pop();
													WindowManager.removeActiveWindow();
													initializeDataTable();
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
									// eslint-disable-next-line no-console
									console.error( 'res', res );
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

						// eslint-disable-next-line compat/compat
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
				Models.pop();
				SelectedItems.pop();
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

	function ProcessDialogNested( config ) {
		ProcessDialogNested.super.call( this, config );

		this.data = config.data;
	}
	OO.inheritClass( ProcessDialogNested, OO.ui.ProcessDialog );

	ProcessDialogNested.static.name = DialogName;

	ProcessDialogNested.static.actions = [
		/*
		{
			action: 'delete',
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-delete' ),
			flags: 'destructive'
		},
		*/
		{
			action: 'save',
			modes: 'edit',
			label: mw.msg( 'pageproperties-jsmodule-dialog-save' ),
			flags: [ 'primary', 'progressive' ]
		},
		{
			modes: 'edit',
			label: mw.msg( 'pageproperties-jsmodule-dialog-cancel' ),
			flags: [ 'safe', 'close' ]
		}
	];

	ProcessDialogNested.prototype.initialize = function () {
		ProcessDialogNested.super.prototype.initialize.apply( this, arguments );
		this.page1 = new PageOneLayoutNested( 'page1', {} );
		this.page2 = new PageTwoLayout( 'properties', {
			classes: [ 'pageproperties-schemas-panel-properties' ]
		} );
		/*
		this.page3 = new PageTwoLayout("anyOf", {
			classes: ["pageproperties-schemas-panel-properties"],
		});
		this.page4 = new PageTwoLayout("oneOf", {
			classes: ["pageproperties-schemas-panel-properties"],
		});

		this.page5 = new PageTwoLayout("allOf", {
			classes: ["pageproperties-schemas-panel-properties"],
		});
		// this.page5 = new PageTwoLayout("prefixItems", {
		// 	classes: ["pageproperties-schemas-panel-properties"],
		// });
		this.page6 = new PageTwoLayout("additionalProperties", {
			classes: ["pageproperties-schemas-panel-properties"],
		});
		*/

		var booklet = new OO.ui.BookletLayout( {
			outlined: true,
			expanded: true,
			padded: false
		} );

		booklet.addPages( [
			this.page1,
			this.page2
			// this.page3,
			// this.page4,
			// this.page5,
			// this.page6,
		] );
		booklet.setPage( 'page1' );

		booklet.on( 'set', function ( value ) {
			if (
				value.name !== 'page1' &&
				!$.fn.DataTable.isDataTable( '#' + getDatatableId( value.name ) )
			) {
				// $('#pageproperties-forms-datatable-dialog').DataTable().clear().draw();
				initializeNestedDataTable( value.name );
			}
		} );

		this.$body.append( booklet.$element );

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader(
				'#pageproperties-ProcessDialogEditProperties'
			);
		}, 30 );
	};

	function handleSaveArray( currentItem, obj ) {
		var parentSchema = obj.parentSchema;
		delete obj.parentSchema;

		// *** important !! otherwise it will be processed
		// as field by PagePropertiesSchemaProcessor
		if ( obj[ 'multiple-items' ] ) {
			parentSchema.type = 'schema';
		}

		if (
			( obj[ 'multiple-items' ] && currentItem.type === 'array' ) ||
			( !obj[ 'multiple-items' ] && currentItem.type !== 'array' )
		) {
			if ( obj[ 'multiple-items' ] ) {
				currentItem.wiki = parentSchema;
				currentItem.items = $.extend( currentItem.items, { wiki: obj } );
				return currentItem;
			}

			currentItem.wiki = obj;
			return currentItem;
		}

		// move child to parent
		if ( !obj[ 'multiple-items' ] ) {
			// currentItem.type should be always array
			return $.extend(
				currentItem.type === 'array' ? currentItem.items : currentItem,
				{ wiki: obj }
			);
		}

		// create parent - child
		return {
			type: 'array',
			wiki: parentSchema,
			items: $.extend( currentItem, { wiki: obj } )
		};
	}

	ProcessDialogNested.prototype.getActionProcess = function ( action ) {
		var dialog = this;

		if (
			!action ||
			( action === 'delete' &&
				// eslint-disable-next-line no-alert
				!confirm( mw.msg( 'pageproperties-jsmodule-schemas-delete-confirm' ) ) )
		) {
			//	return ProcessDialogNested.super.prototype.getActionProcess.call( this, action );
		}

		var data = this.data;
		var propName = data.propName;

		var currentItem = getCurrentItem();
		var parentSchema = currentItem;
		if (
			currentItem.type === 'array' &&
			PagePropertiesFunctions.isObject( currentItem.items )
		) {
			currentItem = currentItem.items;
		}

		function getValueRec( thisModel, thisObj ) {
			for ( var i in thisModel ) {
				if ( !( 'getValue' in thisModel[ i ] ) ) {
					getValueRec( thisModel[ i ], ( thisObj[ i ] = {} ) );
				} else {
					thisObj[ i ] = getWidgetValue( thisModel[ i ] );
				}
			}
		}

		switch ( action ) {
			case 'delete':
				if ( parentSchema.wiki.name !== '' ) {
					delete SelectedItems[ SelectedItems.length - 1 ][ propName ][
						parentSchema.wiki.name
					];
				}
				break;

			case 'save':
				var model = Models[ Models.length - 1 ];
				var ParentObj = SelectedItems[ SelectedItems.length - 2 ];

				var obj = { type: 'schema' };
				getValueRec( model, obj );

				var objName = obj[ 'multiple-items' ] ? obj.parentSchema.name : obj.name;

				var target =
					ParentObj.type !== 'array' ?
						ParentObj[ propName ] :
						ParentObj.items[ propName ];

				var alert = null;
				if ( objName === '' ) {
					alert = mw.msg( 'pageproperties-jsmodule-schemas-alert-noname' );

					// @see PagePropertiesFormField
				} else if ( objName !== parentSchema.wiki.name && objName in target ) {
					alert = mw.msg( 'pageproperties-jsmodule-schemas-alert-existing-item' );
				} else if (
					!Object.keys( currentItem.properties ).length
					//  && !Object.keys(currentItem.allOf).length &&
					// !Object.keys(currentItem.anyOf).length &&
					// !Object.keys(currentItem.oneOf).length
				) {
					alert = mw.msg( 'pageproperties-jsmodule-schemas-alert-no-properties' );
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

				PagePropertiesFunctions.renameObjectKey(
					target,
					parentSchema.wiki.name,
					objName
				);

				var updatedSchema = handleSaveArray( parentSchema, obj );
				updatedSchema.type = !obj[ 'multiple-items' ] ? 'object' : 'array';

				var panels = [
					'properties'
					// "anyOf",
					// "oneOf",
					// "allOf",
					// "additionalProperties",
				];

				var target_ = !obj[ 'multiple-items' ] ?
					updatedSchema :
					updatedSchema.items;

				for ( var panel of panels ) {
					if ( panel in target_ ) {
						orderFields( target_[ panel ], panel );
					}
				}

				target[ objName ] = updatedSchema;
				break;
		}

		return new OO.ui.Process( function () {
			dialog.close( { action: action } );
		} );

		// return ProcessDialogNested.super.prototype.getActionProcess.call( this, action );
	};

	ProcessDialogNested.prototype.getTeardownProcess = function ( data ) {
		var self = this;
		return ProcessDialogNested.super.prototype.getTeardownProcess
			.call( this, data )
			.first( function () {
				Models.pop();
				SelectedItems.pop();
				initializeNestedDataTable( self.data.propName );
				WindowManager.removeActiveWindow();
			}, this );
	};

	/**
	 * Override getBodyHeight to create a tall dialog relative to the screen.
	 *
	 * @return {number} Body height
	 */
	ProcessDialogNested.prototype.getBodyHeight = function () {
		// see here https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs
		// this.page1.content.$element.outerHeight( true );
		return window.innerHeight - 100;
	};

	function PageOneLayout( name, config ) {
		PageOneLayout.super.call( this, name, config );

		var currentItem = getCurrentItem();

		var model = Models[ Models.length - 1 ];

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		//  || currentItem.wiki.name
		var nameInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( 'name' )
		} );

		model.name = nameInput;

		var titleInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( 'title' )
		} );

		model.title = titleInput;

		var descriptionInput = new OO.ui.MultilineTextInputWidget( {
			autosize: true,
			rows: 2,
			value: getPropertyValue( 'description' )
		} );

		model.description = descriptionInput;

		var messageWidget = new OO.ui.MessageWidget( {
			type: 'info',
			label: new OO.ui.HtmlSnippet(
				mw.msg(
					'pageproperties-jsmodule-formfield-message-schemapage',
					`${Config.PagePropertiesSchemaUrl}${getPropertyValue( 'name' )}`
				)
			),

			invisibleLabel: false,
			classes: [ 'PagePropertiesFormFieldMessage' ]
		} );

		messageWidget.toggle( currentItem.wiki.name !== '' );

		fieldset.addItems( [
			messageWidget,
			new OO.ui.FieldLayout( nameInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-name' ),
				align: 'top'
			} ),

			new OO.ui.FieldLayout( titleInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-title' ),
				help: mw.msg( 'pageproperties-jsmodule-schemas-title-help' ),
				align: 'top',
				helpInline: true
			} ),

			new OO.ui.FieldLayout( descriptionInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-description' ),
				help: mw.msg( 'pageproperties-jsmodule-schemas-description-help' ),
				helpInline: true,
				align: 'top'
			} )

			// new OO.ui.FieldLayout(collapsibleInput, {
			// 	label: mw.msg("pageproperties-jsmodule-schemas-collapsible"),
			// 	align: "top",
			// 	help: mw.msg("pageproperties-jsmodule-schemas-collapsible-help"),
			// 	helpInline: true,
			// }),

			// new OO.ui.FieldLayout(collapsedInput, {
			// 	label: mw.msg("pageproperties-jsmodule-schemas-collapsed"),
			// 	align: "top",
			// 	help: mw.msg("pageproperties-jsmodule-schemas-collapsed-help"),
			// 	helpInline: true,
			// }),
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
			mw.msg( 'pageproperties-jsmodule-dialog-main' )
		);
	};

	function parentSchemaContainer( model, self ) {
		if ( !self ) {
			var self = PagePropertiesSchemas;
		}
		var layout = new OO.ui.PanelLayout( {
			expanded: false,
			padded: true,
			framed: true,
			classes: []
		} );
		var fieldset = new OO.ui.FieldsetLayout( {
			label: mw.msg( 'pageproperties-jsmodule-schemas-container-schema' )
		} );

		layout.$element.append( fieldset.$element );

		var nameInput = new OO.ui.TextInputWidget( {
			value: self.getPropertyValue( 'name', 'parentSchema' )
		} );

		model.name = nameInput;

		var titleInput = new OO.ui.TextInputWidget( {
			value: self.getPropertyValue( 'title', 'parentSchema' )
		} );

		model.title = titleInput;

		var descriptionInput = new OO.ui.MultilineTextInputWidget( {
			autosize: true,
			rows: 2,
			value: self.getPropertyValue( 'description', 'parentSchema' )
		} );

		model.description = descriptionInput;

		// @TODO
		// add:
		// min: number, at least: number
		// layout: section, horizontal, greed
		// collapsible: toggle
		// collasped: toggle
		var minItemsInput = new OO.ui.NumberInputWidget( {
			value: self.getPropertyValue( 'min-items', 'parentSchema' ),
			type: 'number'
		} );
		var maxItemsInput = new OO.ui.NumberInputWidget( {
			value: self.getPropertyValue( 'max-items', 'parentSchema' ),
			type: 'number'
		} );

		model[ 'min-items' ] = minItemsInput;
		model[ 'max-items' ] = maxItemsInput;

		var uniqueItemsInput = new OO.ui.ToggleSwitchWidget( {
			value: self.getPropertyValue( 'unique-items', 'parentSchema' )
		} );

		model[ 'unique-items' ] = uniqueItemsInput;

		var fieldMinItems = new OO.ui.FieldLayout( minItemsInput, {
			label: mw.msg( 'pageproperties-jsmodule-schemas-min-items' ),
			align: 'top',
			help: mw.msg( 'pageproperties-jsmodule-schemas-min-items-help' ),
			helpInline: true
		} );

		var fieldMaxItems = new OO.ui.FieldLayout( maxItemsInput, {
			label: mw.msg( 'pageproperties-jsmodule-schemas-max-items' ),
			align: 'top',
			help: mw.msg( 'pageproperties-jsmodule-schemas-max-items-help' ),
			helpInline: true
		} );

		var fieldUniqueItems = new OO.ui.FieldLayout( uniqueItemsInput, {
			label: mw.msg( 'pageproperties-jsmodule-schemas-unique-items' ),
			align: 'top',
			help: mw.msg( 'pageproperties-jsmodule-schemas-unique-items-help' ),
			helpInline: true
		} );

		var messageWidget = new OO.ui.MessageWidget( {
			type: 'info',
			label: new OO.ui.HtmlSnippet(
				mw.msg(
					'pageproperties-jsmodule-schemas-message-container-info'
				)
			),

			invisibleLabel: false,
			classes: [ 'PagePropertiesFormFieldMessage' ]
		} );

		fieldset.addItems( [
			messageWidget,

			new OO.ui.FieldLayout( nameInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-name' ),
				align: 'top'
			} ),

			new OO.ui.FieldLayout( titleInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-title' ),
				help: mw.msg( 'pageproperties-jsmodule-schemas-title-help' ),
				align: 'top',
				helpInline: true
			} ),

			new OO.ui.FieldLayout( descriptionInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-description' ),
				help: mw.msg( 'pageproperties-jsmodule-schemas-description-help' ),
				helpInline: true,
				align: 'top'
			} ),
			fieldMinItems,
			fieldMaxItems,
			fieldUniqueItems
		] );

		return layout;
	}

	function PageOneLayoutNested( name, config ) {
		PageOneLayoutNested.super.call( this, name, config );

		var currentItem = getCurrentItem();
		var parentSchema = {};

		// array items can share the same schema for
		// all items, or to contain a tuple (to be an
		// array of items of fixed length)
		// in the first case, we consider the schema
		// being the child schema,
		// in the second case being the parent schema
		// (in the firse case, we will provide an
		// editable panel with the properties of the
		// parent schema)
		if (
			currentItem.type === 'array' &&
			PagePropertiesFunctions.isObject( currentItem.items )
		) {
			parentSchema = currentItem;
			currentItem = currentItem.items;
		}

		var model = Models[ Models.length - 1 ];

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		//  || currentItem.wiki.name
		var nameInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( 'name' )
		} );

		model.name = nameInput;

		var titleInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( 'title' )
		} );

		model.title = titleInput;

		var descriptionInput = new OO.ui.MultilineTextInputWidget( {
			autosize: true,
			rows: 2,
			value: getPropertyValue( 'description' )
		} );

		model.description = descriptionInput;

		// *** TODO, manage arrays and tuples
		// @see https://json-schema.org/understanding-json-schema/reference/array.html#tuple-validation

		var multipleItemsInputValue =
			getPropertyValue( 'multiple-items' ) || parentSchema.type === 'array';

		var multipleItemsInput = new OO.ui.ToggleSwitchWidget( {
			value: multipleItemsInputValue
		} );

		model[ 'multiple-items' ] = multipleItemsInput;

		var layoutParentSchema = parentSchemaContainer( ( model.parentSchema = {} ) );
		layoutParentSchema.toggle( multipleItemsInputValue );

		multipleItemsInput.on( 'change', function ( enabled ) {
			layoutParentSchema.toggle( enabled );
		} );

		// var layout = new OO.ui.HorizontalLayout( {
		// 	items: [ minInstancesInput, maxInstancesInput ]
		// } );

		var layoutInput = new OO.ui.DropdownInputWidget( {
			options: PagePropertiesFunctions.createDropDownOptions( {
				section: mw.msg( 'pageproperties-jsmodule-schemas-layout-section' ),
				horizontal: mw.msg( 'pageproperties-jsmodule-schemas-layout-horizontal' )
				// 'grid': mw.msg(
				// 	'pageproperties-jsmodule-forms-freetext-showalways'
				// )
			} ),
			value: getPropertyValue( 'layout' ) || 'section'
		} );

		model.layout = layoutInput;

		fieldset.addItems( [
			new OO.ui.FieldLayout( nameInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-name' ),
				align: 'top'
			} ),

			new OO.ui.FieldLayout( titleInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-title' ),
				help: mw.msg( 'pageproperties-jsmodule-schemas-title-help' ),
				align: 'top',
				helpInline: true
			} ),

			new OO.ui.FieldLayout( descriptionInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-description' ),
				align: 'top'
			} ),

			new OO.ui.FieldLayout( multipleItemsInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-multiple-items' ),
				align: 'top',
				help: mw.msg( 'pageproperties-jsmodule-schemas-multiple-items-help' ),
				// 'Toggle on to allow multiple items', // mw.msg(),
				helpInline: true
			} ),

			layoutParentSchema,

			new OO.ui.FieldLayout( layoutInput, {
				label: mw.msg( 'pageproperties-jsmodule-schemas-layout' ),
				align: 'top',
				help: mw.msg( 'pageproperties-jsmodule-schemas-layout-help' ),
				helpInline: true
			} )
		] );

		this.content = new OO.ui.PanelLayout( {
			$content: fieldset.$element,
			padded: true,
			expanded: false
		} );

		this.$element.append( this.content.$element );
	}

	OO.inheritClass( PageOneLayoutNested, OO.ui.PageLayout );

	PageOneLayoutNested.prototype.setupOutlineItem = function () {
		this.outlineItem.setLabel(
			mw.msg( 'pageproperties-jsmodule-dialog-main' )
		);
	};

	function loadSchemas( schemas ) {
		var payload = {
			action: 'pageproperties-get-schemas',
			schemas: schemas.join( '|' )
		};

		// eslint-disable-next-line compat/compat
		return new Promise( ( resolve, reject ) => {

			new mw.Api()
				.postWithToken( 'csrf', payload )
				.done( function ( res ) {
					// console.log('pageproperties-get-schemas res', res)
					if ( payload.action in res ) {
						var thisSchemas = JSON.parse( res[ payload.action ].schemas );

						for ( var i in thisSchemas ) {
							Schemas[ i ] = thisSchemas[ i ];
						}
						resolve();

						for ( var instance of PagePropertiesForms ) {
							instance.updatePanels();
						}
					}
				} )
				.fail( function ( res ) {
					// eslint-disable-next-line no-console
					console.error( 'ProcessDialogSearch error', res );

					reject( res );
				} );
		} );
	}

	function openDialog( schema, propName ) {
		if ( !schema ) {
			SelectedItems.push( {
				properties: {},

				// treat as objects
				// items: {},
				// anyOf: {},
				// oneOf: {},
				// allOf: {},

				// additionalProperties: {},
				wiki: { name: '' }
			} );
		} else {
			SelectedItems.push(
				jQuery.extend(
					{
						properties: {},

						// treat as objects
						// items: {},
						// anyOf: {},
						// oneOf: {},
						// allOf: {},
						// additionalProperties: {},
						wiki: {}
					},
					schema
				)
			);
		}

		Models.push( { parentSchema: {} } );

		var processDialog;
		var title;

		if ( !propName ) {
			processDialog = new ProcessDialog( {
				size: 'larger',
				id: 'pageproperties-ProcessDialogEditSchema'
			} );

			title =
				mw.msg(
					// The following messages are used here:
					// * pageproperties-jsmodule-schemas-defineschema
					// * pageproperties-jsmodule-schemas-defineschema - [name]
					'pageproperties-jsmodule-schemas-defineschema'
				) + ( name ? ' - ' + name : '' );
		} else {
			processDialog = new ProcessDialogNested( {
				size: 'larger',
				id: 'pageproperties-ProcessDialogEditProperties',
				data: { propName: propName }
			} );

			title =
				mw.msg(
					// The following messages are used here:
					// * pageproperties-jsmodule-schemas-defineschema
					// * pageproperties-jsmodule-schemas-defineschema - [name]
					'pageproperties-jsmodule-schemas-defineschema'
				) + ( name ? ' - ' + name : '' );
		}

		WindowManager.newWindow( processDialog, { title: title } );
	}

	// function escape( s ) {
	// 	return String( s )
	// 		.replace( /&/g, '&amp;' )
	// 		.replace( /</g, '&lt;' )
	// 		.replace( />/g, '&gt;' )
	// 		.replace( /"/g, '&quot;' )
	// 		.replace( /'/g, '&#039;' );
	// }

	function initializeDataTable() {
		PagePropertiesFunctions.destroyDataTable(
			'pageproperties-schemas-datatable'
		);

		var data = [];
		for ( var i in Schemas ) {
			var value = Schemas[ i ];

			// *** or use https://datatables.net/manual/data/renderers#Text-helper
			data.push( [
				i,
				'properties' in value ? Object.keys( value.properties ).join( ', ' ) : ''
			] );
		}

		DataTable = $( '#pageproperties-schemas-datatable' ).DataTable( {
			order: 1,
			pageLength: 20,

			// https://datatables.net/reference/option/dom
			dom: '<"pageproperties-datatable-left"f><"pageproperties-datatable-right"l>rtip',
			lengthMenu: [ 10, 20, 50, 100, 200 ],
			// lengthChange: false,
			data: data,
			stateSave: true,
			columns: mw
				.msg( 'pageproperties-jsmodule-schemas-columns' )
				.split( /\s*,\s*/ )
				.map( function ( x ) {
					return { title: x };
				} )
		} );

		DataTable.on( 'click', 'tr', function () {
			var index = DataTable.row( this ).index();
			if ( index !== undefined ) {
				var label = data[ index ][ 0 ];

				if ( !Object.keys( Schemas[ label ] ).length ) {
					loadSchemas( [ label ] ).then( function () {
						openDialog( Schemas[ label ], null, false );
					} );
				} else {
					openDialog( Schemas[ label ], null, false );
				}
			}
		} );
	}

	function createToolbarB( panelName ) {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
		} );

		var currentItem = getCurrentItem();
		// var propName = currentItem.type === "array" ? "items" : panelName;
		var propName = panelName;

		var onSelect = function () {
			var toolName = this.getName();

			var callback = function () {
				initializeNestedDataTable( panelName );
			};
			switch ( toolName ) {
				case 'add-block-content':
					PagePropertiesContentBlockInst.openDialog(
						callback,
						currentItem.type !== 'array' ?
							currentItem[ propName ] :
							currentItem.items[ propName ]
					);
					break;

				case 'add-field':
					PagePropertiesFormFieldInst.openDialog(
						callback,
						currentItem.type !== 'array' ?
							currentItem[ propName ] :
							currentItem.items[ propName ]
					);
					break;

				case 'add-subitem':
					openDialog( null, propName );
					break;
			}

			this.setActive( false );
		};

		var toolGroup = [
			{
				name: 'add-field',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-schemas-add-field' ),
				onSelect: onSelect
			},
			{
				name: 'add-block-content',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-schemas-add-block-content' ),
				onSelect: onSelect
			},
			{
				name: 'add-subitem',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-schemas-add-subitem' ),
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
				case 'createschema':
					openDialog( null, null );
					break;
			}

			this.setActive( false );
		};

		var toolGroup = [
			{
				name: 'createschema',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-schemas-create-schema' ),
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

	function preInitialize( config, windowManager, schemas, pagePropertiesForms ) {
		Config = config;
		WindowManager = windowManager;
		Schemas = schemas;
		PagePropertiesForms = pagePropertiesForms;

		PagePropertiesFormFieldInst = new PagePropertiesFormField(
			config,
			windowManager,
			Schemas
		);
		PagePropertiesContentBlockInst = new PagePropertiesContentBlock(
			config,
			windowManager
		);
	}

	function initialize() {
		if ( Config.context === 'ManageSchemas' ) {
			$( '#schemas-wrapper' ).empty();

			var contentFrame = new OO.ui.PanelLayout( {
				$content: $(
					'<table id="pageproperties-schemas-datatable" class="pageproperties-datatable display" width="100%"></table>'
				),
				expanded: false,
				padded: true
			} );

			var toolbar = createToolbarA();

			var frame = new OO.ui.PanelLayout( {
				$content: [ toolbar.$element, contentFrame.$element ],
				expanded: false,
				framed: true,
				data: { name: 'manage-schemas' }
			} );

			$( '#schemas-wrapper' ).append( frame.$element );

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
		openDialog,
		parentSchemaContainer,
		getPropertyValue,
		getCurrentItem,
		getModel,
		handleSaveArray,
		getWidgetValue,
		loadSchemas
	};
}() );
