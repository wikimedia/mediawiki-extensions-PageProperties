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

use MediaWiki\MediaWikiServices;

include_once __DIR__ . '/PagePropertiesPublishStashedFile.php';

class SpecialPagePropertiesSubmit extends SpecialPage {

	protected $user;
	protected $title;
	protected $formID;

	/** @inheritDoc */
	public function __construct() {
		$listed = false;

		// https://www.mediawiki.org/wiki/Manual:Special_pages
		parent::__construct( 'PagePropertiesSubmit', '', $listed );
	}

	/** @inheritDoc */
	public function execute( $par ) {
		$out = $this->getOutput();
		$out->setArticleRelated( false );
		$out->setRobotPolicy( $this->getRobotPolicy() );

		$user = $this->getUser();

		$this->user = $user;

		// This will throw exceptions if there's a problem
		// $this->checkExecutePermissions( $user );

		$securityLevel = $this->getLoginSecurityLevel();

		if ( $securityLevel !== false && !$this->checkLoginSecurityLevel( $securityLevel ) ) {
			$this->displayRestrictionError();
			return;
		}

		if ( !defined( 'SMW_VERSION' ) ) {
			$this->displayRestrictionError();
			return;
		}

		// NS_MAIN is ignored if $par is prefixed
		$title = Title::newFromText( $par, NS_MAIN );
		$this->title = $title;

		$request = $this->getRequest();

		$this->formID = $request->getVal( 'formID' );

		$data = $request->getVal( 'semantic-properties-model' );

		$ret = $this->onFormSubmit( $data );

		if ( $ret !== true ) {
			list( $data, $errors ) = $ret;
			$this->setSessionData( $data, $errors );
			header( 'Location: ' . $_GET['returnUrl'] );
		}
	}

	/**
	 * @param array $data
	 * @param array $errors
	 * @return array
	 */
	private function setSessionData( $data, $errors ) {
		$data['properties'] = [];

		// @TODO use standard Mediawiki's sessions interface
		$_SESSION['pagepropertiesform-submissiondata-' . $this->formID] = [
			'freetext' => $data['model']['freetext'],
			'properties' => $data['properties'],
			'forms' => $data['forms'],
			'errors' => $errors,
			'pageCategories' => $data['model']['pagecategories'],
		];
	}

	/**
	 * @param array $obj
	 * @param array|null $descriptor
	 * @return array
	 */
	private	function processValues( $obj, $descriptor = null ) {
		$ret = [];
		// labels
		foreach ( $obj as $label => $val ) {
			$values = [];

			if ( $descriptor && $descriptor['fields'][$label]['type'] !== 'property' ) {
				continue;
			}
			// fields
			foreach ( $val as $value ) {
				if ( is_array( $value['value'] ) ) {
					$values = array_merge( $values, $value['value'] );

				} else {
					$values[] = $value['value'];
				}
			}
			$ret[$label] = $values;

		}
		return $ret;
	}

	/**
	 * @param array $obj
	 * @param array $value
	 * @param string $formula
	 * @param int $i
	 * @return string
	 */
	private	function replaceFormula( $obj, $value, $formula, $i ) {
		return preg_replace_callback( '/<\s*([^<>]+)\s*>/', static function ( $matches ) use ( $obj, $value, $i ) {
			switch ( $matches[1] ) {
				case 'i':
				case 'n':
					if ( $i === null ) {
						return $matches[0];
					}
					return $i;
				case 'value':
					if ( $i === null ) {
						return $matches[0];
					}
					return $value;
				default:
					if ( array_key_exists( $matches[1], $obj ) ) {
						// @TODO add to form UI
						// $separator = '';
						// return implode( $separator, $obj[$matches[1]] );
						return $obj[$matches[1]][0];
					}

			}
		}, $formula );
	}

	/**
	 * @param array $obj
	 * @param array $descriptor
	 * @return array
	 */
	private	function applyFormulas( $obj, $descriptor ) {
		$ret = [];
		// labels
		foreach ( $obj as $label => $val ) {
			$field = $descriptor['fields'][$label];

			// replace <value>, <label>, <i>, <n> with their values
			if ( empty( $field['value-formula'] ) ) {
				$ret[$label] = $val;

			} else {
				$ret[$label] = [];

				// store original value
				if ( !array_key_exists( '__transformed-properties', $ret ) ) {
					$ret['__transformed-properties'] = [];
				}

				$ret['__transformed-properties'][$label] = [];
				foreach ( $val as $i => $value ) {
					$ret['__transformed-properties'][$label][$i] = $value;
					$ret[$label][$i] = $this->replaceFormula( $obj, $value, $field['value-formula'], $i );
				}
			}
		}
		return $ret;
	}

	/**
	 * @param Output $output
	 * @param array $obj
	 * @param array $descriptor
	 * @return array
	 */
	private	function parseWikitext( $output, $obj, $descriptor ) {
		$ret = [];
		// labels
		foreach ( $obj as $label => $val ) {
			if ( strpos( $label, '__' ) === 0 ) {
				$ret[$label] = $val;
				continue;
			}
			$field = $descriptor['fields'][$label];

			if ( empty( $field['value-formula'] ) ) {
				$ret[$label] = $val;

			} else {
				$ret[$label] = [];
				foreach ( $val as $i => $value ) {
					$ret[$label][$i] = Parser::stripOuterParagraph( $output->parseAsContent( $value ) );
				}
			}
		}
		return $ret;
	}

	/**
	 * @param string $filename
	 * @param string $filekey
	 * @param array &$errors
	 */
	private	function publishStashedFile( $filename, $filekey, &$errors ) {
		$job = new PagePropertiesPublishStashedFile( Title::makeTitle( NS_FILE, $filename ), [
			'filename' => $filename,
			'filekey' => $filekey,
			'comment' => "",
			// 'tags' => "",
			'text' => false,
			'watch' => false,
			// 'watchlistexpiry' => $watchlistExpiry,
			// 'session' => $this->getContext()->exportSession()
		] );

		if ( !$job->run() ) {
			$errors[] = $this->msg( "pageproperties-editsemantic-publishfilejoberror", $job->getLastError(), $filename )->parse();
		}
	}

	/**
	 * @param array $obj
	 * @param array $formData
	 * @param array &$errors
	 */
	private	function uploadFiles( $obj, $formData, &$errors ) {
		// @TODO handle multiple instances
		$ret = [];
		// labels
		foreach ( $obj as $label => $val ) {
			// fields
			foreach ( $val as $i => $value ) {
				if ( !empty( $formData[$label][$i]['filekey'] ) ) {
					$this->publishStashedFile( $value, $formData[$label][$i]['filekey'], $errors );
				}
			}
		}
	}

	/**
	 * @param array $obj
	 * @param array $formData
	 * @return array
	 */
	private	function applyPrefixes( $obj, $formData ) {
		// @TODO handle multiple instances
		$ret = [];

		// labels
		foreach ( $obj as $label => $val ) {
			if ( strpos( $label, '__' ) === 0 ) {
				$ret[$label] = $val;
				continue;
			}
			$ret[$label] = [];
			// ***attention! this assumes that
			// it was a multiselect
			$prefix = ( !empty( $formData[$label][0]['prefix'] ) ? $formData[$label][0]['prefix']
				: null );
			foreach ( $val as $i => $value ) {
				$ret[$label][$i] = ( $prefix === null ? $value : $prefix . $value );
			}
		}

		return $ret;
	}

	/**
	 * @see includes/specialpage/FormSpecialPage.php
	 * @todo split the function below in various methods
	 * @param array $data
	 * @return true|array
	 */
	private function onFormSubmit( $data ) {
		$data = json_decode( $data, true );
		$errors = [];
		$output = $this->getOutput();

		$forms = \PageProperties::getFormDescriptors( $output, $data );

		$model_keys = [
			'pagecategories',
			'target-title',
			'freetext',
			'content-model',
			'pagename-formula'
		];

		$model = [];
		foreach ( $model_keys as $key ) {
			$data['model'][$key] = $model[$key] = ( !empty( $data['model'][$key] ) ? $data['model'][$key] : null );
		}

		// @TODO make recursive
		$values = [];
		foreach ( $data['forms'] as $form => $value ) {
			$values[$form] = $this->processValues( $value, $forms[$form] );
		}

		foreach ( $values as $form => $value ) {
			$values[$form] = $this->applyFormulas( $value, $forms[$form] );
		}

		$pagenameFormula = null;
		if ( $model['pagename-formula'] ) {
			$form_ = $model['pagename-formula'];
		} else {
			// @TODO ...
			// get pagename formula of unique form in the page
			$form_ = array_key_first( $data['forms'] );
		}
		if ( !empty( $forms[$form_]['pagename-formula'] ) ) {
			$pagenameFormula = $this->replaceFormula( $values[$form_], null, $forms[$form_]['pagename-formula'], null );
		}

		if ( !empty( $pagenameFormula ) ) {
			$pagenameFormula = Parser::stripOuterParagraph( $output->parseAsContent( $pagenameFormula ) );
		}

		$targetTitle = $model['target-title'];

		$currentArticle = ( $_GET['context'] === 'EditSemantic' &&
			\PageProperties::isKnownArticle( $this->title ) ? $this->title : null );

		$creatingPage = !$currentArticle;

		$title = ( $currentArticle ?? Title::newFromText( $targetTitle, NS_MAIN ) );

		if ( !$title && !empty( $pagenameFormula ) ) {
			$title = Title::newFromText( $pagenameFormula );
		}

		if ( !$title ) {
			$errors[] = $this->msg( "pageproperties-editsemantic-titlenotset" )->text();
			return [ $data, $errors ];
		}

		if ( !$currentArticle && $title->isKnown() ) {
			$errors[] = $this->msg( "pageproperties-editsemantic-title-exists" )->text();
			return [ $data, $errors ];
		}

		// now set the output with the target title
		$context = new RequestContext();
		$context->setTitle( $title );
		$output = $context->getOutput();

		// @TODO remove 'on-create-only' at this point

		foreach ( $values as $form => $value ) {
			$values[$form] = $this->parseWikitext( $output, $value, $forms[$form] );
		}

		foreach ( $values as $form => $value ) {
			$this->uploadFiles( $value, $data['forms'][$form], $errors );
		}

		foreach ( $values as $form => $value ) {
			$values[$form] = $this->applyPrefixes( $value, $data['forms'][$form] );
		}

		$properties = $this->processValues( $data['properties'] );
		$this->uploadFiles( $properties, $data['properties'], $errors );
		$properties = $this->applyPrefixes( $properties, $data['properties'] );

		$update_obj = [
			'forms' => $values,
			'semantic-properties' => $properties,
		];

		$pageProperties = [];
		if ( $this->title ) {
			$pageProperties = \PageProperties::getPageProperties( $this->title );

			if ( $pageProperties === false ) {
				$pageProperties = [];
			}
		}

		$default_values = [
			'page-properties' => [],
			'semantic-properties' => [],
			'forms' => [],
		];

		unset( $pageProperties['forms'], $pageProperties['semantic-properties'] );
		$pageProperties = array_merge( $default_values, $pageProperties, $update_obj );

		$pageProperties['page-properties']['categories'] = (array)$model['pagecategories'];

		// $errors is handled by reference
		$ret = \PageProperties::setPageProperties( $this->user, $title, $pageProperties, $errors, $model['freetext'], $model['content-model'] );

		if ( !count( $errors ) ) {
			// unset( $_SESSION['pagepropertiesform-submissiondata-' . $this->formID] );
			MediaWikiServices::getInstance()->getHookContainer()->run( 'PageProperties::OnEditSemanticSave', [ $this->user, $title, $update_obj, $freetext, $creatingPage ] );
			header( 'Location: ' . $title->getFullURL() );
			return true;
		}

		$errors[] = $this->msg( "pageproperties-editsemantic-contentsnotsaved" )->text();
		return [ $data, $errors ];
	}

}
