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
const PagePropertiesWindowManager = function () {
	var WindowManagers = [];
	var DialogName = 'dialog';

	function removeActiveWindow() {
		var windowManager = WindowManagers.pop();
		if ( !windowManager ) {
			return;
		}
		try {
			windowManager.removeWindows( [ DialogName ] );
		} catch ( exceptionVar ) {
		}
		windowManager.destroy();
	}

	function newWindow( processDialog, title ) {
		// we create a new window manager for each new window
		// so we can use the same static name
		var windowManager = PagePropertiesFunctions.createWindowManager();
		WindowManagers.push( windowManager );

		windowManager.addWindows( [ processDialog ] );

		if ( !title ) {
			return windowManager.openWindow( processDialog );
		}

		return windowManager.openWindow( processDialog, {
			title: title
		} );
	}

	return {
		newWindow,
		removeActiveWindow
	};
};
