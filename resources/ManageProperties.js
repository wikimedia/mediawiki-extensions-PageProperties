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
const ManageProperties = ( function () {
	var Model = {};
	var SemanticProperties,
		PropertyLabels,
		TypeLabels,
		ImportedVocabulariesWidget,
		SelectedProperty;
	var processDialog;
	var DataLoaded = false;
	var DataLoading = false;

	var optionsInputs = [
		'OO.ui.DropdownInputWidget',
		'OO.ui.ComboBoxInputWidget',
		'OO.ui.MenuTagMultiselectWidget',
		'OO.ui.RadioSelectInputWidget',
		'OO.ui.CheckboxMultiselectInputWidget'
	];

	var multiselectInputs = [
		'OO.ui.TagMultiselectWidget',
		'mw.widgets.TitlesMultiselectWidget',
		'mw.widgets.UsersMultiselectWidget',
		'mw.widgets.CategoryMultiselectWidget'
	];

	var windowManager = new OO.ui.WindowManager( {
		classes: [ 'pageproperties-ooui-window' ]
	} );
	$( document.body ).append( windowManager.$element );

	function inArray( val, arr ) {
		return jQuery.inArray( val, arr ) !== -1;
	}

	// function getKeyByValue(obj, value) {
	//    return Object.keys(obj).find(key => obj[key] === value);
	// }

	function disableMultipleFields( propertyType, inputLabel ) {
		var singleValues = [ '_boo' ];

		if ( inArray( propertyType, singleValues ) ) {
			return true;
		}

		var inputName = PageProperties.inputNameFromLabel( inputLabel );

		return (
			inArray( inputName, multiselectInputs ) || inArray( inputName, optionsInputs )
		);
	}

	function titleNamespace( name ) {
		switch ( name ) {
			case 'Media':
				return -2;
			case 'Special':
				return -1;
			case '(Main)':
				return 0;
			case 'Main':
				return 0;
			case 'Talk':
				return 1;
			case 'User':
				return 2;
			case 'Project':
				return 4;
			case 'File':
				return 6;
			case 'MediaWiki':
				return 8;
			case 'Template':
				return 10;
			case 'Help':
				return 12;
			case 'Category':
				return 14;
			// SMW_NS_PROPERTY
			case 'Property':
				return 102;
		}
	}

	function getAvailableInputs( dataType ) {
		/*
		"OO.ui.TextInputWidget",
		"OO.ui.TagMultiselectWidget",
		"OO.ui.ToggleSwitchWidget",
		"OO.ui.RadioSelectWidget",
		"OO.ui.NumberInputWidget",
		"OO.ui.ComboBoxInputWidget",
		"OO.ui.MultilineTextInputWidget",
		"OO.ui.MultiselectWidget",
		"OO.ui.ButtonSelectWidget",
		"OO.ui.CheckboxInputWidget",
		"OO.ui.DropdownInputWidget",
		"mw.widgets.DateInputWidget",
		"mw.widgets.datetime.DateTimeInputWidget",
		"mw.widgets.CategoryMultiselectWidget",
		"mw.widgets.TitleInputWidget",
		"mw.widgets.TitlesMultiselectWidget",
		"mw.widgets.UserInputWidget",
		"mw.widgets.UsersMultiselectWidget",
*/

		//  "OO.ui.TextInputWidget"
		// allowed types:'text', 'password' 'email', 'url' or 'number'

		var ret = [];
		switch ( dataType ) {
			// Annotation URI
			case '_anu':
				ret = [ 'OO.ui.TextInputWidget (url)' ];
				break;

			// email
			case '_ema':
				ret = [ 'OO.ui.TextInputWidget (email)' ];
				break;

			// Quantity
			case '_qty':
				ret = [ 'OO.ui.TextInputWidget (number)', 'OO.ui.NumberInputWidget' ];
				break;

			// number
			case '_num':
				ret = [ 'OO.ui.TextInputWidget (number)', 'OO.ui.NumberInputWidget' ];

				break;

			// temperature
			case '_tem':
				ret = [ 'OO.ui.TextInputWidget (number)', 'OO.ui.NumberInputWidget' ];

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
				ret = [ 'OO.ui.TextInputWidget (tel)' ];
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
					'mw.widgets.UserInputWidget'
				];
				break;

			case '_txt':
				ret = [
					'OO.ui.TextInputWidget',
					'OO.ui.TagMultiselectWidget',
					'OO.ui.MultilineTextInputWidget',
					'mw.widgets.CategoryMultiselectWidget'
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
			'_PVALI', // Allows value list
			'__pageproperties_preferred_input',
			'__pageproperties_allows_multiple_values'
		] );
	}

	function getHelpPage( property ) {
		var host = 'https://www.semantic-mediawiki.org/wiki/';

		var help_page = {
			_PVAL: 'Help:Special_property_Allows_value',
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

	function inputInstanceFromName( inputName, config ) {
		switch ( inputName ) {
			case 'mw.widgets.datetime.DateTimeInputWidget':
				return new mw.widgets.datetime.DateTimeInputWidget( config );
		}

		var arr = inputName.split( '.' );
		if ( arr.length === 4 ) {
			var value = arr.pop();
			switch ( arr[ 2 ] ) {
				case 'TitleInputWidget':
				case 'TitlesMultiselectWidget':
					config.namespace = titleNamespace( value );
					break;
				case 'TextInputWidget':
					config.type = value;
					break;
				case 'DateInputWidget':
					config.precision = value;
					break;
			}
		}

		switch ( arr[ 2 ] ) {
			case 'MultilineTextInputWidget':
				config.autosize = true;
				config.rows = 2;
				break;
		}

		var constructor = ( inputName.indexOf( 'OO.ui' ) === 0 ? OO.ui[ arr[ 2 ] ] : mw.widgets[ arr[ 2 ] ] );

		// fallback
		if ( typeof constructor !== 'function' ) {
			return new OO.ui.TextInputWidget( config );
		}

		return new constructor( config );
	}

	function getPropertyValue( property ) {
		var allowsMultipleValues = propertyAllowsMultipleValues( property );

		if ( property in Model ) {
			if ( allowsMultipleValues && property !== '_SUBP' ) {
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

	function createInputOptions( array, config ) {
		var config = jQuery.extend( { key: 'key', value: 'value' }, config || {} );
		var ret = [];
		for ( var i in array ) {
			ret.push( {
				data: config.key === 'key' ? i : array[ i ],
				label: config.value === 'value' ? array[ i ] : i
			} );
		}
		return ret;
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
		var inputWidget = inputInstanceFromName( inputName, {
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
			options: createInputOptions( TypeLabels ),
			value: SelectedProperty.type
		} );

		var multipleValueInput = new OO.ui.ToggleSwitchWidget( {
			value: getPropertyValue( '__pageproperties_allows_multiple_values' )
		} );

		// eslint-disable-next-line no-underscore-dangle
		Model.__pageproperties_allows_multiple_values = multipleValueInput;

		multipleValueInput.setDisabled(
			disableMultipleFields(
				getPropertyValue( '_TYPE' ),
				getPropertyValue( '__pageproperties_preferred_input' )
			)
		);

		var availableInputs = new OO.ui.DropdownInputWidget( {
			options: createInputOptions( getAvailableInputs( SelectedProperty.type ), {
				key: 'value'
			} ),
			value: getPropertyValue( '__pageproperties_preferred_input' )
		} );

		// eslint-disable-next-line no-underscore-dangle
		Model.__pageproperties_preferred_input = availableInputs;

		availableInputs.on( 'change', function ( value ) {
			multipleValueInput.setDisabled(
				disableMultipleFields( getPropertyValue( '_TYPE' ), value )
			);
		} );
		typesInput.on( 'change', function ( value ) {
			SelectedProperty.type = value;
			availableInputs.setOptions(
				createInputOptions( getAvailableInputs( value ), {
					key: 'value'
				} )
			);
			multipleValueInput.setDisabled(
				disableMultipleFields(
					value,
					getPropertyValue( '__pageproperties_preferred_input' )
				)
			);

			processDialog.page2.populateFieldset();
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
			),

			new OO.ui.FieldLayout( multipleValueInput, {
				label: mw.msg(
					'pageproperties-jsmodule-manageproperties-multiple-fields'
				),
				help: mw.msg(
					'pageproperties-jsmodule-manageproperties-multiple-fields-help'
				),
				helpInline: true,
				align: 'top'
			} ),

			new OO.ui.FieldLayout( availableInputs, {
				label: mw.msg(
					'pageproperties-jsmodule-manageproperties-preferred-input'
				),
				// help: 'Multiple values ...',
				// helpInline: true,
				align: 'top'
			} )
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

			if ( Array.isArray( propertyValue ) && inputName.indexOf( 'Multiselect' ) === -1 ) {
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
					// @todo, use localized namespace
					propertyValue = propertyValue.map( ( x ) => x.replace( /^Property:/, '' ) );
				}

				var config = {
					name: 'pageproperties-input-' + property,
					value: propertyValue
				};

				if ( Array.isArray( propertyValue ) ) {
					config.selected = propertyValue;
				}

				var inputWidget = inputInstanceFromName( inputName, config );

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
	ProcessDialog.static.title = mw.msg(
		'pageproperties-jsmodule-manageproperties-define-property'
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

				if (
					// eslint-disable-next-line no-underscore-dangle
					( obj._PVAL.length || obj._PVALI !== '' ) &&
					// eslint-disable-next-line no-underscore-dangle
					!inArray( obj.__pageproperties_preferred_input, optionsInputs )
				) {
					OO.ui.alert(
						new OO.ui.HtmlSnippet(
							mw.msg( 'pageproperties-jsmodule-manageproperties-suggestion1' ) +
								optionsInputs.join( '</br>' )
						),
						{ size: 'medium' }
					);
				} else if (
					// eslint-disable-next-line no-underscore-dangle
					inArray( obj.__pageproperties_preferred_input, optionsInputs ) &&
					// eslint-disable-next-line no-underscore-dangle
					!obj._PVAL.length && obj._PVALI === ''
				) {
					OO.ui.alert(
						mw.msg( 'pageproperties-jsmodule-manageproperties-suggestion2' ),
						{
							size: 'medium'
						}
					);

					return ProcessDialog.super.prototype.getActionProcess.call(
						this,
						action
					);
				}

			// eslint-disable no-fallthrough
			case 'delete':
				mw.loader.using( 'mediawiki.api', function () {
					new mw.Api()
						.postWithToken( 'csrf', {
							action: 'pageproperties-manageproperties-saveproperty',
							dialogAction: action,
							previousLabel: SelectedProperty.label,
							format: 'json',
							data: JSON.stringify( obj )
						} )
						.done( function ( res ) {
							if ( 'pageproperties-manageproperties-saveproperty' in res ) {
								var data = res[ 'pageproperties-manageproperties-saveproperty' ];
								if ( data[ 'result-action' ] === 'error' ) {
									OO.ui.alert( new OO.ui.HtmlSnippet( data.error ), {
										size: 'medium'
									} );
								} else {
									if ( PageProperties.updatePropertiesPanel( data ) === true ) {
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

	function initManagePropertiesData( data ) {
		var importedVocabularies = data.importedVocabularies;
		PropertyLabels = data.propertyLabels;
		TypeLabels = data.typeLabels;

		var options = createInputOptions( {
			'': 'none'
		} );
		for ( var namespace in importedVocabularies ) {
			options.push( { optgroup: namespace } );
			options = options.concat(
				createInputOptions( importedVocabularies[ namespace ], {
					value: 'key'
				} )
			);
		}

		ImportedVocabulariesWidget = new OO.ui.DropdownInputWidget( {
			options: options
		} );
	}

	function loadData( semanticProperties, callback, callbackArgs ) {
		SemanticProperties = semanticProperties;

		if ( DataLoaded ) {
			if ( callback ) {
				callback.apply( null, callbackArgs );
			}
			return;
		}
		if ( DataLoading ) {
			return;
		}
		DataLoading = true;
		mw.loader.using( 'mediawiki.api', function () {
			new mw.Api()
				.postWithToken( 'csrf', {
					action: 'pageproperties-manageproperties-load-data',
					format: 'json'
				} )
				.done( function ( res ) {
					if ( 'pageproperties-manageproperties-load-data' in res ) {
						DataLoaded = true;
						DataLoading = false;
						initManagePropertiesData(
							res[ 'pageproperties-manageproperties-load-data' ]
						);
						if ( callback ) {
							callback.apply( null, callbackArgs );
						}
					}
				} );
		} );
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

		if ( !DataLoaded ) {
			// eslint-disable-next-line no-console
			console.log( 'data not loaded' );
			return;
		}

		Model = {};

		processDialog = new ProcessDialog( {
			size: 'larger'
		} );

		windowManager.addWindows( [ processDialog ] );

		windowManager.openWindow( processDialog );

		// windowManager.openWindow( 'myDialog', { size: 'larger' } );
	}

	return {
		createInputOptions,
		getAvailableInputs,
		inputInstanceFromName,
		loadData,
		openDialog,
		disableMultipleFields,
		optionsInputs,
		multiselectInputs
	};
}() );
