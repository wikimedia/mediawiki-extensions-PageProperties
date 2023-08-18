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

class PagePropertiesApiFormDescriptor extends ApiBase {

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
		if ( !$user->isAllowed( 'pageproperties-canmanagesemanticproperties' )
			&& !$user->isAllowed( 'pageproperties-caneditsemanticproperties' ) ) {

			$this->dieWithError( 'apierror-pageproperties-permissions-error' );
		}
		\PageProperties::initialize();
		$result = $this->getResult();
		$params = $this->extractRequestParams();
		$output = $this->getContext()->getOutput();

		$semanticForms = explode( '|', $params['forms'] );
		$out = $this->getContext()->getOutput();
		\PageProperties::setForms( $out, $semanticForms );

		$forms = \PageProperties::$forms;

		// @see include/api/ApiResult.php -> getResultData
		// "- Boolean-valued items are changed to '' if true or removed if false"
		$convertBoolean = static function ( &$value ) {
			if ( is_bool( $value ) ) {
				$value = (int)$value;
			}
		};

		array_walk_recursive( $forms, $convertBoolean );

		$result->addValue( [ $this->getModuleName() ], 'forms', $forms );
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'forms' => [
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
			'action=pageproperties-form-descriptor'
			=> 'apihelp-pageproperties-form-descriptor-example-1'
		];
	}
}
