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
 * @author thomas-topway-it <support@topway.it>
 * @copyright Copyright ©2021-2023, https://wikisphere.org
 */

use MediaWiki\Extension\PageProperties\SemanticMediawiki as SemanticMediawiki;

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
		$user = $this->getUser();
		if ( !$user->isAllowed( 'pageproperties-canmanageschemas' )
			&& !$user->isAllowed( 'pageproperties-canmanagesemanticproperties' ) ) {
			$this->dieWithError( 'apierror-pageproperties-permissions-error' );
		}
		\PageProperties::initialize();
		$result = $this->getResult();
		$params = $this->extractRequestParams();
		$output = $this->getContext()->getOutput();

		$dataSet = explode( '|', $params['dataset'] );

		$smwRequired = [
			'semantic-properties',
			// 'categories',
			'imported-vocabularies',
			'type-labels',
			'property-labels'
		];
		$ret = [];
		foreach ( $dataSet as $value ) {
			if ( !\PageProperties::$SMW && in_array( $value, $smwRequired ) ) {
				continue;
			}

			switch ( $value ) {
				case 'schemas':
					$schemasArr = \PageProperties::getAllSchemas();
					$schemas = \PageProperties::getSchemas( $output, $schemasArr, false );
					$ret['schemas'] = $schemas;
					break;

				case 'type-labels':
					$typeLabels = SMW\DataTypeRegistry::getInstance()->getKnownTypeLabels();
					$ret['type-labels'] = $typeLabels;
					break;

				case 'property-labels':
					$propertyList = SMW\PropertyRegistry::getInstance()->getPropertyList();

					$propertyLabels = [];
					foreach ( $propertyList as $key => $value ) {
						if ( !in_array( $key, SemanticMediawiki::$specialPropertyDefinitions ) ) {
							continue;
						}

						$property = new SMW\DIProperty( $key );
						$propertyLabels[$key] = $property->getLabel();
					}

					asort( $propertyLabels );
					$ret['property-labels'] = $propertyLabels;
					break;
			}
		}

		// @ATTENTION json_encode avoid internal mediawiki
		// transformations @see include/api/ApiResult.php -> getResultData
		foreach ( $ret as $key => $value ) {
			$result->addValue( [ $this->getModuleName() ], $key, json_encode( $value ) );
		}
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'dataset' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			]
		];
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
	protected function getExamples() {
		return false;
	}

}
