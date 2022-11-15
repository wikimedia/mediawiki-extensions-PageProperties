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

if ( version_compare( MW_VERSION, '1.36', '>' ) ) {
	include_once __DIR__ . '/PagePropertiesImporter.php';
} else {
	include_once __DIR__ . '/PagePropertiesImporter1_35.php';
}

use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\SlotRecord;

class PagePropertiesApiImport extends ApiBase {

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

		if ( !$user->isAllowed( 'pageproperties-canmanageproperties' ) ) {
			$this->dieWithError( 'apierror-pageproperties-permissions-error' );
		}

		\PageProperties::initialize();

		$result = $this->getResult();

		$params = $this->extractRequestParams();
		$file = json_decode( $params['file'], true );
		$config = json_decode( $params['config'], true );
		$options = json_decode( $params['options'], true );

		$services = MediaWikiServices::getInstance();

		if ( version_compare( MW_VERSION, '1.36', '>' ) ) {
			// @see ServiceWiring.php -> WikiImporterFactory
			$importer = new PagePropertiesImporter(
				$services->getMainConfig(),
				$services->getHookContainer(),
				$services->getContentLanguage(),
				$services->getNamespaceInfo(),
				$services->getTitleFactory(),
				$services->getWikiPageFactory(),
				$services->getWikiRevisionUploadImporter(),
				$services->getPermissionManager(),
				$services->getContentHandlerFactory(),
				$services->getSlotRoleRegistry()
			);

		} else {
			$importer = new PagePropertiesImporter1_35( $services->getMainConfig() );
		}

/*
		@todo, implement rootpage

		if ( isset( $params['namespace'] ) ) {
			$importer->setTargetNamespace( $params['namespace'] );
		} elseif ( isset( $params['rootpage'] ) ) {
			$statusRootPage = $importer->setTargetRootPage( $params['rootpage'] );
			if ( !$statusRootPage->isGood() ) {
				$this->dieStatus( $statusRootPage );
			}
		}
*/

		if ( $config['preview'] === false ) {
			// @see includes/api/ApiImport.php
			$isUpload = true;
			$interwikisource = null;
			$summary = null;

			// *** see the contructor of specials/helpers/ImportReporter.php
			// for the methods to be cloned in PagePropertiesImporter
			$reporter = new ApiImportReporter(
				$importer,
				$isUpload,
				$interwikisource,
				$summary
			);
		}

		$context = new RequestContext();

		// @todo set explicity title if this is gonna to
		// be executed by command line
		// $context->setTitle( $title );

		$output = $context->getOutput();

		// *** attention! the heading has to be
		// retrieved from the first chunk and "duplicate_pages"
		// should persist during subsequent calls of the same
		// process !! use $_SESSION[] with the process id as key

		if ( empty( $_SESSION['pageproperties-import-data'] ) ||
			$_SESSION['pageproperties-import-data']['process-id'] !== $config['processId'] ) {

			if ( $options['values']['hasHeader'] ) {
				$heading = array_shift( $file );

			} else {
				$heading = [];
				$EA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
				$length = count( $file[0] );
				for ( $i = 0; $i < $length; $i++ ) {
					$heading[] = $EA[$i];
				}
			}

			$_SESSION['pageproperties-import-data'] = [
				'process-id' => $config['processId'],
				'duplicate_pages' => [],
				'heading' => $heading,
			];

		} else {
			$heading = $_SESSION['pageproperties-import-data']['heading'];
		}

		if ( $options['values']['selectPagename'] === 'formula' ) {
			preg_match_all( '/<\s*([^<>]+)\s*>/', $options['values']['pagenameFormula'], $pagenameMatches, PREG_PATTERN_ORDER );
		}

		if ( $options['values']['selectCategories'] === 'formula' ) {
			preg_match_all( '/<\s*([^<>]+)\s*>/', $options['values']['categoriesFormula'], $categoriesMatches, PREG_PATTERN_ORDER );
		}

		$duplicate_pages = $_SESSION['pageproperties-import-data']['duplicate_pages'];
		$invalid_titles = [];
		$skippedMsg = $this->msg( 'pageproperties-import-api-skipped' )->text();

		$ret = [
			$this->msg( 'pageproperties-import-api-totalpages' )->text() => count( $file ),
			$skippedMsg => 0
		];

		if ( $config['preview'] === true ) {
			$invalidtitlesMsg = $this->msg( 'pageproperties-import-api-invalidtitles' )->text();
			$pagesMsg = $this->msg( 'pageproperties-import-api-pages' )->text();

			$pagenameMsg = $this->msg( "pageproperties-import-api-pagename" )->text();
			$textMsg = $this->msg( "pageproperties-import-api-text" )->text();
			$categoriesMsg = $this->msg( "pageproperties-import-api-categories" )->text();
			$propertiesMsg = $this->msg( "pageproperties-import-api-properties" )->text();

			$badtitleMsg = $this->msg( "pageproperties-import-api-badtitle" )->text();

			$ret[$invalidtitlesMsg] = [];
			$ret[$pagesMsg] = [];
		}

		$error_messages = [];
		foreach ( $file as $fields ) {
			$semanticProperties = [];

			$pagename = ( $options['values']['selectPagename'] === 'field' ? '' : $options['values']['pagenameFormula'] );
			$categories = ( $options['values']['selectCategories'] === 'field' ? '' : $options['values']['categoriesFormula'] );
			$pagecontent = ( $options['values']['selectPagecontent'] === 'field' ? '' : $options['values']['pagecontentNewcontent'] );

			$n = 0;
			foreach ( $fields as $value ) {
				$mappedFieldName = ( array_key_exists( $heading[$n], $options['mappedProperties'] ) ? $options['mappedProperties'][$heading[$n]] : null );

				if ( $mappedFieldName ) {
					if ( !empty( $options['valuesSeparator'] ) && str_pos( $value, $options['valuesSeparator'] ) !== false ) {
						// $value = array_filter( array_map(static function ( $value ) {
						// 	return trim( $value );
						// }, explode( $options['valuesSeparator'], $value ) ) );

						$value = preg_split( '/\s*' . preg_quote( $options['valuesSeparator'], '/' ) . '\s*/', $value, -1, PREG_SPLIT_NO_EMPTY );

						if ( $config['preview'] === true ) {
							$value = array_map( static function ( $v ) {
								return htmlspecialchars( $v );
							}, $value );
						}

					} elseif ( $config['preview'] === true ) {
						$value = htmlspecialchars( $value );
					}

					$semanticProperties[$mappedFieldName] = $value;
				}

				if ( $options['values']['selectPagecontent'] === 'field' && $heading[$n] === $options['values']['pagecontent'] ) {
					$pagecontent = $value;
				}

				if ( $options['values']['selectPagename'] === 'field' ) {
					if ( $heading[$n] === $options['values']['pagename'] ) {
						$pagename = $value;
					}
				} else {
					if ( in_array( $heading[$n], $pagenameMatches[1] ) ) {
						$pagename = preg_replace( '/\<\s*' . $heading[$n] . '\s*\>/', $value, $pagename );

					} elseif ( $mappedFieldName && in_array( $mappedFieldName, $pagenameMatches[1] ) ) {
						$pagename = preg_replace( '/\<\s*' . $mappedFieldName . '\s*\>/', $value, $pagename );
					}
				}

				if ( $options['values']['selectCategories'] === 'field' ) {
					if ( $heading[$n] === $options['values']['categories'] ) {
						$categories = $value;
					}

				} else {
					if ( in_array( $heading[$n], $categoriesMatches[1] ) ) {
						$categories = preg_replace( '/\<\s*' . $heading[$n] . '\s*\>/', $value, $categories );

					} elseif ( $mappedFieldName && in_array( $mappedFieldName, $categoriesMatches[1] ) ) {
						$categories = preg_replace( '/\<\s*' . $mappedFieldName . ')\s*\>/', $value, $categories );
					}
				}

				$n++;
			}

			if ( $options['values']['selectPagename'] === 'formula' ) {
				// *** or use trim(strip_tags())
				$pagename = Parser::stripOuterParagraph( $output->parseAsContent( $pagename ) );
			}

			if ( $options['values']['selectCategories'] === 'formula' ) {
				// *** or use trim(strip_tags())
				$categories = Parser::stripOuterParagraph( $output->parseAsContent( $categories ) );
			}

			$categories = preg_split( "/\s*,\s*/", $categories, -1, PREG_SPLIT_NO_EMPTY );

			$properties = [
				'categories' => $categories,
				'semantic-properties' => $semanticProperties,
			];

			// https://www.mediawiki.org/wiki/Manual:Page_title#:~:text=Titles%20containing%20the%20characters%20%23,for%20MediaWiki%20it%20is%20not.
			// forbidden chars: # < > [ ] | { } _
			// $pagename = str_replace( [ '#', '<', '>', '[', ']', '|', '{', '}', '_' ], '', $pagename );

			if ( !array_key_exists( $pagename, $duplicate_pages ) ) {
				$duplicate_pages[ $pagename ] = 0;
			} else {
				$duplicate_pages[ $pagename ]++;
				$pagename = $pagename . " " . $duplicate_pages[ $pagename ];
			}

			if ( $config['preview'] === true ) {
				list( $title, $foreignTitle ) = $importer->processTitleSelf( $pagename );

				if ( !$title ) {
					$invalid_titles[] = $pagename;
				}

				$ret[$pagesMsg][] = [
					$pagenameMsg => ( $title ? $title->getFullText() : $pagename . ' ' . $badtitleMsg ),
					$textMsg => $pagecontent,
					$categoriesMsg => $categories,
					$propertiesMsg => $semanticProperties,
				];
			}

			if ( empty( $properties['categories'] ) ) {
				unset( $properties['categories'] );
			}

			if ( empty( $properties['semantic-properties'] ) ) {
				unset( $properties['semantic-properties'] );
			}

			$contents = [
				[
					'role' => SlotRecord::MAIN,
					'model' => 'wikitext',
					'text' => $pagecontent
				]
			];

			if ( !empty( $properties ) ) {
				$contents[] = [
					'role' => SLOT_ROLE_PAGEPROPERTIES,
					'model' => 'json',
					'text' => json_encode( $properties )
				];
			}

			if ( $config['preview'] === false ) {
				try {
					$importer->doImportSelf( $pagename, $contents );
				} catch ( Exception $e ) {
					$error_messages[$pagename] = $e->getMessage();
				}
			}
		}

		if ( $config['preview'] === true ) {
			if ( !count( $invalid_titles ) ) {
				unset( $ret[$invalidtitlesMsg] );
			} else {
				$ret[$invalidtitlesMsg] = $invalid_titles;
			}

			$ret[$skippedMsg] = count( $invalid_titles );

		} else {
			$ret[$skippedMsg] = count( $error_messages );
			$ret['import'] = $reporter->getData();
			$ret['error_messages'] = $error_messages;
		}

		$_SESSION['pageproperties-import-data']['duplicate_pages'] = $duplicate_pages;

		$result->addValue( [ $this->getModuleName() ], 'result', $ret );
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
			'options' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			],
			'config' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			],
			'file' => [
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
			'action=pageproperties-manageproperties-import'
			=> 'apihelp-pageproperties-manageproperties-import-example-1'
		];
	}
}
