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

		if ( !$user->isAllowed( 'pageproperties-canmanagesemanticproperties' ) ) {
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
		$update_items = [];

		if ( $dialogAction === 'delete' ) {
			$update_items[$previousLabel] = null;

			if ( empty( $params['confirm-job-execution'] ) ) {
				$jobsCount = $this->createJobs( $update_items, true );

				if ( $jobsCount > $GLOBALS['wgPagePropertiesCreateJobsWarningLimit'] ) {
					$result->addValue( [ $this->getModuleName() ], 'jobs-count-warning', $jobsCount );
					return true;
				}
			}

			$title_ = Title::makeTitleSafe( NS_PAGEPROPERTIESFORM, $previousLabel );
			$wikiPage_ = \PageProperties::getWikiPage( $title_ );
			$reason = '';
			\PageProperties::deletePage( $wikiPage_, $user, $reason );

			$jobsCount = $this->createJobs( $update_items );

			$result->addValue( [ $this->getModuleName() ], 'result-action', 'delete' );
			$result->addValue( [ $this->getModuleName() ], 'jobs-count', $jobsCount );
			$result->addValue( [ $this->getModuleName() ], 'deleted-items', array_keys( $update_items ) );
			return true;
		}

		$pageTitle = Title::makeTitleSafe( NS_PAGEPROPERTIESFORM, $label );

		$label = $pageTitle->getText();

		$resultAction = ( !empty( $previousLabel ) ? 'update' : 'create' );

		// rename
		if ( $resultAction === 'update' && $previousLabel !== $label ) {
			$update_items[$previousLabel] = $label;

			if ( empty( $params['confirmJobExecution'] ) ) {
				$jobsCount = $this->createJobs( $update_items, true );

				if ( $jobsCount > $GLOBALS['wgPagePropertiesCreateJobsWarningLimit'] ) {
					$result->addValue( [ $this->getModuleName() ], 'jobs-count-warning', $jobsCount );
					return true;
				}
			}

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

			$jobsCount = $this->createJobs( $update_items );

			$result->addValue( [ $this->getModuleName() ], 'label', $label );
			$result->addValue( [ $this->getModuleName() ], 'jobs-count', $jobsCount );
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
		$types = [
			'required' => 'bool',
			'label' => 'array',
			'help-message' => 'array',
			'preferred-input' => 'string',
			'multiple' => 'bool',
			'on-create-only' => 'bool',
			'value-formula' => 'string',
			'options-values' => 'array',
			'options-wikilist' => 'string',
			'options-askquery' => 'string',
			'options-printouts' => 'array',
			'askquery-subject' => 'bool',
			'options-formula' => 'string',
			'mapping-formula' => 'string',
			'options-limit' => 'int',
			'alternate-input' => 'string'
		];
		$obj['fields'] = [];

		// @TODO do some cleaning based on the preferred input

		// @see resources/ManageProperties.js
		$optionsInputs = [
			'OO.ui.DropdownInputWidget',
			'OO.ui.ComboBoxInputWidget',
			'OO.ui.MenuTagMultiselectWidget',
			'OO.ui.RadioSelectInputWidget',
			'OO.ui.CheckboxMultiselectInputWidget'
		];

		// @see resources/ManageProperties.js
		$isMultiselect = static function ( $inputName ) {
			return strpos( $inputName, 'Multiselect' ) !== false;
		};

		foreach ( $fields as $property => $values ) {
			$obj['fields'][$property] = [];

			foreach ( $values as $key => $value ) {
				if ( $value === "" ) {
					continue;
				}
				if ( !empty( $value ) || in_array( $key, $inheritableBooleanKeys ) ) {
					if ( array_key_exists( $key, $types ) ) {
						settype( $value, $types[$key] );
					}
					$obj['fields'][$property][$key] = $value;
				}
			}
		}

		$modelId = CONTENT_MODEL_PAGEPROPERTIES_SEMANTIC;
		$slotContent = ContentHandler::makeContent( json_encode( $obj ), $pageTitle, $modelId );
		$pageUpdater->setContent( MediaWiki\Revision\SlotRecord::MAIN, $slotContent );

		$summary = '';
		$flags = EDIT_INTERNAL;
		$comment = CommentStoreComment::newUnsavedComment( $summary );
		$ret = $pageUpdater->saveRevision( $comment, $flags );

		$result->addValue( [ $this->getModuleName() ], 'result-action', $resultAction );
		$result->addValue( [ $this->getModuleName() ], 'result', $ret );

		// @see include/api/ApiResult.php -> getResultData
		// "- Boolean-valued items are changed to '' if true or removed if false"
		// @todo use ApiResult::META_BC_BOOLS
		// $bools = [];
		array_walk_recursive( $obj, static function ( &$value, $key ) {
			if ( is_bool( $value ) ) {
				$value = (int)$value;
				// $bools = $key;
			}
		} );

		$context = new RequestContext();
		$output = $context->getOutput();

		$dataValueFactory = SMW\DataValueFactory::getInstance();
		$pDescProp = new SMW\DIProperty( '_PDESC' );
		$langCode = RequestContext::getMain()->getLanguage()->getCode();
		$obj['fields'] = \PageProperties::processFieldsContent( $output, $dataValueFactory, $pDescProp, $langCode, $obj['fields'] );

		// ApiResult::META_BC_BOOLS => $bools,
		$result->addValue( [ $this->getModuleName() ], 'forms', [ $label => $obj ] );
	}

	/**
	 * @param array $arr
	 * @param bool|null $evaluate
	 * @return int
	 */
	private function createJobs( $arr, $evaluate = false ) {
		$user = $this->getUser();
		$jobs = \PageProperties::updatePagesFormsJobs( $user, $arr );
		return ( $evaluate ? $jobs : \PageProperties::pushJobs( $jobs ) );
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
			],
			'confirmJobExecution' => [
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
