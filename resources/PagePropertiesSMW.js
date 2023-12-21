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

// @TODO to be reintegrated ...

// eslint-disable-next-line no-unused-vars
const PagePropertiesSMW = ( function () {
	var Config;

	// eslint-disable-next-line no-unused-vars
	var PageProperties;
	var Model = {};
	var SemanticProperties;
	var ImportedVocabularies;
	var PropertyLabels;
	var TypeLabels;
	var ImportedVocabulariesWidget;
	var ImportedVocabulariesWidgetCategories;
	var SelectedProperty;
	var processDialog;
	var DataTable;
	var WindowManager;

	function inArray( val, arr ) {
		return arr.indexOf( val ) !== -1;
	}

	function getSemanticProperties() {
		return SemanticProperties;
	}

	function getSemanticProperty( label, prop ) {
		if ( label in SemanticProperties ) {
			var ret = $.extend( { label: label }, SemanticProperties[ label ] );
			if ( prop ) {
				return ( prop in ret ? ret[ prop ] : null );
			}
			return ret;
		}
		return null;
	}

	function getAvailableInputs( dataType ) {
		//  "OO.ui.TextInputWidget"
		// allowed types:'text', 'password' 'email', 'url' or 'number'

		var ret = [];
		switch ( dataType ) {
			// Annotation URI
			case '_anu':
				// @TODO use an object in the form { 'OO.ui.TextInputWidget-type-url': mw.msg() },
				ret = [ 'OO.ui.TextInputWidget (url)' ];
				break;

			// email
			case '_ema':
				ret = [ 'OO.ui.TextInputWidget (email)' ];
				break;

			// Quantity
			case '_qty':
				ret = [ 'OO.ui.NumberInputWidget', 'OO.ui.TextInputWidget (number)' ];
				break;

			// number
			case '_num':
				ret = [ 'OO.ui.NumberInputWidget', 'OO.ui.TextInputWidget (number)', 'RatingWidget' ];
				break;

			// temperature
			case '_tem':
				ret = [ 'OO.ui.NumberInputWidget', 'OO.ui.TextInputWidget (number)' ];
				break;

			// Record
			case '_rec':
				ret = [ 'OO.ui.TextInputWidget' ];
				break;

			// External identifier
			case '_eid':
				ret = [ 'OO.ui.TextInputWidget' ];
				break;

			// Reference
			case '_ref_rec':
				ret = [ 'OO.ui.TextInputWidget' ];
				break;

			// Monolingual text
			case '_mlt_rec':
				ret = [ 'OO.ui.MultilineTextInputWidget' ];
				break;

			// Keyword
			case '_keyw':
				ret = [ 'OO.ui.TagMultiselectWidget' ];
				break;

			// Geographic coordinates
			case '_geo':
				ret = [ 'OO.ui.TextInputWidget' ];
				break;

			case '_uri':
				ret = [ 'OO.ui.TextInputWidget (url)' ];
				break;

			// code
			case '_cod':
				ret = [
					'OO.ui.TextInputWidget',
					'OO.ui.TextInputWidget (number)',
					'OO.ui.NumberInputWidget'
				];
				break;

			// telephone
			case '_tel':
				ret = [
					'intl-tel-input',
					'OO.ui.TextInputWidget (tel)',
					'OO.ui.TagMultiselectWidget'
				];
				break;

			// boolean
			case '_boo':
				ret = [ 'OO.ui.ToggleSwitchWidget' ];
				break;

			case '_dat':
				ret = [
					'mw.widgets.DateInputWidget (precision day)',
					'mw.widgets.DateInputWidget (precision month)',
					'mw.widgets.datetime.DateTimeInputWidget'
				];
				break;

			case '_wpg':
				ret = [
					'mw.widgets.TitlesMultiselectWidget',
					'mw.widgets.TitleInputWidget',
					'mw.widgets.UsersMultiselectWidget',
					'mw.widgets.UserInputWidget',
					'OO.ui.SelectFileWidget'
				];
				break;

			case '_txt':
				ret = [
					'OO.ui.TextInputWidget',
					'OO.ui.TagMultiselectWidget',
					'OO.ui.MultilineTextInputWidget',
					'LookupElement',
					'MenuTagSearchMultiselect',
					'mw.widgets.CategoryMultiselectWidget',
					'OO.ui.SelectFileWidget',
					'OO.ui.TextInputWidget (password)'
				];
		}

		var filter = [ '_boo', '_wpg' ];
		if ( !inArray( dataType, filter ) ) {
			ret = ret.concat( optionsInputs );
		}

		return ret;
	}

	function getAvailablePropertiesOfDataType( dataType ) {
		// available for all data types
		var ret = [
			'_PVAL', // Allows value
			'_URI', // Equivalent URI
			'_SERV', // Provides service
			'_SUBP', // Subproperty of
			'_PVAP', // Allows pattern
			'_PDESC', // Has property description
			'_PVUC', // Has uniqueness constraint
			'_PVALI', // Allows value list
			'_PPLB' // Has preferred property label
		];

		// https://www.semantic-mediawiki.org/wiki/Help:List_of_datatypes
		var additional = [];
		// ***display options based on the input type
		switch ( dataType ) {
			// Annotation URI - for imported properties
			case '_anu':
				break;

			// email
			case '_ema':
				break;

			// Quantity
			case '_qty':
				additional = [ '_CONV', '_UNIT', '_PREC' ];
				break;

			// number
			case '_num':
				additional = [ '_CONV', '_UNIT', '_PREC' ];

				break;

			// temperature
			case '_tem':
				additional = [ '_CONV', '_UNIT', '_PREC' ];

				break;

			// Record
			case '_rec':
				additional = [ '_LIST' ];
				break;

			// External identifier
			case '_eid':
				additional = [ '_PEFU' ];
				break;

			// Reference
			case '_ref_rec':
				additional = [ '_LIST' ];
				break;

			// Monolingual text
			case '_mlt_rec':
				break;

			// Keyword
			case '_keyw':
				break;

			// Geographic coordinates
			case '_geo':
				break;

			case '_uri':
				break;

			// code
			case '_cod':
				break;

			// telephone
			case '_tel':
				break;

			// boolean
			case '_boo':
				var filter = [ '_PVAP' ];
				ret = ret.filter( ( x ) => !inArray( x, filter ) );
				break;

			case '_dat':
				break;

			case '_wpg':
				break;

			case '_txt':
				break;
		}

		return ret.concat( additional );
	}

	function propertyAllowsMultipleValues( property ) {
		return !inArray( property, [
			'label', // custom
			'_TYPE', // type
			'_IMPO', // import
			'_PVAP', // Allows pattern
			'_PVUC', // Has uniqueness constraint - only true
			'_PREC', // Display precision of
			// "_SUBP", // Subproperty of - because the input type
			'_PVALI' // Allows value list
		] );
	}

	function getHelpPage( property ) {
		var host = 'https://www.semantic-mediawiki.org/wiki/';

		var help_page = {
			_PVAL: 'Help:Special_property_Allows_value',
			_URI: 'Help:Special_property_Equivalent_URI',
			_CONV: 'Help:Special_property_Corresponds_to',
			_UNIT: 'Help:Special_property_Display_units',
			_SERV: 'Help:Special_property_Provides_service',
			_SUBP: 'Help:Special_property_Subproperty_of',
			_LIST: 'Help:Special_property_Has_fields',
			_PVAP: 'Help:Special_property_Allows_pattern',
			_PREC: 'Help:Special_property_Display_precision_of',
			_PDESC: 'Help:Special_property_Has_property_description',
			_PVUC: 'Help:Special_property_Has_uniqueness_constraint',
			_PVALI: 'Help:Special_property_Allows_value_list',
			_PEFU: 'Help:Special_property_External_formatter_URI',
			_PEID: 'Help:Special_property_External_identifier',
			_PPLB: 'Help:Special_property_Has_preferred_property_label'
		};
		return host + help_page[ property ];
	}

	function inputNameOfProperty( property ) {
		switch ( property ) {
			// Allows value
			case '_PVAL':
				return 'OO.ui.TextInputWidget';
			// Corresponds to
			case '_CONV':
				return 'OO.ui.TextInputWidget';
			// Display units
			case '_UNIT':
				return 'OO.ui.TextInputWidget';
			// Equivalent URI
			case '_URI':
				return 'OO.ui.TextInputWidget.url';
			// Provides service
			case '_SERV':
				return 'OO.ui.TextInputWidget';
			// Subproperty of
			case '_SUBP':
				return 'mw.widgets.TitlesMultiselectWidget.Property';

			// Has fields
			case '_LIST':
				return 'OO.ui.TextInputWidget';

			// Allows pattern
			case '_PVAP':
				return 'OO.ui.TextInputWidget';

			// Display precision of
			case '_PREC':
				return 'OO.ui.NumberInputWidget';

			// Has property description
			case '_PDESC':
				return 'OO.ui.MultilineTextInputWidget';

			// Has uniqueness constraint
			case '_PVUC':
				return 'OO.ui.ToggleSwitchWidget';

			// Allows value list
			case '_PVALI':
				return 'mw.widgets.TitleInputWidget.MediaWiki';

			// External formatter URI
			case '_PEFU':
				return 'OO.ui.TextInputWidget.url';

			// External identifier - not used ?
			case '_PEID':
				break;
			// Has preferred property label
			case '_PPLB':
				return 'OO.ui.TextInputWidget';

			default:
				return 'OO.ui.TextInputWidget';
		}
	}

	function getPropertyValue( property ) {
		var allowsMultipleValues = propertyAllowsMultipleValues( property );

		if ( property in Model ) {

			if ( !( 'getValue' in Model[ property ] ) ) {
				var values = [];
				for ( var i in Model[ property ] ) {
					var value = Model[ property ][ i ].getValue().trim();
					if ( value !== '' ) {
						values.push( value );
					}
				}
				return values;
			}
			return Model[ property ].getValue();
		}

		if ( property === '_TYPE' ) {
			return SelectedProperty.type;
		}

		if ( !( property in SelectedProperty.properties ) ) {
			return allowsMultipleValues ? [] : '';
		}

		var propertyValue = SelectedProperty.properties[ property ];

		if ( allowsMultipleValues ) {
			return propertyValue;
		}

		return propertyValue.slice( -1 )[ 0 ];
	}

	var InnerItemWidget = function ( config ) {
		config = config || {};
		InnerItemWidget.super.call( this, config );

		if ( !( 'value' in config ) ) {
			config.value = '';
		}
		if ( !( 'property' in config ) ) {
			config.property = '';
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

		var inputName = inputNameOfProperty( config.property );
		var inputWidget = PagePropertiesFunctions.inputInstanceFromName( inputName, {
			name: 'pageproperties-input-' + config.property + '-' + config.index,
			value: config.value
		} );

		Model[ config.property ][ config.index ] = inputWidget;

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

	function PageOneLayout( name, config ) {
		PageOneLayout.super.call( this, name, config );

		var typesInput = new OO.ui.DropdownInputWidget( {
			// , { key: "value" }
			options: PagePropertiesFunctions.createDropDownOptions( TypeLabels ),
			value: SelectedProperty.type
		} );

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		var textInputWidget = new OO.ui.TextInputWidget( {
			value: SelectedProperty.label
		} );

		Model.label = textInputWidget;

		// eslint-disable-next-line no-underscore-dangle
		Model._TYPE = typesInput;

		ImportedVocabulariesWidget.setValue( getPropertyValue( '_IMPO' ) );

		// eslint-disable-next-line no-underscore-dangle
		Model._IMPO = ImportedVocabulariesWidget;

		fieldset.addItems( [
			new OO.ui.FieldLayout( textInputWidget, {
				label: mw.msg( 'pageproperties-jsmodule-manageproperties-name' ),
				align: 'top'
			} ),

			new OO.ui.FieldLayout( typesInput, {
				label: mw.msg( 'pageproperties-jsmodule-manageproperties-type' ),
				align: 'top'
			} ),

			new OO.ui.FieldLayout(
				// OO.ui.SearchInputWidget
				ImportedVocabulariesWidget,
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

	function PageTwoLayout( name, config ) {
		PageTwoLayout.super.call( this, name, config );

		this.fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		this.populateFieldset();

		this.$element.append( this.fieldset.$element );
	}
	OO.inheritClass( PageTwoLayout, OO.ui.PageLayout );
	PageTwoLayout.prototype.setupOutlineItem = function () {
		this.outlineItem.setLabel(
			mw.msg( 'pageproperties-jsmodule-manageproperties-options' )
		);
	};
	PageTwoLayout.prototype.populateFieldset = function () {
		this.fieldset.clearItems();
		var selectedDataType = getPropertyValue( '_TYPE' );

		var properties = getAvailablePropertiesOfDataType( selectedDataType );

		properties.sort( function ( a, b ) {
			var label_a = PropertyLabels[ a ];
			var label_b = PropertyLabels[ b ];
			return label_a.localeCompare( label_b );
		} );

		for ( let property of properties ) {
			var label = new OO.ui.HtmlSnippet(
				'<b>' +
					PropertyLabels[ property ] +
					'</b> <br />' +
					// eslint-disable-next-line mediawiki/msg-doc
					mw.msg(
						'pageproperties-jsmodule-manageproperties-' + property.toLowerCase()
					) +
					' (<a target="_blank" href="' +
					getHelpPage( property ) +
					'">' +
					mw.msg( 'pageproperties-jsmodule-manageproperties-help-page' ) +
					'</a>)'
			);

			var propertyValue = getPropertyValue( property );
			var items;

			var inputName = inputNameOfProperty( property );

			// @TODO add help msg for property _PVALI
			// ("enter a page with title "MediaWiki:Smw_allows_list_..."

			if (
				Array.isArray( propertyValue ) &&
				inputName.indexOf( 'Multiselect' ) === -1
			) {
				let optionsList = new ListWidget();

				if ( !( property in Model ) ) {
					Model[ property ] = {};
				}

				for ( var value of propertyValue ) {
					var index = optionsList.items.length;

					optionsList.addItems( [
						new InnerItemWidget( {
							classes: [ 'InnerItemWidget' ],
							property: property,
							value: value,
							index: index
						} )
					] );
				}

				var addOption = new OO.ui.ButtonWidget( {
					// label: "add option",
					icon: 'add'
				} );

				addOption.on( 'click', function () {
					optionsList.addItems( [
						new InnerItemWidget( {
							classes: [ 'InnerItemWidget' ],
							property: property,
							value: '',
							index: optionsList.items.length
						} )
					] );
				} );

				items = [
					new OO.ui.FieldLayout( optionsList, {
						label: label,
						align: 'top'
						// help: ""
						// helpInline: true,
					} ),

					// add option in optionsList
					addOption
				];
			} else {
				if ( property === '_SUBP' ) {
					var formattedNamespaces = mw.config.get( 'wgFormattedNamespaces' );
					// ^Property:
					let re = new RegExp( '^' + formattedNamespaces[ 102 ] + ':' );
					propertyValue = propertyValue.map( ( x ) => x.replace( re, '' ) );
				}

				var config = {
					name: 'pageproperties-input-' + property,
					value: propertyValue
				};

				if ( Array.isArray( propertyValue ) ) {
					config.selected = propertyValue;
				}

				var inputWidget = PagePropertiesFunctions.inputInstanceFromName( inputName, config );

				// if (Array.isArray(propertyValue)) {
				// // see mw.widgets.TitlesMultiselectWidget.js
				// var $hiddenInput = inputWidget.$element.find("textarea").eq(0);
				// $hiddenInput.prop("defaultValue", propertyValue.join("\n"));
				// }

				Model[ property ] = inputWidget;

				items = [
					new OO.ui.FieldLayout( inputWidget, {
						label: label,
						align: 'top'
					} )
				];
			}
			this.fieldset.addItems( items );
		}
	};

	function ProcessDialog( config ) {
		ProcessDialog.super.call( this, config );
	}
	OO.inheritClass( ProcessDialog, OO.ui.ProcessDialog );

	ProcessDialog.static.name = 'myDialog';
	// ProcessDialog.static.title = mw.msg(
	// "pageproperties-jsmodule-manageproperties-define-property"
	// );
	ProcessDialog.static.actions = [
		{
			action: 'delete',
			label: mw.msg( 'pageproperties-jsmodule-dialog-delete' ),
			flags: 'destructive'
		},
		{
			action: 'save',
			label: mw.msg( 'pageproperties-jsmodule-dialog-save' ),
			flags: [ 'primary', 'progressive' ]
		},
		{
			action: 'cancel',
			label: mw.msg( 'pageproperties-jsmodule-dialog-cancel' ),
			flags: [ 'safe', 'close' ]
		}
	];

	ProcessDialog.prototype.initialize = function () {
		ProcessDialog.super.prototype.initialize.apply( this, arguments );

		this.page1 = new PageOneLayout( 'one', {} );
		this.page2 = new PageTwoLayout( 'two', {} );

		var booklet = new OO.ui.BookletLayout( {
			outlined: true,
			expanded: true
		} );

		booklet.addPages( [ this.page1, this.page2 ] );
		booklet.setPage( 'one' );

		this.$body.append( booklet.$element );
	};

	ProcessDialog.prototype.getActionProcess = function ( action ) {
		if (
			!action ||
			( action === 'cancel' &&
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
								'pageproperties-jsmodule-forms-alert-propertyname'
							);

						} else if ( SelectedProperty.label === '' && ( obj.label in SemanticProperties ) ) {
							alert = mw.msg(
								'pageproperties-jsmodule-manageproperties-existing-property'
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
							// console.log( 'payload', payload );
							new mw.Api()
								.postWithToken( 'csrf', payload )
								.done( function ( res ) {
									resolve();
									if ( payload.action in res ) {
										var data =
											res[ payload.action ];
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
													// @TODO or return promise
													callApi,
													[

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
												} else {
													PagePropertiesFunctions.OOUIAlert(
														mw.msg( 'pageproperties-jsmodule-unknown-error' ),
														{ size: 'medium' }
													);
												}
											}
										}
									} else {
										PagePropertiesFunctions.OOUIAlert(
											mw.msg( 'pageproperties-jsmodule-unknown-error' ),
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
									action: 'pageproperties-manageproperties-saveproperty',
									'dialog-action': action,
									'previous-label': SelectedProperty.label,
									format: 'json',
									data: JSON.stringify( obj )
								}, resolve, reject );
							} );
						} );
				}
			} ); // .next

		// eslint-disable-next-line no-unreachable
		return ProcessDialog.super.prototype.getActionProcess.call( this, action );
	};

	ProcessDialog.prototype.getTeardownProcess = function ( data ) {
		// reinitialize widgets since it seems they get
		// destroyed on dialog close
		initCommonWidgets();

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

	// https://stackoverflow.com/questions/5072136/javascript-filter-for-objects
	Object.filter = ( obj, predicate ) =>
		Object.keys( obj )
			.filter( ( key ) => predicate( obj[ key ] ) )
			// eslint-disable-next-line no-sequences
			.reduce( ( res, key ) => ( ( res[ key ] = obj[ key ] ), res ), {} );

	function initCommonWidgets() {
		var options = PagePropertiesFunctions.createDropDownOptions( {
			'': 'none'
		} );

		for ( var namespace in ImportedVocabularies ) {
			// eslint-disable-next-line no-underscore-dangle
			var obj_ = Object.filter(
				ImportedVocabularies[ namespace ],
				( x ) => x !== 'Category' && x !== 'Class'
			);

			options.push( { optgroup: namespace } );
			options = options.concat(
				PagePropertiesFunctions.createDropDownOptions( obj_, {
					value: 'key'
				} )
			);
		}

		ImportedVocabulariesWidget = new OO.ui.DropdownInputWidget( {
			options: options
		} );

		var options = PagePropertiesFunctions.createDropDownOptions( {
			'': mw.msg( 'pageproperties-jsmodule-manageproperties-import-none' )
		} );

		for ( var namespace in ImportedVocabularies ) {
			// eslint-disable-next-line no-underscore-dangle
			var obj_ = Object.filter(
				ImportedVocabularies[ namespace ],
				( x ) => x === 'Category' || x === 'Class'
			);

			options.push( { optgroup: namespace } );
			options = options.concat(
				PagePropertiesFunctions.createDropDownOptions( obj_, {
					value: 'key'
				} )
			);
		}

		ImportedVocabulariesWidgetCategories = new OO.ui.DropdownInputWidget( {
			options: options
		} );
	}

	function getImportedVocabulariesWidgetCategories() {
		return ImportedVocabulariesWidgetCategories;
	}

	function updateData( data ) {
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
				}
				break;

			case 'create':
				SemanticProperties = jQuery.extend(
					SemanticProperties,
					data[ 'semantic-properties' ]
				);
				SemanticProperties =
					PagePropertiesFunctions.sortObjectByKeys( SemanticProperties );
				break;

			case 'rename':
				delete SemanticProperties[ data[ 'previous-label' ] ];
				// delete Model[data["previous-label"]];

				SemanticProperties = jQuery.extend(
					SemanticProperties,
					data[ 'semantic-properties' ]
				);
				SemanticProperties =
					PagePropertiesFunctions.sortObjectByKeys( SemanticProperties );
				break;
		}

		// if ( Config.context === 'EditSemantic' ) {
		// 	PageProperties.updateData( data );
		// }

		initialize();

		return true;
	}

	function createToolbar() {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
		} );

		var onSelect = function ( self ) {
			var toolName = self.getName();

			switch ( toolName ) {
				case 'createproperty':
					openDialog();
					break;
			}

			self.setActive( false );
		};

		var loadDataBeforeSelect = function () {
			var dataToLoad = matchLoadedData( Config, [
				'imported-vocabularies',
				'type-labels',
				'property-labels'
			] );

			if ( !dataToLoad.length ) {
				return onSelect( this );
			}

			this.setDisabled( true );
			this.pushPending();

			loadData( Config, dataToLoad ).then( ( res ) => {
				this.setDisabled( false );
				this.popPending();
				ImportedVocabularies = res[ 'imported-vocabularies' ];
				PropertyLabels = res[ 'property-labels ' ];
				TypeLabels = res[ 'type-labels ' ];
				initCommonWidgets();
				onSelect( this );
			} );
		};

		var toolGroup = [
			{
				name: 'createproperty',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-pageproperties-create-property' ),
				onSelect: loadDataBeforeSelect
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

	function initializeDataTable() {
		PagePropertiesFunctions.destroyDataTable( 'pageproperties-datatable-manage' );

		var data = [];
		for ( var i in SemanticProperties ) {
			var value = SemanticProperties[ i ];
			data.push( [
				i,
				value.typeLabel,
				'_IMPO' in value.properties ? // eslint-disable-next-line no-underscore-dangle
					value.properties._IMPO.slice( -1 )[ 0 ] :
					'',
				value.description
			] );
		}

		DataTable = $( '#pageproperties-datatable-manage' ).DataTable( {
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
				.msg( 'pageproperties-jsmodule-pageproperties-columns' )
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

	// @TODO or use ManageProperties( ... all vars )
	// function setConfig(config) {
	// Config = config;
	// }

	function preInitialize( config, windowManager, semanticProperties ) {
		Config = config;
		WindowManager = windowManager;
		SemanticProperties = semanticProperties;
	}

	function initialize(
		pageProperties,
		importedVocabularies,
		typeLabels,
		propertyLabels
	) {
		Model = {};

		if ( arguments.length ) {
			PageProperties = pageProperties;
			ImportedVocabularies = importedVocabularies;
			TypeLabels = typeLabels;
			PropertyLabels = propertyLabels;

			if ( ImportedVocabularies !== null ) {
				initCommonWidgets();
			}
		}

		if ( Config.context === 'parserfunction' ) {
			return;
		}

		if ( Config.context === 'ManageProperties' ) {
			$( '#semantic-properties-wrapper' ).empty();

			var toolbar = createToolbar();

			var contentFrame = new OO.ui.PanelLayout( {
				$content: $(
					'<table id="pageproperties-datatable-manage" class="pageproperties-datatable display" width="100%"></table>'
				),
				expanded: false,
				padded: true
			} );

			var frame = new OO.ui.PanelLayout( {
				$content: [ toolbar.$element, contentFrame.$element ],
				expanded: false,
				framed: true,
				data: { name: 'manage-semantic-properties' }
			} );

			$( '#semantic-properties-wrapper' ).append( frame.$element );

			toolbar.initialize();
			// toolbar.emit( 'updateState' );

			var dataToLoad = matchLoadedData( Config, [
				'imported-vocabularies',
				'type-labels',
				'property-labels'
			] );

			if ( dataToLoad.length ) {
				loadData( Config, dataToLoad ).then( ( res ) => {
					ImportedVocabularies = res[ 'imported-vocabularies' ];
					PropertyLabels = res[ 'property-labels' ];
					TypeLabels = res[ 'type-labels ' ];
					initCommonWidgets();
				} );
			}
		}

		initializeDataTable();
	}

	function openDialog( label ) {
		if ( !label ) {
			SelectedProperty = { label: '', type: '_wpg', properties: [] };
		} else {
			SelectedProperty = jQuery.extend(
				{ label: label },
				SemanticProperties[ label ]
			);
		}

		Model = {};

		processDialog = new ProcessDialog( {
			size: 'larger'
		} );

		WindowManager.newWindow( processDialog, { title: mw.msg(
			// The following messages are used here:
			// * pageproperties-jsmodule-manageproperties-define-property
			// * pageproperties-jsmodule-manageproperties-define-property - [name]
			'pageproperties-jsmodule-manageproperties-define-property'
		) + ( label ? ' - ' + label : '' ) }
		);
	}

	return {
		initialize,
		createToolbar,
		getAvailableInputs,
		openDialog,
		lookupInputs,
		getImportedVocabulariesWidgetCategories,
		preInitialize,
		TypeLabels,
		getSemanticProperties,
		getSemanticProperty
	};
}() );
