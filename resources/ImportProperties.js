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
 * along with PageProperties.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @file
 * @author thomas-topway-it <thomas.topway.it@mail.com>
 * @copyright Copyright © 2021-2022, https://wikisphere.org
 */

// eslint-disable-next-line no-unused-vars
const ImportProperties = ( function () {
	var Model;
	var frameA;
	var frameB;
	var myStack;
	// used to refresh datatable
	var FileContent;
	var SemanticProperties;
	var fileInputWidget;
	var processDialog;
	var booklet;
	var DialogName = 'dialogImport';
	var DialogConfirmName = 'dialogImportConfirm';
	var ModelMappedProperties;
	// used to refresh datatable heading mape
	var ParsedData;
	var pageThreeLayout;
	var processDialogConfirm;
	var actionWidget;
	var frameC;
	var toolbarA;
	var toolbarB;
	var ProcessConfig;

	// @use mw.config.get( '[global parameter name]' );
	var ThresholdCallApiPreview = 500;
	var RateCallApiPreview = 500;
	var ThresholdCallApi = 100;
	var RateCallApi = 20;
	var MaxPhpUploadSize;
	var MaxMwUploadSize;
	// var WgMaxArticleSize;
	var FieldMaxSize = 1000;

	var windowManager = new OO.ui.WindowManager( {
		classes: [ 'pageproperties-ooui-window' ]
	} );
	$( document.body ).append( windowManager.$element );

	function resetAll() {
		$( '#import-wrapper' ).empty();
		initialize( SemanticProperties );
	}

	function createToolbar() {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
			// classes: ["pageproperties-import-toolbar"],
		} );

		var onSelect = function () {
			var toolName = this.getName();
			var wordToNumber = { one: 1, two: 2, three: 3 };
			var bookletPageNumber = wordToNumber[ booklet.getCurrentPage().name ];
			// var selectedPanelName = myStack.getCurrentItem().getData().name;

			var nextPage;
			switch ( toolName ) {
				case 'goback':
					if ( bookletPageNumber === 1 ) {
						fileInputWidget.setValue();
						myStack.setItem( frameA );
					} else {
						nextPage = bookletPageNumber - 1;
						booklet.setPage(
							PagePropertiesFunctions.getKeyByValue( wordToNumber, nextPage )
						);
					}
					break;
				case 'goforward':
					nextPage = bookletPageNumber + 1;
					booklet.setPage(
						PagePropertiesFunctions.getKeyByValue( wordToNumber, nextPage )
					);
					break;
			}

			var foundToolGroup = toolbarA.getToolGroupByName( 'my-group' );
			var goforward = foundToolGroup.findItemFromData( { name: 'goforward' } );

			goforward.setDisabled( nextPage > 2 );

			this.setActive( false );
		};
		var toolGroup = [
			{
				name: 'goback',
				icon: 'arrowPrevious',
				title: mw.msg( 'pageproperties-jsmodule-import-goback' ),
				onSelect: onSelect,

				// used with 'findItemFromData'
				config: {
					data: { name: 'goback' }
				}
			},
			{
				name: 'goforward',
				icon: 'arrowNext',
				title: mw.msg( 'pageproperties-jsmodule-import-goforward' ),
				onSelect: onSelect,

				// used with 'findItemFromData'
				config: {
					data: { name: 'goforward' }
				}
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

	function pauseProcess( value ) {
		ProcessConfig.paused = value;
	}

	function createToolbarB() {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
			// classes: ["pageproperties-import-toolbar"],
		} );

		var onSelect = function () {
			var toolName = this.getName();

			var foundToolGroup = toolbarB.getToolGroupByName( 'my-group' );
			var pause = foundToolGroup.findItemFromData( { name: 'pause' } );
			var play = foundToolGroup.findItemFromData( { name: 'play' } );

			switch ( toolName ) {
				case 'upload':
					pauseProcess( true );
					resetAll();
					break;
				case 'goback':
					pauseProcess( true );
					actionWidget.popPending();
					myStack.setItem( frameB );
					break;
				case 'pause':
					pauseProcess( true );
					actionWidget.popPending();
					play.toggle( true );
					pause.toggle( false );
					break;
				case 'play':
					pauseProcess( false );
					play.toggle( false );
					pause.toggle( true );
					actionWidget.pushPending();
					callApiPromiseRun( ProcessConfig.obj, ProcessConfig.config );
					break;
			}

			this.setActive( false );
		};
		var toolGroup = [
			{
				name: 'goback', // name
				icon: 'arrowPrevious', // icon
				title: mw.msg( 'pageproperties-jsmodule-import-goback' ),
				onSelect: onSelect
			},
			{
				name: 'upload', // name
				icon: 'upload', // icon
				title: mw.msg( 'pageproperties-jsmodule-import-upload' ),
				onSelect: onSelect
			},
			{
				name: 'pause',
				icon: 'pause',
				title: mw.msg( 'pageproperties-jsmodule-import-pause' ),
				onSelect: onSelect,

				config: {
					data: { name: 'pause' }
				}
			},
			{
				name: 'play',
				icon: 'play',
				title: mw.msg( 'pageproperties-jsmodule-import-play' ),
				onSelect: onSelect,

				config: {
					data: { name: 'play' }
				}
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

	function callApi( preview ) {
		if ( actionWidget.isPending() ) {
			// eslint-disable-next-line no-console
			console.log( 'isPending' );
			return;
		}

		actionWidget.setPendingElement(
			( preview ? toolbarA : toolbarB ).$bar.find( '.wrapper' )
		);
		actionWidget.pushPending();

		var values = {};
		for ( var i in Model ) {
			values[ i.replace( /Input$/, '' ) ] = Model[ i ].getValue();
		}

		if ( preview ) {
			var threshold = ThresholdCallApiPreview;
			var rate = RateCallApiPreview;
		} else {
			var threshold = ThresholdCallApi;
			var rate = RateCallApi;
		}

		if ( ParsedData.length <= threshold ) {
			var multistep = false;
			rate = ParsedData.length;
		} else {
			var multistep = true;
		}

		ProcessConfig = {
			obj: {
				mappedProperties: ModelMappedProperties,
				values: values,
				preview: preview
			},
			config: {
				paused: false,
				preview: preview,
				// use process id, othwerwise an import process started immediataly
				// after a stopped preview process, might restart the latter
				processId: Date.now(), // milliseconds
				step: 1,
				rate: rate,
				start: 0,
				end: rate,
				multistep: multistep
			}
		};

		if ( !preview ) {
			var toolGroup = toolbarB.getToolGroupByName( 'my-group' );
			var pause = toolGroup.findItemFromData( { name: 'pause' } );
			var play = toolGroup.findItemFromData( { name: 'play' } );

			pause.toggle( ParsedData.length > threshold );
			play.toggle( false );

			myStack.setItem( frameC );
			var el = frameC.$element.find( '.pageproperties-import-saved-content' );
			el.empty();
			el.append( mw.msg( 'importstart' ) );
		}

		callApiPromiseRun( ProcessConfig.obj, ProcessConfig.config );
	}

	function callApiPromiseRun( obj, config ) {
		var slice = ParsedData.slice( config.start, config.end );

		if ( obj.preview ) {
			slice = slice.map( ( x ) => x.map( function ( y ) {
				if ( y.length <= FieldMaxSize ) {
					return y;
				}
				return y.slice( 0, Math.max( 0, FieldMaxSize ) ) + '...';
			} )
			);
		}

		callApiPromise( config, obj, slice )
			.then( callApiPromiseCallback )
			.catch( ( err ) => {
				// eslint-disable-next-line no-console
				console.error( err );
				if ( err !== 'paused' && err !== 'canceled process' ) {
					OO.ui.alert( 'unknown error', { size: 'medium' } );
				}
			} );
	}

	function createBookletPage( name, label, config ) {
		function PageLayout() {
			PageLayout.super.call( this, name, config );
			this.$element.append( config.data );
		}

		OO.inheritClass( PageLayout, OO.ui.PageLayout );
		PageLayout.prototype.setupOutlineItem = function () {
			this.outlineItem.setLabel( label );
		};

		return new PageLayout();
	}

	function callApiPromiseCallback( result ) {
		var config = result.config;
		var data = result.data;
		var obj = result.obj;
		var instance;
		var start = config.step * config.rate;
		var end = start + config.rate;
		var completed = start >= ParsedData.length;

		if ( config.preview ) {
			var contents = JSON.stringify( data, null, '\t' );

			var start_current = ( config.step - 1 ) * config.rate;
			var end_current = start_current + config.rate;
			end_current =
				end_current < ParsedData.length ? end_current : ParsedData.length;

			if ( config.step === 1 ) {
				processDialogConfirm = new ProcessDialogConfirm( {
					size: 'larger', // config.multistep ? 'larger' : 'medium',
					classes: [ 'pageproperties-import-dialog' ],
					data: { multistep: config.multistep }
				} );

				windowManager.addWindows( [ processDialogConfirm ] );

				// , {contents: contents}
				// https://www.mediawiki.org/wiki/OOUI/Windows#Opening
				instance = windowManager.openWindow( processDialogConfirm );
				var step = config.step;
				instance.opening.then( function () {
					// processDialogConfirm.booklet.toggleOutline(config.multistep);
					processDialogConfirm.booklet.addPages( [
						createBookletPage(
							'page' + step,
							start_current + 1 + '-' + end_current,
							{ data: contents }
						)
					] );
					processDialogConfirm.booklet.setPage( 'page' + step );
				} );
			} else {
				processDialogConfirm.booklet.addPages( [
					createBookletPage(
						'page' + config.step,
						start_current + 1 + '-' + end_current,
						{ data: contents }
					)
				] );
				// processDialogConfirm.booklet.setPage("page"  + result.step);
			}
		} else {
			var text = '';
			if ( config.step === 1 ) {
				text += '<ul>';
			}

			for ( var value of data.import ) {
				// @see specials/helpers/ImportReporter.php ->
				text += mw.html.element(
					'li',
					{},
					// @see resources/src/mediawiki.base/mediawiki.base.js
					new mw.html.Raw(
						mw.html.element(
							'a',
							{
								href: mw.util.getUrl( value.title ),
								target: '_blank'
							},
							// url_.getText()
							value.title
						) +
							' ' +
							'<bdi>' +
							// "import-revision-count": "$1 {{PLURAL:$1|revision|revisions}}",
							mw.msg( 'import-revision-count', [ value.revisions ] ) +
							'</bdi>' +
							( value.revisions === 0 && value.title in data.error_messages ?
								' (' + data.error_messages[ value.title ] + ')' :
								'' )
					)
				);
			}

			if ( completed ) {
				text += '</ul>';
			}

			var el = frameC.$element.find( '.pageproperties-import-saved-content' );
			var scrolledBottom =
				Math.round( el.scrollTop() + el.innerHeight() ) >= el.get( 0 ).scrollHeight;

			if ( completed ) {
				text += mw.msg( 'importsuccess' );
			}

			el.append( text );

			if ( config.step === 1 || scrolledBottom ) {
				el.scrollTop( el.get( 0 ).scrollHeight );
			}
		}

		if ( completed ) {
			if ( instance ) {
				instance.opened.then( function () {
					actionWidget.popPending();
				} );
			} else {
				actionWidget.popPending();
			}

			if ( !config.preview ) {
				var toolGroup = toolbarB.getToolGroupByName( 'my-group' );
				var pause = toolGroup.findItemFromData( { name: 'pause' } );
				var play = toolGroup.findItemFromData( { name: 'play' } );

				pause.toggle( false );
				play.toggle( false );
			}

			return;
		}

		if ( instance ) {
			// *** we don't use the following otherwise the action widgets
			// in the dialog head won't be clickable, instead we change
			// the PendingElement of the active actionWidget

			// actionWidget.popPending();
			// processDialogConfirm.pushPending();
			actionWidget.setPendingElement( processDialogConfirm.$head );
		}

		ProcessConfig = {
			obj: obj,
			config: $.extend( config, {
				start: start,
				end: end,
				step: config.step + 1
			} )
		};

		callApiPromiseRun( ProcessConfig.obj, ProcessConfig.config );
	}

	function callApiPromise( config, obj, file ) {

		// *** this shouldn't occur
		if ( ProcessConfig.config.processId !== config.processId ) {
			return new Promise( ( resolve, reject ) => {
				reject( 'canceled process' );
			} );
		}

		if ( ProcessConfig.paused ) {
			return new Promise( ( resolve, reject ) => {
				reject( 'paused' );
			} );
		}

		var payload = {
			action: 'pageproperties-manageproperties-import',
			options: JSON.stringify( obj ),
			config: JSON.stringify( config ),
			file: JSON.stringify( file ),
			format: 'json'
		};

		if ( new Blob( [ payload.file ] ).size > Math.min( MaxPhpUploadSize, MaxMwUploadSize ) ) {
			reject( mw.msg( 'pageproperties-jsmodule-import-file-upload-max-size', PagePropertiesFunctions.formatBytes( Math.min( MaxPhpUploadSize, MaxMwUploadSize ) ) ) );
		}

		// *** we use a polyfill
		// eslint-disable-next-line compat/compat
		return new Promise( ( resolve, reject ) => {
			// @todo verify that uploaded file is not spliced/reduced by the process
			// @todo ensure that each file chunk does not exceed post_max_size
			// and upload_max_filesize
			// @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/UploadWizard/+/refs/heads/master/resources/transports/mw.FormDataTransport.js
			mw.loader.using( 'mediawiki.api', function () {
				new mw.Api()
					.postWithToken( 'csrf', payload )
					.done( function ( res ) {
						if ( ProcessConfig.paused ) {
							reject( 'paused' );
						} else if ( ProcessConfig.config.processId !== config.processId ) {
							reject( 'canceled process' );
						} else if (
							'pageproperties-manageproperties-import' in res &&
							'result' in res[ 'pageproperties-manageproperties-import' ]
						) {
							resolve( {
								config: config,
								obj: obj,
								data: res[ 'pageproperties-manageproperties-import' ].result
							} );
						} else {
							reject( 'unknown error' );
						}
					} );
			} );
		} );
	}

	// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/classes/SearchWidgetDialog.js
	function ProcessDialog( config ) {
		ProcessDialog.super.call( this, config );
	}
	OO.inheritClass( ProcessDialog, OO.ui.ProcessDialog );
	ProcessDialog.static.name = DialogName;
	ProcessDialog.static.title = mw.msg(
		'pageproperties-jsmodule-import-selectproperty'
	);
	ProcessDialog.prototype.initialize = function () {
		ProcessDialog.super.prototype.initialize.apply( this, arguments );

		function getItems( value ) {
			var values = Object.keys( SemanticProperties );
			if ( value ) {
				var valueLowerCase = value.toLowerCase();
				values = values.filter(
					( x ) => x.toLowerCase().indexOf( valueLowerCase ) !== -1
				);
			}

			return values.map( ( x ) => {
				var menuOptionWidget = new OO.ui.MenuOptionWidget( {
					data: x,
					label: x
				} );
				menuOptionWidget.$element.append(
					$(
						'<span class="oo-ui-labelElement-label right">' +
							SemanticProperties[ x ].typeLabel +
							'</span>'
					)
				);
				return menuOptionWidget;
			} );
		}

		var searchWidget = new OO.ui.SearchWidget( {
			id: 'pageproperties-import-search-widget'
		} );

		searchWidget.results.addItems( getItems() );
		var self = this;

		searchWidget.getResults().on( 'press', function ( widget ) {
			if ( !widget ) {
				return;
			}

			ModelMappedProperties[ self.data.label ] = widget.data;
			createDataTableHeadingMap();

			windowManager.removeWindows( [ DialogName ] );
		} );

		searchWidget.onQueryChange = function ( value ) {
			searchWidget.results.clearItems();
			searchWidget.results.addItems( getItems( value ) );
		};

		this.$body.append( [ searchWidget.$element ] );
	};

	ProcessDialog.prototype.getBodyHeight = function () {
		return 300;
	};

	ProcessDialog.static.actions = [
		{
			// modes: "edit",
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-cancel' ),
			flags: [ 'safe', 'close' ]
		},
		{
			action: 'delete',
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-delete' ),
			flags: 'destructive'
		}
	];
	ProcessDialog.prototype.getActionProcess = function ( action ) {
		var dialog = this;

		if ( action === 'delete' ) {
			if ( dialog.data.label in ModelMappedProperties ) {
				delete ModelMappedProperties[ dialog.data.label ];
				createDataTableHeadingMap();
			}
		}

		return new OO.ui.Process( function () {
			dialog.close( { action: action } );
		} );

		// return ProcessDialog.super.prototype.getActionProcess.call( this, action );
	};
	ProcessDialog.prototype.getTeardownProcess = function ( data ) {
		return ProcessDialog.super.prototype.getTeardownProcess
			.call( this, data )
			.first( function () {
				windowManager.removeWindows( [ DialogName ] );
			}, this );
	};

	function openDialog( label ) {
		processDialog = new ProcessDialog( {
			size: 'medium',
			classes: [ 'pageproperties-import-dialog' ],
			data: { label: label }
		} );

		windowManager.addWindows( [ processDialog ] );

		windowManager.openWindow( processDialog );
	}

	// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/classes/SearchWidgetDialog.js
	function ProcessDialogConfirm( config ) {
		ProcessDialogConfirm.super.call( this, config );
	}
	OO.inheritClass( ProcessDialogConfirm, OO.ui.ProcessDialog );
	ProcessDialogConfirm.static.name = DialogConfirmName;
	ProcessDialogConfirm.static.title = mw.msg(
		'pageproperties-jsmodule-import-importpreview'
	);
	ProcessDialogConfirm.prototype.initialize = function () {
		ProcessDialogConfirm.super.prototype.initialize.apply( this, arguments );

		this.booklet = new OO.ui.BookletLayout( {
			outlined: this.data.multistep
			// expanded: false,
			// showMenu: true,
		} );

		this.$body.append( this.booklet.$element );

	};

	ProcessDialogConfirm.prototype.getBodyHeight = function () {
		// return 300;
		return window.innerHeight - 100;
	};

	ProcessDialogConfirm.static.actions = [
		{
			action: 'close',
			label: mw.msg( 'pageproperties-jsmodule-manageproperties-cancel' ),
			flags: [ 'safe', 'close' ]
		},
		{
			action: 'save',
			label: mw.msg( 'pageproperties-jsmodule-import-confirmsave' ),
			flags: [ 'progressive', 'primary' ]
		}
		/*
		{
			action: "cancel",
			label: "Cancel", //mw.msg("pageproperties-jsmodule-manageproperties-delete"),
			flags: "destructive",
		},
*/
	];
	ProcessDialogConfirm.prototype.getActionProcess = function ( action ) {
		var dialog = this;

		switch ( action ) {
			case 'save':
				/*
			// https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs#Action_sets
			return ProcessDialogConfirm.super.prototype.getActionProcess
				.call(this, action)
				.next(function () {
					// return the promise
					return callApi(dialog, false);
				});
*/
				// @todo double-check
				pauseProcess( true );
				if ( actionWidget.isPending() ) {
					actionWidget.popPending();
				}
				return new OO.ui.Process( function () {
					dialog.close( { action: action } );
				} ).next( function () {
					callApi( false );
				} );

			case 'close':
				// stop process and close dialog
				pauseProcess( true );
				if ( actionWidget.isPending() ) {
					actionWidget.popPending();
				}
				return new OO.ui.Process( function () {
					dialog.close( { action: action } );
				} );
		}

		return ProcessDialogConfirm.super.prototype.getActionProcess.call(
			this,
			action
		);
	};
	ProcessDialogConfirm.prototype.getTeardownProcess = function ( data ) {
		return ProcessDialogConfirm.super.prototype.getTeardownProcess
			.call( this, data )
			.first( function () {
				windowManager.removeWindows( [ DialogConfirmName ] );
			}, this );
	};
	/*
ProcessDialogConfirm.prototype.getSetupProcess = function ( data ) {
	data = data || {};
	return ProcessDialogConfirm.super.prototype.getSetupProcess.call( this, data )
	.next( function () {
		// Set up contents based on data
		this.textInput.setValue( data.contents );
	}, this );
};
*/

	function destroyDataTable( id ) {
		if ( !$.fn.dataTable.isDataTable( '#' + id ) ) {
			return;
		}
		var table = $( '#' + id ).DataTable();

		// *** necessary, othwerwise dataTable.on("click", "tr"
		// gets called 2 times, and openDialog() will create 2 dialogs
		table.off( 'click' );

		table.destroy();
		$( '#' + id ).empty();
	}

	function createDataTable() {
		var data = FileContent;
		var hasHeader = Model.hasHeader.getValue();

		// https://www.papaparse.com/#delimiter
		var results = Papa.parse( data, {
			delimiter: '', // auto-detect
			newline: '', // auto-detect
			quoteChar: '"',
			escapeChar: '"',
			header: false, // hasHeader,
			transformHeader: undefined,
			dynamicTyping: false,
			preview: 0,
			encoding: '',
			worker: false,
			comments: false,
			step: undefined,
			complete: undefined,
			error: undefined,
			download: false,
			downloadRequestHeaders: undefined,
			downloadRequestBody: undefined,
			skipEmptyLines: false,
			chunk: undefined,
			chunkSize: undefined,
			fastMode: undefined,
			beforeFirstChunk: undefined,
			withCredentials: undefined,
			transform: undefined,
			delimitersToGuess: [ ',', '\t', '|', ';', Papa.RECORD_SEP, Papa.UNIT_SEP ]
		} );

		ParsedData = results.data;

		destroyDataTable( 'import-datatable' );

		var header = createDataTableHeadingMap();

		$( '#import-datatable' ).DataTable( {
			// https://datatables.net/reference/option/dom
			// dom: '<"pageproperties-datatable-left"f><"pageproperties-datatable-right"l>rtip',

			data: ParsedData.slice( hasHeader ? 1 : 0 ),
			columns: header.map( ( x ) => {
				return { title: x };
			} ),
			scrollX: true
		} );
	}

	function createDataTableHeadingMap() {
		destroyDataTable( 'import-datatable-heading-map' );
		var hasHeader = Model.hasHeader.getValue();
		var fileData = ParsedData.slice();

		function getHeader() {
			if ( hasHeader ) {
				return fileData.shift();
			}

			var EA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
			var ret = [];
			for ( var i = 0; i < fileData[ 0 ].length; i++ ) {
				ret.push( EA.charAt( i ) );
			}
			return ret;
		}

		var header = getHeader();

		var data = [];
		for ( var column of header ) {
			data.push( [
				// &#8203;
				column || '',
				column in ModelMappedProperties ? ModelMappedProperties[ column ] : ''
			] );
		}

		// create dropdown options
		var options = header.map( ( x ) => {
			return { data: x, label: x };
		} );

		pageThreeLayout.pagecontentInput.setOptions( options );
		pageThreeLayout.pagenameInput.setOptions( options );

		options.unshift( {
			data: '',
			label: mw.msg( 'pageproperties-jsmodule-import-options-label-none' )
		} );

		pageThreeLayout.categoriesInput.setOptions( options );

		var dataTable = $( '#import-datatable-heading-map' ).DataTable( {
			searching: false,
			ordering: false,
			order: 1,
			lengthChange: false,
			data: data,
			columns: [
				{ title: mw.msg( 'pageproperties-jsmodule-import-imported' ) },
				{ title: mw.msg( 'pageproperties-jsmodule-import-local' ) }
			]
		} );

		dataTable.on( 'click', 'tr', function () {
			var index = dataTable.row( this ).index();
			var label = data[ index ][ 0 ];

			openDialog( label );
		} );

		return header;
	}

	function PageOneLayout( name, config ) {
		PageOneLayout.super.call( this, name, config );

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		var hasHeaderInput = new OO.ui.ToggleSwitchWidget( {
			value: false
		} );

		// eslint-disable-next-line no-unused-vars
		hasHeaderInput.on( 'change', function ( files ) {
			createDataTable();
		} );

		Model.hasHeader = hasHeaderInput;

		fieldset.addItems( [
			new OO.ui.MessageWidget( {
				type: 'notice',
				// inline: true,
				label: new OO.ui.HtmlSnippet(
					mw.msg( 'pageproperties-jsmodule-import-firststep' )
				)
			} ),

			new OO.ui.FieldLayout( hasHeaderInput, {
				label: mw.msg( 'pageproperties-jsmodule-import-hasheader' ),
				align: 'top'
			} )
		] );

		var contentFrame = new OO.ui.PanelLayout( {
			$content: [
				fieldset.$element,
				$(
					'<br /><div><table class="display" id="import-datatable" width="100%"></table></div>'
				)
			],
			expanded: false,
			padded: true
		} );

		this.$element.append( contentFrame.$element );
	}
	OO.inheritClass( PageOneLayout, OO.ui.PageLayout );
	PageOneLayout.prototype.setupOutlineItem = function () {
		this.outlineItem.setLabel( 'Page One' );
	};

	function PageTwoLayout( name, config ) {
		PageTwoLayout.super.call( this, name, config );

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		fieldset.addItems( [
			new OO.ui.MessageWidget( {
				type: 'notice',
				// inline: true,
				label: new OO.ui.HtmlSnippet(
					mw.msg( 'pageproperties-jsmodule-import-secondstep' )
				)
			} )
		] );

		var contentFrame = new OO.ui.PanelLayout( {
			$content: [
				fieldset.$element,
				$(
					'<div><table class="display" id="import-datatable-heading-map" width="100%"></table></div>'
				)
			],
			expanded: false,
			padded: true
		} );

		this.$element.append( contentFrame.$element );
	}
	OO.inheritClass( PageTwoLayout, OO.ui.PageLayout );
	PageTwoLayout.prototype.setupOutlineItem = function () {
		this.outlineItem.setLabel( 'Page Two' );
	};

	function PageThreeLayout( name, config ) {
		PageThreeLayout.super.call( this, name, config );

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		var valuesSeparatorInput = new OO.ui.ComboBoxInputWidget( {
			value: ',',
			options: [ { data: ',' }, { data: '|+sep' } ]
		} );

		Model.valuesSeparatorInput = valuesSeparatorInput;

		// //////////////////////// page content

		var selectPagecontentInput = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'field',
					label: mw.msg( 'pageproperties-jsmodule-import-fromfield' )
				},
				{
					data: 'newcontent',
					label: mw.msg( 'pageproperties-jsmodule-import-newcontent' )
				}
			]
		} );

		Model.selectPagecontentInput = selectPagecontentInput;

		this.pagecontentInput = new OO.ui.DropdownInputWidget( {} );

		Model.pagecontentInput = this.pagecontentInput;

		var fieldPagecontentDropdown = new OO.ui.FieldLayout(
			this.pagecontentInput,
			{
				// label: "Assign categories",
				align: 'top'
			}
		);

		var pagecontentNewcontentInput = new OO.ui.MultilineTextInputWidget( {
			value: '',
			autosize: true,
			rows: 2
		} );

		Model.pagecontentNewcontentInput = pagecontentNewcontentInput;

		var fieldPagecontentNewcontent = new OO.ui.FieldLayout(
			pagecontentNewcontentInput,
			{
				// label: "Formula",
				align: 'top',
				help: mw.msg( 'pageproperties-jsmodule-import-freewikitext-help' ),
				helpInline: true
			}
		);

		selectPagecontentInput.on( 'change', function ( value ) {
			fieldPagecontentDropdown.toggle( value === 'field' );
			fieldPagecontentNewcontent.toggle( value === 'newcontent' );
		} );

		// //////////////////////// categories

		var selectCategoriesInput = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'field',
					label: mw.msg( 'pageproperties-jsmodule-import-fromfield' )
				},
				{
					data: 'formula',
					label: mw.msg( 'pageproperties-jsmodule-import-formula' )
				}
			]
		} );

		Model.selectCategoriesInput = selectCategoriesInput;

		this.categoriesInput = new OO.ui.DropdownInputWidget( {} );

		Model.categoriesInput = this.categoriesInput;

		var fieldCategoriesDropdown = new OO.ui.FieldLayout( this.categoriesInput, {
			// label: "Assign categories",
			align: 'top'
		} );

		var categoriesFormulaInput = new OO.ui.TextInputWidget( {
			value: ''
		} );

		Model.categoriesFormulaInput = categoriesFormulaInput;

		var fieldCategoriesFormula = new OO.ui.FieldLayout( categoriesFormulaInput, {
			align: 'top',
			// eslint-disable-next-line max-len
			// help: 'Wikitext and parser functions allowed, mapped properties name between angular brackets will be replaced with their values for each row. A counter will be automatically appended to duplicate values. Eg. \'Flowers/<Botanic name>\' if you are importing flowers in your wiki (it assumes that the imported data contains a field with the botanic name that can be mapped to the property "Botanic name" and you want to save each entry as a subpage of the page "Flowers" ',
			// helpInline: true,
			// classes: ["pageproperties-import-dialog-input-hidden"],
			help: mw.msg( 'pageproperties-jsmodule-import-categoriesformula-help' ),
			helpInline: true
		} );

		selectCategoriesInput.on( 'change', function ( value ) {
			fieldCategoriesDropdown.toggle( value === 'field' );
			fieldCategoriesFormula.toggle( value === 'formula' );
		} );

		// //////////////////////// pagename

		var selectPagenameInput = new OO.ui.RadioSelectInputWidget( {
			options: [
				{
					data: 'field',
					label: mw.msg( 'pageproperties-jsmodule-import-fromfield' )
				},
				{
					data: 'formula',
					label: mw.msg( 'pageproperties-jsmodule-import-formula' )
				}
			]
		} );

		Model.selectPagenameInput = selectPagenameInput;

		this.pagenameInput = new OO.ui.DropdownInputWidget( {
			label: mw.msg( 'pageproperties-jsmodule-import-selectone' )
		} );

		Model.pagenameInput = this.pagenameInput;

		var fieldPagenameDropdown = new OO.ui.FieldLayout( this.pagenameInput, {
			// label: "Assign categories",
			align: 'top'
		} );

		var pagenameFormulaInput = new OO.ui.TextInputWidget( {
			value: ''
		} );

		Model.pagenameFormulaInput = pagenameFormulaInput;

		/*
		var editButtonPagename = new OO.ui.ButtonWidget({
			icon: "reload",
			flags: ["progressive"],
			invisibleLabel: true,
			label: "preview result",
		});

		editButtonPagename.on("click", function () {});
*/

		// var fieldPagenameFormula = new OO.ui.ActionFieldLayout(
		var fieldPagenameFormula = new OO.ui.FieldLayout(
			pagenameFormulaInput,
			// editButtonPagename,
			{
				// label: "Page name formula",
				align: 'top',
				// classes: ["pageproperties-import-dialog-input-hidden"],
				help: mw.msg( 'pageproperties-jsmodule-import-pagenameformula-help' ),
				helpInline: true
			}
		);

		selectPagenameInput.on( 'change', function ( value ) {
			fieldPagenameDropdown.toggle( value === 'field' );
			fieldPagenameFormula.toggle( value === 'formula' );
		} );

		fieldset.addItems( [
			new OO.ui.MessageWidget( {
				type: 'notice',
				// inline: true,
				label: new OO.ui.HtmlSnippet(
					mw.msg( 'pageproperties-jsmodule-import-thirdstep' )
				)
			} ),

			new OO.ui.FieldLayout( valuesSeparatorInput, {
				label: mw.msg( 'pageproperties-jsmodule-import-valuesseparator' ),
				align: 'top',
				help: mw.msg( 'pageproperties-jsmodule-import-valuesseparator-help' ),
				helpInline: true
			} ),

			new OO.ui.FieldLayout( selectPagecontentInput, {
				label: mw.msg( 'pageproperties-jsmodule-import-pagecontent' ),
				align: 'top'
			} ),

			fieldPagecontentDropdown,
			fieldPagecontentNewcontent,

			new OO.ui.FieldLayout( selectPagenameInput, {
				label: mw.msg( 'pageproperties-jsmodule-import-pagename' ),
				align: 'top'
			} ),

			fieldPagenameDropdown,
			fieldPagenameFormula,

			new OO.ui.FieldLayout( selectCategoriesInput, {
				label: mw.msg( 'pageproperties-jsmodule-import-assigncategories' ),
				align: 'top'
			} ),

			fieldCategoriesDropdown,
			fieldCategoriesFormula
		] );

		var contentFrame = new OO.ui.PanelLayout( {
			$content: [ fieldset.$element ],
			expanded: false,
			padded: true
		} );

		this.$element.append( contentFrame.$element );

		fieldCategoriesFormula.toggle( false );
		fieldPagenameFormula.toggle( false );
	}

	OO.inheritClass( PageThreeLayout, OO.ui.PageLayout );
	PageThreeLayout.prototype.setupOutlineItem = function () {
		this.outlineItem.setLabel( 'Page Three' );
	};

	function updateVariables( semanticProperties ) {
		SemanticProperties = semanticProperties;
	}

	// , wgMaxArticleSize
	function initialize( semanticProperties, maxPhpUploadSize, maxMwUploadSize ) {
		SemanticProperties = semanticProperties;
		MaxPhpUploadSize = maxPhpUploadSize;
		MaxMwUploadSize = maxMwUploadSize;
		// WgMaxArticleSize = wgMaxArticleSize;

		Model = {};
		ModelMappedProperties = {};

		// See documentation at:
		// https://doc.wikimedia.org/oojs-ui/master/js/#!/api/OO.ui.SelectFileWidget
		fileInputWidget = new OO.ui.SelectFileWidget( {
			// , "application/JSON"
			accept: [ 'text/csv' ],
			$tabIndexed: $(
				'<a class="oo-ui-buttonElement-button" role="button" tabindex="0" rel="nofollow"><span class="oo-ui-iconElement-icon oo-ui-icon-upload"></span><span class="oo-ui-labelElement-label">Select files</span><span class="oo-ui-indicatorElement-indicator oo-ui-indicatorElement-noIndicator"></span><input title="" class="oo-ui-inputWidget-input" type="file" tabindex="-1" accept="text/csv"></a>'
			),
			showDropTarget: true,
			multiple: false
		} );

		fileInputWidget.on( 'change', function ( files ) {
			if ( files.length ) {
				var reader = new FileReader();

				reader.onload = function ( e ) {
					FileContent = e.target.result.trim();
					ModelMappedProperties = {};
					myStack.setItem( frameB );
					createDataTable();
				};
				reader.readAsText( files[ 0 ] );
			}
		} );

		var fieldset = new OO.ui.FieldsetLayout( {
			label: ''
		} );

		fieldset.addItems( [
			new OO.ui.FieldLayout( fileInputWidget, {
				label: mw.msg( 'pageproperties-jsmodule-import-selectfile' ),
				align: 'top'
			} )
		] );

		var contentFrameA = new OO.ui.PanelLayout( {
			$content: fieldset.$element,
			expanded: false,
			padded: true
		} );

		frameA = new OO.ui.PanelLayout( {
			$content: [ contentFrameA.$element ],
			expanded: false,
			framed: true,
			data: { name: 'selectfile' }
		} );

		var page1 = new PageOneLayout( 'one' ),
			page2 = new PageTwoLayout( 'two' );

		pageThreeLayout = new PageThreeLayout( 'three' );

		booklet = new OO.ui.BookletLayout( {
			outlined: false,
			expanded: false,
			showMenu: false
		} );

		booklet.addPages( [ page1, page2, pageThreeLayout ] );

		booklet.setPage( 'one' );

		toolbarA = createToolbar();

		frameB = new OO.ui.PanelLayout( {
			$content: [ toolbarA.$element, booklet.$element ],
			expanded: false,
			framed: true,
			data: { name: 'booklet' }
		} );

		actionWidget = new OO.ui.ActionWidget( {
			label: mw.msg( 'pageproperties-jsmodule-import-previewimport' ),
			flags: [ 'primary', 'progressive' ],
			classes: [
				'oo-ui-tool',
				'oo-ui-tool-with-label',
				'pageproperties-import-toolbar-action-button'
			]
		} );

		toolbarA.$bar.wrapInner( '<div class="wrapper"></div>' );

		// eslint-disable-next-line
		// toolbar.$element.find('.oo-ui-toolbar-actions').parent().wrapInner( "<div class=\"wrapper\"></div>" );

		actionWidget.on( 'click', function () {
			callApi( true );
		} );

		toolbarA.$actions.append( actionWidget.$element );

		setTimeout( function () {
			$( '.pageproperties-import-toolbar-action-button a' ).addClass(
				'oo-ui-tool-link'
			);
		}, 50 );

		var contentFrameC = new OO.ui.PanelLayout( {
			// $content: $('<div class="pageproperties-import-saved-content"></div>'),
			// $content: mw.msg("importstart"),
			expanded: false,
			padded: true,
			classes: [ 'pageproperties-import-saved-content' ]
		} );

		toolbarB = createToolbarB();

		frameC = new OO.ui.PanelLayout( {
			$content: [ toolbarB.$element, contentFrameC.$element ],
			expanded: false,
			framed: true
		} );

		toolbarB.$bar.wrapInner( '<div class="wrapper"></div>' );

		myStack = new OO.ui.StackLayout( {
			items: [ frameA, frameB, frameC ],
			expanded: true,
			continuous: false
			// classes: ["pageproperties-stack-import"],
		} );

		$( '#import-wrapper' ).append( myStack.$element );
	}
	return {
		initialize,
		updateVariables
	};
}() );
