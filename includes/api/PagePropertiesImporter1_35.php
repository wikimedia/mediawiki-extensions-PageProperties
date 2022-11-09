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

use MediaWiki\HookContainer\HookRunner;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\SlotRecord;

// @see includes/import/WikiImporter.php
// *** all the required private vars and method are copied from WikiImporter
// phpcs:ignore Squiz.Classes.ValidClassName.NotCamelCaps
class PagePropertiesImporter1_35 extends WikiImporter {
	/** @var foreignNamespaces */
	private $foreignNamespaces = null;
	/** @var mLogItemCallback */
	private $mLogItemCallback;
	/** @var mRevisionCallback */
	private $mRevisionCallback;
	/** @var mPageCallback */
	private $mPageCallback;
	/** @var mPageOutCallback */
	private $mPageOutCallback;
	/** @var mNoticeCallback */
	private $mNoticeCallback;
	/** @var mNoUpdates */
	private $mNoUpdates = false;
	/** @var Config */
	private $config;
	/** @var ImportTitleFactory */
	private $importTitleFactory;
	/** @var HookRunner */
	private $hookRunner;
	/** @var array */
	private $countableCache = [];
	/** @var bool */
	private $disableStatisticsUpdate = false;
	/** @var ExternalUserNames */
	private $externalUserNames;

	/**
	 * @param Config $config
	 */
	public function __construct( Config $config ) {
		$this->config = $config;
		$this->hookRunner = Hooks::runner();

		// Default callbacks
		$this->setPageCallback( [ $this, 'beforeImportPage' ] );
		$this->setRevisionCallback( [ $this, "importRevision" ] );
		$this->setUploadCallback( [ $this, 'importUpload' ] );
		$this->setLogItemCallback( [ $this, 'importLogItem' ] );
		$this->setPageOutCallback( [ $this, 'finishImportPage' ] );

		$this->importTitleFactory = new NaiveImportTitleFactory();
		$this->externalUserNames = new ExternalUserNames( 'imported', false );
	}

	/**
	 * @param Title $title_text
	 * @param array $contents
	 */
	public function doImportSelf( $title_text, $contents ) {
		$this->title_text = $title_text;
		$this->contents = $contents;

		$this->handlePageSelf();
	}

	/**
	 * @return string
	 */
	public function getErrorMessages() {
		return $this->errorMessages;
	}

	/**
	 * @param string $text
	 * @param string|null $ns
	 * @return array|false
	 */
	public function processTitleSelf( $text, $ns = null ) {
		return $this->processTitle( $text, $ns );
	}

	/**
	 * @throws MWException
	 */
	private function handlePageSelf() {
		// Handle page data.
		$this->debug( "Enter page handler." );
		$pageInfo = [ 'revisionCount' => 0, 'successfulRevisionCount' => 0 ];

		// Fields that can just be stuffed in the pageInfo object
		// $normalFields = [ 'title', 'ns', 'id', 'redirect', 'restrictions' ];

		$pageInfo['title'] = $this->title_text;

		$title = $this->processTitle( $pageInfo['title'], $pageInfo['ns'] ?? null );

		// $title is either an array of two titles or false.
		if ( is_array( $title ) ) {
			$this->pageCallback( $title );
			list( $pageInfo['_title'], $foreignTitle ) = $title;
		} else {
			// $badTitle = true;
			throw new MWException( "Bad title" );
		}

		if ( $title ) {
			$this->handleRevisionSelf( $pageInfo );
		}

		// @note $pageInfo is only set if a valid $title is processed above with
		//       no error. If we have a valid $title, then pageCallback is called
		//       above, $pageInfo['title'] is set and we do pageOutCallback here.
		//       If $pageInfo['_title'] is not set, then $foreignTitle is also not
		//       set since they both come from $title above.
		if ( array_key_exists( '_title', $pageInfo ) ) {
			/** @var Title $title */
			$title = $pageInfo['_title'];
			$this->pageOutCallback(
				$title,
				$foreignTitle,
				$pageInfo['revisionCount'],
				$pageInfo['successfulRevisionCount'],
				$pageInfo
			);
		}
	}

	/**
	 * @param array &$pageInfo
	 */
	private function handleRevisionSelf( &$pageInfo ) {
		$this->debug( "Enter revision handler" );
		$revisionInfo = [];

		// $normalFields = [ 'id', 'parentid', 'timestamp', 'comment', 'minor', 'origin',
		// 	'model', 'format', 'text', 'sha1' ];

		// $revisionInfo['contributor'] = $this->handleContributor();
		$revisionInfo = [
			'content' => $this->contents
		];

		$pageInfo['revisionCount']++;
		if ( $this->processRevisionSelf( $pageInfo, $revisionInfo ) ) {
			$pageInfo['successfulRevisionCount']++;
		}
	}

	//////////////////////// required methods ///////////////////

	/**
	 * @inheritDoc
	 */
	public function setNoticeCallback( $callback ) {
		return wfSetVar( $this->mNoticeCallback, $callback );
	}

	/**
	 * @inheritDoc
	 */
	public function pageCallback( $title ) {
		if ( isset( $this->mPageCallback ) ) {
			call_user_func( $this->mPageCallback, $title );
		}
	}

	/**
	 * @inheritDoc
	 */
	public function setPageCallback( $callback ) {
		$previous = $this->mPageCallback;
		$this->mPageCallback = $callback;
		return $previous;
	}

	/**
	 * @inheritDoc
	 */
	public function setPageOutCallback( $callback ) {
		$previous = $this->mPageOutCallback;
		$this->mPageOutCallback = $callback;
		return $previous;
	}

	/**
	 * @inheritDoc
	 */
	public function setRevisionCallback( $callback ) {
		$previous = $this->mRevisionCallback;
		$this->mRevisionCallback = $callback;
		return $previous;
	}

	/**
	 * @inheritDoc
	 */
	public function setLogItemCallback( $callback ) {
		$previous = $this->mLogItemCallback;
		$this->mLogItemCallback = $callback;
		return $previous;
	}

	/**
	 * @inheritDoc
	 */
	public function beforeImportPage( $titleAndForeignTitle ) {
		$title = $titleAndForeignTitle[0];
		$page = WikiPage::factory( $title );
		$this->countableCache['title_' . $title->getPrefixedText()] = $page->isCountable();
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function finishImportPage( $title, $foreignTitle, $revCount,
		$sRevCount, $pageInfo
	) {
		// Update article count statistics (T42009)
		// The normal counting logic in WikiPage->doEditUpdates() is designed for
		// one-revision-at-a-time editing, not bulk imports. In this situation it
		// suffers from issues of replica DB lag. We let WikiPage handle the total page
		// and revision count, and we implement our own custom logic for the
		// article (content page) count.
		if ( !$this->disableStatisticsUpdate ) {
			$page = WikiPage::factory( $title );
			$page->loadPageData( 'fromdbmaster' );
			$content = $page->getContent();
			if ( $content === null ) {
				wfDebug( __METHOD__ . ': Skipping article count adjustment for ' . $title .
					' because WikiPage::getContent() returned null' );
			} else {
				$editInfo = $page->prepareContentForEdit( $content );
				$countKey = 'title_' . $title->getPrefixedText();
				$countable = $page->isCountable( $editInfo );
				if ( array_key_exists( $countKey, $this->countableCache ) &&
					$countable != $this->countableCache[$countKey] ) {
					DeferredUpdates::addUpdate( SiteStatsUpdate::factory( [
						'articles' => ( (int)$countable - (int)$this->countableCache[$countKey] )
					] ) );
				}
			}
		}

		return $this->hookRunner->onAfterImportPage( $title, $foreignTitle,
			$revCount, $sRevCount, $pageInfo );
	}

	/**
	 * @inheritDoc
	 */
	private function pageOutCallback( $title, $foreignTitle, $revCount,
			$sucCount, $pageInfo ) {
		if ( isset( $this->mPageOutCallback ) ) {
			call_user_func_array( $this->mPageOutCallback, func_get_args() );
		}
	}

	/**
	 * @inheritDoc
	 */
	private function revisionCallback( $revision ) {
		if ( isset( $this->mRevisionCallback ) ) {
			return call_user_func_array( $this->mRevisionCallback,
					[ $revision, $this ] );
		} else {
			return false;
		}
	}

	/**
	 * @inheritDoc
	 */
	private function makeContent( Title $title, $revisionId, $contentInfo ) {
		global $wgMaxArticleSize;

		// ***edited
		// main content can be null
		// if ( !isset( $contentInfo['text'] ) ) {
		// 	throw new MWException( 'Missing text field in import.' );
		// }

		// Make sure revisions won't violate $wgMaxArticleSize, which could lead to
		// database errors and instability. Testing for revisions with only listed
		// content models, as other content models might use serialization formats
		// which aren't checked against $wgMaxArticleSize.
		if ( ( !isset( $contentInfo['model'] ) ||
				in_array( $contentInfo['model'], [
					'wikitext',
					'css',
					'json',
					'javascript',
					'text',
					''
				] ) ) &&
			strlen( $contentInfo['text'] ) > $wgMaxArticleSize * 1024
		) {
			throw new MWException( 'The text of ' .
				( $revisionId ?
					"the revision with ID $revisionId" :
					'a revision'
				) . " exceeds the maximum allowable size ($wgMaxArticleSize KB)" );
		}

		$role = $contentInfo['role'] ?? SlotRecord::MAIN;
		$model = $contentInfo['model'] ?? $this->getDefaultContentModel( $title, $role );
		$handler = $this->getContentHandler( $model );

		$text = $handler->importTransform( $contentInfo['text'] );

		$content = $handler->unserializeContent( $text );

		return $content;
	}

	/**
	 * @param array $pageInfo
	 * @param array $revisionInfo
	 * @throws MWException
	 * @return bool|mixed
	 */
	private function processRevisionSelf( $pageInfo, $revisionInfo ) {
		$revision = new WikiRevision( $this->config );

		$revId = $revisionInfo['id'] ?? 0;
		if ( $revId ) {
			$revision->setID( $revisionInfo['id'] );
		}

		$title = $pageInfo['_title'];
		$revision->setTitle( $title );

		// ***edited
		// $content = $this->makeContent( $title, $revId, $revisionInfo );
		// $revision->setContent( SlotRecord::MAIN, $content );

		foreach ( $revisionInfo['content'] ?? [] as $slotInfo ) {
			if ( !isset( $slotInfo['role'] ) ) {
				throw new MWException( "Missing role for imported slot." );
			}

			$content = $this->makeContent( $title, $revId, $slotInfo );
			$revision->setContent( $slotInfo['role'], $content );
		}
		$revision->setTimestamp( $revisionInfo['timestamp'] ?? wfTimestampNow() );

		if ( isset( $revisionInfo['comment'] ) ) {
			$revision->setComment( $revisionInfo['comment'] );
		}

		if ( isset( $revisionInfo['minor'] ) ) {
			$revision->setMinor( true );
		}

/*
		if ( isset( $revisionInfo['contributor']['ip'] ) ) {
			$revision->setUserIP( $revisionInfo['contributor']['ip'] );
		} elseif ( isset( $revisionInfo['contributor']['username'] ) ) {
			$revision->setUsername(
				$this->externalUserNames->applyPrefix( $revisionInfo['contributor']['username'] )
			);
		} else {
			$revision->setUsername( $this->externalUserNames->addPrefix( 'Unknown user' ) );
		}
*/
		if ( isset( $revisionInfo['sha1'] ) ) {
			$revision->setSha1Base36( $revisionInfo['sha1'] );
		}
		$revision->setNoUpdates( $this->mNoUpdates );

		return $this->revisionCallback( $revision );
	}

	/**
	 * @inheritDoc
	 */
	private function processTitle( $text, $ns = null ) {
		if ( $this->foreignNamespaces === null ) {
			$foreignTitleFactory = new NaiveForeignTitleFactory();
		} else {
			$foreignTitleFactory = new NamespaceAwareForeignTitleFactory(
				$this->foreignNamespaces );
		}

		$foreignTitle = $foreignTitleFactory->createForeignTitle( $text,
			intval( $ns ) );

		$title = $this->importTitleFactory->createTitleFromForeignTitle(
			$foreignTitle );

		$commandLineMode = $this->config->get( 'CommandLineMode' );
		if ( $title === null ) {
			# Invalid page title? Ignore the page
			$this->notice( 'import-error-invalid', $foreignTitle->getFullText() );
			return false;
		} elseif ( $title->isExternal() ) {
			$this->notice( 'import-error-interwiki', $title->getPrefixedText() );
			return false;
		} elseif ( !$title->canExist() ) {
			$this->notice( 'import-error-special', $title->getPrefixedText() );
			return false;
		} elseif ( !$commandLineMode ) {
			$permissionManager = MediaWikiServices::getInstance()->getPermissionManager();
			$user = RequestContext::getMain()->getUser();

			if ( !$permissionManager->userCan( 'edit', $user, $title ) ) {
				# Do not import if the importing wiki user cannot edit this page
				$this->notice( 'import-error-edit', $title->getPrefixedText() );

				return false;
			}

			if ( !$title->exists() && !$permissionManager->userCan( 'create', $user, $title ) ) {
				# Do not import if the importing wiki user cannot create this page
				$this->notice( 'import-error-create', $title->getPrefixedText() );

				return false;
			}
		}

		return [ $title, $foreignTitle ];
	}

	/**
	 * @inheritDoc
	 */
	private function getContentHandler( $model ) {
		return MediaWikiServices::getInstance()
			->getContentHandlerFactory()
			->getContentHandler( $model );
	}

	/**
	 * @inheritDoc
	 */
	private function getDefaultContentModel( $title, $role ) {
		return MediaWikiServices::getInstance()
			->getSlotRoleRegistry()
			->getRoleHandler( $role )
			->getDefaultModel( $title );
	}
}
