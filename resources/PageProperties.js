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
 * @copyright Copyright © 2021-2022, https://wikisphere.org
 */

// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/toolbars.js

/* eslint-disable no-tabs */

const PageProperties = function (
	Config,
	FormID,
	SemanticProperties,
	Properties,
	Forms,
	SemanticForms,
	PageContent,
	PageCategories,
	WindowManagerSearch,
	WindowManagerAlert,
	Errors
) {
	var Model;
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

	function getPropertyValue( property ) {
		if ( property in Model ) {
			var ret = [];
			for ( var i in Model[ property ] ) {
				var inputWidget = Model[ property ][ i ];
				var value = inputWidget.getValue();
				if ( Array.isArray( value ) ) {
					return value;
				}
				ret.push( value );
			}
			return ret;
		}
		return Properties[ property ];
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

		if ( typeof value === 'string' ) {
			value = value.trim() !== '';
		}

		return value === false;
	}

	function getInputWidget( inputName, property, index, value, config ) {
		if ( Array.isArray( value ) ) {
			for ( var i in value ) {
				if ( value[ i ].trim() === '' ) {
					delete value[ i ];
				}
			}
		}

		switch ( inputName ) {
			case 'OO.ui.ToggleSwitchWidget':
				// @TODO this doesn't seem correct
				value = value === '1';
				break;
		}

		var config = $.extend(
			{
				// workaround for this issue https://www.php.net/manual/en/language.variables.external.php
				// otherwise we don't kwnow when to remove underscores ...
				name:
					'semantic-properties-input-' +
					encodeURIComponent( property ) +
					'-' +
					index,
				value: value
			},
			config || {}
		);

		if ( ManageProperties.isMultiselect( inputName ) ) {
			config.selected = value;
			config.allowArbitrary = true;
		}

		// see here https://www.semantic-mediawiki.org/wiki/Help:Special_property_Allows_value
		// SemanticMediaWiki/src/DataValues/Va lueValidator/AllowsListConstraintValueValidator.php
		if ( inArray( inputName, ManageProperties.optionsInputs ) ) {
			if (
				PagePropertiesFunctions.getNestedProp( [ 'options', 'length' ], config )
			) {
				config.options = ManageProperties.createInputOptions( config.options, {
					key: 'value'
				} );
			} else if ( '_PVAL' in SemanticProperties[ property ].properties ) {
				config.options = ManageProperties.createInputOptions(
					// eslint-disable-next-line no-underscore-dangle
					SemanticProperties[ property ].properties._PVAL,
					{
						key: 'value'
					}
				);
			} else {
				config.options = [];
				config.allowArbitrary = true;
			}
		}

		return ManageProperties.inputInstanceFromName( inputName, config );
	}

	function getSemanticForms() {
		return SemanticForms;
	}

	function isNewForm( form ) {
		return !inArray( form, RecordedForms );
	}

	function getPageCategories() {
		return PageCategories;
	}

	function getPreferredInput( form, property ) {
		var propertyObj = SemanticProperties[ property ];

		if ( form && 'preferred-input' in Forms[ form ].fields[ property ] ) {
			return Forms[ form ].fields[ property ][ 'preferred-input' ];
		}

		if ( '__pageproperties_preferred_input' in propertyObj.properties ) {
			return ManageProperties.inputNameFromLabel(
				// eslint-disable-next-line no-underscore-dangle
				propertyObj.properties.__pageproperties_preferred_input[ 0 ]
			);
		}

		return ManageProperties.inputNameFromLabel(
			ManageProperties.getAvailableInputs( propertyObj.type )[ 0 ]
		);
	}

	function getModel( formEl ) {
		var ret = {};
		var formattedNamespaces = mw.config.get( 'wgFormattedNamespaces' );
		var propertiesInForms = getPropertiesInForms();

		for ( var property in Model ) {
			if ( !formEl && property.indexOf( '__' ) === 0 ) {
				continue;
			}
			// ignore deleted properties
			// @TODO this shouldn't be anymore necessary
			if (
				property.indexOf( '__' ) !== 0 &&
				!inArray( property, propertiesInForms ) &&
				!( property in Properties )
			) {
				continue;
			}
			ret[ property ] = [];
			for ( var i in Model[ property ] ) {
				// empty string on error
				var value =
					'getValue' in Model[ property ][ i ] ? Model[ property ][ i ].getValue() : '';

				if ( Array.isArray( value ) ) {
					ret[ property ] = value;
				} else {
					ret[ property ].push( value );
				}

				// replace multi values inputs with single inputs
				// for each value
				if ( formEl ) {
					// OoUiTagMultiselectWidget => OO.ui.TagMultiselectWidget
					// MwWidgetsUsersMultiselectWidget => mw.widgets.UsersMultiselectWidget

					var inputName = ( 'constructorName' in Model[ property ][ i ] ? Model[ property ][ i ].constructorName :
						Model[ property ][ i ].constructor.name )
						.replace( /^OoUi/, 'OO.ui.' )
						.replace( /^MwWidgets/, 'mw.widgets.' );

					// @TODO handle prefix server-side ?
					let prefix = '';

					// add namespace prefix for page type
					// based on the input type
					if (
						property in SemanticProperties &&
						SemanticProperties[ property ].type === '_wpg'
					) {
						let namespace = null;
						switch ( inputName ) {
							// case 'OO.ui.SelectFileWidget':
							// namespace = 6;
							// break;
							case 'OO.ui.TextInputWidget':
								// @TODO, do it server-side
								if ( '__filekey-' + property in Model ) {
									// 'File:';
									namespace = 6;
								}
								break;
							case 'mw.widgets.UserInputWidget':
							case 'mw.widgets.UsersMultiselectWidget':
								// User:
								namespace = 2;
								break;
						}

						if ( namespace ) {
							prefix = formattedNamespaces[ namespace ] + ':';
						}
					}

					switch ( inputName ) {
						case 'OO.ui.SelectFileInputWidget':
						case 'OO.ui.SelectFileWidget':
							continue;
					}

					if ( typeof value === 'boolean' ) {
						value = value ? 1 : 0;
					}

					var inputValue = value;

					if ( prefix ) {
						$( '<input>' )
							.attr( {
								type: 'hidden',

								name:
									'semantic-properties-input-' +
									'__prefix-' +
									encodeURIComponent( property ) +
									'-' +
									i,
								value: prefix
							} )
							.appendTo( formEl );
					}

					var inputVal = Array.isArray( inputValue ) ? inputValue[ 0 ] : inputValue;

					// @TODO, replace '-input-' with the value of special fields (like 'freetext')
					var inputNameAttr =
						'semantic-properties-input-' + encodeURIComponent( property ) + '-';

					// *** keep $(formEl).find otherwise it will lead
					// to false positives for hidden inputs
					var inputEl = $( formEl ).find( ":input[name='" + ( inputNameAttr + i ) + "']" );

					if ( !inputEl.get( 0 ) ) {
						$( '<input>' )
							.attr( {
								type: 'hidden',
								name: inputNameAttr + i,
								value: inputVal
							} )
							.appendTo( formEl );

						// override the value of the existing input
						// } else if ( prefix || isMultiselect( inputName ) ) {
					} else {
						inputEl.val( inputVal );
					}

					// create inputs for all other values
					if (
						ManageProperties.isMultiselect( inputName ) &&
						inputValue.length > 1
					) {
						for ( var ii = 1; ii < inputValue.length; ii++ ) {
							$( '<input>' )
								.attr( {
									type: 'hidden',
									name: inputNameAttr + ii,
									value: inputValue[ ii ]
								} )
								.appendTo( formEl );
						}
					}
				}
			}
		}

		return ret;
	}

	function getPropertiesInForms() {
		var ret = [];

		for ( var form of SemanticForms ) {
			for ( var i in Forms[ form ].fields ) {
				if (
					Config.targetPage &&
					isTrue( Forms[ form ].fields[ i ][ 'on-create-only' ] )
				) {
					continue;
				}

				ret.push( i );
			}
		}
		return ret;
	}

	// eslint-disable-next-line no-unused-vars
	function getSingleProperties() {
		var ret = [];
		var propertiesInForms = getPropertiesInForms();
		for ( var i in Properties ) {
			if ( inArray( i, propertiesInForms ) ) {
				continue;
			}
			ret.push( i );
		}
		return ret;
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

	ListWidget.prototype.onItemDelete = function ( itemWidget, isFile ) {
		if ( itemWidget.parentWidget ) {
			if (
				!inputIsEmpty(
					Model[ itemWidget.parentWidget.config.property ][ itemWidget.index ]
				) &&
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
				delete Model[ itemWidget.parentWidget.config.property ][ itemWidget.index ];

				if ( isFile ) {
					if ( itemWidget.parentWidget.required ) {
						itemWidget.parentWidget.fileInputWidget.setRequired( true );
					}
				}

			} else {
				Model[ itemWidget.parentWidget.config.property ][ itemWidget.index ].setValue( '' );
			}

			if ( length === 0 ) {
				itemWidget.parentWidget.onDeleteButtonClick();
			}
			return;
		}

		// currently unused (deletion of single properties through delete icon)
		// if (
		// 	(itemWidget.optionsList && !itemWidget.optionsList.getItems().length) ||
		// 	// eslint-disable-next-line no-alert
		// 	confirm(mw.msg("pageproperties-jsmodule-pageproperties-delete-confirm"))
		// ) {
		// 	this.removeItems([itemWidget]);
		// 	delete Model[itemWidget.property];
		// 	delete Properties[itemWidget.property];
		// 	PanelProperties.messageWidget.toggle(
		// 		!PanelProperties.optionsList.getItems().length
		// 	);
		// }
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

		var deleteButton = new OO.ui.ButtonWidget( {
			icon: 'close'
			// flags: ["destructive"],
		} );

		var required = true;

		// initialize this here to be used by getInputWidget
		// @TODO replace File: server-side and simplify here
		Model[ '__filekey-' + property ][ config.index ] = {
			getValue: function () {
				return '';
			}
		};

		// *** or set fileInputWidget before creating
		// InnerItemWidgetFile
		if ( 'fileInputWidget' in this.parentWidget ) {
			this.parentWidget.fileInputWidget.setRequired( false );
		}

		var inputWidget = getInputWidget(
			// 'OO.ui.TextInputWidget'
			config.inputName,
			property,
			config.index,
			config.value,
			// @TODO, enable after adding the logic
			// for file move server-side on filename edit
			// , disabled: true
			{ required: required }
		);

		Model[ property ][ config.index ] = inputWidget;

		var filePreview = new OO.ui.Widget( {
			classes: [ 'mw-upload-bookletLayout-filePreview' ]
		} );
		var progressBarWidget = new OO.ui.ProgressBarWidget( {
			progress: 0
		} );

		// var hiddenInputWidget = new OO.ui.HiddenInputWidget( { name: hiddenInputName } );

		/*
'semantic-properties-input-' + '__title' + '-' + '0',

		var hiddenInputName = 'semantic-properties-input-' + '__files' +
				encodeURIComponent( config.property ) +
				'-' +
				config.index;

		var hiddenInputWidget = new OO.ui.HiddenInputWidget( { name: hiddenInputName } );
*/
		this.progressBarWidget = progressBarWidget;
		this.textInputWidget = inputWidget;
		// this.hiddenInputWidget = hiddenInputWidget;

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

			// @TODO, use instead the form/expression 'semantic-properties-freetext-',
			// 'semantic-properties-filekey-', etc.
			Model[ '__filekey-' + self.property ][ self.index ] = {
				getValue: function () {
					return res.upload.filekey;
				}
			};
		};

		this.errorMessage = function ( errorMessage ) {
			self.textInputWidget.toggle( false );
			self.progressBarWidget.toggle( false );

			self.messageWidget.$element.append( errorMessage.getMessage() );
			self.messageWidget.toggle( true );
		};

		// eslint-disable-next-line no-unused-vars
		this.fail = function ( res ) {};

		var widget = new OO.ui.ActionFieldLayout( filePreview, deleteButton, {
			label: '',
			align: 'top',
			// This can produce:
			// * inputName-mw.widgets.DateInputWidget
			// * inputName-mw.widgets...
			classes: [ 'inputName-' + config.inputName ]
		} );

		this.$element.append( widget.$element );

		deleteButton.connect( this, {
			click: 'onDeleteButtonClick'
		} );
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
		var form = this.parentWidget.config.form;

		OO.ui.mixin.GroupWidget.call(
			this,
			$.extend(
				{
					$group: this.$element
				},
				config
			)
		);

		var deleteButton = new OO.ui.ButtonWidget( {
			icon: 'close'
			// flags: ["destructive"],
		} );

		var formField =
			form in Forms ? Forms[ form ].fields[ property ] : null;

		var required =
			formField && 'required' in formField && isTrue( formField.required );

		if ( formField && 'default' in formField && config.value === '' &&
			( Config.isNewPage || required || isNewForm( form ) ) ) {
			config.value = formField[ 'default-result' ];
		}

		var inputOptions = { required: required };

		if ( formField && 'options-values-result' in formField ) {
			inputOptions.options = formField[ 'options-values-result' ];
		}

		var inputWidget = getInputWidget(
			config.inputName,
			property,
			config.index,
			config.value,
			inputOptions
		);

		// mock-up native validation, see the following:
		// https://stackoverflow.com/questions/8287779/how-to-use-the-required-attribute-with-a-radio-input-field
		// https://stackoverflow.com/questions/6218494/using-the-html5-required-attribute-for-a-group-of-checkboxes

		if ( config.index === 0 && inputWidget.requiresValidation ) {

			// eslint-disable-next-line  no-underscore-dangle
			var name_ =
				'semantic-properties-input-' +
				encodeURIComponent( property ) +
				'-' +
				config.index +
				'-validation';

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
					var value_ = ( 'getValue' in widget_ ? widget_.getValue() : 'data' in widget_ ? widget_.data : '' );

					if ( value_.trim() !== '' ) {
						return true;
					}
				}
			};

			inputWidget.on( 'change', function ( value ) {
				handleInputValidation( valueIsNonEmpty( value ) );
			} );
		}

		Model[ property ][ config.index ] = inputWidget;

		var helpMessage = '';
		if ( config.last ) {
			if ( formField && 'help-message' in formField ) {
				if ( formField[ 'help-message-result' ] ) {
					helpMessage = formField[ 'help-message-result' ];
				} else {
					helpMessage = formField[ 'help-message' ];

					if ( Array.isArray( helpMessage ) ) {
						helpMessage = helpMessage[ 0 ];
					}
				}
			} else if ( SemanticProperties[ property ].description ) {
				helpMessage = SemanticProperties[ property ].description;
			}
		}

		var widget = config.multiple ?
			new OO.ui.ActionFieldLayout( inputWidget, deleteButton, {
				label: '',
				align: 'top',
				help: new OO.ui.HtmlSnippet( helpMessage ),
				helpInline: true,
				// This can produce:
				// * inputName-mw.widgets.DateInputWidget
				// * inputName-mw.widgets...
				classes: [ 'inputName-' + config.inputName ]
			} ) :
			new OO.ui.FieldLayout( inputWidget, {
				label: '',
				align: 'top',
				help: new OO.ui.HtmlSnippet( helpMessage ),
				helpInline: true,
				// This can produce:
				// * inputName-mw.widgets.DateInputWidget
				// * inputName-mw.widgets...
				classes: [ 'inputName-' + config.inputName ]
			} );

		this.$element.append( widget.$element );

		deleteButton.connect( this, {
			click: 'onDeleteButtonClick'
		} );
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

		var propertyObj = SemanticProperties[ config.property ];

		var inputName = getPreferredInput(
			'form' in config ? config.form : null,
			config.property
		);

		var formField =
			'form' in config ? Forms[ config.form ].fields[ config.property ] : null;

		var multiple = false;

		if ( formField && 'multiple' in formField && formField.multiple !== '' ) {
			multiple = formField.multiple;
		} else if (
			!ManageProperties.disableMultipleFields( propertyObj.type, inputName ) &&
			'__pageproperties_allows_multiple_values' in propertyObj.properties &&
			// eslint-disable-next-line no-underscore-dangle
			propertyObj.properties.__pageproperties_allows_multiple_values
		) {
			multiple = true;
		}

		var optionsList = new ListWidget();
		this.optionsList = optionsList;

		if (
			!( config.property in Properties ) ||
			!Properties[ config.property ].length
		) {
			Properties[ config.property ] = !ManageProperties.isMultiselect( inputName ) ?
				[ '' ] :
				[];
		}

		var values = getPropertyValue( config.property );

		// remove namespace prefix for page type
		// based on the input type
		if ( propertyObj.type === '_wpg' ) {
			var formattedNamespaces = mw.config.get( 'wgFormattedNamespaces' );
			for ( var i in values ) {
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
					var re = new RegExp( '^' + formattedNamespaces[ namespace ] + ':' );
					values[ i ] = values[ i ].replace( re, '' );
				}
			}
		}

		Model[ config.property ] = {};

		if ( inputName === 'OO.ui.SelectFileWidget' ) {
			Model[ '__filekey-' + config.property ] = {};

			values = values.filter( ( x ) => x !== '' );
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
		} else if ( !ManageProperties.isMultiselect( inputName ) ) {
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

		// uncomment to allow "inline" edit of semantic properties
		// this is not the most appropriate in conjunction with forms
		// since forms can in turn override attributes of semantic properties
		// if (CanManageSemanticProperties) {
		// 	var editButton = new OO.ui.ButtonWidget( {
		// 		icon: 'settings',
		// 		flags: [ 'progressive' ]
		// 	} );
		//
		// 	editButton.on( 'click', function () {
		// 		ManageProperties.openDialog( config.property );
		// 	} );
		//
		// 	var items = [
		// 		// eslint-disable-next-line mediawiki/class-doc
		// 		new OO.ui.ActionFieldLayout( optionsList, editButton, {
		// 			label: config.property,
		// 			align: 'top',
		//
		// 			// The following classes are used here:
		// 			// * inputName-mw.widgets.DateInputWidget
		// 			classes: [ 'inputName-' + inputName ]
		// 		} )
		// 	];
		// } else {

		var label = config.property;
		if ( formField && 'label' in formField ) {
			if ( formField[ 'label-result' ] ) {
				label = formField[ 'label-result' ];
			} else {
				label = formField.label;

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
					align: 'top',

					// The following classes are used here:
					// * inputName-mw.widgets.DateInputWidget
					// * inputName-mw.widgets. ...
					classes: [ 'inputName-' + inputName ]
				} )
			);
		}
		// }

		if ( inputName === 'OO.ui.SelectFileWidget' ) {
			var required =
				formField && 'required' in formField && isTrue( formField.required );

			self.required = required;

			var inputWidget = getInputWidget(
				inputName,
				config.property + '-SelectFileWidget',
				0,
				'',

				// only requires if there aren't files arealdy
				// loaded, then toggle require attribute on the
				// input widget if they are removed
				//
				{ required: required && optionsList.items.length === 0, multiple: multiple }
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
					value: file.name,
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

			items.push( inputWidget );
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
						value: '',
						parentWidget: self,
						index: optionsList.items.length,
						multiple: multiple,
						last: true
					} )
				] );
			} );

			items.push( addOption );
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
		var isSelected;
		var values;
		function getItems( value ) {
			switch ( self.data.toolName ) {
				case 'addremoveproperties':
					values = Object.keys( SemanticProperties );
					values = values.filter( ( x ) => !inArray( x, getPropertiesInForms() ) );
					isSelected = function ( value_ ) {
						return value_ in Properties;
					};
					break;
				case 'addremoveforms':
					values = Object.keys( Forms );
					isSelected = function ( value_ ) {
						return inArray( value_, SemanticForms );
					};
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
					selected: isSelected( x )
				} );

				if ( self.data.toolName === 'addremoveproperties' ) {
					menuOptionWidget.$element.append(
						$(
							'<span class="oo-ui-labelElement-label right">' +
								SemanticProperties[ x ].typeLabel +
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
		var self = this;

		// searchWidget.getResults() is a SelectWidget
		// https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.SelectWidget

		this.selectWidget = searchWidget.getResults();

		this.selectWidget.multiselect = true;
		/*
		this.selectWidget.on("press", function (widget) {
			if (!widget) {
				return;
			}
		});
*/
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
			var values = items.map( ( x ) => x.data );

			switch ( this.data.toolName ) {
				case 'addremoveproperties':
					// remove unselected properties
					for ( var i in Properties ) {
						if ( !inArray( i, values ) ) {
							delete Properties[ i ];
						}
					}

					// add new properties
					for ( var label of values ) {
						if ( !( label in Properties ) ) {
							Properties[ label ] = [ '' ];
						}
					}

					// PropertiesPanel.populateFieldset();
					break;
				case 'addremoveforms':
					var propertiesInForms = getPropertiesInForms();
					for ( var property of propertiesInForms ) {
						if ( !inArray( property, values ) ) {
							delete Properties[ property ];
						}
					}

					SemanticForms = values;
					break;
			}

			updatePanels();
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

	function openSearchDialog( toolName ) {
		processDialogSearch = new ProcessDialogSearch( {
			size: 'medium',
			classes: [ 'pageproperties-import-dialog' ],
			data: { toolName: toolName }
		} );

		WindowManagerSearch.addWindows( [ processDialogSearch ] );

		// see https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs
		WindowManagerSearch.openWindow( processDialogSearch, {
			title: mw.msg(
				// The following messages are used here:
				// * pageproperties-jsmodule-forms-dialogsearch-selectforms
				// * pageproperties-jsmodule-forms-dialogsearch-selectproperties
				'pageproperties-jsmodule-forms-dialogsearch-select' +
					( toolName === 'addremoveforms' ? 'forms' : 'properties' )
			)
		} );
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

			ManageProperties.loadData( dataToLoad ).then( ( res ) => {
				if ( 'semanticProperties' in res ) {
					SemanticProperties = res.semanticProperties;
				}
				if ( 'forms' in res ) {
					Forms = res.forms;
				}
				this.setDisabled( false );
				this.popPending();
				onSelect( this );

			} ).catch( ( error ) => {
				// eslint-disable-next-line no-console
				console.log( 'loadData error', error );
				this.popPending();
				this.setDisabled( false );
				this.setActive( false );

				PagePropertiesFunctions.OOUIAlert(
					WindowManagerAlert,
					new OO.ui.HtmlSnippet( error ),
					{ size: 'medium' }
				);
			} );
		};

		var toolGroup = [];

		if ( Config.context !== 'parserfunction' &&
			( Config.canManageSemanticProperties || Config.canComposeForms ) ) {
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
			( Config.canManageSemanticProperties || Config.canAddSingleProperties ) ) {
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
			// @TODO use a "cheapest" way
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

			ManageProperties.loadData( dataToLoad ).then( ( res ) => {
				// this.setDisabled(false);
				// this.popPending();
				ActionWidget.popPending();
				$( ToolbarA.$bar ).find( '.wrapper' ).css( 'pointer-events', 'auto' );

				if ( 'semanticProperties' in res ) {
					SemanticProperties = res.semanticProperties;
				}
				if ( 'forms' in res ) {
					Forms = res.forms;
				}

				ManageProperties.initialize(
					Self,
					SemanticProperties,
					res.importedVocabularies,
					res.typeLabels,
					res.propertyLabels
				);

				PagePropertiesCategories.initialize( res.categories );

				PagePropertiesForms.initialize( Self, SemanticProperties, Forms );

				onSelect( this );
			} ).catch( ( error ) => {
				// eslint-disable-next-line no-console
				console.log( 'loadData error', error );
				ActionWidget.popPending();
				$( ToolbarA.$bar ).find( '.wrapper' ).css( 'pointer-events', 'auto' );
				this.setActive( false );

				PagePropertiesFunctions.OOUIAlert(
					WindowManagerAlert,
					new OO.ui.HtmlSnippet( error ),
					{ size: 'medium' }
				);
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

		this.$element.append(
			'<h3 style="margin-top:0;padding-top:0"><b>' +
				config.data.label +
				'</b></h3>'
		);
		this.$element.append( this.fieldset.$element );
		// this.$element.append(this.messageWidget.$element);
	}

	OO.inheritClass( PanelLayout, OO.ui.PanelLayout );
	PanelLayout.prototype.populateFieldset = function () {
		this.fieldset.clearItems();
		var data = this.data;

		var items = [];
		if ( 'properties' in data && data.properties === true ) {
			var propertiesInForms = getPropertiesInForms();
			Properties = PagePropertiesFunctions.sortObjectByKeys( Properties );

			for ( var i in Properties ) {
				if ( inArray( i, propertiesInForms ) ) {
					continue;
				}

				// property renamed or deleted
				if ( !( i in SemanticProperties ) ) {
					continue;
				}

				items.push(
					new ItemWidget( {
						classes: [ 'ItemWidget' ],
						property: i
					} )
				);
			}
		} else if ( 'form' in data ) {
			var formName = data.form;
			var form = Forms[ formName ];

			for ( var i in form.fields ) {
				if ( Config.targetPage && isTrue( form.fields[ i ][ 'on-create-only' ] ) ) {
					continue;
				}

				// property renamed or deleted
				if ( !( i in SemanticProperties ) ) {
					continue;
				}

				items.push(
					new ItemWidget( {
						classes: [ 'ItemWidget' ],
						property: i,
						form: formName
					} )
				);
			}
		} else if ( 'pagenameFormula' in data ) {
			var userDefinedInput;
			var userDefinedField;
			if ( data.userDefined ) {
				var inputName = 'mw.widgets.TitleInputWidget';
				userDefinedInput = new mw.widgets.TitleInputWidget( {
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__title' + '-' + '0',
					required: true
				} );

				// eslint-disable-next-line no-underscore-dangle
				Model.__title = { 0: userDefinedInput };

				userDefinedField = new OO.ui.FieldLayout( userDefinedInput, {
					label: mw.msg( 'pageproperties-jsmodule-forms-pagename' ),
					align: 'top',

					// help: new OO.ui.HtmlSnippet("&nbsp;"),
					// helpInline: true,
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

				for ( var i in data.pagenameFormula ) {
					options.push( {
						data: data.pagenameFormula[ i ],
						label: mw.msg( 'pageproperties-jsmodule-pageproperties-pagenameformulaof', i )
					} );
				}

				var selectPagenameInput = new OO.ui.RadioSelectInputWidget( {
					options: options,
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__pagename-formula' + '-' + '0'
				} );

				Model[ '__pagename-formula' ] = { 0: selectPagenameInput };

				selectPagenameInput.on( 'change', function ( value ) {
					userDefinedField.toggle( value === '' );
					userDefinedInput.setRequired( value === '' );
				} );

				items.push(
					new OO.ui.FieldLayout( selectPagenameInput, {
						label: mw.msg( 'pageproperties-jsmodule-forms-pagename' ),
						align: 'top',
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
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__freetext' + '-' + '0',
					autosize: true,
					rows: 6,
					// eslint-disable-next-line no-underscore-dangle
					value: Model.__freetext ?
						// eslint-disable-next-line no-underscore-dangle
						Model.__freetext[ 0 ].getValue() :
						PageContent
				} );

				// eslint-disable-next-line no-underscore-dangle
				Model.__freetext = { 0: inputWidget };

				items.push(
					new OO.ui.FieldLayout( inputWidget, {
						label: mw.msg( 'pageproperties-jsmodule-formedit-freetext' ),
						align: 'top',

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
						// eslint-disable-next-line no-useless-concat
						name: 'semantic-properties-input-' + '__pagecategories' + '-' + '0'
						// value: categories,
					} );

					// eslint-disable-next-line no-underscore-dangle
					Model.__pagecategories = { 0: categoriesInput };

					// ***prevents error "Cannot read properties of undefined (reading 'apiUrl')"
					for ( var category of categories ) {
						categoriesInput.addTag( category );
					}
					items.push(
						new OO.ui.FieldLayout( categoriesInput, {
							label: mw.msg( 'pageproperties-jsmodule-forms-categories' ),
							align: 'top',
							classes: [ 'ItemWidget' ]
						} )
					);
				} else {
					// eslint-disable-next-line no-underscore-dangle
					Model.__pagecategories = {
						0: {
							getValue: function () {
								return categories;
							}
						}
					};
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
						// eslint-disable-next-line no-useless-concat
						name: 'semantic-properties-input-' + '__content-model' + '-' + '0'
					} );

					Model[ '__content-model' ] = { 0: selectContentModelsInput };

					items.push(
						new OO.ui.FieldLayout( selectContentModelsInput, {
							label: mw.msg( 'pageproperties-jsmodule-forms-contentmodels' ),
							align: 'top',
							classes: [ 'ItemWidget' ]
						} )
					);

					// @TODO do the same for '__pagename-formula' and remove
					// the block on submit
				} else {
					// eslint-disable-next-line no-shadow
					var Input = function Input() {
						this.getValue = function () {
							// eslint-disable-next-line no-shadow
							var contentModel = data.contentModels[ 0 ];
							return Config.contentModels[ contentModel ];
						};
					};
					Model[ '__content-model' ] = { 0: new Input() };
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
		if ( !( property in Properties ) ) {
			Properties[ property ] = [ '' ];
		}

		this.populateFieldset();
	};

	function updateData( data ) {
		Properties = getModel();

		switch ( data[ 'result-action' ] ) {
			case 'update':
				break;
			case 'delete':
				for ( var property of data[ 'deleted-properties' ] ) {
					// delete Model[property];
					delete Properties[ property ];
				}
				for ( var form in Forms ) {
					for ( var property of data[ 'deleted-properties' ] ) {
						delete Forms[ form ].fields[ property ];
					}
				}
				break;

			case 'create':
				for ( var property in data[ 'semantic-properties' ] ) {
					Properties[ property ] = [ '' ];
				}
				break;

			case 'rename':
				if ( data[ 'previous-label' ] in Properties ) {
					PagePropertiesFunctions.renameObjectKey(
						Properties,
						data[ 'previous-label' ],
						data.label
					);
				}
				for ( var form in Forms ) {
					PagePropertiesFunctions.renameObjectKey(
						Forms[ form ].fields,
						data[ 'previous-label' ],
						data.label
					);
				}
				break;
		}

		if ( Config.context !== 'ManageProperties' ) {
			// initialize();
			updatePanels();
			// PagePropertiesCategories.initialize();
			// PagePropertiesForms.initialize();
		}
		return true;
	}

	function updateSemanticProperties( semanticProperties ) {
		SemanticProperties = semanticProperties;
	}

	function getPropertiesPanels() {
		var panels = [];

		// create panels for forms
		var pagenameFormula = {};
		var userDefined = false;
		var freeText = false;
		var formProperties = [];
		var formCategories = [];
		var formContentModels = [];
		var showCategoriesInput = !SemanticForms.length;
		for ( var form of SemanticForms ) {
			if ( isTrue( Forms[ form ][ 'show-categories-input' ] ) ) {
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

			for ( var i in Forms[ form ].fields ) {
				// *** on-create-only field don't get recorded when creating the form
				// so exclude them from the form to let them be added as single property
				if (
					Config.targetPage &&
					isTrue( Forms[ form ].fields[ i ][ 'on-create-only' ] )
				) {
					continue;
				}
				formProperties.push( i );
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

			panels.push(
				new PanelLayout( {
					expanded: false,
					padded: true,
					framed: false,
					classes: [ 'PanelProperties-panel-section' ],
					data: {
						label: form, // mw.msg
						form: form
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
		if (
			Object.keys( Properties ).filter( ( x ) => !inArray( x, formProperties ) ).length
		) {
			panels.push(
				new PanelLayout( {
					padded: true,
					framed: false,
					classes: [ 'PanelProperties-panel-section' ],
					data: {
						label: mw.msg( 'pageproperties-jsmodule-formedit-properties' ),
						expanded: false,
						properties: true
					}
				} )
			);
		}

		formCategories = formCategories
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
			formCategories
		) {
			panels.push(
				new PanelLayout( {
					expanded: false,
					padded: true,
					framed: false,
					classes: [ 'PanelProperties-panel-section' ],
					data: {
						label: mw.msg( 'pageproperties-jsmodule-formedit-wiki' ),
						pagenameFormula: pagenameFormula,
						contentModels: formContentModels,
						userDefined: userDefined,
						freeText: freeText,
						categories: formCategories,
						showCategoriesInput: showCategoriesInput
					}
				} )
			);
		}

		return panels.filter( ( x ) => !x.isEmpty );
	}

	function updatePanels() {
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
		updatePanels();
	}

	function onSubmit() {
		$( 'input.radio_for_required_checkboxes[name$=-validation]' ).remove();
		var formEl = $( this ).closest( '.pagepropertiesform' );

		var obj = getModel( formEl );
		var semanticForms = getSemanticForms();

		var formName = null;
		for ( var i in semanticForms ) {
			$( '<input>' )
				.attr( {
					type: 'hidden',
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__semanticforms' + '-' + i,
					value: semanticForms[ i ]
				} )
				.appendTo( formEl );
			formName = semanticForms[ i ];
		}

		// eslint-disable-next-line no-underscore-dangle
		if ( !Config.targetPage && !obj.__title && !obj[ '__pagename-formula' ] ) {
			$( '<input>' )
				.attr( {
					type: 'hidden',
					// eslint-disable-next-line no-useless-concat
					name: 'semantic-properties-input-' + '__pagename-formula' + '-' + '0',

					// there should be only one form
					value: Forms[ formName ][ 'pagename-formula' ]
				} )
				.appendTo( formEl );
		}

		// return false;
	}

	function initialize( pageProperties ) {
		if ( arguments.length ) {
			Self = pageProperties;
		}

		Model = {};
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
			action: Config.actionUrl + ( Config.actionUrl.indexOf( '?' ) === -1 ? '?' : '&' ) +
					Object.keys( queryObj ).map( ( key ) => {
						return `${key}=${encodeURIComponent( queryObj[ key ] )}`;
					} ).join( '&' ),
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
			ActionToolbarA = createActionToolbar(
				Config.context === 'EditSemantic'
			);
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
		updateForms,
		updateSemanticProperties
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

	var properties = JSON.parse( mw.config.get( 'pageproperties-properties' ) );
	// console.log("properties", properties);

	var sessionData = JSON.parse( mw.config.get( 'pageproperties-sessionData' ) );
	// console.log("sessionData", sessionData);

	var config = JSON.parse( mw.config.get( 'pageproperties-config' ) );
	// console.log("config", config);

	// the order is important !! ( first is behind)
	var windowManagerCommon = PagePropertiesFunctions.createWindowManager();
	var windowManagerSearch = PagePropertiesFunctions.createWindowManager();
	var windowManagerManageProperties =
		PagePropertiesFunctions.createWindowManager();
	var windowManagerAlert = PagePropertiesFunctions.createWindowManager();

	ManageProperties.preInitialize( config, windowManagerManageProperties, windowManagerAlert );

	if (
		config.context === 'ManageProperties' ||
		config.context === 'EditSemantic'
	) {
		PagePropertiesCategories.preInitialize(
			windowManagerCommon,
			windowManagerAlert
		);

		PagePropertiesForms.preInitialize(
			config,
			windowManagerCommon,
			windowManagerSearch,
			windowManagerAlert
		);
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
				semanticProperties,
				properties,
				forms,
				semanticForms,
				pageContent,
				pageCategories,
				windowManagerSearch,
				windowManagerAlert,
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
			semanticProperties,
			null,
			null,
			null
		);

		PagePropertiesCategories.initialize( categories );

		PagePropertiesForms.initialize( pageProperties, semanticProperties, forms );

		ImportProperties.initialize(
			config,
			semanticProperties,
			windowManagerCommon,
			windowManagerAlert
		);
	}

	// display every 3 days
	if (
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
