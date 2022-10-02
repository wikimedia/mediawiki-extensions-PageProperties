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

class PagePropertiesApiLoadData extends ApiBase {

	/**
	 * @inheritDoc
	 */
	public function isWriteMode() {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function mustBePosted(): bool {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function execute() {
		// $params = $this->extractRequestParams();
		$user = $this->getUser();

		if ( !$user->isAllowed( 'pageproperties-canmanageproperties' ) ) {
			$this->dieWithError( 'apierror-pageproperties-permissions-error' );
		}

		$result = $this->getResult();

		\PageProperties::initSMW();

		$importedVocabularies = \PageProperties::getImportedVocabularies();

		$propertyList = SMW\PropertyRegistry::getInstance()->getPropertyList();

		$propertyLabels = [];
		foreach ( $propertyList as $key => $value ) {
			if ( !in_array( $key, \PageProperties::$specialPropertyDefinitions ) ) {
				continue;
			}

			$property = new SMW\DIProperty( $key );
			$propertyLabels[$key] = $property->getLabel();
		}

		asort( $propertyLabels );

		$typeLabels = SMW\DataTypeRegistry::getInstance()->getKnownTypeLabels();

		// // https://www.mediawiki.org/wiki/API:JSON_version_2
		if ( method_exists( $this->getResult(), 'setPreserveKeysList' ) ) {
			foreach ( $typeLabels as $key => $value ) {
				$result->setPreserveKeysList( $typeLabels, array_keys( $typeLabels ) );
			}
			foreach ( $propertyLabels as $key => $value ) {
				$result->setPreserveKeysList( $propertyLabels, array_keys( $propertyLabels ) );
			}
		}

		$result->addValue( [ $this->getModuleName() ], 'importedVocabularies', $importedVocabularies );
		$result->addValue( [ $this->getModuleName() ], 'typeLabels', $typeLabels );
		$result->addValue( [ $this->getModuleName() ], 'propertyLabels', $propertyLabels );
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [];
	}

	/**
	 * @inheritDoc
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * @inheritDoc
	 */
	protected function getExamplesMessages() {
		return [
			'action=pageproperties-manageproperties-load-data'
			=> 'apihelp-pageproperties-manageproperties-load-data-example-1'
		];
	}
}
