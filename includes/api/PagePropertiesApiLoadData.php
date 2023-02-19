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
 * @author thomas-topway-it <business@topway.it>
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
		$user = $this->getUser();
		if ( !$user->isAllowed( 'pageproperties-canmanagesemanticproperties' ) ) {
			$this->dieWithError( 'apierror-pageproperties-permissions-error' );
		}
		\PageProperties::initialize();
		$result = $this->getResult();
		$params = $this->extractRequestParams();

		$dataSet = explode( '|', $params['dataset'] );
		$self = $this;

		// allow properties that begin with an underscore
		// @see https://www.mediawiki.org/wiki/API:JSON_version_2
		$setPreserveKeysList = static function ( &$arr ) use ( $self, $result ) {
			if ( method_exists( $self->getResult(), 'setPreserveKeysList' ) ) {
				$result->setPreserveKeysList( $arr, array_keys( $arr ) );
			}
		};

		$ret = [];
		foreach ( $dataSet as $value ) {

			if ( $value === 'semantic-properties' ) {
				$allProperties = \PageProperties::getAllProperties();
				$semanticProperties = \PageProperties::formatSemanticProperties( $allProperties );

				if ( method_exists( $this->getResult(), 'setPreserveKeysList' ) ) {
					foreach ( $semanticProperties as $key => $value ) {
						$result->setPreserveKeysList( $semanticProperties[$key]['properties'], array_keys( $semanticProperties[$key]['properties'] ) );
					}
				}

				$ret['semanticProperties'] = $semanticProperties;

			} elseif ( $value === 'forms' ) {

				// @TODO do not retrieve forms already loaed
				$allForms = \PageProperties::getPagesWithPrefix( null, NS_PAGEPROPERTIESFORM );

				\PageProperties::setForms( array_map( static function ( $title ) {
					return $title->getText();
				}, $allForms ) );

				$ret['forms'] = \PageProperties::$forms;

			} elseif ( $value === 'categories' ) {
				$categories = \PageProperties::getCategoriesSemantic();

				if ( method_exists( $this->getResult(), 'setPreserveKeysList' ) ) {
					foreach ( $categories as $key => $value ) {
						$result->setPreserveKeysList( $categories[$key]['properties'], array_keys( $categories[$key]['properties'] ) );
					}
				}

				$ret['categories'] = $categories;

			} elseif ( $value === 'importedVocabularies' ) {
				$ret['importedVocabularies'] = \PageProperties::getImportedVocabularies();

			} elseif ( $value === 'typeLabels' ) {
				$typeLabels = SMW\DataTypeRegistry::getInstance()->getKnownTypeLabels();

				$setPreserveKeysList( $typeLabels );
				$ret['typeLabels'] = $typeLabels;

			} elseif ( $value === 'propertyLabels' ) {
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
				$setPreserveKeysList( $propertyLabels );

				$ret['propertyLabels'] = $propertyLabels;
			}

		}

		// @see include/api/ApiResult.php -> getResultData
		// "- Boolean-valued items are changed to '' if true or removed if false"
		$convertBoolean = static function ( &$value ) {
			if ( is_bool( $value ) ) {
				$value = (int)$value;
			}
		};

		foreach ( $ret as $key => $value ) {
			array_walk_recursive( $value, $convertBoolean );
			$result->addValue( [ $this->getModuleName() ], $key, $value );
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
	protected function getExamplesMessages() {
		return [
			'action=pageproperties-manageproperties-load-data'
			=> 'apihelp-pageproperties-manageproperties-load-data-example-1'
		];
	}
}
