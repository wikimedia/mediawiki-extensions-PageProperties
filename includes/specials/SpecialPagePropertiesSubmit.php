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

		$errors = [];
		$ret = $this->onFormSubmit( $this->parseFormData(), $errors );

		if ( $ret !== true ) {
			$this->setSessionData( $ret, $errors );
			header( 'Location: ' . $_GET['returnUrl'] );
		}
	}

	/**
	 * @param array $ret
	 * @param array $errors
	 * @return array
	 */
	private function setSessionData( $ret, $errors ) {
		list( $update_obj, $freetext ) = $ret;

		$pageCategories = ( !empty( $update_obj['page-properties']['categories'] ) ?
			$update_obj['page-properties']['categories'] : [] );

		$semanticProperties = $update_obj['semantic-properties'];

		// @TODO use standard Mediawiki's sessions interface
		$_SESSION['pagepropertiesform-submissiondata-' . $this->formID] = [
			'freetext' => $freetext,
			'properties' => $semanticProperties,
			'errors' => $errors,
			'pageCategories' => $pageCategories,
		];
	}

	/**
	 * @return array
	 */
	private function parseFormData() {
		$ret = [];
		// e.g. semantic-properties-input-Carbon_copy-0
		foreach ( $_POST as $key => $value ) {
			if ( strpos( $key, 'semantic-properties-input-' ) === 0 ) {
				preg_match( '/^semantic\-properties\-input\-(.+?)\-(\d+)$/', $key, $match );

				// replace underscore with space
				// https://www.php.net/manual/en/language.variables.external.php
				$ret[ urldecode( $match[1] ) ][$match[2]] = $value;
			}
		}
		return $ret;
	}

	/**
	 * @param array $data
	 * @param array $formula
	 * @return string
	 */
	private function replaceFormula( $data, $formula ) {
		preg_match_all( '/<\s*([^<>]+)\s*>/', $formula, $matches, PREG_PATTERN_ORDER );

		foreach ( $data as $property => $values ) {
			if ( in_array( $property, $matches[1] ) ) {
				$formula = preg_replace( '/\<\s*' . preg_quote( $property, '/' ) . '\s*\>/', \PageProperties::array_last( $values ), $formula );
			}
		}

		return $formula;
	}

	/**
	 * @see includes/specialpage/FormSpecialPage.php
	 * @todo split the function below in various methods
	 * @param array $data
	 * @param array &$errors
	 * @return true|array
	 */
	public function onFormSubmit( $data, &$errors ) {
		// @todo, use instead the form (expression) 'semantic-properties-freetext-', etc.
		$arr = [ '__freetext' => null, '__title' => null, '__pagename-formula' => null, '__content-model' => null ];

		foreach ( $arr as $key => $value ) {
			$arr[$key] = ( array_key_exists( $key, $data ) && count( $data[$key] ) ? $data[$key][0] : null );
		}

		$filekeys = [];
		foreach ( $data as $key => $values ) {
			if ( strpos( $key, '__filekey-' ) === 0 ) {
				$prop = substr( $key, strlen( '__filekey-' ) );

				foreach ( $values as $k => $v ) {
					if ( !empty( $v ) && !empty( $data[$prop][$k] ) ) {
						// record only the reference, to handle transformations
						// *** this is only required in conjunction with value-formula
						$filekeys[$prop][$k] = $v;
					}
				}

				unset( $data[$key] );
			}
		}

		$prefixes = [];
		foreach ( $data as $key => $values ) {
			if ( strpos( $key, '__prefix-' ) === 0 ) {
				$prop = substr( $key, strlen( '__prefix-' ) );

				foreach ( $values as $k => $v ) {
					if ( !empty( $data[$prop][$k] ) ) {
						$prefixes[$prop][$k] = $v;
					}
				}

				unset( $data[$key] );
			}
		}

		// *** when $freetext is null the main slot will not be handled
		list( $freetext, $targetTitle, $pagenameFormula, $contentModel ) = array_values( $arr );

		$semanticForms = ( $data['__semanticforms'] ?? [] );
		$categories = ( $data['__pagecategories'] ?? [] );

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
			'semantic-forms' => [],
		];

		$pageProperties = array_merge( $default_values, $pageProperties );

		unset( $data['__pagename-formula'], $data['__semanticforms'], $data['__freetext'],
			$data['__title'], $data['__pagecategories'], $data['__content-model'] );

		// untransformed data on error
		$pageProperties['semantic-properties'] = $data;

		$pageProperties['semantic-forms'] = $semanticForms;
		$pageProperties['page-properties']['categories'] = $categories;
		$update_obj = $pageProperties;

		// replacements <fieldName> to <fieldValue>
		$valueFormulas = [];
		$onCreateOnly = [];

		$output = $this->getOutput();

		\PageProperties::setForms( $output, $semanticForms );

		$forms = \PageProperties::$forms;

		foreach ( $semanticForms as $value ) {
			foreach ( $forms[$value]['fields'] as $label => $field ) {

				if ( !empty( $field['value-formula'] ) ) {
					$valueFormulas[$label][] = $field['value-formula'];
				}

				if ( array_key_exists( 'on-create-only', $field ) && (bool)$field['on-create-only'] === true ) {
					$onCreateOnly[] = $label;
				}
			}
		}

		// store untransformed properties values
		// to be used in forms
		if ( !empty( $valueFormulas ) ) {
			$update_obj['transformed-properties'] = array_intersect_key( $data, $valueFormulas );
		}

		// replace field values, without parsing wikitext yet
		foreach ( $valueFormulas as $label => $values ) {
			foreach ( $data[$label] as $key => $field ) {
				foreach ( $values as $formula ) {
					$data[$label][$key] = $this->replaceFormula( $data, $formula );
				}
			}
		}

		$editingTitle = ( $_GET['context'] === 'EditSemantic' && $this->title->isContentPage() ? $this->title : null );

		$creatingPage = !$editingTitle;

		$title = ( $editingTitle ?? Title::newFromText( $targetTitle, NS_MAIN ) );

		if ( !$title && !empty( $pagenameFormula ) ) {

			// get pagename formula with a parsed version of submitted data
			$data_ = $data;
			foreach ( $valueFormulas as $label => $values ) {
				foreach ( $data_[$label] as $key => $field ) {
					// *** or use trim(strip_tags())
					$data_[$label][$key] = Parser::stripOuterParagraph( $output->parseAsContent( $data[$label][$key] ) );
				}
			}

			$pagenameFormula = $this->replaceFormula( $data_, $pagenameFormula );

			// *** or use trim(strip_tags())
			$pagenameFormula = Parser::stripOuterParagraph( $output->parseAsContent( $pagenameFormula ) );

			$title = Title::newFromText( $pagenameFormula );
		}

		if ( !$title ) {
			$errors[] = $this->msg( "pageproperties-editsemantic-titlenotset" )->text();
			return [ $pageProperties, $freetext ];
		}

		if ( !$editingTitle && $title->isKnown() ) {
			$errors[] = $this->msg( "pageproperties-editsemantic-title-exists" )->text();
			return [ $pageProperties, $freetext ];
		}

		// now set the output with the target title
		$context = new RequestContext();
		$context->setTitle( $title );
		$output = $context->getOutput();

		// parse wikitext, with the target context title
		foreach ( $valueFormulas as $label => $values ) {
			foreach ( $data[$label] as $key => $field ) {
				// *** or use trim(strip_tags())
				$data[$label][$key] = Parser::stripOuterParagraph( $output->parseAsContent( $data[$label][$key] ) );
			}
		}

		// reassign filenames after transformations
		// *** this is only required in conjunction with value-formula
		$upload = [];
		foreach ( $filekeys as $label => $values ) {
			foreach ( $values as $key => $filekey ) {
				$upload[$filekey] = $data[$label][$key];
			}
		}

		// assign prefixes (if any) after transformations
		foreach ( $prefixes as $prop => $values ) {
			foreach ( $values as $key => $value ) {
				$data[$prop][$key] = $value . $data[$prop][$key];
			}
		}

		if ( $creatingPage ) {
			foreach ( $onCreateOnly as $field ) {
				unset( $data['semantic-properties'][$field] );
			}
		}

		$update_obj['semantic-properties'] = $data;

		// $errors is handled by reference
		$ret = \PageProperties::setPageProperties( $this->user, $title, $update_obj, $errors, $freetext, $contentModel );

		// publish stashed files
		foreach ( $upload as $filekey => $filename ) {
			// see includes/api/ApiUpload.php
			$job = new PagePropertiesPublishStashedFile( Title::makeTitle( NS_FILE, $filename ),
				[
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

		if ( !count( $errors ) ) {
			// unset( $_SESSION['pagepropertiesform-submissiondata-' . $this->formID] );
			Hooks::run( 'PageProperties::OnEditSemanticSave', [ $this->user, $title, $update_obj, $freetext, $creatingPage ] );
			header( 'Location: ' . $title->getFullURL() );
			return true;
		}

		$errors[] = $this->msg( "pageproperties-editsemantic-contentsnotsaved" )->text();
		return [ $pageProperties, $freetext ];
	}

}
