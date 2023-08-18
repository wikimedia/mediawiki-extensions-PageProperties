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

// @see https://doc.wikimedia.org/oojs-ui/master/js/
// eslint-disable-next-line no-unused-vars
const PagePropertiesFormField = function (
	windowManager
	// pagePropertiesInputConfig
) {
	var WindowManager = windowManager;
	// var PagePropertiesInputConfig = pagePropertiesInputConfig;
	var PagePropertiesInputConfigInst = new PagePropertiesInputConfig(
		windowManager
	);

	var ProcessDialog;
	var Model;
	// eslint-disable-next-line no-unused-vars
	var PropertyType;
	var ParentObj;
	var panelLayout;
	var CurrentLabel;
	var SemanticProperties;
	var Callback;

	function inArray( val, arr ) {
		return jQuery.inArray( val, arr ) !== -1;
	}

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

		if ( !( CurrentLabel in ParentObj ) ) {
			return '';
		}

		if ( property in ParentObj[ CurrentLabel ] ) {
			return ParentObj[ CurrentLabel ][ property ];
		}
		return '';
	}

	function getAvailableInputs(
		propertyModel,
		SMWproperty,
		JSONSchemaType,
		stringFormat,
		multipleValues
	) {
		if ( propertyModel === 'smw-property' ) {
			var dataType = SemanticProperties[ SMWproperty ].type;
			var ret = ManageProperties.getAvailableInputs( dataType );

			if ( multipleValues === false ) {
				return ret.filter( ( x ) => !ManageProperties.isMultiselect( x ) );
			}

			return ret;
		}

		var ret = ManageProperties.getAvailableInputsSchema( JSONSchemaType, stringFormat );

		if ( multipleValues === false ) {
			return ret.filter( ( x ) => !ManageProperties.isMultiselect( x ) );
		}
		return ret.concat( ManageProperties.optionsInputs );
	}

	// @TODO move in PagePropertiesInputConfig ?
	function handleMultipleValuesOptions( availableInputsInput, items ) {
		var optionsAsdefinedValue = getPropertyValue( 'options-values' ) || [];

		var wikilistValue = getPropertyValue( 'options-wikilist' );
		var askqueryValue = getPropertyValue( 'options-askquery' );

		var selectOptionsFrom = new OO.ui.RadioSelectInputWidget( {
			options: [
				// {
				// 	data: 'property',
				// 	label: mw.msg( 'pageproperties-jsmodule-forms-optionsfrom-property' )
				// },
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
		Model.selectOptionsFrom = selectOptionsFrom;

		var fieldSelectOptionsFrom = new OO.ui.FieldLayout( selectOptionsFrom, {
			label: new OO.ui.HtmlSnippet(
				mw.msg( 'pageproperties-jsmodule-forms-field-options-from' )
			),
			align: 'top'
			// help: ""
			// helpInline: true,
		} );

		items.push( fieldSelectOptionsFrom );

		var optionsAsdefinedInput = new OO.ui.TagMultiselectWidget( {
			selected: optionsAsdefinedValue,
			allowArbitrary: true,
			orientation: 'vertical'
		} );

		Model[ 'options-values' ] = optionsAsdefinedInput;

		var fieldOptionsAsdefined = new OO.ui.FieldLayout( optionsAsdefinedInput, {
			label: '',
			help: mw.msg( 'pageproperties-jsmodule-forms-field-optionsasdefined' ),
			helpInline: true,
			align: 'top'
		} );

		items.push( fieldOptionsAsdefined );

		var wikilistInput = new mw.widgets.TitleInputWidget( {
			value: wikilistValue
		} );

		Model[ 'options-wikilist' ] = wikilistInput;

		var fieldWikilist = new OO.ui.FieldLayout( wikilistInput, {
			label: '',
			help: mw.msg( 'pageproperties-jsmodule-forms-field-wikilist' ),
			helpInline: true,
			align: 'top'
		} );

		items.push( fieldWikilist );

		var askqueryInput = new OO.ui.TextInputWidget( {
			value: askqueryValue
		} );

		Model[ 'options-askquery' ] = askqueryInput;

		var fieldAskquery = new OO.ui.FieldLayout( askqueryInput, {
			label: '',
			help: mw.msg( 'pageproperties-jsmodule-forms-field-askquery' ),
			helpInline: true,
			align: 'top'
		} );

		items.push( fieldAskquery );

		var printoutsInputValue = getPropertyValue( 'askquery-printouts' ) || [];

		var printoutsInput = new mw.widgets.TitlesMultiselectWidget( {
			selected: printoutsInputValue,

			// https://www.semantic-mediawiki.org/wiki/Help:Namespaces
			namespace: 102
		} );

		Model[ 'askquery-printouts' ] = printoutsInput;

		var fieldPrintouts = new OO.ui.FieldLayout( printoutsInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-printouts' ),
			help: mw.msg( 'pageproperties-jsmodule-forms-field-printouts-help' ),
			helpInline: true,
			align: 'top'
		} );

		items.push( fieldPrintouts );

		var querysubjectInput = new OO.ui.ToggleSwitchWidget( {
			value: !!getPropertyValue( 'askquery-subject' )
		} );

		Model[ 'askquery-subject' ] = querysubjectInput;

		var fieldQuerysubject = new OO.ui.FieldLayout( querysubjectInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-querysubject' ),
			help: mw.msg( 'pageproperties-jsmodule-forms-field-querysubject-help' ),
			helpInline: true,
			align: 'top'
		} );

		items.push( fieldQuerysubject );

		var optionFormulaInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( 'options-formula' )
		} );

		Model[ 'options-formula' ] = optionFormulaInput;

		var fieldOptionFormula = new OO.ui.FieldLayout( optionFormulaInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-optionformula' ),
			help: mw.msg( 'pageproperties-jsmodule-forms-field-optionformula-help' ),
			helpInline: true,
			align: 'top'
		} );

		items.push( fieldOptionFormula );

		// ////////	@credits: WikiTeq	///////
		var optionMappingInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( 'mapping-formula' )
		} );

		Model[ 'mapping-formula' ] = optionMappingInput;

		var fieldOptionMapping = new OO.ui.FieldLayout( optionMappingInput, {
			label: mw.msg( 'pageproperties-jsmodule-forms-field-mappingformula' ),
			help: mw.msg( 'pageproperties-jsmodule-forms-field-mappingformula-help' ),
			helpInline: true,
			align: 'top'
		} );
		// ///////////////////////////

		items.push( fieldOptionMapping );

		/*
		 NOT YET IMPLEMENTED **********

		 var optionslimitInputValue = getPropertyValue( 'options-limit' );
		 var optionslimitInput = new OO.ui.NumberInputWidget( {
		 	value: optionslimitInputValue || 100
		 } );

		 Model["options-limit"] = optionslimitInput;

		 var fieldOptionslimit = new OO.ui.FieldLayout(optionslimitInput, {
		 	label: mw.msg("pageproperties-jsmodule-forms-field-optionslimit"),
		 	help: mw.msg("pageproperties-jsmodule-forms-field-optionslimit-help"),
		 	helpInline: true,
		 	align: "top",
		 });

		 items.push(fieldOptionslimit);

		 var options = PagePropertiesFunctions.createDropDownOptions({
		 autocomplete: mw.msg(
		 	"pageproperties-jsmodule-forms-alternateinput-autocomplete"
		 ),
		 "infinite-scroll": mw.msg(
		 	"pageproperties-jsmodule-forms-alternateinput-infinite-scroll"
		 ),
		 });
		 var alternateInput = new OO.ui.DropdownInputWidget({
			options: options,
			// 	// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/classes/DialogWithDropdowns.js
			// 	$overlay: true,
			value: getPropertyValue("alternate-input"),
		});

		// var alternateInput = new PagePropertiesDropdownWidget( { value: getPropertyValue( 'alternate-input' ), options: options } );

		Model["alternate-input"] = alternateInput;

		var fieldAlternateInput = new OO.ui.FieldLayout(alternateInput, {
			label: mw.msg("pageproperties-jsmodule-forms-field-alternateinput"),
			align: "top",
			help: mw.msg("pageproperties-jsmodule-forms-field-alternateinput-help"),
			helpInline: true,
		});

		items.push(fieldAlternateInput);
		*/

		selectOptionsFrom.on( 'change', function ( value ) {
			fieldOptionsAsdefined.toggle( value === 'options-values' );
			fieldWikilist.toggle( value === 'options-wikilist' );
			fieldAskquery.toggle( value === 'options-askquery' );
			fieldPrintouts.toggle( value === 'options-askquery' );
			fieldQuerysubject.toggle( value === 'options-askquery' );
			fieldOptionFormula.toggle( value === 'options-askquery' );
		} );

		function onSelectAvailableInputs() {
			var availableInputsValue = availableInputsInput.getValue();
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
			// fieldOptionslimit.toggle(
			// 	inArray(availableInputsValue, ManageProperties.optionsInputs)
			// );
			// fieldAlternateInput.toggle(
			// 	inArray(availableInputsValue, ManageProperties.optionsInputs)
			// );
		}

		// eslint-disable-next-line no-unused-vars
		availableInputsInput.on( 'change', function ( value ) {
			onSelectAvailableInputs();
		} );

		onSelectAvailableInputs();
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

		this.$element.append( this.fieldset.$element );

		// this.$element.append(this.messageWidget.$element);
	}

	OO.inheritClass( PanelLayout, OO.ui.PanelLayout );
	PanelLayout.prototype.populateFieldset = function () {
		this.fieldset.clearItems();

		// eslint-disable-next-line no-unused-vars
		var data = this.data;
		var items = [];

		var labelInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( 'label' ) || CurrentLabel
		} );

		Model.label = labelInput;

		items.push(
			new OO.ui.FieldLayout( labelInput, {
				label: mw.msg( 'pageproperties-jsmodule-formfield-label' ),
				helpInline: true,
				align: 'top'
			} )
		);

		var helpMessageInput = new OO.ui.MultilineTextInputWidget( {
			value: getPropertyValue( 'help-message' ),
			autosize: true,
			rows: 2
		} );

		Model[ 'help-message' ] = helpMessageInput;

		items.push(
			new OO.ui.FieldLayout( helpMessageInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-help-message' ),
				helpInline: true,
				help: mw.msg( 'pageproperties-jsmodule-forms-contentblock-content-help' ),
				align: 'top'
			} )
		);

		var propertyModelValue = getPropertyValue( 'property-model' ) || 'smw-property';
		var propertyModelInput = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'smw-property',
					label: mw.msg(
						'pageproperties-jsmodule-formfield-propertymodel-smwproperty'
					)
				},
				{
					data: 'json-schema',
					label: mw.msg(
						'pageproperties-jsmodule-formfield-propertymodel-jsonschema'
					)
				}
			],
			value: propertyModelValue
		} );

		Model[ 'property-model' ] = propertyModelInput;

		items.push(
			new OO.ui.FieldLayout( propertyModelInput, {
				label: mw.msg( 'pageproperties-jsmodule-formfield-propertymodel' ),
				helpInline: true,
				align: 'top'
			} )
		);

		var SMWpropertiesValue = getPropertyValue( 'SMW-property' ) || Object.keys( SemanticProperties )[ 0 ];

		var SMWpropertiesInput = new OO.ui.DropdownInputWidget( {
			options: PagePropertiesFunctions.createDropDownOptions(
				Object.keys( SemanticProperties ),
				{ key: 'value' }
			),
			value: SMWpropertiesValue
		} );

		// eslint-disable-next-line no-unused-vars
		SMWpropertiesInput.on( 'change', function ( value ) {
			redrawAvailableInputs();
		} );

		Model[ 'SMW-property' ] = SMWpropertiesInput;

		var fieldSMWpropertiesInput = new OO.ui.FieldLayout( SMWpropertiesInput, {
			label: mw.msg( 'pageproperties-jsmodule-formfield-smwproperties' ),
			helpInline: true,
			align: 'top'
		} );

		items.push( fieldSMWpropertiesInput );

		// var smwTypesInput = new OO.ui.DropdownInputWidget({
		// 	options: PagePropertiesFunctions.createDropDownOptions(ManageProperties.TypeLabels),
		// 	value:
		// });

		var jsonSchemaValue = getPropertyValue( 'jsonSchema-type' );
		var jsonSchemaInput = new OO.ui.DropdownInputWidget( {
			options: PagePropertiesFunctions.createDropDownOptions(
				[
					'string',
					'number',
					'integer',
					'boolean'
					// select rather a type and toggle "multiple values"
					// "array",
				],
				{ key: 'value' }
			),
			value: jsonSchemaValue
		} );

		Model[ 'jsonSchema-type' ] = jsonSchemaInput;

		var fieldjsonSchemaInput = new OO.ui.FieldLayout( jsonSchemaInput, {
			label: mw.msg( 'pageproperties-jsmodule-formfield-schematypes' ),
			helpInline: true,
			align: 'top'
		} );

		items.push( fieldjsonSchemaInput );

		var textFormat = [
			'color',
			'date',
			'datetime',
			'datetime-local',
			'email',
			'month',
			'password',
			'number',
			'range',
			'tel',
			'text',
			'textarea',
			'time',
			'url',
			'week'
		];

		var jsonSchemaFormatValue = getPropertyValue( 'jsonSchema-format' );
		var jsonSchemaFormatInput = new OO.ui.DropdownInputWidget( {
			// , { key: "value" }
			options: PagePropertiesFunctions.createDropDownOptions( textFormat, {
				key: 'value'
			} ),
			value: jsonSchemaFormatValue
		} );

		// eslint-disable-next-line no-unused-vars
		jsonSchemaFormatInput.on( 'change', function ( value ) {
			redrawAvailableInputs();
		} );

		Model[ 'jsonSchema-format' ] = jsonSchemaFormatInput;

		var fieldjsonSchemaFormatInput = new OO.ui.FieldLayout(
			jsonSchemaFormatInput,
			{
				label: mw.msg( 'pageproperties-jsmodule-formfield-schematextsubtypes' ),
				helpInline: true,
				align: 'top'
			}
		);

		items.push( fieldjsonSchemaFormatInput );

		jsonSchemaInput.on( 'change', function ( value ) {
			switch ( value ) {
				case 'string':
					fieldjsonSchemaFormatInput.toggle( true );
					break;
				case 'integer':
				case 'number':
				case 'boolean':
					fieldjsonSchemaFormatInput.toggle( false );
					break;
			}
			redrawAvailableInputs();
		} );

		fieldSMWpropertiesInput.toggle( propertyModelValue === 'smw-property' );
		fieldjsonSchemaInput.toggle( propertyModelValue === 'json-schema' );
		fieldjsonSchemaFormatInput.toggle(
			propertyModelValue === 'jsonschema' && jsonSchemaValue === 'string'
		);

		propertyModelInput.on( 'change', function ( value ) {
			switch ( value ) {
				case 'smw-property':
					fieldSMWpropertiesInput.toggle( true );
					fieldjsonSchemaInput.toggle( false );
					fieldjsonSchemaFormatInput.toggle( false );
					break;
				case 'json-schema':
					fieldSMWpropertiesInput.toggle( false );
					fieldjsonSchemaInput.toggle( true );
					fieldjsonSchemaFormatInput.toggle(
						getPropertyValue( 'jsonSchema-type' ) === 'string'
					);
					break;
			}
			redrawAvailableInputs();
		} );

		var multipleValuesValue = getPropertyValue( 'multiple-value' );
		var multipleValuesInput = new OO.ui.ToggleSwitchWidget( {
			value: multipleValuesValue
		} );

		Model[ 'multiple-value' ] = multipleValuesInput;

		// eslint-disable-next-line no-unused-vars
		multipleValuesInput.on( 'change', function ( value ) {
			redrawAvailableInputs();
		} );

		var fieldMultipleValues = new OO.ui.FieldLayout( multipleValuesInput, {
			label: mw.msg( 'pageproperties-jsmodule-formfield-multiple-values' ),
			help: '',
			helpInline: true,
			align: 'top'
		} );

		items.push( fieldMultipleValues );

		var availableInputsValue = getPropertyValue( 'preferred-input' );
		// preferred input based on property type
		var availableInputsInput = new OO.ui.DropdownInputWidget( {
			// , { key: "value" }
			options: PagePropertiesFunctions.createDropDownOptions(
				getAvailableInputs(
					propertyModelValue,
					SMWpropertiesValue,
					jsonSchemaValue,
					jsonSchemaFormatValue,
					multipleValuesValue
				).concat( 'OO.ui.HiddenInputWidget' ),
				{
					key: 'value'
				}
			),
			value: availableInputsValue
		} );

		availableInputsInput.on( 'change', function ( value ) {
			onToggleHiddenInput( value === 'OO.ui.HiddenInputWidget' );
		} );

		Model[ 'preferred-input' ] = availableInputsInput;

		var inputConfigButton = new OO.ui.ButtonWidget( {
			icon: 'settings',
			flags: []
		} );

		Model[ 'input-config' ] = new PagePropertiesFunctions.MockupOOUIClass(
			getPropertyValue( 'input-config' ) || {}
		);

		inputConfigButton.on( 'click', function () {
			var SMWproperty = getPropertyValue( 'SMW-property' );
			var dataType = SemanticProperties[ SMWproperty ].type;
			PagePropertiesInputConfigInst.openDialog(
				Model[ 'input-config' ],
				availableInputsInput.getValue(),
				dataType
			);
		} );

		items.push(
			new OO.ui.ActionFieldLayout( availableInputsInput, inputConfigButton, {
				label: mw.msg( 'pageproperties-jsmodule-formfield-availableinputs' ),
				helpInline: true,
				align: 'top'
			} )
		);

		handleMultipleValuesOptions( availableInputsInput, items );

		var requiredInput = new OO.ui.ToggleSwitchWidget( {
			value: !!getPropertyValue( 'required' )
		} );

		Model.required = requiredInput;

		items.push(
			new OO.ui.FieldLayout( requiredInput, {
				label: mw.msg( 'pageproperties-jsmodule-formfield-required' ),
				helpInline: true,
				align: 'top'
			} )
		);

		var defaultInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( 'default' )
		} );

		Model.default = defaultInput;

		items.push(
			new OO.ui.FieldLayout( defaultInput, {
				label: mw.msg( 'pageproperties-jsmodule-formfield-default' ),
				help: mw.msg( 'pageproperties-jsmodule-formfield-default-value' ),
				helpInline: true,
				align: 'top'
			} )
		);

		var valueFormulaInput = new OO.ui.TextInputWidget( {
			value: getPropertyValue( 'value-formula' )
		} );

		Model[ 'value-formula' ] = valueFormulaInput;

		items.push(
			new OO.ui.FieldLayout( valueFormulaInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-valueformula' ),
				help: mw.msg( 'pageproperties-jsmodule-forms-field-valueformula-help' ),
				helpInline: true,
				align: 'top'
			} )
		);

		var onCreateOnlyInput = new OO.ui.ToggleSwitchWidget( {
			value: !!getPropertyValue( 'on-create-only' )
		} );

		Model[ 'on-create-only' ] = onCreateOnlyInput;

		items.push(
			new OO.ui.FieldLayout( onCreateOnlyInput, {
				label: mw.msg( 'pageproperties-jsmodule-forms-field-oncreateonly' ),
				help: mw.msg( 'pageproperties-jsmodule-forms-field-oncreateonly-help' ),
				helpInline: true,
				align: 'top'
			} )
		);

		function onToggleHiddenInput( selected ) {
			requiredInput.setDisabled( selected );
			onCreateOnlyInput.setDisabled( selected );
			fieldMultipleValues.toggle( !selected );
		}

		if ( availableInputsValue === 'OO.ui.HiddenInputWidget' ) {
			onToggleHiddenInput( true );
		}

		function redrawAvailableInputs() {
			availableInputsInput.setOptions(
				PagePropertiesFunctions.createDropDownOptions(
					getAvailableInputs(
						getPropertyValue( 'property-model' ),
						getPropertyValue( 'SMW-property' ),
						getPropertyValue( 'jsonSchema-type' ),
						getPropertyValue( 'jsonSchema-format' ),
						getPropertyValue( 'multiple-value' )
					).concat( 'OO.ui.HiddenInputWidget' ),
					{
						key: 'value'
					}
				)
			);
		}

		items = items.filter( function ( x ) {
			return !( 'items' in x ) || x.items.length;
		} );

		this.isEmpty = !items.length;

		this.fieldset.addItems( items );

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader(
				'#pageproperties-processDialogEditField'
			);
		}, 30 );
	};

	// eslint-disable-next-line no-unused-vars
	PanelLayout.prototype.addItem = function ( property ) {
		this.populateFieldset();
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

		panelLayout = new PanelLayout( {
			expanded: false,
			padded: false,
			classes: [ 'pageproperties-forms-fields-contentframe' ],
			data: {}
		} );

		var frameA = new OO.ui.PanelLayout( {
			$content: [ panelLayout.$element ],
			expanded: false,
			// framed: false,
			padded: false,
			data: { name: 'manageforms' }
		} );

		this.$body.append( frameA.$element );
	};

	ProcessDialog.prototype.getActionProcess = function ( action ) {
		var dialog = this;

		switch ( action ) {
			case 'save':
				var obj = {};
				for ( var i in Model ) {
					obj[ i ] = Model[ i ].getValue();
				}
				switch ( obj[ 'property-model' ] ) {
					case 'json-schema':
						delete obj[ 'SMW-property' ];
						break;
					case 'smw-property':
						delete obj[ 'jsonSchema-type' ];
						delete obj[ 'jsonSchema-format' ];
						break;
				}

				var label = obj.label.trim();
				var alert = null;
				if ( label === '' ) {
					alert = mw.msg( 'pageproperties-jsmodule-formfield-empty-field' );
				} else if ( label !== CurrentLabel && label in ParentObj ) {
					alert = mw.msg( 'pageproperties-jsmodule-formfield-existing-field' );
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

				if ( label !== CurrentLabel && CurrentLabel in ParentObj ) {
					PagePropertiesFunctions.renameObjectKey(
						ParentObj,
						CurrentLabel,
						label
					);
				}

				obj.type = 'property';
				ParentObj[ label ] = obj;
				Callback();

				return new OO.ui.Process( function () {
					dialog.close( { action: action } );
				} );
		}

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

	function openDialog( callback, semanticProperties, parentObj, fieldLabel ) {
		Callback = callback;
		SemanticProperties = semanticProperties;
		Model = {};
		ParentObj = parentObj;
		// NewField = fieldLabel === null || fieldLabel === undefined;
		CurrentLabel = fieldLabel || PagePropertiesFunctions.createNewLabel(
			parentObj,
			mw.msg( 'pageproperties-jsmodule-formfield-newlabel' )
		);

		var processDialog = new ProcessDialog( {
			size: 'large',
			classes: [],
			id: 'pageproperties-processDialogEditField'
		} );

		WindowManager.newWindow(
			processDialog,
			mw.msg(
				// The following messages are used here:
				// * pageproperties-jsmodule-manageproperties-define-property
				// * pageproperties-jsmodule-manageproperties-define-property - [name]
				'pageproperties-jsmodule-forms-definefield'
			) + ( fieldLabel ? ' - ' + fieldLabel : '' )
		);
	}

	return {
		openDialog,
		getAvailableInputs
	};
};
