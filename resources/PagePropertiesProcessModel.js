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
 * @copyright Copyright © 2023, https://wikisphere.org
 */

/* eslint-disable no-tabs */
/* eslint-disable no-unused-vars */
/* eslint-disable no-underscore-dangle */

const PagePropertiesProcessModel = function (
	callbackShowError,
	Form,
	Schemas,
	RecordedSchemas,
	Model,
	ModelSchemas
) {
	var Flatten;
	var Action;
	var Removed;
	var Errors;

	function castType( value, model ) {
		// *** this is an hack to prevent
		// empty string, alternatively
		// use required native validation
		// or "minLength": 1

		if (
			model.schema.wiki.required &&
			model.schema.type === 'string' &&
			// value can be undefined for OO.ui.SelectFileWidget
			( !value || ( typeof value === 'string' && value.trim() === '' ) )
		) {
			return null;
		}

		return PagePropertiesFunctions.castType( value, model.schema.type );
	}

	async function formatValue( path, model ) {
		var path_ = ( Action === 'submit' ? path : model.path );
		var value = 'getValue' in model.input ? model.input.getValue() : '';

		if ( PagePropertiesFunctions.isPromise( value ) ) {
			value = await value;
		}

		if ( 'validateFunc' in model.input ) {
			var errorMsg = model.input.validateFunc();
			if ( PagePropertiesFunctions.isPromise( errorMsg ) ) {
				errorMsg = await errorMsg;
			}
			if ( typeof errorMsg === 'string' ) {
				Errors[ path_ ] = errorMsg;
			}
		}

		if ( Array.isArray( value ) ) {
			value = value.map( ( x ) => castType( x, model ) );
		} else {
			value = castType( value, model );
		}

		Flatten[ path_ ] = {
			pathNoIndex: model.pathNoIndex,
			value: value,
			multiselect: model.multiselect,
			schema: model.schema
		};

		if ( model.isFile ) {
			Flatten[ path_ ].filekey = model.filekey;
			// Flatten[model.path].previousFilaneme = model.previousFilaneme;
		}

		return value;
	}

	function validate( schemaName, data, schema ) {

		var ret = Errors;
		// eslint-disable-next-line new-cap
		const ajv = new window.ajv7( { strict: false, allErrors: true } );
		var validateAjv;
		try {
			validateAjv = ajv.compile( schema );
		} catch ( e ) {
			// eslint-disable-next-line no-console
			console.error( 'validate', e );
			callbackShowError( schemaName, e.message );
			return false;
		}
		if ( validateAjv( data ) && !Object.keys( ret ).length ) {
			return true;
		}

		if ( 'errors' in validateAjv && Array.isArray( validateAjv.errors ) ) {
			loopA: for ( var error of validateAjv.errors ) {
				var path = `${ schemaName }${ error.instancePath }`;
				for ( var path_ of Removed ) {
					if ( path.indexOf( path_ ) === 0 ) {
						continue loopA;
					}
				}

				// eslint-disable-next-line no-console
				console.error( error );
				ret[ path ] = error.message;
			}
		}

		if ( !Object.keys( ret ).length ) {
			return true;
		}

		callbackShowError( schemaName, null, ret );
		return false;
	}

	async function getValuesRec( path, model ) {
		switch ( model.schema.type ) {
			case 'array':
				var items = [];
				// @TODO handle tuple
				// multiselect
				if ( 'schema' in model.items ) {
					items = await formatValue( path, model.items );
				} else {
					var n = 0;
					for ( var ii in model.items ) {
						var path_ = `${ path }/${ n }`;
						if ( model.items[ ii ].removed ) {
							if ( Action !== 'validate' ) {
								continue;
							} else {
								Removed.push( path_ );
							}
						}
						items.push( await getValuesRec( path_, model.items[ ii ] ) );
						n++;
					}
				}
				// set to null only required items
				for ( var ii in items ) {
					if (
						typeof items[ ii ] === 'string' &&
						items[ ii ].trim() === '' &&
						'minItems' in model.schema &&
						ii <= model.schema.minItems
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
				for ( var ii in model.properties ) {
					var path_ = `${ path }/${ ii }`;
					items[ ii ] = await getValuesRec( path_, model.properties[ ii ] );
				}
				return items;

			default:
				return await formatValue( path, model );
		}
	}

	async function getFormModel() {
		var ret = {};
		for ( var i in Model ) {
			ret[ i ] = Model[ i ].getValue();

			if ( PagePropertiesFunctions.isPromise( ret[ i ] ) ) {
				ret[ i ] = await ret[ i ];
			}
		}
		return ret;
	}

	async function getModel( action, schemaName ) {
		Action = action;
		Flatten = {};
		Removed = [];
		Errors = {};

		var ret = {};
		switch ( action ) {
			case 'validate':
				callbackShowError( schemaName, null, [] );

				try {
					for ( var schemaName in ModelSchemas ) {
						ret[ schemaName ] = await getValuesRec(
							schemaName,
							ModelSchemas[ schemaName ]
						);
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
					ret[ schemaName ] = await getValuesRec(
						schemaName,
						ModelSchemas[ schemaName ]
					);
				}
				return ret;

			case 'submit':
				for ( var schemaName in ModelSchemas ) {
					ret[ schemaName ] = await getValuesRec(
						schemaName,
						ModelSchemas[ schemaName ]
					);
				}
				var formModel = await getFormModel();

				return {
					data: ret,
					flatten: Flatten,
					form: formModel,
					schemas: Object.keys( ModelSchemas ),
					// @FIXME or retrieve it server side
					options: Form.options
				};

			case 'validate&submit':
				Action = 'validate';
				if ( !( await getModel( 'validate' ) ) ) {
					return false;
				}
				Action = 'submit';
				return await getModel( 'submit' );

			case 'delete':
				var formModel = await getFormModel();
				Form.options.action = 'delete';
				return {
					form: formModel,
					options: Form.options,
					schemas: RecordedSchemas // Object.keys(ModelSchemas),
				};

			case 'schema':
				if ( !( schemaName in ModelSchemas ) ) {
					return false;
				}

				var ret = await getValuesRec( schemaName, ModelSchemas[ schemaName ] );
				return {
					data: ret,
					flatten: Flatten
				};
		}
	}

	return {
		getModel
	};
};
