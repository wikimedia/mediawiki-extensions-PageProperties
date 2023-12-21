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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
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
/* eslint-disable no-unused-vars */
/* eslint-disable no-underscore-dangle */

const PageProperties = function ( Config, Form, FormID, Schemas, WindowManager ) {
	var Model;
	var ModelSchemas;
	var OuterStack;
	var PropertiesStack;
	var processDialogSearch;
	var DialogSearchName = 'dialogSearch';
	var ToolbarMain;
	var ActionToolbarMain;
	var ActionWidget;
	var Self;
	var SubmitButton;
	var ValidateButton;
	var GoBackButton;
	var DeleteButton;
	// shallow copy
	var RecordedSchemas = Form.data.schemas.slice();
	var Fields = {};
	var SchemasLayout;
	var DialogName = 'dialogForm';
	var StoredProperties;
	var ModelFlatten;
	var SelectedSchema;

	function inArray( val, arr ) {
		return arr.indexOf( val ) !== -1;
	}

	function escapeJsonPtr( str ) {
		return str.replace( /~/g, '~0' ).replace( /\//g, '~1' );
	}

	function getInputWidget( config ) {
		var field = config.model.schema.wiki;

		if ( !( 'input-config' in field ) ) {
			field[ 'input-config' ] = {};
		}
		var required = 'required' in field && field.required;

		// create shallow copy, otherwise changes are
		// copied to Forms[ form ].properties[ property ][ 'input-config' ]
		var inputConfig = $.extend(
			{}, // *** important !! cast to object
			JSON.parse( JSON.stringify( field[ 'input-config' ] ) ),
			{ value: config.data, required: required }
		);

		if ( 'options-values-parsed' in field ) {
			inputConfig.options = field[ 'options-values-parsed' ];
		}

		var inputName =
			!( 'visibility' in field ) || field.visibility !== 'hidden' ?
				PagePropertiesFunctions.inputNameFromLabel(
					PagePropertiesFunctions.getPreferredInput( config.model.schema )
				) :
				'OO.ui.HiddenInputWidget';

		// FIXME with HiddenInputWidget, value is null (as string)
		config.model.inputName = inputName;

		if ( !( 'name' in config ) || config.name.trim() === '' ) {
			inputConfig.name = `${ FormID }-${ config.model.path }`;
		}

		if ( Array.isArray( inputConfig.value ) ) {
			for ( var i in inputConfig.value ) {
				if ( inputConfig.value[ i ].trim() === '' ) {
					delete inputConfig.value[ i ];
				}
			}
		}

		// @see https://www.semantic-mediawiki.org/wiki/Help:Special_property_Allows_value
		// SemanticMediaWiki/src/DataValues/ValueValidator/AllowsListConstraintValueValidator.php
		if ( inArray( inputName, PagePropertiesFunctions.optionsInputs ) ) {
			if ( inputConfig.options && Object.keys( inputConfig.options ).length ) {
				inputConfig.options = PagePropertiesFunctions.createDropDownOptions(
					inputConfig.options
				);
			} else if ( isSMWProperty( field ) ) {
				inputConfig.options = [];
				var SMWProperty = getSMWProperty( field );
				if ( '_PVAL' in SMWProperty.properties ) {
					inputConfig.options = PagePropertiesFunctions.createDropDownOptions(

						SMWProperty.properties._PVAL,
						{
							key: 'value'
						}
					);
				} else {
					inputConfig.options = [];
				}
			} else {
				inputConfig.options = [];
			}
		}
		inputConfig.data = {
			path: config.model.path,
			schema: config.model.schema,
			performQuery: performQuery
		};
		return PagePropertiesFunctions.inputInstanceFromName(
			inputName,
			inputConfig
		);
	}

	function isSMWProperty( field ) {
		return (
			'SMW-property' in field &&
			field[ 'SMW-property' ] in PagePropertiesSMW.getSemanticProperties()
		);
	}

	function getSMWProperty( field ) {
		if ( 'SMW-property' in field ) {
			return PagePropertiesSMW.getSemanticProperty( field[ 'SMW-property' ] );
		}
		return null;
	}

	function isNewSchema( schemaName ) {
		return !inArray( schemaName, RecordedSchemas );
	}

	function getCategories() {
		return Form.data.categories;
	}

	function getFieldAlign( field ) {
		return 'layout-align' in Form.options ?
			Form.options[ 'layout-align' ] :
			'top';
	}

	function getHelpInline( field ) {
		return !( 'popup-help' in Form.options ? Form.options[ 'popup-help' ] : false );
	}

	function getModel( action, schemaName ) {
		var flatten = {};

		function castType( value, thisModel ) {
			// *** this is an hack to prevent
			// empty string, alternatively
			// use required native validation
			// or "minLength": 1

			if (
				thisModel.schema.wiki.required &&
				thisModel.schema.type === 'string' &&
				// value can be undefined for OO.ui.SelectFileWidget
				( !value || ( typeof value === 'string' && value.trim() === '' ) )
			) {
				return null;
			}

			return PagePropertiesFunctions.castType( value, thisModel.schema.type );
		}

		function formatValue( thisModel ) {
			var value = 'getValue' in thisModel.input ? thisModel.input.getValue() : '';
			if ( Array.isArray( value ) ) {
				value = value.map( ( x ) => castType( x, thisModel ) );
			} else {
				value = castType( value, thisModel );
			}

			flatten[ thisModel.path ] = {
				pathNoIndex: thisModel.pathNoIndex,
				value: value,
				multiselect: thisModel.multiselect,
				schema: thisModel.schema
			};

			if ( thisModel.isFile ) {
				flatten[ thisModel.path ].filekey = thisModel.filekey;
				// flatten[thisModel.path].previousFilaneme = thisModel.previousFilaneme;
			}

			return value;
		}

		function getValuesRec( thisModel ) {
			switch ( thisModel.schema.type ) {
				case 'array':
					var items = [];
					// @TODO handle tuple
					// multiselect
					if ( 'schema' in thisModel.items ) {
						items = formatValue( thisModel.items );
					} else {
						for ( var ii in thisModel.items ) {
							items.push( getValuesRec( thisModel.items[ ii ] ) );
						}
					}
					// set to null only required items
					for ( var ii in items ) {
						if (
							typeof items[ ii ] === 'string' &&
							items[ ii ].trim() === '' &&
							'minItems' in thisModel.schema &&
							ii <= thisModel.schema.minItems
						) {
							items[ ii ] = null;
						}
					}
					return items;
				// return items.filter(function (x) {
				// 	return (
				// 		PagePropertiesFunctions.isObject(x) || (x && x.trim() !== "")
				// 	);
				// 	});
				case 'object':
					var items = {};
					for ( var ii in thisModel.properties ) {
						items[ ii ] = getValuesRec( thisModel.properties[ ii ] );
					}
					return items;

				default:
					return formatValue( thisModel );
			}
		}

		function showError( thisSchemaName ) {
			var el = window.document.querySelector(
				`#PagePropertiesGroupWidgetPanel-${ FormID }-${ thisSchemaName }`.replace(
					/ /g,
					'_'
				)
			);

			if ( el ) {
				if ( 'setTabPanel' in SchemasLayout ) {
					SchemasLayout.setTabPanel( thisSchemaName );
				} else if ( 'setPage' in SchemasLayout ) {
					SchemasLayout.setPage( thisSchemaName );
				}

				setTimeout( function () {
					el.scrollIntoView( {
						behavior: 'smooth'
					} );
				}, 250 );
			}
		}

		function validate( thisSchemaName, data, schema ) {

			// eslint-disable-next-line new-cap
			const ajv = new window.ajv7( { strict: false } );

			var validateAjv;
			try {
				validateAjv = ajv.compile( schema );
			} catch ( e ) {
				// eslint-disable-next-line no-console
				console.error( 'validate', e );
				Fields[ thisSchemaName ].toggle( true );
				Fields[ thisSchemaName ].setType( 'error' );

				// @TODO
				// add: "please report the issue in the talk page
				// of the extension"
				Fields[ thisSchemaName ].setLabel( e.message );

				showError( thisSchemaName );
				return false;
			}

			if ( validateAjv( data ) ) {
				return true;
			}

			Fields[ thisSchemaName ].toggle( true );
			Fields[ thisSchemaName ].setType( 'error' );
			Fields[ thisSchemaName ].setLabel( 'there are errors' );

			for ( var error of validateAjv.errors ) {
				var path = `${ thisSchemaName }${ error.instancePath }`;

				if ( path in Fields ) {
					// eslint-disable-next-line no-console
					console.log( 'error', error );
					if ( Fields[ path ].constructor.name === 'OoUiMessageWidget' ) {
						Fields[ path ].setType( 'error' );
						Fields[ path ].setLabel( error.message );

						Fields[ path ].toggle( true );
					} else {
						Fields[ path ].setErrors( [ error.message ] );
					}
				}
			}

			showError( thisSchemaName );

			return false;
		}

		var ret = {};
		switch ( action ) {
			case 'validate':
				for ( var i in Fields ) {
					if ( Fields[ i ].constructor.name === 'OoUiMessageWidget' ) {
						Fields[ i ].toggle( false );
					} else {
						Fields[ i ].setErrors( [] );
					}
				}

				try {
					for ( var schemaName in ModelSchemas ) {
						ret[ schemaName ] = getValuesRec( ModelSchemas[ schemaName ] );
						// removeNulls(ret);

						if ( !validate( schemaName, ret[ schemaName ], Schemas[ schemaName ] ) ) {
							return false;
						}
					}
				} catch ( e ) {
					// eslint-disable-next-line no-console
					console.error( 'validate', e );
					return false;
				}
				return ret;

			case 'fetch':
				for ( var schemaName in ModelSchemas ) {
					ret[ schemaName ] = getValuesRec( ModelSchemas[ schemaName ] );
				}
				return ret;

			case 'submit':
				for ( var schemaName in ModelSchemas ) {
					ret[ schemaName ] = getValuesRec( ModelSchemas[ schemaName ] );
				}

				var model = {};
				for ( var i in Model ) {
					model[ i ] = Model[ i ].getValue();
				}

				return {
					data: ret,
					flatten: flatten,
					form: model,
					schemas: Object.keys( ModelSchemas ),
					// @FIXME or retrieve it server side
					options: Form.options
				};

			case 'validate&submit':
				if ( !getModel( 'validate' ) ) {
					return false;
				}
				return getModel( 'submit' );

			case 'delete':
				Form.options.action = 'delete';
				return {
					options: Form.options,
					schemas: RecordedSchemas // Object.keys(ModelSchemas),
				};

			case 'schema':
				if ( !( schemaName in ModelSchemas ) ) {
					return false;
				}

				var ret = getValuesRec( ModelSchemas[ schemaName ] );
				return {
					data: ret,
					flatten: flatten
				};
		}
	}

	function clearDependentFields( pathNoIndex ) {
		for ( var model of ModelFlatten ) {
			var field = model.schema.wiki;
			if ( !( 'options-askquery' in field ) ) {
				continue;
			}
			var askQuery = field[ 'options-askquery' ];
			var regExp = new RegExp( '<' + pathNoIndex + '>' );
			if ( regExp.test( askQuery ) ) {
				model.input.setValue( !model.multiselect ? '' : [] );
			}
		}
	}

	function performQuery( data, value ) {
		var field = data.schema.wiki;
		var askQuery = field[ 'options-askquery' ];
		let matches = [];
		// for ( const match of matches_ ) {
		// 	matches.push( match );
		// }

		var re = /<([^<>]+)>/g;
		while ( true ) {
			var match = re.exec( askQuery );
			if ( !match ) {
				break;
			}
			matches.push( match );
		}

		if ( matches.length ) {
			var res = getModel( 'schema', field.schema );
			if ( res ) {
				// @MUST MATCH classes/SubmitForm -> replaceFormula
				var parent = data.path.slice( 0, Math.max( 0, data.path.indexOf( '/' ) ) );
				for ( var match of matches ) {
					for ( var i in res.flatten ) {
						if ( match[ 1 ] === 'value' ) {
							askQuery = askQuery.replace(
								match[ 0 ],
								// value of lookupElement
								value
							);
							continue;
						}

						// match first names at the same level
						var fullPath = parent + '/' + match[ 1 ];

						if ( fullPath in res.flatten ) {
							askQuery = askQuery.replace(
								match[ 0 ],
								res.flatten[ fullPath ].value
							);
							continue;
						}

						// var fullPath = match[1];
						// if (fullPath.charAt(0) !== "/") {
						// 	fullPath = "/${fullPath}";
						// }

						if ( res.flatten[ i ].pathNoIndex === fullPath ) {
							askQuery = askQuery.replace( match[ 0 ], res.flatten[ i ].value );
						}
					}
				}
			}
		}

		var payload = {
			action: 'pageproperties-askquery',
			data: JSON.stringify( {
				query: askQuery,
				properties: field[ 'askquery-printouts' ],
				schema: field[ 'askquery-schema' ],
				'options-query-formula': field[ 'options-query-formula' ],
				'mapping-label-formula': field[ 'mapping-label-formula' ]
			} )
		};

		return new Promise( ( resolve, reject ) => {
			mw.loader.using( 'mediawiki.api', function () {
				new mw.Api()
					.postWithToken( 'csrf', payload )
					.done( function ( thisRes ) {
						if ( payload.action in thisRes ) {
							var thisData = thisRes[ payload.action ];
							thisData = JSON.parse( thisData.result );
							resolve( thisData );
						}
					} )
					.fail( function ( thisRes ) {
						// eslint-disable-next-line no-console
						console.error( 'res', thisRes );
						reject( thisRes );
					} );
			} );
		} );
	}

	var FileItemWidget = function ( config ) {
		config = config || {};
		FileItemWidget.super.call( this, config );

		var self = this;
		this.parentWidget = config.parentWidget;
		this.parentWidget.setFileKey( null );

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

		var inputConfig = {
			required: true,
			value: config.value
		};

		var inputWidget = PagePropertiesFunctions.inputInstanceFromName(
			'OO.ui.TextInputWidget',
			inputConfig
		);

		this.inputWidget = inputWidget;

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

		this.progress = function ( progress, estimatedRemainingTime ) {
			self.progressBarWidget.setProgress( progress * 100 );
		};

		this.uploadComplete = function ( file, res ) {
			self.progressBarWidget.toggle( false );
			self.textInputWidget.toggle( true );

			self.parentWidget.setFileKey( res.upload.filekey );
		};

		this.errorMessage = function ( errorMessage ) {
			self.textInputWidget.toggle( false );
			self.progressBarWidget.toggle( false );

			self.messageWidget.$element.append( errorMessage.getMessage() );
			self.messageWidget.toggle( true );
		};

		this.fail = function ( res ) {};

		var widget = new OO.ui.ActionFieldLayout( filePreview, deleteButton, {
			label: '',
			align: 'top'
			// classes: ["inputName-" + config.inputName],
		} );

		this.$element.append( widget.$element );

		deleteButton.connect( this, {
			click: 'onDeleteButtonClick'
		} );
	};

	OO.inheritClass( FileItemWidget, OO.ui.Widget );
	OO.mixinClass( FileItemWidget, OO.ui.mixin.GroupWidget );

	FileItemWidget.prototype.onDeleteButtonClick = function () {
		this.emit( 'delete', 'file' );

		this.parentWidget.clearFileClick( this );
	};

	var FileUploadGroupWidget = function ( config ) {
		// Configuration initialization
		config = config || {};

		// Parent constructor
		FileUploadGroupWidget.super.call( this, config );

		// Mixin constructors
		OO.ui.mixin.GroupElement.call(
			this,
			$.extend(
				{
					$group: this.$element
				},
				config
			)
		);

		this.addItems( config.items || [] );
	};

	OO.inheritClass( FileUploadGroupWidget, OO.ui.Widget );
	OO.mixinClass( FileUploadGroupWidget, OO.ui.mixin.GroupElement );

	var ItemWidget = function ( config ) {
		config = config || {};
		ItemWidget.super.call( this, config );

		var field = config.model.schema.wiki;

		var helpMessage = '';
		if ( 'help-message' in field ) {
			if ( field[ 'help-message-parsed' ] ) {
				helpMessage = field[ 'help-message-parsed' ];
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

		var label = '';
		if ( 'label' in field ) {
			if ( field[ 'label-parsed' ] ) {
				label = field[ 'label-parsed' ];
			} else {
				label = field.label;

				if ( Array.isArray( label ) ) {
					label = label[ 0 ];
				}
			}
		}
		var fieldAlign = getFieldAlign( field );
		var helpInline = getHelpInline( field );

		var inputWidget = getInputWidget( config );

		inputWidget.on( 'change', function ( e ) {
			clearDependentFields( config.model.pathNoIndex );
		} );

		config.model.input = inputWidget;

		ModelFlatten.push( config.model );

		config.model.multiselect = PagePropertiesFunctions.isMultiselect(
			field[ 'preferred-input' ]
		);

		config.model.isFile = config.model.inputName === 'OO.ui.SelectFileWidget';

		if ( config.model.isFile ) {
			var fileItemWidget;

			var restoreButton = new OO.ui.ButtonWidget( {
				icon: 'restore'
			} );

			restoreButton.toggle( false );

			var fileUploadGroupWidget = new FileUploadGroupWidget( {
				items: [ inputWidget, restoreButton ]
			} );

			this.setFileKey = function ( filekey ) {
				config.model.filekey = filekey;
			};

			var loadedFiles = {};

			var self = this;

			// @FIXME
			// eslint-disable-next-line no-inner-declarations
			function createFileItemWidget( filename, loaded ) {
				// inputWidget is the SelectFileWidget
				inputWidget.toggle( false );

				// if ( loaded ) {
				config.model.previousFilename = filename;
				// }

				var thisFileItemWidget = new FileItemWidget( {
					classes: [ 'PagePropertiesFileItemWidget' ],
					value: filename,
					loaded: loaded,
					parentWidget: self
				} );

				loadedFiles[ filename ] = thisFileItemWidget;
				fileUploadGroupWidget.addItems( [ thisFileItemWidget ] );

				// overwrite the model, we want to
				// validate the filename
				config.model.input = thisFileItemWidget.inputWidget;

				return thisFileItemWidget;
			}

			// create fileItemWidget with existing filename
			if ( typeof config.data === 'string' && config.data.trim() !== '' ) {
				fileItemWidget = createFileItemWidget( config.data, true );
			}

			this.clearFileClick = function ( item ) {
				restoreButton.toggle( true );

				// inputWidget is the SelectFileWidget
				inputWidget.toggle( true );
				inputWidget.setValue( null );

				// TextInputWidget used for validation
				config.model.input.setValue( null );

				// this will remove fileItemWidget
				fileUploadGroupWidget.removeItems( [ item ] );
			};

			restoreButton.on( 'click', function () {
				inputWidget.toggle( false );
				restoreButton.toggle( false );
				fileUploadGroupWidget.removeItems( [ fileItemWidget ] );
				fileItemWidget = createFileItemWidget(
					// the previous content of fileItemWidget.inputWidget
					// (a TextInputWidget with filename)
					config.model.previousFilename,
					true
				);
			} );

			// @FIXME move to FileItemWidget

			this.on( 'fileUploaded', function ( file ) {
				// eslint-disable-next-line no-console
				console.log( 'event fileUploaded', file );
			} );

			this.on( 'fileUploadInit', function ( file ) {
				// eslint-disable-next-line no-console
				console.log( 'event fileUploadInit', file );
				restoreButton.toggle( false );
				fileItemWidget = createFileItemWidget( file.name, false );
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
		}

		var fieldLayout = new OO.ui.FieldLayout(
			!config.model.isFile ? inputWidget : fileUploadGroupWidget,
			{
				label: new OO.ui.HtmlSnippet( label ),
				align: fieldAlign,
				helpInline: helpMessage ? helpInline : true,
				help: new OO.ui.HtmlSnippet( helpMessage )
				// classes: [`pageproperties-input-${config.model.path}`],
			}
		);

		Fields[ config.model.path ] = fieldLayout;

		this.$element.append( fieldLayout.$element );
	};

	OO.inheritClass( ItemWidget, OO.ui.Widget );
	OO.mixinClass( ItemWidget, OO.ui.mixin.GroupWidget );

	// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/classes/SearchWidgetDialog.js
	function ProcessDialogSearch( config ) {
		ProcessDialogSearch.super.call( this, config );
	}
	OO.inheritClass( ProcessDialogSearch, OO.ui.ProcessDialog );
	ProcessDialogSearch.static.name = DialogSearchName;

	ProcessDialogSearch.prototype.initialize = function () {
		ProcessDialogSearch.super.prototype.initialize.apply( this, arguments );
		var self = this;
		var selectedSchemas = Form.data.schemas;
		this.selectedItems = [];
		function getItems( value ) {
			var values;
			switch ( self.data.toolName ) {
				case 'addremoveschemas':
					self.selectedItems = selectedSchemas;
					values = Object.keys( Schemas );
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
				return menuOptionWidget;
			} );
		}

		var searchWidget = new OO.ui.SearchWidget( {
			// id: "pageproperties-import-search-widget",
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
			// modes: "edit",
			label: mw.msg( 'pageproperties-jsmodule-pageproperties-searchdialog-save' ),
			flags: [ 'primary', 'progressive' ]
		},
		{
			// modes: "edit",
			label: mw.msg( 'pageproperties-jsmodule-pageproperties-cancel' ),
			flags: [ 'safe', 'close' ]
		}
	];
	ProcessDialogSearch.prototype.getActionProcess = function ( action ) {
		var dialog = this;

		if ( action === 'save' ) {
			var values = processDialogSearch.selectedItems;
			Form.data.properties.schemas = getModel( 'fetch' );

			switch ( this.data.toolName ) {
				case 'addremoveschemas':
					for ( var i in ModelSchemas ) {
						if ( !inArray( i, values ) ) {
							delete Form.data.properties.schemas[ i ];
							delete ModelSchemas[ i ];
							delete Fields[ i ];
						}
					}

					var missingSchemas = [];
					for ( var i of values ) {
						if ( !( i in Schemas ) || !Object.keys( Schemas[ i ] ).length ) {
							missingSchemas.push( i );
						}
					}

					if ( missingSchemas.length ) {
						PagePropertiesSchemas.loadSchemas( missingSchemas );
					} else {
						updatePanels();
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
			// classes: ["pageproperties-search-dialog"],
			data: { toolName: toolName }
		} );

		WindowManager.newWindow( processDialogSearch, {
			title: mw.msg(
				'pageproperties-jsmodule-pageproperties-dialogsearch-selectschemas'
			)
		} );
	}

	// @see https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.Toolbar
	// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/toolbars.js
	function createToolbar( /* disabled */ ) {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
		} );

		var onSelect = function ( self ) {
			var self = arguments.length ? self : this;
			var toolName = self.getName();

			switch ( toolName ) {
				case 'addremoveschemas':
					openSearchDialog( toolName );
					break;
				// case "createschema":
				// 	PagePropertiesSchemas.openDialog(null, false);
				// 	break;
			}

			self.setActive( false );
		};

		var loadDataBeforeSelect = function () {
			var dataToLoad = PagePropertiesFunctions.matchLoadedData( Config, [
				'schemas'
			] );

			if ( !dataToLoad.length ) {
				return onSelect( this );
			}

			this.setDisabled( true );
			this.pushPending();

			PagePropertiesFunctions.loadData( Config, dataToLoad )
				.then( ( res ) => {
					if ( 'schemas' in res ) {
						Schemas = res.schemas;
					}
					this.setDisabled( false );
					this.popPending();
					onSelect( this );
				} )
				.catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.error( 'loadData error', error );
					this.popPending();
					this.setDisabled( false );
					this.setActive( false );

					PagePropertiesFunctions.OOUIAlert( new OO.ui.HtmlSnippet( error ), {
						size: 'medium'
					} );
				} );
		};

		var toolGroup = [];

		if ( Config.context !== 'parserfunction' ) {
			toolGroup.push( {
				name: 'addremoveschemas',
				icon: 'add',
				title: mw.msg(
					'pageproperties-jsmodule-pageproperties-addremoveschemas'
				),
				onSelect: onSelect
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
				case 'manage-schemas':
					PagePropertiesSchemas.initialize();
					break;
				// case "manage-forms":
				// 		PagePropertiesForms.initialize();
				// 		break;
				// 	case "manage-semantic-properties":
				// 		PagePropertiesSMW.initialize();
				// 		break;
			}

			self.setActive( false );
		};

		var loadDataBeforeSelect = function () {
			var dataToLoad = PagePropertiesFunctions.matchLoadedData( Config, [
				// "forms",
				'schemas'
				// "semantic-properties",
				// "imported-vocabularies",
				// "type-labels",
				// "property-labels",
			] );

			if ( !dataToLoad.length ) {
				return onSelect( this );
			}

			// this.setDisabled(true);
			// this.pushPending();

			ActionWidget = new OO.ui.ActionWidget();
			ToolbarMain.$bar.wrapInner( '<div class="wrapper"></div>' );
			ActionWidget.setPendingElement( ToolbarMain.$bar.find( '.wrapper' ) );
			ActionWidget.pushPending();

			$( ToolbarMain.$bar ).find( '.wrapper' ).css( 'pointer-events', 'none' );

			PagePropertiesFunctions.loadData( Config, dataToLoad )
				.then( ( res ) => {
					// this.setDisabled(false);
					// this.popPending();
					ActionWidget.popPending();
					$( ToolbarMain.$bar ).find( '.wrapper' ).css( 'pointer-events', 'auto' );

					// PagePropertiesSMW.initialize(
					// 		Self,
					// 		res["imported-vocabularies"],
					// 		res["type-labels"],
					// 		res["property-labels"]
					// );

					// PagePropertiesForms.initialize(Self, Forms);

					onSelect( this );
				} )
				.catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.error( 'loadData error', error );
					ActionWidget.popPending();
					$( ToolbarMain.$bar ).find( '.wrapper' ).css( 'pointer-events', 'auto' );
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
				name: 'manage-schemas',
				icon: null,
				title: mw.msg( 'pageproperties-jsmodule-pageproperties-manage-schemas' ),
				onSelect: loadDataBeforeSelect
				// config: {
				// 	data: { disabled: disabled },
				// },
			}
			// {
			// 	name: 'manage-forms',
			// 	icon: null,
			// 	title: mw.msg( 'pageproperties-jsmodule-pageproperties-manage-forms' ),
			// 	onSelect: loadDataBeforeSelect
			// 	// config: {
			// 	// 	data: { disabled: disabled },
			// 	// },
			// }
		];

		if ( Config.SMW ) {
			toolGroup = toolGroup.concat( [
				{
					name: 'manage-semantic-properties',
					icon: null,
					title: mw.msg(
						'pageproperties-jsmodule-pageproperties-manage-semantic-properties'
					),
					onSelect: loadDataBeforeSelect
				}
			] );
		}

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

	var GroupWidget = function ( config, data ) {
		config = config || {};
		GroupWidget.super.call( this, config );

		OO.ui.mixin.GroupWidget.call(
			this,
			$.extend( { $group: this.$element }, config )
		);

		this.data = data;

		var showBorder =
			!data.root &&
			data.schema.wiki.type !== 'content-block' &&
			data.schema.wiki.type !== 'property' &&
			( data.schema.type !== 'array' ||
				data.schema.items.type === 'object' ||
				!( 'preferred-input' in data.schema.items.wiki ) ||
				!PagePropertiesFunctions.isMultiselect(
					data.schema.items.wiki[ 'preferred-input' ]
				) );

		// eslint-disable-next-line mediawiki/class-doc
		var layout = new OO.ui.PanelLayout( {
			expanded: false,
			padded: showBorder,
			framed: showBorder,
			classes: [
				'PagePropertiesGroupWidgetPanel' + ( !showBorder ? '-border' : '' )
			],
			id: `PagePropertiesGroupWidgetPanel-${ FormID }-${ data.path }`.replace(
				/ /g,
				'_'
			)
		} );

		var messageWidget = new OO.ui.MessageWidget( {
			classes: [ 'PagePropertiesGroupWidgetMessageWidget' ]
		} );

		// @TODO toggle parent as well if all children
		// aren't visible
		this.toggle(
			!PagePropertiesFunctions.getNestedProp(
				[ 'schema', 'options', 'hidden' ],
				data
			)
		);

		messageWidget.toggle( false );

		Fields[ data.path ] = messageWidget;

		layout.$element.append( messageWidget.$element );

		// console.log("data.schema", data.schema);
		switch ( data.schema.wiki.layout ) {
			case 'horizontal':
				this.layoutHorizontal = new OO.ui.HorizontalLayout();

				layout.$element.append(
					$(
						'<div class="pageproperties-form-table-multiple-fields" style="display: table">'
					).append( [
						$( '<div style="display: table-cell;vertical-align:middle">' ).append(
							this.layoutHorizontal.$element
						),
						$(
							'<div class="pageproperties-horizontal-section-remove-row" style="display: table-cell">'
						)
					] )
				);

				break;

			default:
				this.fieldset = new OO.ui.FieldsetLayout( {
					label: new OO.ui.HtmlSnippet(
						'title-parsed' in data.schema.wiki ?
							data.schema.wiki[ 'title-parsed' ] :
							'title' in data.schema.wiki ?
								data.schema.wiki.title :
								''
					)
				} );

				if ( 'description' in data.schema.wiki ) {
					this.fieldset.addItems( [
						new OO.ui.Element( {
							content: [
								new OO.ui.HtmlSnippet(
									'description-parsed' in data.schema.wiki ?
										data.schema.wiki[ 'description-parsed' ] :
										'description' in data.schema.wiki ?
											data.schema.wiki.description :
											''
								)
							]
						} )
					] );
				}

				if ( data.schema.wiki.layout === 'table' ) {
					layout.$element.append(
						$(
							'<div class="pageproperties-form-table-multiple-fields" style="display: table">'
						).append( [
							$( '<div style="display: table-cell">' ).append(
								this.fieldset.$element
							),
							$(
								'<div class="pageproperties-horizontal-section-remove-row" style="display: table-cell">'
							)
						] )
					);
				} else {
					layout.$element.append( this.fieldset.$element );
				}
		}

		/*
		// @TODO implement button switch for oneOf, anyOf
		this.buttonSelectWidget = new OO.ui.ButtonSelectWidget();

		var self = this;
		this.buttonSelectWidget.on("choose", function (item, seleted) {
			self.booklet.setPage(item.data);
		});

		layout.$element.append(this.buttonSelectWidget.$element);

		// var directives = [ 'anyOf', 'oneOf', 'allOf' ];

		// for ( var directive of directives ) {
		// 	this['fieldset-' + directive] = new OO.ui.FieldsetLayout({
		// 		// label: data.wiki.title,
		// 	});
		// 	layout.$element.append(this['fieldset-' + directive].$element);
		// }

		this.booklet = new OO.ui.BookletLayout({
			outlined: false,
			expanded: true,
			padded: false,
			classes: ["PagePropertiesGroupWidgetBooklet"],
		});

		layout.$element.append(this.booklet.$element);

		*/

		this.$element.append( layout.$element );
	};

	OO.inheritClass( GroupWidget, OO.ui.Widget );
	OO.mixinClass( GroupWidget, OO.ui.mixin.GroupWidget );

	GroupWidget.prototype.addItems = function ( items ) {
		if ( this.data.schema.wiki.layout === 'horizontal' ) {
			this.layoutHorizontal.addItems( items );
		} else {
			this.fieldset.addItems( items );
		}
	};

	GroupWidget.prototype.addCombinedItem = function ( item, title, directive ) {
		// this['fieldset-' + directive].addItems(items);

		var items = [
			new OO.ui.ButtonOptionWidget( {
				data: title,
				label: title
			} )
		];
		this.buttonSelectWidget.addItems( items );

		//	this['fieldset-' + directive]..addItems(items);

		if ( this.buttonSelectWidget.items.length === 1 ) {
			this.buttonSelectWidget.selectItem( items[ 0 ] );
		}

		var ThisPageLayout = function ( name, config ) {
			pageLayout.super.call( this, name, config );
			this.$element.append( item.$element );
		};
		OO.inheritClass( ThisPageLayout, OO.ui.PageLayout );

		var page = new ThisPageLayout( title );

		this.booklet.addPages( [ page ] );
	};

	function PanelLayout( config ) {
		PanelLayout.super.call( this, config );

		var data = this.data;
		var content;
		SchemasLayout = {};

		if ( !( 'layout' in Form.options ) ) {
			Form.options.layout = 'tabs';
		}

		// @TODO implement booklet also outside dialog
		if ( Form.options.layout === 'booklet' && Form.options.view !== 'popup' ) {
			Form.options.layout = 'tabs';
		}

		function getWidgets() {
			var ret = {};
			for ( var thisSchemaName of Form.data.schemas ) {
				if ( !( thisSchemaName in Schemas ) ) {
					// eslint-disable-next-line no-console
					console.error( "required schema doesn't exist", thisSchemaName );
					continue;
				}

				var schema = Schemas[ thisSchemaName ];

				if ( !( thisSchemaName in Form.data.properties.schemas ) ) {
					Form.data.properties.schemas[ thisSchemaName ] = {};
				}

				var path = `${ escapeJsonPtr( thisSchemaName ) }`;
				var pathNoIndex = '';
				var widget = new GroupWidget(
					{},
					{ root: true, schema: schema, path: path }
				);

				processSchema(
					widget,
					schema,
					thisSchemaName,
					( ModelSchemas[ thisSchemaName ] = {
						parent: ModelSchemas,
						childIndex: thisSchemaName
					} ),
					Form.data.properties.schemas[ thisSchemaName ],
					path,
					pathNoIndex,
					false
				);

				ret[ thisSchemaName ] = widget;
			}

			return ret;
		}

		switch ( data.name ) {
			case 'schemas':
				if ( !( 'schemas' in Form.data.properties ) ) {
					Form.data.properties.schemas = {};
				}

				var layout = Form.options.layout;
				var widgets = getWidgets();

				var selectedSchema = null;
				if ( Object.keys( widgets ).length ) {
					selectedSchema = Object.keys( widgets )[ 0 ];
				}

				if ( !selectedSchema ) {
					this.isEmpty = true;
					return false;
				}

				var ThisPageLayout = function ( name, thisConfig ) {
					pageLayout.super.call( this, name, thisConfig );
				};

				OO.inheritClass( ThisPageLayout, OO.ui.PageLayout );

				ThisPageLayout.prototype.setupOutlineItem = function () {
					this.outlineItem.setLabel( this.name );
				};

				var ThisTabPanelLayout = function ( name, thisConfig ) {
					this.name = name;
					ThisTabPanelLayout.super.call( this, name, thisConfig );
				};

				OO.inheritClass( ThisTabPanelLayout, OO.ui.TabPanelLayout );
				ThisTabPanelLayout.prototype.setupTabItem = function () {
					this.tabItem.setLabel( this.name );
				};

				switch ( layout ) {
					case 'single':
						content = widgets[ selectedSchema ];
						this.$element.addClass( 'PanelPropertiesStackPanelSingle' );

						break;
					case 'booklet':
						var booklet = new OO.ui.BookletLayout( {
							outlined: true,
							expanded: true,
							padded: false
						} );

						if (
							SelectedSchema &&
							Object.keys( widgets ).indexOf( SelectedSchema ) !== -1
						) {
							selectedSchema = SelectedSchema;
						}

						booklet.on( 'set', function () {
							SelectedSchema = booklet.getCurrentPageName();
						} );

						SchemasLayout = booklet;

						var items = [];

						for ( var schemaName in widgets ) {
							var tabPanel = new ThisPageLayout( schemaName );
							tabPanel.$element.append( widgets[ schemaName ].$element );
							items.push( tabPanel );
						}

						booklet.addPages( items );
						content = booklet;

						booklet.setPage( selectedSchema );

						this.$element.addClass( 'PanelPropertiesStackPanelBooklet' );

						break;
					case 'tabs':
					default:
						var indexLayout = new OO.ui.IndexLayout( {
							framed: true,
							showMenu: false,
							expanded: true,
							padded: false,
							autoFocus: false
						} );
						SchemasLayout = indexLayout;

						if (
							SelectedSchema &&
							Object.keys( widgets ).indexOf( SelectedSchema ) !== -1
						) {
							selectedSchema = SelectedSchema;
						}

						indexLayout.on( 'set', function () {
							SelectedSchema = indexLayout.getCurrentTabPanelName();
						} );

						var widgets = getWidgets();
						var items = [];

						for ( var schemaName in widgets ) {
							var tabPanel = new ThisTabPanelLayout( schemaName );
							tabPanel.$element.append( widgets[ schemaName ].$element );
							items.push( tabPanel );
						}

						indexLayout.addTabPanels( items );
						indexLayout.setTabPanel( selectedSchema );
						content = indexLayout;

						this.$element.addClass( 'PanelPropertiesStackPanelTabs' );

						break;
				}
				break;

			case 'article':
				var items = [];

				var userDefinedInput;
				var userDefinedField;
				if ( data.userDefined ) {
					var inputName = 'mw.widgets.TitleInputWidget';

					userDefinedInput = new mw.widgets.TitleInputWidget( {
						name: `${ FormID }-model-target-title`,
						value: !( 'userDefined' in Form.data ) ? '' : Form.data.userDefined,
						// @FIXME if the stack panel is hidden
						// this will create a browser error
						required: true
					} );

					Model[ 'target-title' ] = userDefinedInput;

					userDefinedField = new OO.ui.FieldLayout( userDefinedInput, {
						label: mw.msg( 'pageproperties-jsmodule-forms-pagename' ),
						align: data.fieldAlign
						// classes: ["ItemWidget", "inputName-" + inputName],
					} );
					items.push( userDefinedField );
				}

				if ( data.editFreeText ) {
					// @TODO add editor
					// @see PageForms-5.5.1/includes/forminputs/PF_TextAreaInput.php
					// libs/PF_wikieditor.js

					var inputName = 'OO.ui.MultilineTextInputWidget';
					var inputWidget = new OO.ui.MultilineTextInputWidget( {
						name: `${ FormID }-model-freetext`,
						autosize: true,
						rows: 6,
						value: Model.freetext ?
							Model.freetext.getValue() :
							Form.data.freetext
					} );

					// @TODO VEFORALL
					// inputWidget.$element.find("textarea").addClass("visualeditor");

					// if ($.fn.applyVisualEditor) {
					// 	inputWidget.$element.find("textarea").applyVisualEditor();
					// } else {
					// 	jQuery(document).on("VEForAllLoaded", function (e) {
					// 		inputWidget.$element.find("textarea").applyVisualEditor();
					// 	});
					// }

					Model.freetext = inputWidget;

					items.push(
						new OO.ui.FieldLayout( inputWidget, {
							label: mw.msg( 'pageproperties-jsmodule-formedit-freetext' ),
							align: data.fieldAlign
							// classes: ["ItemWidget", "inputName-" + inputName],
						} )
					);
				}
				if ( data.editCategories ) {
					var categories = data.categories;

					var categoriesInput = new mw.widgets.CategoryMultiselectWidget( {
						name: `${ FormID }-model-categories`
						// value: categories,
					} );

					Model.categories = categoriesInput;

					// ***prevents error "Cannot read properties of undefined (reading 'apiUrl')"
					for ( var category of categories ) {
						categoriesInput.addTag( category );
					}
					items.push(
						new OO.ui.FieldLayout( categoriesInput, {
							label: mw.msg( 'pageproperties-jsmodule-forms-categories' ),
							align: data.fieldAlign,
							classes: [ 'PagePropertiesItemWidget' ]
						} )
					);
				}

				if ( data.editContentModel ) {
					var contentModelInput = new OO.ui.DropdownInputWidget( {
						name: `${ FormID }-model-content-model`,
						options: PagePropertiesFunctions.createDropDownOptions(
							Config.contentModels
						),
						value: Config.contentModel
					} );

					Model[ 'content-model' ] = contentModelInput;

					items.push(
						new OO.ui.FieldLayout( contentModelInput, {
							label: mw.msg( 'pageproperties-jsmodule-forms-content-models' ),
							align: data.fieldAlign,
							classes: [ 'PagePropertiesItemWidget' ]
						} )
					);
				}

				if ( !items.length ) {
					this.isEmpty = true;
					return false;
				}

				this.$element.addClass( 'PanelPropertiesStackPanelFieldset' );

				content = new OO.ui.FieldsetLayout( {
					label: '',
					items: items
				} );
		}

		this.isEmpty = false;
		this.$element.append( content.$element );
	}

	OO.inheritClass( PanelLayout, OO.ui.PanelLayout );

	var OptionsList = function ListWidget( config, schema, model ) {
		config = config || {};

		// Call parent constructor
		OptionsList.super.call( this, config );

		OO.ui.mixin.GroupWidget.call(
			this,
			$.extend(
				{
					$group: this.$element
				},
				config
			)
		);

		this.schema = schema;
		this.model = model;

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

	OO.inheritClass( OptionsList, OO.ui.Widget );
	OO.mixinClass( OptionsList, OO.ui.mixin.GroupWidget );

	OptionsList.prototype.onAddItem = function () {};

	OptionsList.prototype.onItemDelete = function () {};

	// OptionsList.prototype.addItems = function (items) {
	// 	for ( var i in items ) {
	// 		OO.ui.mixin.GroupWidget.prototype.addItem.call(this, items[i], i);
	// 	}
	// }

	function updateOnItemDelete( optionsList, item ) {
		var itemIndex = item.data.index;
		var itemPath = item.data.path;
		var model = optionsList.model;

		delete model[ itemIndex ];

		// @FIXME
		// a simpler way is just to updatePanels
		// in this case also Fields with path
		// of the related schema must be
		// deleted from function PanelLayout

		// *** the following code is only
		// required to identify the rearranged
		// element upon validation

		for ( var path in Fields ) {
			if ( path.indexOf( itemPath ) === 0 ) {
				delete Fields[ path ];
			}
		}

		// reorder the model of current level
		var ret = {};
		var n = 0;
		for ( var i in model ) {
			ret[ n ] = model[ i ];
			delete model[ i ];
			n++;
		}

		// rename paths and indexes in the model,
		// Fields and optionsList items
		for ( var i in ret ) {
			var oldPath = ret[ i ].path;
			var newPath = oldPath.split( '/' ).slice( 0, -1 ).join( '/' ) + '/' + i;

			model[ i ] = ret[ i ];
			model[ i ].path = newPath;

			// @ATTENTION ensure it is a number
			optionsList.items[ i ].data.index = parseInt( i );
			optionsList.items[ i ].data.path = newPath;

			for ( var path in Fields ) {
				if ( path.indexOf( oldPath ) === 0 ) {
					var newPath_ = newPath + path.slice( oldPath.length );
					Fields[ newPath_ ] = Fields[ path ];
					delete Fields[ path ];
				}
			}
		}
	}

	OptionsList.prototype.addItem = function ( item, i ) {
		var self = this;
		item.data.index = i;

		function recDeleteValue( model ) {
			switch ( model.schema.type ) {
				case 'object':
					if ( 'properties' in model ) {
						for ( var ii in model.properties ) {
							recDeleteValue( model.properties[ ii ] );
						}
					}
					break;
				case 'array':
					// @TODO implement tuple
					if ( PagePropertiesFunctions.isObject( schema.items ) ) {
						recDeleteValue( model.items );
					}
					break;
				default:
					if ( 'input' in model ) {
						model.input.setValue( !model.multiselect ? '' : [] );
					}
			}
		}

		var deleteButton = new OO.ui.ButtonWidget( {
			icon: 'close'
			// flags: ["destructive"],
			// classes: ["PagePropertiesOptionsListDeleteButton"],
		} );
		deleteButton.on( 'click', function () {
			if (
				!( 'minItems' in self.schema ) ||
				self.items.length > self.schema.minItems
			) {
				self.removeItems( [ item ] );
				// updateOnItemDelete(self, item);
				delete self.model[ item.data.index ];
				updatePanels();
			} else {
				recDeleteValue( self.model[ item.data.index ] );
			}
		} );

		if (
			item.data.schema.wiki.layout === 'horizontal' ||
			item.data.schema.wiki.layout === 'table'
		) {
			$( item.$element )
				.find( '.pageproperties-horizontal-section-remove-row' )
				.append( deleteButton.$element );
		} else {
			item.$element.prepend(
				$( '<div style="text-align:right">' ).append( deleteButton.$element )
			);
		}

		OO.ui.mixin.GroupWidget.prototype.addItems.call( this, [ item ] );

		this.emit( 'add', item );

		return this;
	};

	OptionsList.prototype.removeItems = function ( items ) {
		OO.ui.mixin.GroupWidget.prototype.removeItems.call( this, items );
		this.emit( 'remove', items );
		return this;
	};

	OptionsList.prototype.clearItems = function () {
		var items = this.items.slice();
		OO.ui.mixin.GroupWidget.prototype.clearItems.call( this );
		this.emit( 'remove', items );
		return this;
	};

	function applyUntransformed( data, i, path ) {
		if (
			!( 'schemas-data' in Form.data.properties ) ||
			!( 'untransformed' in Form.data.properties[ 'schemas-data' ] ) ||
			!( path in Form.data.properties[ 'schemas-data' ].untransformed )
		) {
			return;
		}

		// *** this ensures subsequent edits are maintained
		data[ i ] = Form.data.properties[ 'schemas-data' ].untransformed[ path ];
		delete Form.data.properties[ 'schemas-data' ].untransformed[ path ];
	}

	var OptionsListContainer = function OptionsListContainer(
		config,
		schema,
		item,
		schemaName,
		model,
		data,
		path,
		pathNoIndex,
		newItem
	) {
		config = config || {};

		// Call parent constructor
		OptionsListContainer.super.call( this, config );

		// display multiselect
		if (
			item.type !== 'object' &&
			'preferred-input' in item.wiki &&
			PagePropertiesFunctions.isMultiselect( item.wiki[ 'preferred-input' ] )
		) {
			let widget_ = new GroupWidget( {}, { schema: item, path: path } );
			processSchema(
				widget_,
				item,
				schemaName,
				model,
				data,
				path,
				pathNoIndex,
				newItem
			);
			this.$element.append( widget_.$element );
			return;
		}

		this.optionsList = new OptionsList( {}, schema, model );

		var minItems = 'minItems' in schema ? schema.minItems : 0;
		var data;
		if (
			Array.isArray( item.default ) &&
			( !Array.isArray( data ) || !data.length ) &&
			( isNewSchema( schemaName ) || Form.options.action === 'create' )
		) {
			data =
				'default-parsed' in item.wiki ?
					item.wiki[ 'default-parsed' ] :
					item.default;
		}

		if ( Array.isArray( data ) && minItems < data.length ) {
			minItems = data.length;
		}

		var i = 0;
		while ( this.optionsList.items.length < minItems ) {
			var newItem = false;

			// data is not an object if the type of schema
			// changed from non object to object, e.g.
			// an array of text fields vs an array
			// of subitems, and the name/key was the same

			if ( typeof data !== 'object' || !( i in data ) ) {
				data[ i ] = {};
				newItem = true;
			}
			var path_ = `${ path }/${ i }`;
			applyUntransformed( data, i, path );

			let widget_ = new GroupWidget( {}, { schema: item, path: path_ } );
			processSchema(
				widget_,
				item,
				schemaName,
				( model[ i ] = { parent: model, childIndex: i } ),
				data[ i ],
				path_,
				pathNoIndex,
				newItem
			);
			this.optionsList.addItem( widget_, i );
			i++;
		}

		var self = this;

		var addOption = new OO.ui.ButtonWidget( {
			icon: 'add'
		} );

		addOption.on( 'click', function () {
			if (
				!( 'maxItems' in schema ) ||
				self.optionsList.items.length < schema.maxItems
			) {
				let widget_ = new GroupWidget( {}, { schema: item, path: path } );
				var ii = self.optionsList.items.length ?
					self.optionsList.items[ self.optionsList.items.length - 1 ].data
						.index + 1 :
					0;

				var thisPath_ = `${ path }/${ ii }`;
				processSchema(
					widget_,
					item,
					schemaName,
					( model[ ii ] = { parent: model, childIndex: ii } ),
					( data[ ii ] = {} ),
					thisPath_,
					pathNoIndex,
					true
				);
				self.optionsList.addItem( widget_, ii );
			}
		} );

		this.$element.append( this.optionsList.$element );
		this.$element.append( addOption.$element );
	};

	OO.inheritClass( OptionsListContainer, OO.ui.Widget );
	// OO.mixinClass(OptionsListContainer, OO.ui.mixin.GroupWidget);

	function processSchema(
		widget,
		schema,
		schemaName,
		model,
		data,
		path,
		pathNoIndex,
		newItem
	) {
		if ( !( 'type' in schema ) ) {
			schema.type = 'default' in schema ? 'string' : 'object';
		}

		model.schema = schema;
		model.path = path;
		model.pathNoIndex = pathNoIndex;
		// @TODO implement allOf, anyOf, oneOf using addCombinedItem
		// @TODO implement "$ref"

		switch ( schema.type ) {
			case 'object':
				model.properties = {};
				if ( 'properties' in schema ) {
					var items_ = [];
					for ( var i in schema.properties ) {
						// data is not an object if the type of schema
						// changed from non object to object, e.g.
						// an array of text fields vs an array
						// of subitems, and the name/key was the same
						if ( typeof data !== 'object' || !( i in data ) ) {
							data[ i ] = {};
						}
						var path_ = `${ path }/${ escapeJsonPtr( i ) }`;
						applyUntransformed( data, i, path_ );
						var pathNoIndex_ = pathNoIndex ?
							`${ pathNoIndex }/${ escapeJsonPtr( i ) }` :
							escapeJsonPtr( i );
						var item = schema.properties[ i ];
						var widget_ = new GroupWidget( {}, { schema: item, path: path_ } );
						processSchema(
							widget_,
							item,
							schemaName,
							( model.properties[ i ] = {
								parent: model.properties,
								childIndex: i
							} ),
							data[ i ],
							path_,
							pathNoIndex_,
							newItem
						);
						items_.push( widget_ );
					}
					widget.addItems( items_ );
				}
				break;
			case 'array':
				if ( 'items' in schema ) {
					if ( PagePropertiesFunctions.isObject( schema.items ) ) {
						var item = schema.items;
						model.items = {};
						if ( item.wiki.type === 'property' ) {
							item.wiki.layout = 'table';
						}

						var optionsListContainer = new OptionsListContainer(
							{},
							schema,
							item,
							schemaName,
							model.items,
							data,
							path,
							pathNoIndex,
							newItem
						);
						widget.addItems( [ optionsListContainer ] );
					} else {
						// @TODO
						// implement tuple
					}
				}
				break;
			default:
				// 'string',
				// 'number',
				// 'integer',
				// 'boolean',
				// 'null'
				// model.type = "property";
				if ( !( 'wiki' in schema ) ) {
					schema.wiki = {};
				}

				if (
					'visibility' in schema.wiki &&
					schema.wiki.visibility === 'oncreate-only' &&
					Form.options.action !== 'create'
				) {
					delete model.parent[ model.childIndex ];
					return;
				}

				var defaultValue = PagePropertiesFunctions.isObject( data ) ? null : data;

				// remove value-prefix
				// ***this is not necessary, since is hanlded
				// by applyUntransformed
				// if (defaultValue) {
				// 	if ("value-prefix" in schema.wiki) {
				// 		var prefixLength = schema.wiki["value-prefix"].length;
				// 		if (Array.isArray(defaultValue)) {
				// 			defaultValue = value.map((x) => x.substr(prefixLength));
				// 		} else {
				// 			defaultValue = defaultValue.substr(prefixLength);
				// 		}
				// 	}
				// }

				// can be an array, in case of multiselect

				if (
					defaultValue === null &&
					( newItem ||
						isNewSchema( schemaName ) ||
						Form.options.action === 'create' ) &&
					'default-parsed' in schema.wiki
				) {
					defaultValue = schema.wiki[ 'default-parsed' ];
				}

				if ( Array.isArray( defaultValue ) ) {
					defaultValue = defaultValue.filter(
						( x ) => !PagePropertiesFunctions.isObject( x )
					);
				}

				// used by getFieldAlign
				schema.wiki.schema = schemaName;
				var item = new ItemWidget( {
					classes: [ 'PagePropertiesItemWidget' ],
					model: model,
					data: defaultValue
				} );

				widget.addItems( [ item ] );
		}

		// @TODO implement anyOf, oneOf, allOf
		// https://json-schema.org/understanding-json-schema/reference/combining.html
		// var directives = ["anyOf", "oneOf", "allOf"];
		// for (var directive of directives) {
		// 	if (directive in schema) {
		// 		// *** this is by default an array,
		// 		// but transformed to an object
		// 		for (var i in schema[directive]) {
		// 			var item = schema[directive][i];
		// 			let widget_ = new GroupWidget({}, item);
		// 			processSchema(widget_, item, schemaName, (model[i] = {}));
		// 			if ( directive!=='allOf' ) {
		// 				widget.addCombinedItem(widget_, item.title || i, directive);
		// 			} else {
		// 				widget.addItems([widget_]);
		// 			}
		// 		}
		// 	}
		// }
	}

	function getSchemasPanel() {
		Fields = {};
		Model = {};
		ModelSchemas = {};
		ModelFlatten = [];

		return new PanelLayout( {
			expanded: true,
			padded: false,
			framed: false,
			// classes: ["PanelProperties-panel-section"],
			data: {
				name: 'schemas',
				schemas: Form.data.schemas
			}
		} );
	}

	function getArticlePanel() {
		var userDefined = Config.isNewPage && Form.options[ 'edit-page' ] === '';

		// var editFreeText = Config.isNewPage;
		// var editContentModel = Config.isNewPage || !Form.data.schemas.length || Config.context === "EditSemantic";
		// var editCategories = Config.isNewPage || !Form.data.schemas.length || Config.context === "EditSemantic";

		var editFreeText = Config.isNewPage && Config.context === 'EditSemantic';
		var editContentModel = Config.context === 'EditSemantic';
		var editCategories = Config.context === 'EditSemantic';

		var categories = [];

		if ( 'edit-content-model' in Form.options ) {
			editContentModel = Form.options[ 'edit-content-model' ];
		}

		if ( 'edit-categories' in Form.options ) {
			editCategories = Form.options[ 'edit-categories' ]; // !Form.schemas.length || !Config.isNewPage;
		}

		if ( 'edit-freetext' in Form.options ) {
			editFreeText = Form.options[ 'edit-freetext' ];
		}

		var fieldAlign = 'top';

		if (
			Form.options.action === 'create' &&
			Form.options[ 'pagename-formula' ] === ''
		) {
			userDefined = true;
		}

		// this will set the fieldAlign of the wiki
		// section as the fieldAlign of last form
		if ( 'layout-align' in Form.options ) {
			fieldAlign = Form.options[ 'layout-align' ];
		}

		// if (Form.options["default-categories"]) {
		// 	categories = Form.options["default-categories"].split(/\s*,\s*/)
		// 		.filter( x => x.trim() !== '' );
		// }
		var categories = (
			'default-categories' in Form.options ?
				Form.options[ 'default-categories' ] :
				[]
		)
			.concat( Form.data.categories )
			.filter( function onlyUnique( value, index, self ) {
				return self.indexOf( value ) === index;
			} );

		// create title and free text input
		if ( !userDefined && !editFreeText && !editCategories && !editContentModel ) {
			return { isEmpty: true };
		}

		return new PanelLayout( {
			expanded: false,
			padded: true,
			framed: false,
			// classes: ["PanelProperties-panel-section"],
			data: {
				name: 'article',
				label: mw.msg( 'pageproperties-jsmodule-formedit-wiki' ),
				userDefined: userDefined,
				editFreeText: editFreeText,
				editCategories: editCategories,
				editContentModel: editContentModel,
				categories: categories,
				fieldAlign: fieldAlign
			}
		} );
	}

	function updatePanels() {
		Form.data.properties.schemas = getModel( 'fetch' );

		var panels = PropertiesStack.getItems();
		for ( var panel of panels ) {
			if ( panel.getData().name === 'schemas' ) {
				PropertiesStack.removeItems( [ panel ] );
				break;
			}
		}

		var schemasPanel = getSchemasPanel();
		if ( !schemasPanel.isEmpty ) {
			PropertiesStack.addItems( [ schemasPanel ], 0 );
		}

		panels = PropertiesStack.getItems();

		PropertiesStack.setItem( panels[ 0 ] );

		PropertiesStack.$element.removeClass( [
			'PanelPropertiesStack',
			'PanelPropertiesStack-empty'
		] );

		switch ( panels.length ) {
			case 0:
				PropertiesStack.$element.addClass( 'PanelPropertiesStack-empty' );
				break;
			default:
				PropertiesStack.$element.addClass( 'PanelPropertiesStack' );
		}

		updateButtons( panels );

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader( 'form' );
		}, 30 );
	}

	function updateButtons( panels ) {
		if ( hasMultiplePanels() ) {
			ValidateButton.toggle( panels.length !== 0 );
			DeleteButton.toggle( hasStoredProperties() );
			GoBackButton.toggle( false );
			SubmitButton.toggle( false );
		} else {
			SubmitButton.toggle( panels.length !== 0 );
			DeleteButton.toggle( hasStoredProperties() );
			GoBackButton.toggle( false );
			ValidateButton.toggle( false );
		}
	}

	function updateSchemas( schemas ) {
		Schemas = schemas;
		updatePanels();
	}

	function onSubmit() {
		var action;
		var formEl = $( this ); // .closest(".PagePropertiesForm");

		if ( formEl.data( 'delete' ) === true ) {
			action = 'delete';
		} else {
			action = !hasMultiplePanels() ? 'validate&submit' : 'submit';
		}

		var res = getModel( action );

		if ( typeof res === 'boolean' && !res ) {
			return false;
		}

		$( '<input>' )
			.attr( {
				type: 'hidden',
				name: 'data',
				value: JSON.stringify( getFormAttributes( res ) )
			} )
			.appendTo( formEl );
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
			label: mw.msg( 'pageproperties-jsmodule-dialog-delete' ),
			flags: 'destructive',
			modes: [ 'validate-delete', 'submit-single-delete' ]
		},
		{
			action: 'validate',
			modes: [ 'validate', 'validate-delete' ],
			label: mw.msg( 'pageproperties-jsmodule-dialog-validate' ),
			flags: [ 'primary', 'progressive' ]
		},
		{
			action: 'back',
			label: OO.ui.deferMsg( 'pageproperties-jsmodule-dialog-goback' ),
			flags: [ 'safe', 'back' ],
			modes: [ 'submit', 'submit-delete' ]
		},
		{
			action: 'submit',
			label: mw.msg( 'pageproperties-jsmodule-dialog-submit' ),
			flags: [ 'primary', 'progressive' ],
			modes: [ 'submit', 'submit-delete' ]
		},
		{
			action: 'validate&submit',
			label: mw.msg( 'pageproperties-jsmodule-dialog-submit' ),
			flags: [ 'primary', 'progressive' ],
			modes: [ 'submit-single', 'submit-single-delete' ]
		},
		{
			label: mw.msg( 'pageproperties-jsmodule-dialog-close' ),
			flags: [ 'safe', 'close' ],
			modes: [
				'validate',
				'submit-single',
				'validate-delete',
				'submit-single-delete'
			]
		}
	];

	ProcessDialog.prototype.getSetupProcess = function ( data ) {
		// data = data || {};

		// @see https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs
		return ProcessDialog.super.prototype.getSetupProcess
			.call( this, data )
			.next( function () {
				// @see resources/lib/ooui/oojs-ui-windows.js
				this.actions.setMode(
					( PropertiesStack.getItems().length > 1 ?
						'validate' :
						'submit-single' ) + ( !hasStoredProperties() ? '' : '-delete' )
				);

				this.$body.append( data.PropertiesStack.$element );
			}, this );
	};

	ProcessDialog.prototype.initialize = function () {
		ProcessDialog.super.prototype.initialize.apply( this, arguments );

		// this.$body.append(this.data.OuterStack.$element);

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader(
				'#pagepropertiesform-wrapper-dialog-' + FormID
			);
		}, 30 );
	};

	ProcessDialog.prototype.getActionProcess = function ( action ) {
		if (
			!action ||
			( action === 'delete' &&
				// eslint-disable-next-line no-alert
				!confirm(
					mw.msg( 'pageproperties-jsmodule-pageproperties-delete-data-confirm' )
				) )
		) {
			return ProcessDialog.super.prototype.getActionProcess.call( this, action );
		}
		var self = this;
		return ProcessDialog.super.prototype.getActionProcess
			.call( this, action )
			.next( function () {
				switch ( action ) {
					case 'back':
						var panels = PropertiesStack.getItems();
						PropertiesStack.setItem( panels[ 0 ] );
						self.setSize(
							!( 'popup-size' in Form.options ) ||
								Form.options[ 'popup-size' ] === '' ?
								'medium' :
								Form.options[ 'popup-size' ]
						);
						self.actions.setMode(
							'validate' + ( !hasStoredProperties() ? '' : '-delete' )
						);
						break;
					case 'validate':
						var res = getModel( 'validate' );

						if ( typeof res === 'boolean' ) {
							return;
						}

						var panels = PropertiesStack.getItems();
						PropertiesStack.setItem( panels[ panels.length - 1 ] );
						self.setSize( 'medium' );
						self.actions.setMode(
							'submit' + ( !hasStoredProperties() ? '' : '-delete' )
						);
						break;
					case 'validate&submit':
					case 'submit':
					case 'delete':
						var res = getModel( action );

						if ( action.indexOf( 'submit' ) !== 1 && typeof res === 'boolean' ) {
							return;
						}

						var payload = {
							data: JSON.stringify( getFormAttributes( res ) ),
							action: 'pageproperties-submit-form'
						};

						return new Promise( ( resolve, reject ) => {
							mw.loader.using( 'mediawiki.api', function () {
								new mw.Api()
									.postWithToken( 'csrf', payload )
									.done( function ( thisRes ) {
										resolve();
										if ( payload.action in thisRes ) {
											var data = JSON.parse( thisRes[ payload.action ].result );
											if ( !data.errors.length ) {
												WindowManager.removeActiveWindow();
												// @FIXME reload only if the changes affect
												// the current page
												if ( data[ 'target-url' ] === window.location.href ) {
													window.location.reload();
												} else {
													window.location.href = data[ 'target-url' ];
												}
											} else {
												PagePropertiesFunctions.OOUIAlert(
													new OO.ui.HtmlSnippet( data.errors.join( '<br />' ) ),
													{
														size: 'medium'
													}
												);
											}
										}
									} )
									.fail( function ( thisRes ) {
										// eslint-disable-next-line no-console
										console.error( 'res', thisRes );
										reject();
									} );
							} );
						} ); // promise
				}
			} );

		// return new OO.ui.Process(function () {
		// 	dialog.close({ action: action });
		// });

		// return ProcessDialog.super.prototype.getActionProcess.call(this, action);
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

	function getFormAttributes( jsondata ) {
		return $.extend(
			{
				formID: FormID,
				config: Config
			},
			jsondata
		);
	}

	function initializePropertiesStack() {
		var panels = [ getSchemasPanel(), getArticlePanel() ].filter(
			( x ) => !x.isEmpty
		);

		var classes = [];

		switch ( panels.length ) {
			case 0:
				classes.push( 'PanelPropertiesStack-empty' );
				break;
			default:
				classes.push( 'PanelPropertiesStack' );
		}

		PropertiesStack = new OO.ui.StackLayout( {
			items: panels,
			continuous: false, // !hasMultiplePanels(),
			expanded: true,
			padded: false,
			// The following classes are used here:
			// * PanelPropertiesStack
			// * PanelPropertiesStack-empty
			classes: classes
		} );
		return panels;
	}

	function hasMultiplePanels() {
		return (
			PropertiesStack.getItems().length > 1
			// Form.options.view === "popup"
			// || Object.keys( SchemasLayout ) > 0
		);
	}

	function hasStoredProperties() {
		if (
			Config.context !== 'EditSemantic' &&
			Form.options.action !== 'edit'
		) {
			return false;
		}

		if ( !( 'schemas' in StoredProperties ) ) {
			return false;
		}
		for ( var i in StoredProperties.schemas ) {
			if (
				PagePropertiesFunctions.isObject( StoredProperties.schemas[ i ] ) &&
				Object.keys( StoredProperties.schemas[ i ] ).length
			) {
				return true;
			}
		}
		return false;
	}

	function initialize( pageProperties ) {
		if ( arguments.length ) {

			Self = pageProperties;
		}

		if ( Form.options.view === 'popup' ) {
			var popupButton = new OO.ui.ButtonWidget( {
				icon: 'edit',
				label: Form.options.title
			} );

			popupButton.on( 'click', function () {
				initializePropertiesStack();
				StoredProperties = JSON.parse( JSON.stringify( Form.data.properties ) );

				var thisClasses = [];
				if ( 'css-class' in Form.options && Form.options[ 'css-class' ] !== '' ) {
					thisClasses.push( Form.options[ 'css-class' ] );
				}

				// eslint-disable-next-line mediawiki/class-doc
				var processDialog = new ProcessDialog( {
					size:
						!( 'popup-size' in Form.options ) || Form.options[ 'popup-size' ] === '' ?
							'medium' :
							Form.options[ 'popup-size' ],
					id: 'pagepropertiesform-wrapper-dialog-' + FormID,
					classes: thisClasses
				} );

				WindowManager.newWindow( processDialog, {
					title: Form.options.title,
					PropertiesStack: PropertiesStack
				} );
			} );
			$( '#pagepropertiesform-wrapper-' + FormID ).append( popupButton.$element );

			return;
		}

		var formContent = [];

		if ( Form.data.errors.length ) {
			var messageWidget = new OO.ui.MessageWidget( {
				type: 'error',
				label: new OO.ui.HtmlSnippet( Form.data.errors.join( '<br /> ' ) )
			} );

			formContent.push( messageWidget.$element );
			formContent.push( $( '<br>' ) );
		}

		var panels = initializePropertiesStack();
		StoredProperties = JSON.parse( JSON.stringify( Form.data.properties ) );

		SubmitButton = new OO.ui.ButtonInputWidget( {
			label:
				!( 'submit-button-text' in Form.options ) ||
				Form.options[ 'submit-button-text' ] === '' ?
					mw.msg( 'pageproperties-jsmodule-pageproperties-submit' ) :
					Form.options[ 'submit-button-text' ],

			flags: [ 'primary', 'progressive' ],
			classes: [ 'PagePropertiesFormSubmitButton' ],
			type: 'submit'
		} );

		formContent.push( PropertiesStack.$element );
		formContent.push( SubmitButton.$element );

		ValidateButton = new OO.ui.ButtonInputWidget( {
			label:
				!( 'validate-button-text' in Form.options ) ||
				Form.options[ 'validate-button-text' ] === '' ?
					mw.msg( 'pageproperties-jsmodule-pageproperties-validate' ) :
					Form.options[ 'validate-button-text' ],
			classes: [ 'PagePropertiesFormSubmitButton' ],
			flags: [ 'primary', 'progressive' ]
			// type: "submit",
		} );

		ValidateButton.on( 'click', function () {
			var res = getModel( 'validate' );

			if ( typeof res === 'boolean' && !res ) {
				return false;
			}

			var thisPanels = PropertiesStack.getItems();
			PropertiesStack.setItem( thisPanels[ thisPanels.length - 1 ] );

			ValidateButton.toggle( false );
			SubmitButton.toggle( true );
			GoBackButton.toggle( true );
			DeleteButton.toggle( false );
			$( '#pagepropertiesform-wrapper-' + FormID )
				.get( 0 )
				.scrollIntoView( { behavior: 'smooth' } );
		} );

		formContent.push( ValidateButton.$element );

		var printDeleteButton = hasStoredProperties();

		DeleteButton = new OO.ui.ButtonInputWidget( {
			label: mw.msg( 'pageproperties-jsmodule-pageproperties-delete' ),
			classes: [ 'PagePropertiesFormSubmitButton' ],
			flags: [ 'destructive' ],
			type: 'submit'
		} );

		formContent.push( DeleteButton.$element );

		GoBackButton = new OO.ui.ButtonInputWidget( {
			label: mw.msg( 'pageproperties-jsmodule-pageproperties-goback' ),
			classes: [ 'PagePropertiesFormSubmitButton' ],
			flags: [ 'progressive' ]
		} );

		GoBackButton.on( 'click', function () {
			var thisPanels = PropertiesStack.getItems();
			PropertiesStack.setItem( thisPanels[ 0 ] );

			ValidateButton.toggle( true );
			SubmitButton.toggle( false );
			GoBackButton.toggle( false );
			DeleteButton.toggle( hasStoredProperties() );

			$( '#pagepropertiesform-wrapper-' + FormID )
				.get( 0 )
				.scrollIntoView( { behavior: 'smooth' } );
		} );

		formContent.push( GoBackButton.$element );

		updateButtons( panels );

		var classes = [
			'PagePropertiesForm',
			'PagePropertiesFormContext-' + Config.context
		];

		if ( 'css-class' in Form.options && Form.options[ 'css-class' ] !== '' ) {
			classes.push( Form.options[ 'css-class' ] );
		}

		// eslint-disable-next-line mediawiki/class-doc
		var form = new OO.ui.FormLayout( {
			action: Config.actionUrl,
			method: 'post',
			enctype: 'multipart/form-data',
			$content: formContent,
			classes: classes,
			data: { name: 'pageproperties' }
		} );

		DeleteButton.on( 'click', function () {
			if (
				// eslint-disable-next-line no-alert
				confirm(
					mw.msg( 'pageproperties-jsmodule-pageproperties-delete-data-confirm' )
				)
			) {
				form.$element.data( { delete: true } );
				form.$element.trigger( 'submit' );
			}

			// PagePropertiesFunctions.OOUIAlert(
			// 	new OO.ui.HtmlSnippet(
			// 		mw.msg("pageproperties-jsmodule-pageproperties-delete-data-confirm")
			// 	),
			// 	{ size: "medium" },
			// 	function () {
			// 		form.$element.data({ delete: true });
			// 		form.$element.submit();
			// 	}
			// );
		} );

		form.$element.on( 'submit', onSubmit );

		var editToolbar =
			Config.canmanageschemas ||
			Config.canmanagesemanticproperties ||
			Config.canmanageforms;

		if ( Config.context === 'parserfunction' || !editToolbar ) {
			$( '#pagepropertiesform-wrapper-' + FormID ).append( form.$element );

			// eslint-disable-next-line no-jquery/no-global-selector
			$( '#mw-rcfilters-spinner-wrapper' ).remove();

			setTimeout( function () {
				PagePropertiesFunctions.removeNbspFromLayoutHeader( 'form' );
			}, 30 );

			return;
		}

		var items = [];
		ToolbarMain = createToolbar( Config.context === 'EditSemantic' );

		var frameA = new OO.ui.PanelLayout( {
			$content: [ ToolbarMain.$element, form.$element ],
			expanded: false,
			framed: false,
			padded: false,
			data: { name: 'pageproperties' }
		} );

		items.push( frameA );

		ActionToolbarMain = createActionToolbar( Config.context === 'EditSemantic' );
		ToolbarMain.$actions.append( ActionToolbarMain.$element );

		if ( Config.canmanageschemas ) {
			// https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/layouts.js
			var toolbarSchemas = PagePropertiesSchemas.createToolbarA();
			var contentSchemas = new OO.ui.PanelLayout( {
				$content: $(
					'<table id="pageproperties-schemas-datatable" class="pageproperties-datatable display" width="100%"></table>'
				),
				expanded: false,
				framed: true,
				padded: true,
				classes: [ 'PagePropertiesEditSemanticOuterStackPanel' ]
			} );

			var frameSchemas = new OO.ui.PanelLayout( {
				$content: [ toolbarSchemas.$element, contentSchemas.$element ],
				expanded: false,
				framed: false,
				padded: false,
				data: { name: 'manage-schemas' }
			} );

			items.push( frameSchemas );
		}

		// if (Config.canmanageforms) {
		// 	var toolbarForms = PagePropertiesForms.createToolbarA();
		// 	var contentForms = new OO.ui.PanelLayout({
		// 		$content: $(
		// 			'<table id="pageproperties-forms-datatable" class="pageproperties-datatable display" width="100%"></table>'
		// 		),
		// 		expanded: false,
		// 		padded: true,
		// 	});
		//
		// 	var frameForms = new OO.ui.PanelLayout({
		// 		$content: [toolbarForms.$element, contentForms.$element],
		// 		expanded: false,
		// 		framed: true,
		// 		data: { name: "manage-forms" },
		// 	});
		//
		// 	items.push(frameForms);
		// }

		if ( Config.SMW && Config.canmanagesemanticproperties ) {
			var toolbarSemanticProperties = PagePropertiesSMW.createToolbar();
			var contentSemanticProperties = new OO.ui.PanelLayout( {
				$content: $(
					'<table id="pageproperties-datatable-manage" class="pageproperties-datatable display" width="100%"></table>'
				),
				expanded: false,
				padded: true
			} );

			var frameSemanticProperties = new OO.ui.PanelLayout( {
				$content: [
					toolbarSemanticProperties.$element,
					contentSemanticProperties.$element
				],
				expanded: false,
				framed: true,
				data: { name: 'manage-semantic-properties' }
			} );

			items.push( frameSemanticProperties );
		}

		OuterStack = new OO.ui.StackLayout( {
			items: items,
			expanded: false,
			continuous: false
			// classes: ["pagepropertiesform-wrapper"],
		} );

		if ( Config.canmanageschemas ) {
			var actionToolbarSchemas = createActionToolbar(
				Config.context === 'EditSemantic'
			);
			toolbarSchemas.$actions.append( actionToolbarSchemas.$element );
		}

		// if (Config.canmanageforms) {
		// 	var actionToolbarForms = createActionToolbar();
		// 	toolbarForms.$actions.append(actionToolbarForms.$element);
		// }

		if ( Config.SMW && Config.canmanagesemanticproperties ) {
			var actionToolbarSemanticProperties = createActionToolbar();
			toolbarSemanticProperties.$actions.append(
				actionToolbarSemanticProperties.$element
			);

			var actionToolbarCategories = createActionToolbar();
			toolbarCategories.$actions.append( actionToolbarCategories.$element );
		}

		$( '#pagepropertiesform-wrapper-' + FormID ).append( OuterStack.$element );

		ToolbarMain.initialize();

		if ( Config.canmanageschemas ) {
			toolbarSchemas.initialize();
		}

		// if (Config.canmanageforms) {
		// 	toolbarForms.initialize();
		// }

		if ( Config.SMW && Config.canmanagesemanticproperties ) {
			toolbarSemanticProperties.initialize();
			toolbarCategories.initialize();
		}

		$( '#mw-rcfilters-spinner-wrapper' ).remove();

		setTimeout( function () {
			PagePropertiesFunctions.removeNbspFromLayoutHeader( 'form' );
		}, 30 );
	}

	return {
		initialize,
		getModel,
		getCategories,
		// updateForms,
		updateSchemas,
		updatePanels
	};
};

$( function () {
	// var semanticProperties = JSON.parse(
	// 	mw.config.get("pageproperties-semantic-properties")
	// );
	// console.log("semanticProperties", semanticProperties);

	var schemas = JSON.parse( mw.config.get( 'pageproperties-schemas' ) );
	// console.log("schemas", schemas);

	var submissionData = JSON.parse(
		mw.config.get( 'pageproperties-submissiondata' )
	);
	// console.log("submissionData", submissionData);

	var pageForms = JSON.parse( mw.config.get( 'pageproperties-pageforms' ) );
	// console.log("pageForms", pageForms);

	var config = JSON.parse( mw.config.get( 'pageproperties-config' ) );
	// console.log("config", config);

	var windowManager = new PagePropertiesWindowManager();

	if ( !submissionData ) {
		submissionData = {};
	}

	var instances = [];
	if (
		config.context === 'parserfunction' ||
		config.context === 'EditSemantic'
	) {
		for ( var formID in pageForms ) {
			var form = pageForms[ formID ];

			if ( formID in submissionData ) {
				form.data = submissionData[ formID ];
			}

			if ( !( 'data' in form ) ) {
				form.data = {};
			}

			form.data = $.extend(
				{
					freetext: '',
					properties: {},
					categories: [],
					errors: [],
					schemas: []
				},
				form.data
			);

			var pageProperties = new PageProperties(
				config,
				form,
				formID,
				schemas,
				windowManager
			);

			pageProperties.initialize( pageProperties );

			if ( config.context === 'parserfunction' && form.data.errors.length ) {
				$( '#pagepropertiesform-wrapper-' + formID )
					.get( 0 )
					.scrollIntoView();
			}

			instances.push( pageProperties );
		}
	}

	// @TODO use a standard class initialization
	// remove autoload
	PagePropertiesSchemas.preInitialize(
		config,
		windowManager,
		schemas,
		instances
	);

	if ( config.context === 'ManageSchemas' ) {
		PagePropertiesSchemas.initialize();
	}

	// display every 3 days
	if (
		!mw.config.get( 'pageproperties-disableVersionCheck' ) &&
		( config.canmanageschemas ||
			config.canmanagesemanticproperties ||
			config.canmanageforms ) &&
		!mw.cookie.get( 'pageproperties-check-latest-version' )
	) {
		mw.loader.using( 'mediawiki.api', function () {
			var payload = {
				action: 'pageproperties-check-latest-version'
			};
			new mw.Api()
				.postWithToken( 'csrf', payload )
				.done( function ( res ) {
					if ( payload.action in res ) {
						if ( res[ payload.action ].result === 2 ) {
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
							$( '.PagePropertiesForm' )
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
				} )
				.fail( function ( res ) {
					// eslint-disable-next-line no-console
					console.error( 'res', res );
				} );
		} );
	}
} );
