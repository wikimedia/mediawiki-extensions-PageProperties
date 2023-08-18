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

( function () {
	// @credits resources/src/mediawiki.Upload.BookletLayout/BookletLayout.js

	// eslint-disable-next-line no-implicit-globals
	PagePropertiesUpload = function ( config ) {
		// Parent constructor
		PagePropertiesUpload.parent.call( this, config );

		// this.$overlay = config.$overlay;
		// this.filekey = config.filekey;
	};

	/* Setup */

	OO.inheritClass( PagePropertiesUpload, OO.ui.BookletLayout );

	PagePropertiesUpload.prototype.initialize = function (
		selectFileWidget,
		parentWidget
	) {
		// this.clear();
		this.upload = this.createUpload();

		this.selectFileWidget = selectFileWidget;
		// this.filenameWidget = filenameWidget;
		this.parentWidget = parentWidget;
	};

	PagePropertiesUpload.prototype.createUpload = function () {
		return new mw.Upload( {
			parameters: {
				errorformat: 'html',
				errorlang: mw.config.get( 'wgUserLanguage' ),
				errorsuselocal: 1,
				formatversion: 2
			}
		} );
	};

	PagePropertiesUpload.prototype.uploadFiles = function ( files ) {
		for ( var i in files ) {
			this.uploadFile( files[ i ] );
		}
	};

	PagePropertiesUpload.prototype.uploadFile = function ( file ) {
		var deferred = $.Deferred(),
			startTime = mw.now(),
			layout = this;

		if ( this.filekey ) {
			if ( file === null ) {
				// Someone gonna get-a hurt real bad
				throw new Error(
					"filekey not passed into file select widget, which is impossible. Quitting while we're behind."
				);
			}

			// Stashed file already uploaded.
			deferred.resolve();
			this.uploadPromise = deferred;
			this.parentWidget.emit( 'fileUploaded', file );
			return deferred;
		}

		this.setFilename( file.name );

		layout.parentWidget.emit( 'fileUploadInit', file );

		this.upload.setFile( file );
		// The original file name might contain invalid characters, so use our sanitized one
		this.upload.setFilename( this.getFilename() );
		// this.upload.setFilename(  this.selectFileWidget.getValue().name );

		this.upload.upload().then(
			function ( res ) {
				deferred.resolve();
				layout.parentWidget.emit( 'fileUploadComplete', file, res );
			},
			function () {
				// These errors will be thrown while the user is on the info page.
				layout.getErrorMessageForStateDetails().then( function ( errorMessage ) {
					// eslint-disable-next-line no-console
					console.log( 'errorMessage', errorMessage );
					deferred.reject( errorMessage );
					layout.parentWidget.emit( 'fileUploadErrorMessage', file, errorMessage );
				} );
			},
			function ( progress ) {
				var elapsedTime = mw.now() - startTime,
					estimatedTotalTime = ( 1 / progress ) * elapsedTime,
					estimatedRemainingTime = moment.duration(
						estimatedTotalTime - elapsedTime
					);

				layout.parentWidget.emit(
					'fileUploadProgress',
					file,
					progress,
					estimatedRemainingTime
				);
				// console.log("fileUploadProgress", progress, estimatedRemainingTime);
			}
		);

		// cancel uploading
		deferred.fail( function ( res ) {
			// layout.setPage( 'upload' );
			layout.parentWidget.emit( 'fileUploadFail', file, res );
		} );

		return deferred;
	};

	PagePropertiesUpload.prototype.getErrorMessageForStateDetails = function () {
		var state = this.upload.getState(),
			stateDetails = this.upload.getStateDetails(),
			warnings = stateDetails.upload && stateDetails.upload.warnings,
			$ul = $( '<ul>' ),
			$error;

		if ( state === mw.Upload.State.ERROR ) {
			$error = new mw.Api().getErrorMessage( stateDetails );

			return $.Deferred().resolve(
				new OO.ui.Error( $error, { recoverable: false } )
			);
		}

		if ( state === mw.Upload.State.WARNING ) {
			// We could get more than one of these errors, these are in order
			// of importance. For example fixing the thumbnail like file name
			// won't help the fact that the file already exists.
			if ( warnings.exists !== undefined ) {
				return $.Deferred().resolve(
					new OO.ui.Error(
						$( '<p>' ).msg( 'fileexists', 'File:' + warnings.exists ),
						{ recoverable: false }
					)
				);
			} else if ( warnings[ 'exists-normalized' ] !== undefined ) {
				return $.Deferred().resolve(
					new OO.ui.Error(
						$( '<p>' ).msg( 'fileexists', 'File:' + warnings[ 'exists-normalized' ] ),
						{ recoverable: false }
					)
				);
			} else if ( warnings[ 'page-exists' ] !== undefined ) {
				return $.Deferred().resolve(
					new OO.ui.Error(
						$( '<p>' ).msg( 'filepageexists', 'File:' + warnings[ 'page-exists' ] ),
						{ recoverable: false }
					)
				);
			} else if ( Array.isArray( warnings.duplicate ) ) {
				warnings.duplicate.forEach( function ( filename ) {
					var $a = $( '<a>' ).text( filename ),
						href = mw.Title.makeTitle(
							mw.config.get( 'wgNamespaceIds' ).file,
							filename
						).getUrl( {} );

					$a.attr( { href: href, target: '_blank' } );
					$ul.append( $( '<li>' ).append( $a ) );
				} );

				return $.Deferred().resolve(
					new OO.ui.Error(
						$( '<p>' )
							.msg( 'file-exists-duplicate', warnings.duplicate.length )
							.append( $ul ),
						{ recoverable: false }
					)
				);
			} else if ( warnings[ 'thumb-name' ] !== undefined ) {
				return $.Deferred().resolve(
					new OO.ui.Error( $( '<p>' ).msg( 'filename-thumb-name' ), {
						recoverable: false
					} )
				);
			} else if ( warnings[ 'bad-prefix' ] !== undefined ) {
				return $.Deferred().resolve(
					new OO.ui.Error(
						$( '<p>' ).msg( 'filename-bad-prefix', warnings[ 'bad-prefix' ] ),
						{ recoverable: false }
					)
				);
			} else if ( warnings[ 'duplicate-archive' ] !== undefined ) {
				return $.Deferred().resolve(
					new OO.ui.Error(
						$( '<p>' ).msg(
							'file-deleted-duplicate',
							'File:' + warnings[ 'duplicate-archive' ]
						),
						{ recoverable: false }
					)
				);
			} else if ( warnings[ 'was-deleted' ] !== undefined ) {
				return $.Deferred().resolve(
					new OO.ui.Error(
						$( '<p>' ).msg( 'filewasdeleted', 'File:' + warnings[ 'was-deleted' ] ),
						{ recoverable: false }
					)
				);
			} else if ( warnings.badfilename !== undefined ) {
				// Change the name if the current name isn't acceptable
				// TODO This might not really be the best place to do this
				this.setFilename( warnings.badfilename );
				return $.Deferred().resolve(
					new OO.ui.Error( $( '<p>' ).msg( 'badfilename', warnings.badfilename ) )
				);
			} else {
				return $.Deferred().resolve(
					new OO.ui.Error(
						// Let's get all the help we can if we can't pin point the error
						$( '<p>' ).msg(
							'api-error-unknown-warning',
							JSON.stringify( stateDetails )
						),
						{ recoverable: false }
					)
				);
			}
		}
	};

	PagePropertiesUpload.prototype.renderUploadForm = function () {
		var fieldset,
			layout = this;

		this.selectFileWidget = this.getFileWidget();
		fieldset = new OO.ui.FieldsetLayout();
		fieldset.addItems( [ this.selectFileWidget ] );
		this.uploadForm = new OO.ui.FormLayout( { items: [ fieldset ] } );

		// Validation (if the SFW is for a stashed file, this never fires)
		this.selectFileWidget.on( 'change', this.onUploadFormChange.bind( this ) );

		this.selectFileWidget.on( 'change', function () {
			layout.updateFilePreview();
		} );

		return this.uploadForm;
	};

	PagePropertiesUpload.prototype.getFileWidget = function () {
		if ( this.filekey ) {
			return new mw.widgets.StashedFileWidget( {
				filekey: this.filekey
			} );
		}

		return new OO.ui.SelectFileWidget( {
			showDropTarget: true
		} );
	};

	PagePropertiesUpload.prototype.updateFilePreview = function () {
		this.selectFileWidget
			.loadAndGetImageUrl()
			.done(
				function ( url ) {
					this.filePreview.$element.find( 'p' ).remove();
					this.filePreview.$element.css( 'background-image', 'url(' + url + ')' );
					this.infoForm.$element.addClass(
						'mw-upload-bookletLayout-hasThumbnail'
					);
				}.bind( this )
			)
			.fail(
				function () {
					this.filePreview.$element.find( 'p' ).remove();
					if ( this.selectFileWidget.getValue() ) {
						this.filePreview.$element.append(
							$( '<p>' ).text( this.selectFileWidget.getValue().name )
						);
					}
					this.filePreview.$element.css( 'background-image', '' );
					this.infoForm.$element.removeClass(
						'mw-upload-bookletLayout-hasThumbnail'
					);
				}.bind( this )
			);
	};

	PagePropertiesUpload.prototype.onUploadFormChange = function () {
		this.emit( 'uploadValid', !!this.selectFileWidget.getValue() );
	};

	PagePropertiesUpload.prototype.renderInfoForm = function () {
		var fieldset;

		this.filePreview = new OO.ui.Widget( {
			classes: [ 'mw-upload-bookletLayout-filePreview' ]
		} );
		this.progressBarWidget = new OO.ui.ProgressBarWidget( {
			progress: 0
		} );
		this.filePreview.$element.append( this.progressBarWidget.$element );

		this.filenameWidget = new OO.ui.TextInputWidget( {
			indicator: 'required',
			required: true,
			validate: /.+/
		} );
		this.descriptionWidget = new OO.ui.MultilineTextInputWidget( {
			indicator: 'required',
			required: true,
			validate: /\S+/,
			autosize: true
		} );

		fieldset = new OO.ui.FieldsetLayout( {
			label: mw.msg( 'upload-form-label-infoform-title' )
		} );
		fieldset.addItems( [
			new OO.ui.FieldLayout( this.filenameWidget, {
				label: mw.msg( 'upload-form-label-infoform-name' ),
				align: 'top',
				help: mw.msg( 'upload-form-label-infoform-name-tooltip' )
			} ),
			new OO.ui.FieldLayout( this.descriptionWidget, {
				label: mw.msg( 'upload-form-label-infoform-description' ),
				align: 'top',
				help: mw.msg( 'upload-form-label-infoform-description-tooltip' )
			} )
		] );
		this.infoForm = new OO.ui.FormLayout( {
			classes: [ 'mw-upload-bookletLayout-infoForm' ],
			items: [ this.filePreview, fieldset ]
		} );

		this.on(
			'fileUploadProgress',
			function ( progress ) {
				this.progressBarWidget.setProgress( progress * 100 );
			}.bind( this )
		);

		this.filenameWidget.on( 'change', this.onInfoFormChange.bind( this ) );
		this.descriptionWidget.on( 'change', this.onInfoFormChange.bind( this ) );

		return this.infoForm;
	};

	PagePropertiesUpload.prototype.onInfoFormChange = function () {
		var layout = this;
		$.when(
			this.filenameWidget.getValidity(),
			this.descriptionWidget.getValidity()
		)
			.done( function () {
				layout.emit( 'infoValid', true );
			} )
			.fail( function () {
				layout.emit( 'infoValid', false );
			} );
	};

	PagePropertiesUpload.prototype.renderInsertForm = function () {
		var fieldset;

		this.filenameUsageWidget = new OO.ui.TextInputWidget();
		fieldset = new OO.ui.FieldsetLayout( {
			label: mw.msg( 'upload-form-label-usage-title' )
		} );
		fieldset.addItems( [
			new OO.ui.FieldLayout( this.filenameUsageWidget, {
				label: mw.msg( 'upload-form-label-usage-filename' ),
				align: 'top'
			} )
		] );
		this.insertForm = new OO.ui.FormLayout( { items: [ fieldset ] } );

		return this.insertForm;
	};

	PagePropertiesUpload.prototype.getFile = function () {
		return this.selectFileWidget.getValue();
	};

	PagePropertiesUpload.prototype.getFilename = function () {
		// var filename = this.filenameWidget.getValue();
		var filename = this.filename;
		if ( this.filenameExtension ) {
			filename += '.' + this.filenameExtension;
		}
		return filename;
	};

	PagePropertiesUpload.prototype.setFilename = function ( filename ) {
		var title = mw.Title.newFromFileName( filename );

		if ( title ) {
			// this.filenameWidget.setValue( title.getNameText() );
			this.filenameExtension = mw.Title.normalizeExtension(
				title.getExtension()
			);

			this.filename = title.getNameText();
		} else {
			// Seems to happen for files with no extension, which should fail some checks anyway...
			// this.filenameWidget.setValue( filename );
			this.filename = filename;
			this.filenameExtension = null;
		}
	};

	PagePropertiesUpload.prototype.getText = function () {
		return this.descriptionWidget.getValue();
	};

	PagePropertiesUpload.prototype.setFile = function ( file ) {
		this.selectFileWidget.setValue( [ file ] );
	};

	PagePropertiesUpload.prototype.setFilekey = function ( filekey ) {
		this.upload.setFilekey( this.filekey );
		this.selectFileWidget.setValue( filekey );

		this.onUploadFormChange();
	};

	PagePropertiesUpload.prototype.clear = function () {
		this.selectFileWidget.setValue( null );
		this.progressBarWidget.setProgress( 0 );
		this.filenameWidget.setValue( null ).setValidityFlag( true );
		this.descriptionWidget.setValue( null ).setValidityFlag( true );
		this.filenameUsageWidget.setValue( null );
	};
}() );
