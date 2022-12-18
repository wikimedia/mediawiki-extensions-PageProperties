<?php

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
 * @ingroup extensions
 * @author thomas-topway-it <thomas.topway.it@mail.com>
 * @copyright Copyright ©2021-2022, https://wikisphere.org
 */

class PagePropertiesEditAction extends Action {

	/**
	 * @return string lowercase
	 */
	public function getName() {
		return 'editsemantic';
	}

	/**
	 * @throws ErrorPageError
	 * @return false
	 */
	public function show() {
		$article = $this->getArticle();
		$output = $this->getOutput();
		$title = $article->getTitle();

		$specialEditProperties = new SpecialEditProperties();
		$specialEditProperties->execute( $title->getText() );

		return false;
	}

	/**
	 * @return bool
	 */
	public function execute() {
		return true;
	}

}
