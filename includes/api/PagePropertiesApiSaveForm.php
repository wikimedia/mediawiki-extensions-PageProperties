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

class PagePropertiesApiSaveForm extends ApiBase {

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
		$form = json_decode( $params['formFields'], true );
		$fields = json_decode( $params['fields'], true );
		$dialogAction = $params['dialogAction'];
		$previousLabel = $params['previousLabel'];

		if ( $dialogAction !== 'delete' && ( empty( $form['formName'] ) || !count( $fields ) ) ) {
			$this->dieWithError( 'apierror-pageproperties-permissions-error' );
		}

		$label = $form['formName'];
		unset( $form['formName'] );

		$errors = [];
		$update_properties = [];

		if ( $dialogAction === 'delete' ) {
			$title_ = Title::makeTitleSafe( NS_PAGEPROPERTIESFORM, $previousLabel );
			$wikiPage_ = \PageProperties::getWikiPage( $title_ );
			$reason = '';
			\PageProperties::deletePage( $wikiPage_, $user, $reason );

			$update_items[$previousLabel] = null;

			// \PageProperties::bulkUpdateProperties( $user, $update_properties );

			$result->addValue( [ $this->getModuleName() ], 'result-action', 'delete' );
			$result->addValue( [ $this->getModuleName() ], 'deleted-items', array_keys( $update_items ) );
			return true;
		}

		$pageTitle = Title::makeTitleSafe( NS_PAGEPROPERTIESFORM, $label );

		$label = $pageTitle->getText();

		$resultAction = ( !empty( $previousLabel ) ? 'update' : 'create' );

		// rename
		if ( $resultAction === 'update' && $previousLabel !== $label ) {
			$title_from = Title::makeTitleSafe( NS_PAGEPROPERTIESFORM, $previousLabel );
			$title_to = $pageTitle;
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

		$wikiPage = \PageProperties::getWikiPage( $pageTitle );
		$pageUpdater = $wikiPage->newPageUpdater( $user );

		$obj = [];
		foreach ( $form as $key => $value ) {
			// @todo keep false only for inheritable fields
			if ( !empty( $value ) ) {
				$obj[$key] = $value;
			}
		}

		$inheritableBooleanKeys = [ 'multiple' ];
		$types = [ 'required' => 'bool', 'help-message' => 'string', 'preferred-input' => 'string',
			 'multiple' => 'bool', 'on-create-only' => 'bool', 'value-formula' => 'string' ];
		$obj['fields'] = [];
		foreach ( $fields as $property => $values ) {
			$obj['fields'][$property] = [];
			foreach ( $values as $key => $value ) {
				if ( !empty( $value ) || in_array( $key, $inheritableBooleanKeys ) ) {
					if ( array_key_exists( $key, $types ) ) {
						settype( $value, $types[$key] );
					}
					$obj['fields'][$property][$key] = $value;
				}
			}

			// if ( !count( $obj['fields'][$property] ) ) {
			// 	unset( $obj['fields'][$property] );
			// }
		}

		$modelId = 'json';
		$slotContent = ContentHandler::makeContent( json_encode( $obj ), $pageTitle, $modelId );
		$pageUpdater->setContent( MediaWiki\Revision\SlotRecord::MAIN, $slotContent );

		$summary = '';
		$flags = EDIT_INTERNAL;
		$comment = CommentStoreComment::newUnsavedComment( $summary );
		$ret = $pageUpdater->saveRevision( $comment, $flags );

		$result->addValue( [ $this->getModuleName() ], 'result-action', $resultAction );
		$result->addValue( [ $this->getModuleName() ], 'result', $ret );

		// @todo modify and use the ApiResult -> getResultData function
		// or use the following ApiResult::META_BC_BOOLS = $bools;
		array_walk_recursive( $obj, static function ( &$value ) {
			if ( is_bool( $value ) ) {
				$value = (int)$value;
			}
		} );

		$langCode = RequestContext::getMain()->getLanguage()->getCode();
		$prop = new SMW\DIProperty( '_PDESC' );
		$dataValueFactory = SMW\DataValueFactory::getInstance();
		foreach ( $obj['fields'] as $label_ => $field ) {
			$helpMessages = [];
			if ( !empty( $field['help-message'] ) ) {
				$helpMessages = $field['help-message'];
				if ( !is_array( $helpMessages ) ) {
					$helpMessages = [ $helpMessages ];
				}
				$dataValues = [];
				foreach ( $helpMessages as $value_ ) {
					$dataValues[] = $dataValueFactory->newDataValueByProperty( $prop, $value_ );
				}
				$obj['fields'][ $label_ ][ 'help-message-result' ] = \PageProperties::getMonolingualText( $langCode, $dataValues );
			}
		}

		$result->addValue( [ $this->getModuleName() ], 'forms', [ $label => $obj ] );
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
			'formFields' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			],
			'fields' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			],
			'previousLabel' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false
			],
			'dialogAction' => [
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
			'action=pageproperties-manageproperties-saveform'
			=> 'apihelp-pageproperties-manageproperties-saveform-example-1'
		];
	}
}
