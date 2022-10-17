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

class PagePropertiesApiSaveCategory extends ApiBase {

	/**
	 * @inheritDoc
	 */
	public function isWriteMode() {
		return true;
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

		if ( !$user->isAllowed( 'pageproperties-caneditproperties' ) && !$user->isAllowed( 'pageproperties-canmanageproperties' ) ) {
			$this->dieWithError( 'apierror-pageproperties-permissions-error' );
		}

		\PageProperties::initialize();

		$result = $this->getResult();

		$params = $this->extractRequestParams();
		$data = json_decode( $params['data'], true );
		$dialogAction = $params['dialogAction'];
		$previousLabel = $params['previousLabel'];

		$errors = [];
		$update_properties = [];

		if ( $dialogAction === 'delete' ) {
			$title_ = Title::makeTitleSafe( NS_CATEGORY, $previousLabel );
			$wikiPage_ = \PageProperties::getWikiPage( $title_ );
			$reason = '';
			\PageProperties::deletePage( $wikiPage_, $user, $reason );

			$update_properties[$previousLabel] = null;

			// \PageProperties::bulkUpdateProperties( $user, $update_properties );

			$result->addValue( [ $this->getModuleName() ], 'result-action', 'delete' );
			$result->addValue( [ $this->getModuleName() ], 'deleted-properties', array_keys( $update_properties ) );
			return true;
		}

		$propertyTitle = Title::makeTitleSafe( NS_CATEGORY, $data['label'] );
		unset( $data['label'] );
		$label = $propertyTitle->getText();

		$resultAction = ( !empty( $previousLabel ) ? 'update' : 'create' );

		// rename
		if ( $resultAction === 'update' && $previousLabel !== $label ) {
			$title_from = Title::makeTitleSafe( NS_CATEGORY, $previousLabel );
			$title_to = $propertyTitle;
			$move_result = \PageProperties::movePage( $user, $title_from, $title_to );

			if ( !$move_result->isOK() ) {
				$errors = $move_result->getErrorsByType( 'error' );
				foreach ( $errors as $key => &$error ) {
					$error = $this->getMessage( array_merge( [ $error['message'] ], $error['params'] ) )->parse();
				}

				$result->addValue( [ $this->getModuleName() ], 'result-action', 'error' );
				$result->addValue( [ $this->getModuleName() ], 'error', $error );
				return true;
			}

			$update_properties[$previousLabel] = $label;

			// \PageProperties::bulkUpdateProperties( $user, $update_properties );

			$result->addValue( [ $this->getModuleName() ], 'label', $label );
			$result->addValue( [ $this->getModuleName() ], 'previous-label', $previousLabel );
			$resultAction = 'rename';
		}

		// update semantic properties
		$pageproperties = \PageProperties::getPageProperties( $propertyTitle );
		$pageproperties['semantic-properties'] = [];
		$typeLabels = SMW\DataTypeRegistry::getInstance()->getKnownTypeLabels();

		foreach ( $data as $key => $value ) {
			if ( empty( $value ) ) {
				continue;
			}
			$prop = new SMW\DIProperty( $key );
			$label_ = ( $prop )->getLabel();

			$pageproperties['semantic-properties'][$label_] = $value;
		}

		\PageProperties::setPageProperties( $user, $propertyTitle, $pageproperties );

		// get updated category
		// see SpecialManageProperties.php -> getCategories
		$ret[$label] = [
			'label' => $label,
			'properties' => []
		];

		foreach ( $data as $key => $value ) {
			if ( !empty( $value ) ) {
				$ret[$label]['properties'][$key][] = $value;
			}
		}

		// @todo modify and use the ApiResult -> getResultData function
		// or use the following ApiResult::META_BC_BOOLS = $bools;
		array_walk_recursive( $ret, static function ( &$value ) {
			if ( is_bool( $value ) ) {
				$value = (int)$value;
			}
		} );

		// see https://www.mediawiki.org/wiki/API:JSON_version_2
		if ( method_exists( $this->getResult(), 'setPreserveKeysList' ) ) {
			foreach ( $ret as $key => $value ) {
				$result->setPreserveKeysList( $ret[$key]['properties'], array_keys( $ret[$key]['properties'] ) );
			}
		}

		$result->addValue( [ $this->getModuleName() ], 'result-action', $resultAction );
		$result->addValue( [ $this->getModuleName() ], 'categories', $ret );
	}

	/**
	 * @see includes/htmlform/HTMLForm.php
	 * @param string $value
	 * @return Message
	 */
	protected function getMessage( $value ) {
		return Message::newFromSpecifier( $value )->setContext( $this->getContext() );
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'data' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			],
			'dialogAction' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			],
			'previousLabel' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false
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
			'action=pageproperties-manageproperties-savecategory'
			=> 'apihelp-pageproperties-manageproperties-savecategory-example-1'
		];
	}
}
