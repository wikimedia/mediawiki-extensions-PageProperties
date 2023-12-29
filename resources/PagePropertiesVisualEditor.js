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
 * @copyright Copyright © 2023, https://wikisphere.org
 */

/* eslint-disable no-tabs */
/* eslint-disable no-unused-vars */

( function () {
	// eslint-disable-next-line no-implicit-globals
	PagePropertiesVisualEditor = function ( config ) {
		config = config || {};
		if ( !( 'classes' in config ) ) {
			config.classes = [];
		}
		var self = this;
		this.config = config;

		// @FIXME only allows wikitext for now
		// this.isHtml =
		// 	"contentModel" in this.config && this.config.contentModel === "html";
		PagePropertiesVisualEditor.super.call( this, config );

		this.textarea = $( '<textarea rows="8">' )
			.attr( 'name', config.name )
			.attr( 'class', 'pageproperties toolbarOnTop' );

		this.text = this.config.value || '';
		this.textarea.val( this.text );

		this.VEInstance = $( '<span>' ).attr( 'class', 've-area-wrapper' );
		this.$element.append( this.VEInstance.append( this.textarea ) );
		this.Editor = null;
		this.initialized = false;

		setTimeout( function () {
			if ( self.$element.parent().is( ':visible' ) ) {
				self.initialize();
			}
		}, 50 );
	};

	OO.inheritClass( PagePropertiesVisualEditor, OO.ui.Widget );
	OO.mixinClass( PagePropertiesVisualEditor, OO.EventEmitter );

	// @see https://github.com/Open-CSP/FlexForm/blob/main/Modules/FlexForm.general.js
	PagePropertiesVisualEditor.prototype.initialize = async function () {
		if ( this.initialized ) {
			return;
		}
		this.destroyEditor();
		var self = this;
		self.initialized = true;
		this.loadVEForAll().then( function () {
			// if (!self.isHtml) {
			// 	return;
			// }
			// var callbackCond = function () {
			// 	return self.getEditor();
			// };
			// var callback = function (resolve, reject) {
			// 	setTimeout(function() {
			// 		self.getEditor().createWithHtmlContent(self.text);
			// 	}, 100);
			// 	resolve();
			// };
			// var callbackMaxAttempts = function (resolve, reject) {
			// 	reject();
			// };

			// PagePropertiesFunctions.waitUntil(
			// 	callbackCond,
			// 	callback,
			// 	callbackMaxAttempts,
			// 	8
			// );
		} );
	};

	// @see https://github.com/Open-CSP/FlexForm/blob/main/Modules/FlexForm.general.js
	PagePropertiesVisualEditor.prototype.loadVEForAll = async function () {
		var self = this;

		var callbackCond = function () {
			return typeof $().applyVisualEditor === 'function';
		};

		var callback = function ( resolve, reject ) {
			self.textarea.applyVisualEditor();
			resolve();
		};
		var callbackMaxAttempts = function ( resolve, reject ) {
			jQuery( document ).on( 'VEForAllLoaded', function ( e ) {
				self.textarea.applyVisualEditor();
				resolve();
			} );
		};

		return PagePropertiesFunctions.waitUntil(
			callbackCond,
			callback,
			callbackMaxAttempts,
			5
		);
	};

	PagePropertiesVisualEditor.prototype.destroyEditor = function () {
		if ( typeof $.fn.getVEInstances === 'function' ) {
			var visualEditors = $.fn.getVEInstances();
			for ( var i in visualEditors ) {
				var editor = visualEditors[ i ];
				if ( $( editor.$node ).attr( 'name' ) === this.config.name ) {
					editor.destroy();
					visualEditors.splice( i, 1 );
				}
			}
		}
	};

	// @see PageForms PF_submit.js
	PagePropertiesVisualEditor.prototype.getEditor = function () {
		if ( this.Editor ) {
			return this.Editor;
		}
		var visualEditors = $.fn.getVEInstances();
		for ( var editor of visualEditors ) {
			if ( $( editor.$node ).attr( 'name' ) === this.config.name ) {
				// eslint-disable-next-line no-return-assign
				return this.Editor = editor.target;
			}
		}
	};

	PagePropertiesVisualEditor.prototype.getValue = function () {
		var self = this;
		var editor = this.getEditor();

		if ( !this.initialized ) {
			return null;
		}

		// if (this.isHtml) {
		// 	return PagePropertiesFunctions.decodeHTMLEntities( editor.getSurface().getHtml() );
		// }

		return new Promise( ( resolve, reject ) => {
			$.when( editor.updateContent() ).then( function () {
				// @see ext.veforall.target.js
				// *** sometimes convertToWikiText is not called
				// based on focus
				editor.$node.addClass( 've-for-all-waiting-for-update' );

				resolve( self.textarea.val() );
			} );
		} );
	};
}() );
