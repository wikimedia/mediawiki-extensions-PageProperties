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

// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/toolbars.js

/* eslint-disable no-tabs */

const PageProperties = function (
	Config,
	FormID,
	Properties,
	Forms,
	SemanticForms,
	PageContent,
	PageCategories,
	WindowManager,
	Errors
) {
	var Model;
	var ModelForms;
	var ModelProperties;
	var OuterStack;
	var PropertiesStack;
	var processDialogSearch;
	var DialogSearchName = 'dialogSearch';
	var ToolbarA;
	var ActionToolbarA;
	var ActionWidget;
	var Self;
	var SubmitButton;
	// make shallow copy
	var RecordedForms = SemanticForms.slice();

	function inArray( val, arr ) {
		return jQuery.inArray( val, arr ) !== -1;
	}

	function getPropertyValue( properties, property ) {
		var ret = [];
		if (
			'__transformed-properties' in properties &&
			property in properties[ '__transformed-properties' ]
		) {
			ret = properties[ '__transformed-properties' ][ property ];
			ret = ret.map( ( x ) => {
				return { value: x };
			} );
		} else {
			if ( !( property in properties ) ) {
				ret = [ '' ];
			} else {
				// recorded model
				ret = properties[ property ];
			}
			ret = !Array.isArray( ret ) ? [ ret ] : ret;
			for ( var i in ret ) {
				if ( !PagePropertiesFunctions.isObject( ret[ i ] ) ) {
					ret[ i ] = { value: ret[ i ] };
				}
			}
		}
		return ret;
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

		if ( typeof value === 'boolean' ) {
			return false;
		}

		return value.trim() === '';
	}

	function getInputWidget( innerItemWidgetConfig, property, config ) {
		var config = JSON.parse( JSON.stringify( config ) ) || {};
		config.value = Array.isArray( config.value ) ?
			config.value.map( ( x ) => x.value ) :
			config.value.value;

		var inputName = innerItemWidgetConfig.inputName;
		var index = innerItemWidgetConfig.index;

		if ( !( 'name' in config ) || config.name.trim() === '' ) {
			config.name = `${FormID}-${property}-${index}`;
		}

		// or innerItemWidgetConfig.parentWidget.model.field
		var field = innerItemWidgetConfig.parentWidget.config.field;

		if ( Array.isArray( config.value ) ) {
			for ( var i in config.value ) {
				if ( config.value[ i ].trim() === '' ) {
					delete config.value[ i ];
				}
			}
		}

		// see here https://www.semantic-mediawiki.org/wiki/Help:Special_property_Allows_value
		// SemanticMediaWiki/src/DataValues/Va lueValidator/AllowsListConstraintValueValidator.php
		if ( inArray( inputName, ManageProperties.optionsInputs ) ) {
			if ( config.options && Object.keys( config.options ).length ) {
				config.options = PagePropertiesFunctions.createDropDownOptions(
					config.options
				);
			} else if ( field.form === null && isSMWProperty( field ) ) {
				config.options = [];
				var SMWProperty = getSMWProperty( field );
				if ( '_PVAL' in SMWProperty.properties ) {
					config.options = PagePropertiesFunctions.createDropDownOptions(
						// eslint-disable-next-line no-underscore-dangle
						SMWProperty.properties._PVAL,
						{
							key: 'value'
						}
					);
				} else {
					config.options = [];
				}
			} else {
				config.options = [];
			}
		}

		return ManageProperties.inputInstanceFromName( inputName, config );
	}

	function getSemanticForms() {
		return SemanticForms;
	}

	function isSMWProperty( field ) {
		return (
			'SMW-property' in field && field[ 'SMW-property' ] in ManageProperties.getSemanticProperties()
		);
	}

	function getSMWProperty( field ) {
		if ( 'SMW-property' in field ) {
			return ManageProperties.getSemanticProperty( field[ 'SMW-property' ] );
		}
		return null;
	}

	function isNewForm( form ) {
		return !inArray( form, RecordedForms );
	}

	function getPageCategories() {
		return PageCategories;
	}

	function getFieldAlign( field ) {
		if ( 'field-align' in field ) {
			return field[ 'field-align' ];
		}
		if ( field.form === null ) {
			return 'top';
		}
		return 'field-align' in Forms[ field.form ] ?
			Forms[ field.form ][ 'field-align' ] : 'top';
	}

	function getHelpInline( field ) {
		if ( field.form === null ) {
			return true;
		}
		return 'popup-help' in Forms[ field.form ] ?
			!isTrue( Forms[ field.form ][ 'popup-help' ] ) : true;
	}

	function getPreferredInput( field ) {
		if ( 'preferred-input' in field ) {
			return field[ 'preferred-input' ];
		}

		var SMWProperty = getSMWProperty( field );

		if ( SMWProperty ) {
			if ( '__pageproperties_preferred_input' in SMWProperty.properties ) {
				// eslint-disable-next-line no-underscore-dangle
				return SMWProperty.properties.__pageproperties_preferred_input[ 0 ];
			}

			return ManageProperties.getAvailableInputs( SMWProperty.type )[ 0 ];
		} else if (
			'property-model' in field &&
			field[ 'property-model' ] === 'json-schema'
		) {
			return ManageProperties.getAvailableInputsSchema(
				field[ 'jsonSchema-type' ],
				field[ 'jsonSchema-format' ]
			);
		}
		// fall-back
		return 'OO.ui.TextInputWidget';
	}

	function getModel( submit ) {
		var formattedNamespaces = mw.config.get( 'wgFormattedNamespaces' );

		function getPrefix( inputName, field, filekey ) {
			// @TODO handle prefix server-side ?
			var prefix = '';
			var namespace = null;
			// filekey can be ""
			if ( filekey !== null ) {
				// 'File:';
				namespace = 6;
			} else if ( isSMWProperty( field ) ) {
				switch ( inputName ) {
					// case 'OO.ui.SelectFileWidget':
					// namespace = 6;
					// break;
					case 'mw.widgets.UserInputWidget':
					case 'mw.widgets.UsersMultiselectWidget':
						// User:
						namespace = 2;
						break;
				}
			}

			if ( namespace ) {
				prefix = formattedNamespaces[ namespace ] + ':';
			}

			return prefix;
		}

		// eslint-disable-next-line no-shadow
		function getValuesRec( model, obj ) {
			// label
			for ( var label in model.properties ) {
				var field = model.properties[ label ].field;
				obj[ label ] = [];
				// index
				for ( var index in model.properties[ label ].items ) {
					var inputObj = model.properties[ label ].items[ index ];
					var value =
						'getValue' in inputObj.default ? inputObj.default.getValue() : '';

					var filekey =
						'filekey' in inputObj && 'getValue' in inputObj.filekey ?
							inputObj.filekey.getValue() :
							null;
					var prefix = getPrefix(
						model.properties[ label ].widgetConfig.inputName,
						field,
						filekey
					);

					if ( !Array.isArray( value ) ) {
						value = [ value ];
					}

					// eslint-disable-next-line no-shadow
					for ( var i in value ) {
						var valueObj = {
							value: value[ i ]
						};
						if ( filekey ) {
							valueObj.filekey = filekey;
						}
						if ( prefix ) {
							valueObj.prefix = prefix;
						}
						obj[ label ].push( valueObj );
					}
				}
			}
		}

		var forms = {};
		for ( var i in ModelForms ) {
			forms[ i ] = {};
			getValuesRec( ModelForms[ i ], forms[ i ] );
		}

		var properties = {};
		getValuesRec( ModelProperties, properties );

		if ( !submit ) {
			return { forms: forms, properties: properties };
		}

		var model = {};
		for ( var i in Model ) {
			model[ i ] = Model[ i ].getValue();
		}

		return { forms: forms, model: model, properties: properties };
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

		this.connect( this, {
			add: 'onAddItem'
		} );
	};

	OO.inheritClass( ListWidget, OO.ui.Widget );
	OO.mixinClass( ListWidget, OO.ui.mixin.GroupWidget );

	ListWidget.prototype.onAddItem = function () {
		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader( 'form' );
		}, 30 );
	};

	// @see onDeleteButtonClick
	ListWidget.prototype.onItemDelete = function ( itemWidget, isFile ) {
		var model = itemWidget.parentWidget.config.model;
		// var property = itemWidget.parentWidget.config.property;

		if ( itemWidget.parentWidget ) {
			if (
				!inputIsEmpty( model.items[ itemWidget.index ].default ) &&
				// eslint-disable-next-line no-alert
				!confirm(
					mw.msg( 'pageproperties-jsmodule-pageproperties-delete-confirm' )
				)
			) {
				return;
			}

			var length = this.getItems().length;

			if ( length > 1 || isFile ) {
				this.removeItems( [ itemWidget ] );
				delete model.items[ itemWidget.index ];

				if ( isFile ) {
					if ( itemWidget.parentWidget.required ) {
						itemWidget.parentWidget.fileInputWidget.setRequired( true );
					}
				}
			} else {
				model.items[ itemWidget.index ].default.setValue( '' );
			}

			if ( length === 0 ) {
				itemWidget.parentWidget.onDeleteButtonClick();
			}
			return;
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

	var InnerItemWidgetFile = function ( config ) {
		config = config || {};
		InnerItemWidgetFile.super.call( this, config );

		this.parentWidget = config.parentWidget;
		this.index = config.index;
		var property = this.parentWidget.config.property;
		var self = this;

		OO.ui.mixin.GroupWidget.call(
			this,
			$.extend(
				{
					$group: this.$element
				},
				config
			)
		);

		// the filename is always required
		var required = true;

		// *** or set fileInputWidget before creating
		// InnerItemWidgetFile
		if ( 'fileInputWidget' in this.parentWidget ) {
			this.parentWidget.fileInputWidget.setRequired( false );
		}

		// *** attention!! this is related to the OO.ui.TextInputWidget
		// not the OO.ui.SelectFileWidget
		var inputConfig = { required: required, value: config.value };

		var inputWidget = getInputWidget(
			config,
			property,
			// @TODO, enable after adding the logic
			// for file move server-side on filename edit
			// , disabled: true
			inputConfig
		);

		this.parentWidget.config.model.items[ config.index ] = {
			default: inputWidget,
			filekey: PagePropertiesFunctions.MockupOOUIClass(
				'filekey' in config.value ? config.value.filekey : ''
			)
		};

		var filePreview = new OO.ui.Widget( {
			classes: [ 'mw-upload-bookletLayout-filePreview' ]
		} );
		var progressBarWidget = new OO.ui.ProgressBarWidget( {
			progress: 0
		} );

		this.progressBarWidget = progressBarWidget;
		this.textInputWidget = inputWidget;

		this.messageWidget = new OO.ui.MessageWidget( {
			type: 'error',
			label: '',
			invisibleLabel: true,
			classes: [ 'pageproperties-upload-messagewidget' ]
		} );

		filePreview.$element.append( progressBarWidget.$element );
		filePreview.$element.append( inputWidget.$element );
		filePreview.$element.append( this.messageWidget.$element );

		progressBarWidget.toggle( !config.loaded );
		inputWidget.toggle( config.loaded );
		this.messageWidget.toggle( false );

		// eslint-disable-next-line no-unused-vars
		this.progress = function ( progress, estimatedRemainingTime ) {
			self.progressBarWidget.setProgress( progress * 100 );
		};

		this.property = property;

		this.uploadComplete = function ( file, res ) {
			self.progressBarWidget.toggle( false );
			self.textInputWidget.toggle( true );

			self.parentWidget.config.model.items[ config.index ].filekey =
				PagePropertiesFunctions.MockupOOUIClass( res.upload.filekey );
		};

		this.errorMessage = function ( errorMessage ) {
			self.textInputWidget.toggle( false );
			self.progressBarWidget.toggle( false );

			self.messageWidget.$element.append( errorMessage.getMessage() );
			self.messageWidget.toggle( true );
		};

		// eslint-disable-next-line no-unused-vars
		this.fail = function ( res ) {};

		var deleteButton = new OO.ui.ButtonWidget( {
			icon: 'close'
			// flags: ["destructive"],
		} );
		deleteButton.connect( this, {
			click: 'onDeleteButtonClick'
		} );
		this.$element.append(
			$( '<div style="display: table; width: 100%">' ).append( [
				$(
					'<div style="display: table-cell">'
				).append(
					filePreview.$element
				),
				$( '<div style="display: table-cell; width: 1%">'
				).append(
					deleteButton.$element
				)
			] )
		);
	};

	OO.inheritClass( InnerItemWidgetFile, OO.ui.Widget );
	OO.mixinClass( InnerItemWidgetFile, OO.ui.mixin.GroupWidget );

	InnerItemWidgetFile.prototype.onDeleteButtonClick = function () {
		this.emit( 'delete', 'file' );
	};

	var InnerItemWidget = function ( config ) {
		config = config || {};
		InnerItemWidget.super.call( this, config );
		this.parentWidget = config.parentWidget;
		this.index = config.index;
		var property = this.parentWidget.config.property;

		OO.ui.mixin.GroupWidget.call(
			this,
			$.extend(
				{
					$group: this.$element
				},
				config
			)
		);

		var field = this.parentWidget.config.field;

		var required =
			'required' in field && isTrue( field.required ) && config.index === 0;

		function isEmpty( value ) {
			if ( Array.isArray( value ) ) {
				return !value.length;
			}
			return value.value === '';
		}

		// @TODO default and "default-result"
		// should support multiselect inputs
		if (
			'default-result' in field &&
			isEmpty( config.value ) &&
			( Config.isNewPage || required || isNewForm( field.form ) )
		) {
			if ( !Array.isArray( config.value ) ) {
				config.value.value = field[ 'default-result' ];
			} else {
				if ( !Array.isArray( field[ 'default-result' ] ) ) {
					// eslint-disable-next-line no-console
					console.error( 'field["default-result"] must be an array' );
				} else {
					for ( var i in config.value ) {
						config.value[ i ].value = field[ 'default-result' ].shift();
					}
				}
			}
		}

		if ( !( 'input-config' in field ) ) {
			field[ 'input-config' ] = {};
		}
		// create shallow copy, otherwise changes are
		// copied to Forms[ form ].fields[ property ][ 'input-config' ]
		var inputConfig = $.extend(
			{},	// *** important !! cast to object
			JSON.parse( JSON.stringify( field[ 'input-config' ] ) ),
			{ value: config.value, required: required }
		);

		if ( 'options-values-result' in field ) {
			inputConfig.options = field[ 'options-values-result' ];
		}

		var inputWidget = getInputWidget( config, property, inputConfig );

		// mock-up native validation, see the following:
		// https://stackoverflow.com/questions/8287779/how-to-use-the-required-attribute-with-a-radio-input-field
		// https://stackoverflow.com/questions/6218494/using-the-html5-required-attribute-for-a-group-of-checkboxes

		if ( config.index === 0 && inputWidget.requiresValidation ) {
			// eslint-disable-next-line  no-underscore-dangle
			var name_ = Date.now() + '-validation';

			inputWidget.$element.append(
				$(
					'<input class="radio_for_required_checkboxes" type="radio" name="' +
						name_ +
						'"' +
						( inputIsEmpty( inputWidget ) ? ' required="required"' : '' ) +
						' />'
				)
			);

			var handleInputValidation = function ( nonEmpty ) {
				if ( nonEmpty ) {
					$( ":input[name='" + name_ + "']" ).removeAttr( 'required' );
				} else {
					$( ":input[name='" + name_ + "']" ).attr( 'required', 'required' );
				}
			};

			var valueIsNonEmpty = function ( value ) {
				if ( !Array.isArray( value ) ) {
					return value.trim() !== '';
				}

				// eslint-disable-next-line  no-underscore-dangle
				for ( var widget_ of value ) {
					// eslint-disable-next-line  no-underscore-dangle
					var value_ =
						'getValue' in widget_ ?
							widget_.getValue() :
							'data' in widget_ ?
								widget_.data :
								'';

					if ( value_.trim() !== '' ) {
						return true;
					}
				}
			};

			inputWidget.on( 'change', function ( value ) {
				handleInputValidation( valueIsNonEmpty( value ) );
			} );
		}

		this.parentWidget.config.model.items[ config.index ] = {
			default: inputWidget
		};

		if ( !config.multiple ) {
			this.$element.append( inputWidget.$element );

		} else {
			var deleteButton = new OO.ui.ButtonWidget( {
				icon: 'close'
				// flags: ["destructive"],
			} );
			deleteButton.connect( this, {
				click: 'onDeleteButtonClick'
			} );
			this.$element.append(
				$( '<div style="display: table; width: 100%">' ).append( [
					$(
						'<div style="display: table-cell">'
					).append(
						inputWidget.$element
					),
					$( '<div style="display: table-cell; width: 1%">'
					).append(
						deleteButton.$element
					)
				] )
			);
		}
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

		var self = this;
		this.config = config;
		// this.property = config.property;

		var deleteButton = new OO.ui.ButtonWidget( {
			icon: 'trash',
			flags: [ 'destructive' ]
		} );

		var field = config.field;

		var fieldAlign = getFieldAlign( field );
		var helpInline = getHelpInline( field );

		var inputName = ManageProperties.inputNameFromLabel(
			getPreferredInput( field )
		);

		if ( 'type' in field && field.type === 'content-block' ) {
			var item = new OO.ui.HtmlSnippet( field[ 'content-result' ] );
			this.$element.append( item.toString() );

			this.items = [ item ];
			deleteButton.connect( this, {
				click: 'onDeleteButtonClick'
			} );
			return;
		}

		this.field = field;
		var SMWProperty = getSMWProperty( field );

		var multiple = false;

		var isMultiselect = ManageProperties.isMultiselect( inputName );
		if ( !isMultiselect ) {
			// eslint-disable-next-line eqeqeq
			if ( [ 'multiple-value' ] in field && field[ 'multiple-value' ] == true ) {
				multiple = true;
			} else if (
				field.form === null &&
				SMWProperty &&
				!ManageProperties.disableMultipleFields( SMWProperty.type, inputName ) &&
				'__pageproperties_allows_multiple_values' in SMWProperty.properties &&
				// eslint-disable-next-line no-underscore-dangle
				SMWProperty.properties.__pageproperties_allows_multiple_values
			) {
				multiple = true;
			}
		}

		var helpMessage = '';
		if ( 'help-message' in field ) {
			if ( field[ 'help-message-result' ] ) {
				helpMessage = field[ 'help-message-result' ];
			} else {
				helpMessage = field[ 'help-message' ];

				if ( Array.isArray( helpMessage ) ) {
					helpMessage = helpMessage[ 0 ];
				}
			}
		} else if ( isSMWProperty( field ) ) {
			var SMWProperty = getSMWProperty( field );
			if ( SMWProperty.description ) {
				helpMessage = SMWProperty.description;
			}
		}

		config.model.widgetConfig = {
			inputName: inputName,
			multiple: multiple
		};

		var optionsList = new ListWidget();
		this.optionsList = optionsList;
		var values = getPropertyValue(
			config.properties,
			config.property
		);

		// remove namespace prefix for page type
		// based on the input type
		if ( SMWProperty && SMWProperty.type === '_wpg' ) {
			var formattedNamespaces = mw.config.get( 'wgFormattedNamespaces' );

			var namespace;
			switch ( inputName ) {
				case 'OO.ui.SelectFileWidget':
					// File:
					namespace = 6;
					break;
				case 'mw.widgets.UserInputWidget':
				case 'mw.widgets.UsersMultiselectWidget':
					// User:
					namespace = 2;
					break;
			}

			if ( namespace ) {
				for ( var i in values ) {
					var re = new RegExp( '^' + formattedNamespaces[ namespace ] + ':' );
					values[ i ].value = values[ i ].value.replace( re, '' );
				}
			}
		}

		if ( inputName === 'OO.ui.SelectFileWidget' ) {
			values = values.filter( ( x ) => x.value !== '' );
			for ( var i in values ) {
				optionsList.addItems( [
					new InnerItemWidgetFile( {
						classes: [ 'InnerItemWidgetFile' ],
						inputName: 'OO.ui.TextInputWidget',
						value: values[ i ],
						parentWidget: this,
						index: optionsList.items.length,
						multiple: multiple,
						loaded: true,
						last: i * 1 === values.length - 1
					} )
				] );
			}
		} else if ( !isMultiselect ) {
			for ( var i in values ) {
				optionsList.addItems( [
					new InnerItemWidget( {
						classes: [ 'InnerItemWidget' ],
						inputName: inputName,
						value: values[ i ],
						parentWidget: this,
						index: optionsList.items.length,
						multiple: multiple,
						last: i * 1 === values.length - 1
					} )
				] );
			}
		} else {
			optionsList.addItems( [
				new InnerItemWidget( {
					classes: [ 'InnerItemWidget' ],
					inputName: inputName,
					value: values,
					parentWidget: this,
					index: optionsList.items.length,
					multiple: false,
					last: true
				} )
			] );
		}

		var label = config.property;
		if ( 'label' in field ) {
			if ( field[ 'label-result' ] ) {
				label = field[ 'label-result' ];
			} else {
				label = field.label;

				if ( Array.isArray( label ) ) {
					label = label[ 0 ];
				}
			}
		}

		var items = [];
		if ( inputName !== 'OO.ui.HiddenInputWidget' ) {
			items.push(
				new OO.ui.FieldLayout( optionsList, {
					label: new OO.ui.HtmlSnippet( label ),
					align: fieldAlign,
					helpInline: helpMessage ? helpInline : true,
					help: new OO.ui.HtmlSnippet( helpMessage ),
					// The following classes are used here:
					// * inputName-mw.widgets.DateInputWidget
					// * inputName-mw.widgets. ...
					classes: [ 'inputName-' + inputName ]
				} )
			);
		}
		// }

		if ( inputName === 'OO.ui.SelectFileWidget' ) {
			var required = 'required' in field && isTrue( field.required );

			self.required = required;

			var inputConfig = $.extend(
				{ multiple: multiple },
				JSON.parse(
					JSON.stringify( 'input-config' in field ? field[ 'input-config' ] : {} )
				),
				{
					required: required && optionsList.items.length === 0,
					value: { value: '' }
				}
			);

			var inputWidget = getInputWidget(
				{
					inputName: inputName,
					parentWidget: this,
					index: 0
				},
				config.property + '-selectfile',
				// only require if there aren't files arealdy
				// loaded, then toggle require attribute on the
				// input widget if they are removed
				//
				inputConfig
			);

			// required to toggle required for native validation
			// based on the optionsList
			self.fileInputWidget = inputWidget;

			var loadedFiles = {};

			// eslint-disable-next-line no-unused-vars
			this.on( 'fileUploaded', function ( file ) {
				// console.log("event fileUploaded", file)
			} );

			this.on( 'fileUploadInit', function ( file ) {
				var innerItemWidgetFile = new InnerItemWidgetFile( {
					classes: [ 'InnerItemWidgetFile' ],
					inputName: 'OO.ui.TextInputWidget',
					value: { value: file.name },
					parentWidget: self,
					index: optionsList.items.length,
					multiple: multiple,
					loaded: false,
					last: false
				} );

				loadedFiles[ file.name ] = innerItemWidgetFile;
				optionsList.addItems( [ innerItemWidgetFile ] );
			} );

			this.on(
				'fileUploadProgress',
				function ( file, progress, estimatedRemainingTime ) {
					loadedFiles[ file.name ].progress( progress, estimatedRemainingTime );
				}
			);

			this.on( 'fileUploadComplete', function ( file, res ) {
				loadedFiles[ file.name ].uploadComplete( file, res );
			} );

			this.on( 'fileUploadErrorMessage', function ( file, errorMessage ) {
				loadedFiles[ file.name ].errorMessage( errorMessage );
			} );

			this.on( 'fileUploadFail', function ( file, res ) {
				loadedFiles[ file.name ].fail( res );
			} );

			var upload = new PagePropertiesUpload();
			upload.initialize( inputWidget, this );
			inputWidget.on( 'change', upload.uploadFiles.bind( upload ) );

			var fieldUploadInput = new OO.ui.FieldLayout( inputWidget, {
				label: fieldAlign === 'top' ? '' : new OO.ui.HtmlSnippet( '&nbsp;' ),
				align: fieldAlign,
				classes: [ ' pageproperties-form-button-addoption' ]
			} );

			// @TODO hide input after first upload is multiple is false

			items.push( fieldUploadInput );
		} else if ( multiple ) {
			var addOption = new OO.ui.ButtonWidget( {
				// label: "add field",
				icon: 'add'
			} );

			addOption.on( 'click', function () {
				optionsList.addItems( [
					new InnerItemWidget( {
						classes: [ 'InnerItemWidget' ],
						inputName: inputName,
						value: { value: '' },
						parentWidget: self,
						index: optionsList.items.length,
						multiple: multiple,
						last: true
					} )
				] );
			} );

			var fieldAddOption = new OO.ui.FieldLayout( addOption, {
				label: fieldAlign === 'top' ? '' : new OO.ui.HtmlSnippet( '&nbsp;' ),
				align: fieldAlign,
				classes: [ ' pageproperties-form-button-addoption' ]
			} );

			items.push( fieldAddOption );
		}

		for ( var item of items ) {
			this.$element.append( item.$element );
		}

		this.items = items;

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

	ProcessDialogSearch.prototype.initialize = function () {
		ProcessDialogSearch.super.prototype.initialize.apply( this, arguments );
		var self = this;
		this.selectedProperties = Object.keys( Properties[ 'semantic-properties' ] );
		this.selectedForms = SemanticForms;
		this.selectedItems = [];
		function getItems( value ) {
			var values;
			switch ( self.data.toolName ) {
				case 'addremoveproperties':
					values = Object.keys( ManageProperties.getSemanticProperties() );
					self.selectedItems = self.selectedProperties;
					break;
				case 'addremoveforms':
					self.selectedItems = self.selectedForms;
					values = Object.keys( Forms );
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
					selected: inArray( x, self.selectedItems )
				} );

				if ( self.data.toolName === 'addremoveproperties' ) {
					menuOptionWidget.$element.append(
						$(
							'<span class="oo-ui-labelElement-label right">' +
								ManageProperties.getSemanticProperty( x, 'typeLabel' ) +
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

		// searchWidget.getResults() is a SelectWidget
		// https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.SelectWidget
		var searchWidgetResults = searchWidget.getResults();
		searchWidgetResults.multiselect = true;

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
			var values = processDialogSearch.selectedItems;

			var res = getModel( false );
			Properties[ 'semantic-properties' ] = res.properties;
			Properties.forms = res.forms;

			switch ( this.data.toolName ) {
				case 'addremoveproperties':
					// remove unselected properties
					for ( var i in Properties[ 'semantic-properties' ] ) {
						if ( !inArray( i, values ) ) {
							delete Properties[ 'semantic-properties' ][ i ];
						}
					}

					// add new properties
					for ( var label of values ) {
						if ( !( label in Properties[ 'semantic-properties' ] ) ) {
							Properties[ 'semantic-properties' ][ label ] = [ { value: '' } ];
						}
					}

					updatePanels( false );
					break;
				case 'addremoveforms':
					for ( var i in Properties.forms ) {
						if ( !inArray( i, values ) ) {
							delete Properties.forms[ i ];
							delete ModelForms[ i ];
						}
					}

					var missingForms = [];
					for ( var i of values ) {
						if ( !( i in Forms ) || !Object.keys( Forms[ i ] ).length ) {
							missingForms.push( i );
						}
					}
					if ( missingForms.length ) {
						var payload = {
							action: 'pageproperties-form-descriptor',
							forms: missingForms.join( '|' )
						};

						// eslint-disable-next-line no-shadow
						new mw.Api().postWithToken( 'csrf', payload ).done( function ( res ) {
							// console.log("res", res);

							if ( 'pageproperties-form-descriptor' in res ) {
								var data = res[ 'pageproperties-form-descriptor' ];

								// eslint-disable-next-line no-shadow
								for ( var i in data.forms ) {
									Forms[ i ] = data.forms[ i ];
								}

								// SemanticForms = SemanticForms.concat(missingForms)
								updatePanels( false );
							}
						} );
					} else {
						updatePanels( false );
					}

					break;
			}
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
				WindowManager.removeActiveWindow();
			}, this );
	};

	function openSearchDialog( toolName ) {
		processDialogSearch = new ProcessDialogSearch( {
			size: 'medium',
			classes: [ 'pageproperties-search-dialog' ],
			data: { toolName: toolName }
		} );

		WindowManager.newWindow(
			processDialogSearch,
			mw.msg(
				// The following messages are used here:
				// * pageproperties-jsmodule-forms-dialogsearch-selectforms
				// * pageproperties-jsmodule-forms-dialogsearch-selectproperties
				'pageproperties-jsmodule-forms-dialogsearch-select' +
					( toolName === 'addremoveforms' ? 'forms' : 'properties' )
			)
		);
	}

	// https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.Toolbar

	function createToolbar( /* disabled */ ) {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		// *** not working
		// var Toolbar = function (toolFactory, toolGroupFactory, config) {
		// 	Toolbar.super.call(this, toolFactory, toolGroupFactory, config);
		// };

		// OO.inheritClass(Toolbar, OO.ui.Toolbar);
		// OO.mixinClass(Toolbar, OO.ui.mixin.PendingElement);

		// var toolbar = new Toolbar(toolFactory, toolGroupFactory, {
		// 	actions: true,
		// });

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
		} );

		var onSelect = function ( self ) {
			var toolName = self.getName();

			switch ( toolName ) {
				case 'addremoveforms':
				case 'addremoveproperties':
					openSearchDialog( toolName );
					break;
			}

			self.setActive( false );
		};

		var loadDataBeforeSelect = function () {
			var dataToLoad = ManageProperties.matchLoadedData( [
				'forms',
				'semantic-properties'
			] );

			if ( !dataToLoad.length ) {
				return onSelect( this );
			}

			this.setDisabled( true );
			this.pushPending();

			ManageProperties.loadData( dataToLoad )
				.then( ( res ) => {
					if ( 'forms' in res ) {
						Forms = res.forms;
					}
					this.setDisabled( false );
					this.popPending();
					onSelect( this );
				} )
				.catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.log( 'loadData error', error );
					this.popPending();
					this.setDisabled( false );
					this.setActive( false );

					PagePropertiesFunctions.OOUIAlert( new OO.ui.HtmlSnippet( error ), {
						size: 'medium'
					} );
				} );
		};

		var toolGroup = [];

		if (
			Config.context !== 'parserfunction' &&
			( Config.canManageSemanticProperties || Config.canComposeForms )
		) {
			toolGroup.push( {
				name: 'addremoveforms',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-pageproperties-addremoveforms' ),
				onSelect: loadDataBeforeSelect
				// config: {
				// 	data: { disabled: disabled },
				// },
			} );
		}

		if (
			Config.context !== 'parserfunction' &&
			( Config.canManageSemanticProperties || Config.canAddSingleProperties )
		) {
			toolGroup.push( {
				name: 'addremoveproperties',
				icon: 'add',
				title: mw.msg( 'pageproperties-jsmodule-forms-addremoveproperties' ),
				onSelect: loadDataBeforeSelect
				// config: {
				// 	data: { disabled: disabled },
				// },
			} );
		}

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

	function createActionToolbar( /* disabled */ ) {
		// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/refs/tags/v0.40.4/demos/pages/toolbars.js

		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: false
		} );

		var onSelect = function ( self ) {
			var self = arguments.length ? self : this;
			var selected = self.getName();

			var panels = OuterStack.getItems();
			for ( var panel of panels ) {
				if ( panel.getData().name === selected ) {
					break;
				}
			}

			OuterStack.setItem( panel );

			// *** this prevents inconsistencies of the datatable layout
			switch ( selected ) {
				case 'manageproperties':
					ManageProperties.initialize();
					break;
				case 'managecategories':
					PagePropertiesCategories.initialize();
					break;
				case 'manageforms':
					PagePropertiesForms.initialize();
					break;
			}

			self.setActive( false );
		};

		var loadDataBeforeSelect = function () {
			var dataToLoad = ManageProperties.matchLoadedData( [
				'forms',
				'semantic-properties',
				'categories',
				'importedVocabularies',
				'typeLabels',
				'propertyLabels'
			] );

			if ( !dataToLoad.length ) {
				return onSelect( this );
			}

			// this.setDisabled(true);
			// this.pushPending();

			ActionWidget = new OO.ui.ActionWidget();
			// ActionToolbarA
			ToolbarA.$bar.wrapInner( '<div class="wrapper"></div>' );
			ActionWidget.setPendingElement( ToolbarA.$bar.find( '.wrapper' ) );
			ActionWidget.pushPending();

			$( ToolbarA.$bar ).find( '.wrapper' ).css( 'pointer-events', 'none' );

			ManageProperties.loadData( dataToLoad )
				.then( ( res ) => {
					// this.setDisabled(false);
					// this.popPending();
					ActionWidget.popPending();
					$( ToolbarA.$bar ).find( '.wrapper' ).css( 'pointer-events', 'auto' );

					if ( 'forms' in res ) {
						Forms = res.forms;
					}

					ManageProperties.initialize(
						Self,
						res.importedVocabularies,
						res.typeLabels,
						res.propertyLabels
					);

					PagePropertiesCategories.initialize( res.categories );

					PagePropertiesForms.initialize( Self, Forms );

					onSelect( this );
				} )
				.catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.log( 'loadData error', error );
					ActionWidget.popPending();
					$( ToolbarA.$bar ).find( '.wrapper' ).css( 'pointer-events', 'auto' );
					this.setActive( false );

					PagePropertiesFunctions.OOUIAlert( new OO.ui.HtmlSnippet( error ), {
						size: 'medium'
					} );
				} );
		};

		var toolGroup = [
			{
				name: 'pageproperties',
				icon: null,
				title: mw.msg( 'pageproperties-jsmodule-pageproperties-page-properties' ),
				onSelect: onSelect
			},
			{
				name: 'manageproperties',
				icon: null,
				title: mw.msg(
					'pageproperties-jsmodule-pageproperties-manage-properties'
				),
				onSelect: loadDataBeforeSelect
				// config: {
				// 	data: { disabled: disabled },
				// },
			},
			{
				name: 'managecategories',
				icon: null,
				title: mw.msg(
					'pageproperties-jsmodule-pageproperties-manage-categories'
				),
				onSelect: loadDataBeforeSelect
				// config: {
				// 	data: { disabled: disabled },
				// },
			},
			{
				name: 'manageforms',
				icon: null,
				title: mw.msg( 'pageproperties-jsmodule-pageproperties-manage-forms' ),
				onSelect: loadDataBeforeSelect
				// config: {
				// 	data: { disabled: disabled },
				// },
			}
			// ["forms", "null", "Forms", onSelectSwitch],
		];

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

		// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/toolbars.js
		// PagePropertiesFunctions.createDisabledToolGroup(
		// 	toolGroupFactory,
		// 	OO.ui.ListToolGroup,
		// 	"editorSwitch",
		// );

		PagePropertiesFunctions.createToolGroup(
			toolFactory,
			'selectSwitch',
			toolGroup
		);

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

		if ( config.data.type === 'form' && Config.canManageSemanticProperties ) {
			var editButton = new OO.ui.ButtonWidget( {
				classes: [ 'pageproperties-form-editbutton' ],
				icon: 'edit',
				label: '',
				framed: false,
				invisibleLabel: true
			} );

			editButton.on( 'click', function () {
				var dataToLoad = ManageProperties.matchLoadedData( [
					'forms',
					'semantic-properties',
					'typeLabels'
				] );

				if ( !dataToLoad.length ) {
					return PagePropertiesForms.openDialog( config.data.label );
				}

				ManageProperties.loadData( dataToLoad ).then( ( res ) => {
					if ( 'forms' in res ) {
						Forms = res.forms;
					}
					PagePropertiesForms.initialize( Self, Forms );
					PagePropertiesForms.openDialog( config.data.label );
				} );
			} );

			this.$element.append(
				$( '<div style="display: flex;align-items: center">' ).append( [
					$(
						'<h3 style="margin-top:0;padding-top:0"><b>' +
							config.data.label +
							'</b></h3>'
					).append(
						$( '<sup style="margin-left:8px">' ).append( editButton.$element )
					)
				] )
			);
		} else {
			this.$element.append(
				'<h3 style="margin-top:0;padding-top:0"><b>' +
					config.data.label +
					'</b></h3>'
			);
		}
		this.$element.append( this.fieldset.$element );

		// this.$element.append(this.messageWidget.$element);
	}

	OO.inheritClass( PanelLayout, OO.ui.PanelLayout );

	// ^^^
	function addPropertyItems( model, properties, fields, obj ) {
		var items = [];
		model.properties = {};

		for ( var i in fields ) {
			if (
				obj.form !== null &&
				Config.targetPage &&
				isTrue( fields[ i ][ 'on-create-only' ] )
			) {
				continue;
			}

			if ( obj.form ) {
				fields[ i ].form = obj.form;
			}

			if ( !( i in model.properties ) ) {
				model.properties[ i ] = { field: fields[ i ], items: [] };
			}

			var item = new ItemWidget( {
				classes: [ 'ItemWidget' ],
				properties: properties,
				property: i,
				model: model.properties[ i ],
				field: fields[ i ]
			} );

			items.push( item );
		}

		return items;
	}

	PanelLayout.prototype.populateFieldset = function () {
		this.fieldset.clearItems();
		var data = this.data;

		var items = [];

		switch ( data.type ) {
			case 'properties':
				if ( !( 'semantic-properties' in Properties ) ) {
					Properties[ 'semantic-properties' ] = {};
				}

				// @TODO create PageProperties properties
				// in a dedicated namespace with properties
				// like a form-field
				var fields = {};
				// or call directly new ItemWidget()
				for ( var i in Properties[ 'semantic-properties' ] ) {
					fields[ i ] = {
						'SMW-property': i,
						form: null,
						'field-align': data.fieldAlign
					};
				}
				items = addPropertyItems(
					ModelProperties,
					Properties[ 'semantic-properties' ],
					fields,
					{
						multiple: null,
						form: null
					}
				);
				break;

			case 'form':
				var formName = data.form;
				var form = Forms[ formName ];

				if ( !( 'forms' in Properties ) ) {
					Properties.forms = {};
				}

				if ( !( formName in Properties.forms ) ) {
					Properties.forms[ formName ] = {};
				}

				items = addPropertyItems(
					// @TODO handle multiple instances
					( ModelForms[ formName ] = {} ),
					Properties.forms[ formName ],
					form.fields,
					{
						multiple: null,
						form: formName
					}
				);

				break;

			case 'wiki':
				var userDefinedInput;
				var userDefinedField;
				if ( data.userDefined ) {
					var inputName = 'mw.widgets.TitleInputWidget';
					userDefinedInput = new mw.widgets.TitleInputWidget( {
						name: `${FormID}-model-target-title`,
						required: true
					} );

					Model[ 'target-title' ] = userDefinedInput;

					userDefinedField = new OO.ui.FieldLayout( userDefinedInput, {
						label: mw.msg( 'pageproperties-jsmodule-forms-pagename' ),
						align: data.fieldAlign,
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

					for ( var form in data.pagenameFormula ) {
						options.push( {
							data: form,
							label: mw.msg(
								'pageproperties-jsmodule-pageproperties-pagenameformulaof',
								form
							)
						} );
					}

					var selectPagenameInput = new OO.ui.RadioSelectInputWidget( {
						options: options,
						name: `${FormID}-model-pagename-formula`
					} );

					Model[ 'pagename-formula' ] = selectPagenameInput;

					selectPagenameInput.on( 'change', function ( value ) {
						userDefinedField.toggle( value === '' );
						userDefinedInput.setRequired( value === '' );
					} );

					items.push(
						new OO.ui.FieldLayout( selectPagenameInput, {
							label: mw.msg( 'pageproperties-jsmodule-forms-pagename' ),
							align: data.fieldAlign,
							classes: [ 'ItemWidget' ]
						} )
					);
				}

				if ( data.userDefined ) {
					items.push( userDefinedField );
				}

				if ( data.freeText ) {
					// @TODO add editor
					// @see PageForms-5.5.1/includes/forminputs/PF_TextAreaInput.php
					// libs/PF_wikieditor.js

					var inputName = 'OO.ui.MultilineTextInputWidget';
					var inputWidget = new OO.ui.MultilineTextInputWidget( {
						name: `${FormID}-model-freetext`,
						autosize: true,
						rows: 6,

						value: Model.freetext ? Model.freetext.getValue() : PageContent
					} );

					Model.freetext = inputWidget;

					items.push(
						new OO.ui.FieldLayout( inputWidget, {
							label: mw.msg( 'pageproperties-jsmodule-formedit-freetext' ),
							align: data.fieldAlign,

							// The following classes are used here:
							// * inputName-mw.widgets.TitleInputWidget
							// * inputName-mw.widgets...
							classes: [ 'ItemWidget', 'inputName-' + inputName ]
						} )
					);
				}
				if ( data.categories ) {
					var categories = data.categories;

					if ( data.showCategoriesInput ) {
						var categoriesInput = new mw.widgets.CategoryMultiselectWidget( {
							name: `${FormID}-model-pagecategories`
							// value: categories,
						} );

						Model.pagecategories = categoriesInput;

						// ***prevents error "Cannot read properties of undefined (reading 'apiUrl')"
						for ( var category of categories ) {
							categoriesInput.addTag( category );
						}
						items.push(
							new OO.ui.FieldLayout( categoriesInput, {
								label: mw.msg( 'pageproperties-jsmodule-forms-categories' ),
								align: data.fieldAlign,
								classes: [ 'ItemWidget' ]
							} )
						);
					} else {
						Model.pagecategories =
							PagePropertiesFunctions.MockupOOUIClass( categories );
					}
				}

				if ( data.contentModels ) {
					// show radio
					if ( data.contentModels.length > 1 ) {
						var options = [];
						for ( var contentModel of data.contentModels ) {
							options.push( {
								data: Config.contentModels[ contentModel ],
								label: contentModel
							} );
						}

						var selectContentModelsInput = new OO.ui.RadioSelectInputWidget( {
							options: options,
							name: `${FormID}-model-content-model`
						} );

						Model[ 'content-model' ] = selectContentModelsInput;

						items.push(
							new OO.ui.FieldLayout( selectContentModelsInput, {
								label: mw.msg( 'pageproperties-jsmodule-forms-contentmodels' ),
								align: data.fieldAlign,
								classes: [ 'ItemWidget' ]
							} )
						);
					} else {
						Model[ 'content-model' ] = {
							getValue: function () {
								// eslint-disable-next-line no-shadow
								var contentModel = data.contentModels[ 0 ];
								return Config.contentModels[ contentModel ];
							}
						};
					}
				}
		}

		items = items.filter( function ( x ) {
			return !( 'items' in x ) || x.items.length;
		} );

		this.isEmpty = !items.length;

		this.fieldset.addItems( items );
	};

	PanelLayout.prototype.addProperty = function ( property ) {
		if ( !( property in Properties[ 'semantic-properties' ] ) ) {
			Properties[ 'semantic-properties' ][ property ] = [ { value: '' } ];
		}

		this.populateFieldset();
	};

	// called from ManageProperties
	function updateData( data ) {
		if ( Config.context !== 'ManageProperties' ) {
			var res = getModel( false );
			Properties[ 'semantic-properties' ] = res.properties;
			Properties.forms = res.forms;
		}

		switch ( data[ 'result-action' ] ) {
			case 'update':
				break;
			case 'delete':
				for ( var property of data[ 'deleted-properties' ] ) {
					delete Properties[ 'semantic-properties' ][ property ];
				}
				// @TODO remove SMW-properties properties in forms
				break;

			case 'create':
				for ( var property in data[ 'semantic-properties' ] ) {
					Properties[ 'semantic-properties' ][ property ] = [ { value: '' } ];
				}
				break;

			case 'rename':
				if ( data[ 'previous-label' ] in Properties[ 'semantic-properties' ] ) {
					PagePropertiesFunctions.renameObjectKey(
						Properties[ 'semantic-properties' ],
						data[ 'previous-label' ],
						data.label
					);
				}
				// @TODO rename SMW-properties
				// for (var form in Forms) {
				// }
				break;
		}

		if ( Config.context !== 'ManageProperties' ) {
			updatePanels( false );
		}
		return true;
	}

	function getPropertiesPanels() {
		var panels = [];

		// create panels for forms
		var pagenameFormula = {};
		var userDefined = false;
		var freeText = false;
		var formCategories = [];
		var formContentModels = [];
		var showCategoriesInput = !SemanticForms.length || !Config.isNewPage;
		var fieldAlign = 'top';

		if ( !( 'semantic-properties' in Properties ) ) {
			Properties[ 'semantic-properties' ] = {};
		}

		for ( var form of SemanticForms ) {
			if ( 'show-categories-input' in Forms[ form ] && isTrue( Forms[ form ][ 'show-categories-input' ] ) ) {
				showCategoriesInput = true;
			}

			if ( !Config.targetPage ) {
				if ( Forms[ form ][ 'pagename-formula' ] ) {
					pagenameFormula[ form ] = Forms[ form ][ 'pagename-formula' ];
				} else {
					userDefined = true;
				}
			}

			if (
				Forms[ form ][ 'freetext-input' ] === 'show always' ||
				( !Config.targetPage &&
					Forms[ form ][ 'freetext-input' ] === 'show on create' )
			) {
				freeText = true;
			}

			if ( Forms[ form ][ 'content-model' ] ) {
				if ( !inArray( Forms[ form ][ 'content-model' ], formContentModels ) ) {
					formContentModels.push( Forms[ form ][ 'content-model' ] );
				}
			}

			if ( Forms[ form ].categories ) {
				for ( var i of Forms[ form ].categories ) {
					formCategories.push( i );
				}
			}

			// this will set the fieldAlign of the wiki
			// section as the fieldAlign of last form
			if ( 'field-align' in Forms[ form ] ) {
				fieldAlign = Forms[ form ][ 'field-align' ];
			}

			panels.push(
				new PanelLayout( {
					expanded: false,
					padded: true,
					framed: false,
					classes: [ 'PanelProperties-panel-section' ],
					data: {
						label: form, // mw.msg
						form: form,
						type: 'form'
					}
				} )
			);
		}

		if ( !SemanticForms.length ) {
			if ( !Config.targetPage || Config.isNewPage ) {
				freeText = true;
			}
			if ( !Config.targetPage ) {
				userDefined = true;
			}
		}

		// create single properties panel
		if ( Object.keys( Properties[ 'semantic-properties' ] ).length ) {
			panels.push(
				new PanelLayout( {
					padded: true,
					framed: false,
					classes: [ 'PanelProperties-panel-section' ],
					data: {
						label: mw.msg( 'pageproperties-jsmodule-formedit-properties' ),
						expanded: false,
						type: 'properties',
						fieldAlign: fieldAlign
					}
				} )
			);
		}

		var categories = formCategories
			.concat( PageCategories )
			.filter( function onlyUnique( value, index, self ) {
				return self.indexOf( value ) === index;
			} );

		// create title and free text input
		if (
			Object.keys( pagenameFormula ).length ||
			formContentModels.length ||
			userDefined ||
			freeText ||
			categories
		) {
			panels.push(
				new PanelLayout( {
					expanded: false,
					padded: true,
					framed: false,
					classes: [ 'PanelProperties-panel-section' ],
					data: {
						type: 'wiki',
						label: mw.msg( 'pageproperties-jsmodule-formedit-wiki' ),
						pagenameFormula: pagenameFormula,
						contentModels: formContentModels,
						userDefined: userDefined,
						freeText: freeText,
						categories: formCategories,
						showCategoriesInput: showCategoriesInput,
						fieldAlign: fieldAlign
					}
				} )
			);
		}

		return panels.filter( ( x ) => !x.isEmpty );
	}

	function updatePanels( fromModel ) {
		if ( fromModel ) {
			var res = getModel( false );
			Properties[ 'semantic-properties' ] = res.properties;
			Properties.forms = res.forms;
		}

		PropertiesStack.clearItems();
		var panels = getPropertiesPanels();
		PropertiesStack.addItems( panels );
		PropertiesStack.$element[ !panels.length ? 'addClass' : 'removeClass' ](
			'PanelProperties-empty'
		);

		SubmitButton.toggle( panels.length );

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader( 'form' );
		}, 30 );
	}

	// @TODO this is used as long as Mediawiki's api
	// prevents to return boolean values (see include/api/ApiResult.php -> getResultData)
	// "- Boolean-valued items are changed to '' if true or removed if false"
	function isTrue( val ) {
		return val === true || val === 1;
	}

	function updateForms( forms ) {
		Forms = forms;
		updatePanels( true );
	}

	function onSubmit() {
		$( 'input.radio_for_required_checkboxes[name$=-validation]' ).remove();
		var formEl = $( this ).closest( '.pagepropertiesform' );

		var res = getModel( true );

		// return false;
		$( '<input>' )
			.attr( {
				type: 'hidden',
				name: 'semantic-properties-model',
				value: JSON.stringify( res )
			} )
			.appendTo( formEl );

		return true;
	}

	function initialize( pageProperties ) {
		if ( arguments.length ) {
			Self = pageProperties;
		}

		Model = {};
		ModelProperties = {};
		ModelForms = {};
		$( '#semantic-properties-wrapper' ).empty();

		var panels = getPropertiesPanels();
		var classes = [ 'PanelProperties' ];
		if ( !panels.length ) {
			classes.push( 'PanelProperties-empty' );
		}
		PropertiesStack = new OO.ui.StackLayout( {
			items: panels,
			continuous: true,
			// The following classes are used here:
			// * PanelProperties
			// * PanelProperties-empty
			classes: classes
		} );

		var frameAContent = [];

		if ( Errors.length ) {
			var messageWidget = new OO.ui.MessageWidget( {
				type: 'error',
				label: new OO.ui.HtmlSnippet( Errors.join( '<br /> ' ) )
			} );

			frameAContent.push( messageWidget.$element );
			frameAContent.push( $( '<br>' ) );
		}

		// var progressBar = new OO.ui.ProgressBarWidget( {
		//	progress: false
		// } );

		ToolbarA = createToolbar( Config.context === 'EditSemantic' );
		frameAContent.push( ToolbarA.$element );

		frameAContent.push( PropertiesStack.$element );

		SubmitButton = new OO.ui.ButtonInputWidget( {
			label: mw.msg( 'pageproperties-jsmodule-pageproperties-submit' ),
			flags: [ 'primary', 'progressive' ],
			type: 'submit'
		} );

		SubmitButton.toggle( panels.length );

		frameAContent.push( SubmitButton.$element );
		var queryObj = {
			formID: FormID,
			context: Config.context,
			returnUrl: Config.returnUrl
		};
		var form = new OO.ui.FormLayout( {
			$content: frameAContent,
			action:
				Config.actionUrl +
				( Config.actionUrl.indexOf( '?' ) === -1 ? '?' : '&' ) +
				Object.keys( queryObj )
					.map( ( key ) => {
						return `${key}=${encodeURIComponent( queryObj[ key ] )}`;
					} )
					.join( '&' ),
			method: 'post',
			enctype: 'multipart/form-data',
			classes: [ 'pagepropertiesform' ],
			data: { name: 'pageproperties' }
		} );

		form.$element.on( 'submit', onSubmit );

		var items = [ form ];

		if (
			Config.context !== 'parserfunction' &&
			Config.canManageSemanticProperties
		) {
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

			items = items.concat( [ frameB, frameC, frameD ] );
		}

		OuterStack = new OO.ui.StackLayout( {
			items: items,
			expanded: true,
			continuous: false
		} );

		if (
			Config.context !== 'parserfunction' &&
			Config.canManageSemanticProperties
		) {
			ActionToolbarA = createActionToolbar( Config.context === 'EditSemantic' );
			ToolbarA.$actions.append( ActionToolbarA.$element );

			var actionToolbar = createActionToolbar();
			toolbarB.$actions.append( actionToolbar.$element );

			actionToolbar = createActionToolbar();
			toolbarC.$actions.append( actionToolbar.$element );

			actionToolbar = createActionToolbar();
			toolbarD.$actions.append( actionToolbar.$element );
		}

		$( '#pagepropertiesform-wrapper-' + FormID ).append( OuterStack.$element );

		// if (Config["context"] === "EditSemantic") {
		ToolbarA.initialize();
		// }

		if (
			Config.context !== 'parserfunction' &&
			Config.canManageSemanticProperties
		) {
			toolbarB.initialize();
			toolbarC.initialize();
			toolbarD.initialize();
		}

		$( '#mw-rcfilters-spinner-wrapper' ).remove();

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader( 'form' );
		}, 30 );
	}

	return {
		initialize,
		updateData,
		getModel,
		getSemanticForms,
		getPageCategories,
		updateForms
	};
};

$( function () {
	var semanticProperties = JSON.parse(
		mw.config.get( 'pageproperties-semanticProperties' )
	);
	// console.log("semanticProperties", semanticProperties);

	var forms = JSON.parse( mw.config.get( 'pageproperties-forms' ) );
	// console.log("forms", forms);

	var categories = JSON.parse( mw.config.get( 'pageproperties-categories' ) );
	// console.log("categories", categories);

	var pageForms = JSON.parse( mw.config.get( 'pageproperties-pageForms' ) );
	// console.log("pageForms", pageForms);

	var sessionData = JSON.parse( mw.config.get( 'pageproperties-sessionData' ) );
	// console.log("sessionData", sessionData);

	var config = JSON.parse( mw.config.get( 'pageproperties-config' ) );
	// console.log("config", config);

	var windowManager = new PagePropertiesWindowManager();

	ManageProperties.preInitialize( config, windowManager, semanticProperties );

	if (
		config.context === 'ManageProperties' ||
		config.context === 'EditSemantic'
	) {
		PagePropertiesCategories.preInitialize( windowManager );
		PagePropertiesForms.preInitialize( config, windowManager );
	} else if (
		config.context === 'parserfunction' &&
		config.canManageSemanticProperties
	) {
		PagePropertiesForms.preInitialize( config, windowManager );
	}

	var pageProperties;
	if (
		config.context === 'parserfunction' ||
		config.context === 'EditSemantic'
	) {
		for ( var formID in pageForms ) {
			var semanticForms = pageForms[ formID ].forms;

			// @TODO available options
			// css-class = 		// used to display the form
			// redirect-page = 	// to be passed server-side
			// submit-text = 		// used to display the form
			// eslint-disable-next-line max-len
			// paging = [ sections, sections-accordion, steps ] (multiple-forms-display-strategy) // used to display the form
			// email-to = 			// to be passed server-side
			// navigation-next = 	// used to display the form
			// navigation-back = 	// used to display the form
			// var options = pageForms[ formID ].options;

			var pageContent = '';
			var pageCategories = [];
			var errors = [];
			var properties = [];

			if ( sessionData.formID && sessionData.formID === formID ) {
				pageContent = sessionData.freetext;
				pageCategories = sessionData.pageCategories;
				errors = sessionData.errors;
				properties = sessionData.properties;
			}

			pageProperties = new PageProperties(
				config,
				formID,
				properties,
				forms,
				semanticForms,
				pageContent,
				pageCategories,
				windowManager,
				errors
			);

			pageProperties.initialize( pageProperties );

			if ( config.context === 'parserfunction' && errors.length ) {
				$( '#pagepropertiesform-wrapper-' + formID )
					.get( 0 )
					.scrollIntoView();
			}
		}
	}

	if ( config.context === 'ManageProperties' ) {
		ManageProperties.initialize(
			pageProperties,
			null,
			null,
			null
		);

		PagePropertiesCategories.initialize( categories );
		PagePropertiesForms.initialize( pageProperties, forms );
		ImportProperties.initialize( config, windowManager );
	}

	// display every 3 days
	if (
		!mw.config.get( 'pageproperties-disableVersionCheck' ) &&
		config.canManageSemanticProperties &&
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
							$( '.pagepropertiesform' )
								.first()
								.prepend( $( '<div><br/></div>' ).prepend( messageWidget.$element ) );
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
