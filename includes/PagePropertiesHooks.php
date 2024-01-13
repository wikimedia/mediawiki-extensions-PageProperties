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

use MediaWiki\Extension\PageProperties\DatabaseManager as DatabaseManager;
use MediaWiki\Extension\PageProperties\SemanticMediawiki as SemanticMediawiki;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;

define( 'SLOT_ROLE_PAGEPROPERTIES', 'pageproperties' );
define( 'CONTENT_MODEL_PAGEPROPERTIES_HTML', 'html' );
define( 'CONTENT_MODEL_PAGEPROPERTIES_JSONDATA', 'pageproperties-jsondata' );

class PagePropertiesHooks {

	/**
	 * @param array $credits
	 * @return void
	 */
	public static function initExtension( $credits = [] ) {
		// see includes/specialpage/SpecialPageFactory.php

		$GLOBALS['wgSpecialPages']['PageProperties'] = [
			'class' => \SpecialPageProperties::class,
			'services' => [
				'ContentHandlerFactory',
				'ContentModelChangeFactory',
				// MW 1.36+
				( method_exists( MediaWikiServices::class, 'getWikiPageFactory' ) ? 'WikiPageFactory'
				// ***whatever other class
				: 'PermissionManager' )
			]
		];

		// *** important! otherwise Page information (action=info) will display a wrong value
		$GLOBALS['wgPageLanguageUseDB'] = true;
		$GLOBALS['wgAllowDisplayTitle'] = true;
		$GLOBALS['wgRestrictDisplayTitle'] = false;

		if ( !is_array( $GLOBALS['wgPagePropertiesEditSemanticNamespaces'] ) ) {
			$GLOBALS['wgPagePropertiesEditSemanticNamespaces'] = [ 0 ];
		}
	}

	/**
	 * @param MediaWikiServices $services
	 * @return void
	 */
	public static function onMediaWikiServices( $services ) {
		$services->addServiceManipulator( 'SlotRoleRegistry', static function ( \MediaWiki\Revision\SlotRoleRegistry $registry ) {
			if ( !$registry->isDefinedRole( SLOT_ROLE_PAGEPROPERTIES ) ) {
				$registry->defineRoleWithModel( SLOT_ROLE_PAGEPROPERTIES, CONTENT_MODEL_PAGEPROPERTIES_JSONDATA, [
					"display" => "none",
					"region" => "center",
					"placement" => "append"
				] );
			}
		} );
	}

	/**
	 * Register any render callbacks with the parser
	 *
	 * @param Parser $parser
	 */
	public static function onParserFirstCallInit( Parser $parser ) {
		$parser->setFunctionHook( 'pagepropertiesprint', [ \PageProperties::class, 'parserFunctionPagepropertiesPrint' ] );
		$parser->setFunctionHook( 'pagepropertiesquery', [ \PageProperties::class, 'parserFunctionPagepropertiesQuery' ] );
		$parser->setFunctionHook( 'pagepropertiesform', [ \PageProperties::class, 'parserFunctionPagepropertiesForm' ] );
		$parser->setFunctionHook( 'pagepropertiesbutton', [ \PageProperties::class, 'parserFunctionPagepropertiesButton' ] );
	}

	/**
	 * @see https://github.com/SemanticMediaWiki/SemanticMediaWiki/blob/master/docs/examples/hook.property.initproperties.md
	 * @param SMW\PropertyRegistry $propertyRegistry
	 * @return void
	 */
	public static function onSMWPropertyinitProperties( SMW\PropertyRegistry $propertyRegistry ) {
		$defs = [];

		foreach ( $defs as $propertyId => $definition ) {
			$propertyRegistry->registerProperty(
				$propertyId,
				$definition['type'],
				$definition['label'],
				$definition['viewable'],
				$definition['annotable']
			);

			$propertyRegistry->registerPropertyAlias(
				$propertyId,
				wfMessage( $definition['alias'] )->text()
			);

			$propertyRegistry->registerPropertyAliasByMsgKey(
				$propertyId,
				$definition['alias']
			);

		}

		return true;
	}

	/**
	 * @param Title &$title
	 * @param null $unused
	 * @param OutputPage $output
	 * @param User $user
	 * @param WebRequest $request
	 * @param MediaWiki|MediaWiki\Actions\ActionEntryPoint $mediaWiki
	 * @return void
	 */
	public static function onBeforeInitialize( \Title &$title, $unused, \OutputPage $output, \User $user, \WebRequest $request, $mediaWiki ) {
		\PageProperties::initialize();

		if ( !empty( $GLOBALS['wgPagePropertiesShowSlotsNavigation'] ) && isset( $_GET['slot'] ) ) {
			$slot = $_GET['slot'];
			$slots = \PageProperties::getSlots( $title );

			if ( is_array( $slots ) && array_key_exists( $slot, $slots ) ) {
				// set content model of active slot
				$model = $slots[ $slot ]->getModel();
				$title->setContentModel( $model );
			}
		}
	}

	/**
	 * @param Content $content
	 * @param Title $title
	 * @param int $revId
	 * @param ParserOptions $options
	 * @param bool $generateHtml
	 * @param ParserOutput &$output
	 * @return void
	 */
	public static function onContentGetParserOutput( $content, $title, $revId, $options, $generateHtml, &$output ) {
		// this should be executed before onOutputPageParserOutput
		$databaseManager = new DatabaseManager();
		$databaseManager->removeLinks( $title );

		if ( !empty( $GLOBALS['wgPagePropertiesShowSlotsNavigation'] ) && isset( $_GET['slot'] ) ) {
			$slot = $_GET['slot'];
			$slots = \PageProperties::getSlots( $title );

			$slot_content = $slots[ $slot ]->getContent();
			$contentHandler = $slot_content->getContentHandler();

			// @TODO: find a more reliable method
			if ( class_exists( 'MediaWiki\Content\Renderer\ContentParseParams' ) ) {
				// see includes/content/AbstractContent.php
				$cpoParams = new MediaWiki\Content\Renderer\ContentParseParams( $title, $revId, $options, $generateHtml );
				$contentHandler->fillParserOutputInternal( $slot_content, $cpoParams, $output );

			} else {
				// @TODO: find a more reliable method
				$output = MediaWikiServices::getInstance()->getParser()
					->parse( $slot_content->getText(), $title, $options, true, true, $revId );
			}
			// this will prevent includes/content/AbstractContent.php
			// fillParserOutput from running
			return false;
		}
	}

	/**
	 * called before onPageSaveComplete
	 * @see https://gerrit.wikimedia.org/g/mediawiki/core/+/master/includes/Storage/PageUpdater.php
	 * @param WikiPage $wikiPage
	 * @param RevisionRecord $rev
	 * @param int $originalRevId
	 * @param User $user
	 * @param array &$tags
	 * @return void
	 */
	public static function onRevisionFromEditComplete( $wikiPage, $rev, $originalRevId, $user, &$tags ) {
		// *** this shouldn't be anymore necessary, since
		// we update the slots cache *while* the new slot contents are saved
		// and we delete the cache if the update fails
		// \PageProperties::emptySlotsCache( $wikiPage->getTitle() );
	}

	/**
	 * @param WikiPage $page
	 * @param User $deleter
	 * @param string $reason
	 * @param int $pageID
	 * @param RevisionRecord $deletedRev
	 * @param ManualLogEntry $logEntry
	 * @param int $archivedRevisionCount
	 * @return void
	 */
	public static function onPageDeleteComplete( $page, $deleter, $reason, $pageID, $deletedRev, $logEntry, $archivedRevisionCount ) {
		$databaseManager = new DatabaseManager();
		$databaseManager->deletePage( $page->getTitle() );
	}

	/**
	 * @param Content $content
	 * @param Title $title
	 * @param ParserOutput &$parserOutput
	 * @return void
	 */
	public static function onContentAlterParserOutput( Content $content, Title $title, ParserOutput &$parserOutput ) {
		$jsonData = \PageProperties::getJsonData( $title );

		$categories = [];
		if ( !empty( $jsonData['categories'] ) ) {
			foreach ( $jsonData['categories'] as $category ) {
				if ( !empty( $category ) ) {
					$categories[str_replace( ' ', '_', $category )] = ( version_compare( MW_VERSION, '1.38', '<' )
						? $parserOutput->getProperty( 'defaultsort' ) : null );
				}
			}
		}
		if ( version_compare( MW_VERSION, '1.38', '<' ) ) {
			$parserOutput->mCategories = $categories;
		} else {
			$parserOutput->setCategories( $categories );
		}
		if ( \PageProperties::$SMW ) {
			SemanticMediawiki::onContentAlterParserOutput( $content, $title, $parserOutput );
		}
	}

	/**
	 * @param Parser $parser
	 * @param string &$text
	 */
	public static function onParserAfterTidy( Parser $parser, &$text ) {
		$title = $parser->getTitle();

		if ( !$title->isKnown() ) {
			return;
		}

		// @see https://datatables.net/forums/discussion/18291/use-datatables-in-mediawiki-table
		// @see https://www.mediawiki.org/wiki/Topic:Vvqpspn9lzambqp2
		// @FIXME run selectively by setting an exension data
		// \PageProperties::moveTableHeaders( $text, 'datatable' );

		if ( isset( $GLOBALS['wgPagePropertiesAddTrackingCategory'] ) ) {
			$pageProperties = \PageProperties::getPageProperties( $title );
			if ( !empty( $pageProperties ) ) {
				$parser->addTrackingCategory( 'pageproperties-tracking-category' );
			}
		}

		// if ( isset( $GLOBALS['wgPagePropertiesJsonDataTrackingCategory'] ) ) {
		// 	$jsonData = \PageProperties::getJsonData( $title );
		// 	if ( !empty( $jsonData ) ) {
		// 		$parser->addTrackingCategory( 'jsondata-tracking-category' );
		// 	}
		// }
	}

	/**
	 * @param DatabaseUpdater|null $updater
	 */
	public static function onLoadExtensionSchemaUpdates( DatabaseUpdater $updater = null ) {
		$base = __DIR__;
		$db = $updater->getDB();
		$dbType = $db->getType();

		$tables = DatabaseManager::$tables;
		$tables[] = 'pageproperties_pageproperties';

		// print_r($types);
		foreach ( $tables as $tableName ) {
			$filename = "$base/../$dbType/$tableName.sql";

			// echo $filename;
			if ( file_exists( $filename ) && !$db->tableExists( $tableName ) ) {
				$updater->addExtensionUpdate(
					[
						'addTable',
						$tableName,
						$filename,
						true
					]
				);
			}
		}

		$importer = \PageProperties::getImporter();
		$error_messages = [];

		// https://www.mediawiki.org/wiki/Help:TemplateData
		$templates = [
			'PagePropertiesForm' => \PageProperties::$PagepropertiesFormDefaultParameters,

			// printouts and printouts template are dynamic
			// so we leave for now
			// 'PagePropertiesQuery' => \PageProperties::$PagepropertiesQueryDefaultParameters,
			'PagePropertiesButton' => \PageProperties::$PagepropertiesButtonDefaultParameters,
			'PagePropertiesPrint' => \PageProperties::$PagepropertiesQueryDefaultParameters
		];

		foreach ( $templates as $pageName => $value ) {
			$text = \PageProperties::createTemplateContent( $pageName, $value );

			$contents = [
				[
					'role' => SlotRecord::MAIN,
					'model' => 'wikitext',
					'text' => $text
				]
			];

			try {
				$importer->doImportSelf( "Template:$pageName", $contents );
			} catch ( Exception $e ) {
				$error_messages["Template:$pageName"] = $e->getMessage();
			}
		}
	}

	/**
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/MultiContentSave
	 * @param RenderedRevision $renderedRevision
	 * @param UserIdentity $user
	 * @param CommentStoreComment $summary
	 * @param int $flags
	 * @param Status $hookStatus
	 * @return void
	 */
	public static function onMultiContentSave( MediaWiki\Revision\RenderedRevision $renderedRevision, MediaWiki\User\UserIdentity $user, CommentStoreComment $summary, $flags, Status $hookStatus ) {
		$revision = $renderedRevision->getRevision();
		$title = Title::newFromLinkTarget( $revision->getPageAsLinkTarget() );
		$displaytitle = \PageProperties::getDisplayTitle( $title );

		// this will store displaytitle in the page_props table
		if ( $displaytitle !== false ) {
			// getRevisionParserOutput();
			$out = $renderedRevision->getSlotParserOutput( SlotRecord::MAIN );
			if ( method_exists( $out, 'setPageProperty' ) ) {
				$out->setPageProperty( 'displaytitle', $displaytitle );
			} else {
				$out->setProperty( 'displaytitle', $displaytitle );
			}
		}
	}

	/**
	 * @param WikiPage $wikiPage
	 * @param MediaWiki\User\UserIdentity $user
	 * @param string $summary
	 * @param int $flags
	 * @param RevisionRecord $revisionRecord
	 * @param MediaWiki\Storage\EditResult $editResult
	 * @return void
	 */
	public static function onPageSaveComplete(
		WikiPage $wikiPage,
		MediaWiki\User\UserIdentity $user,
		string $summary,
		int $flags,
		RevisionRecord $revisionRecord,
		MediaWiki\Storage\EditResult $editResult
	) {
		$slots = $revisionRecord->getSlots()->getSlots();

		if ( array_key_exists( SLOT_ROLE_PAGEPROPERTIES, $slots ) ) {
			// rebuild only if restoring a revision
			$revertMethod = $editResult->getRevertMethod();
			if ( $revertMethod === null ) {
				return;
			}
			$slot = $slots[SLOT_ROLE_PAGEPROPERTIES];

		} else {
			// rebuild only if main slot contains json data
			$modelId = $revisionRecord->getSlot( SlotRecord::MAIN )->getContent()->getContentHandler()->getModelID();

			if ( $modelId !== 'json' && $modelId !== CONTENT_MODEL_PAGEPROPERTIES_JSONDATA ) {
				return;
			}

			$slot = $slots[SlotRecord::MAIN];
		}

		if ( $slot ) {
			$content = $slot->getContent();
			$title = $wikiPage->getTitle();
			$errors = [];
			\PageProperties::rebuildArticleDataFromSlot( $title, $content, $errors );
		}
	}

	/**
	 * @param Title $title
	 * @param bool $create
	 * @param string $comment
	 * @param int $oldPageId
	 * @param array $restoredPages
	 * @return bool|void
	 */
	public static function onArticleUndelete( Title $title, $create, $comment, $oldPageId, $restoredPages ) {
		$revisionRecord = \PageProperties::revisionRecordFromTitle( $title );
		$slots = $revisionRecord->getSlots()->getSlots();
		$errors = [];
		$slot = null;
		if ( array_key_exists( SLOT_ROLE_PAGEPROPERTIES, $slots ) ) {
			$slot = $slots[SLOT_ROLE_PAGEPROPERTIES];

		} else {
			// rebuild only if main slot contains json data
			$modelId = $revisionRecord->getSlot( SlotRecord::MAIN )->getContent()->getContentHandler()->getModelID();

			if ( $modelId === 'json' || $modelId === CONTENT_MODEL_PAGEPROPERTIES_JSONDATA ) {
				$slot = $slots[SlotRecord::MAIN];
			}
		}

		if ( $slot ) {
			$content = $slot->getContent();
			\PageProperties::rebuildArticleDataFromSlot( $title, $content, $errors );
		}
	}

	/**
	 * @param string &$confstr
	 * @param User $user
	 * @param array &$forOptions
	 * @return void
	 */
	public static function onPageRenderingHash( &$confstr, User $user, &$forOptions ) {
		if ( !empty( $GLOBALS['wgPagePropertiesShowSlotsNavigation'] ) && isset( $_GET['slot'] ) ) {
			$confstr .= '!' . $_GET['slot'];
		}
	}

	/**
	 * @param OutputPage $out
	 * @param ParserOutput $parserOutput
	 * @return void
	 */
	public static function onOutputPageParserOutput( OutputPage $out, ParserOutput $parserOutput ) {
		$parserOutput->addWrapperDivClass( 'pageproperties-content-model-' . $out->getTitle()->getContentModel() );

		$title = $out->getTitle();
		$databaseManager = new DatabaseManager();
		if ( $parserOutput->getExtensionData( 'pagepropertiesquery' ) !== null ) {
			$queryParams = $parserOutput->getExtensionData( 'pagepropertiesquerydata' );
			$databaseManager->storeLink( $title, 'query', $queryParams['schema'] );
		}

		if ( $parserOutput->getExtensionData( 'pagepropertiesform' ) !== null ) {
			$pageForms = $parserOutput->getExtensionData( 'pagepropertiesforms' );

			\PageProperties::addJsConfigVars( $out, [
				'pageForms' => $pageForms,
				'config' => [
					'context' => 'parserfunction',
					// 'loadedData' => [],
				]
			] );

			$out->addModules( 'ext.PageProperties.EditSemantic' );
		}

		if ( $parserOutput->getExtensionData( 'pagepropertiesbutton' ) !== null ) {
			$pageButtons = $parserOutput->getExtensionData( 'pagepropertiesbuttons' );

			foreach ( $pageButtons as $buttonID => $value ) {
				if ( !empty( $value['preload'] ) ) {
					$pageButtons[$buttonID]['data'] = \PageProperties::getPreloadData( $value['preload'] );
				}
			}

			$out->addJsConfigVars( [
				'pageproperties-pageButtons' => json_encode( $pageButtons, true ),
			] );

			$out->addModules( 'ext.PageProperties.PageButtons' );
		}
	}

	/**
	 * @param Skin $skin
	 * @param array &$bar
	 * @return void
	 */
	public static function onSkinBuildSidebar( $skin, &$bar ) {
		if ( !empty( $GLOBALS['wgPagePropertiesDisableSidebarLink'] ) ) {
			return;
		}

		$specialpage_title = SpecialPage::getTitleFor( 'EditSemantic' );
		$bar[ wfMessage( 'pageproperties' )->text() ][] = [
			'text'   => wfMessage( 'pageproperties-new-article' )->text(),
			'class'   => "pageproperties-new-article",
			'href'   => $specialpage_title->getLocalURL()
		];

		$user = $skin->getUser();

		$title = $skin->getTitle();
		$specialpage_title = SpecialPage::getTitleFor( 'PageProperties' );
		if ( strpos( $title->getFullText(), $specialpage_title->getFullText() ) === 0 ) {
			$par = str_replace( $specialpage_title->getFullText() . '/', '', $title->getFullText() );
			$title = Title::newFromText( $par, NS_MAIN );
		}
		if ( $user->isAllowed( 'pageproperties-caneditpageproperties' ) ) {
			if ( \PageProperties::isKnownArticle( $title ) ) {
				$bar[ wfMessage( 'pageproperties' )->text() ][] = [
					'text'   => wfMessage( 'pageproperties-label' )->text(),
					'href'   => $specialpage_title->getLocalURL() . '/' . wfEscapeWikiText( $title->getPrefixedURL() )
				];
			}
		}

		if ( $user->isAllowed( 'pageproperties-canmanageschemas' )
			|| $user->isAllowed( 'pageproperties-caneditschema' )
		) {
			$specialpage_title = SpecialPage::getTitleFor( 'ManageSchemas' );
			$bar[ wfMessage( 'pageproperties' )->text() ][] = [
				'text'   => wfMessage( 'manageschemas-label' )->text(),
				'href'   => $specialpage_title->getLocalURL()
			];

			// , 'forms', 'queries', 'schemas'
			$allowedItems = [ 'data' ];
			foreach ( $allowedItems as $item ) {
				$specialpage_title = SpecialPage::getTitleFor( 'PagePropertiesBrowse', ucfirst( $item ) );
				$bar[ wfMessage( 'pageproperties' )->text() ][] = [
					'text'   => wfMessage( "pagepropertiesbrowse-$item-label" )->text(),
					'href'   => $specialpage_title->getLocalURL()
				];
			}
		}
	}

	/**
	 * @param Skin $skin
	 * @param array &$sidebar
	 * @return void
	 */
	public static function onSidebarBeforeOutput( $skin, &$sidebar ) {
	}

	/**
	 * @param SkinTemplate $skinTemplate
	 * @param array &$links
	 * @return void
	 */
	public static function onSkinTemplateNavigation( SkinTemplate $skinTemplate, array &$links ) {
		$user = $skinTemplate->getUser();
		$title = $skinTemplate->getTitle();

		if ( !$title->canExist() ) {
			return;
		}

		$errors = [];
		if ( \PageProperties::checkWritePermissions( $user, $title, $errors )
			&& $user->isAllowed( 'pageproperties-caneditschemas' )
			&& !$title->isSpecialPage()
			&& in_array( $title->getNamespace(), $GLOBALS['wgPagePropertiesEditSemanticNamespaces'] )
		 ) {
			$link = [
				'class' => ( $skinTemplate->getRequest()->getVal( 'action' ) === 'editsemantic' ? 'selected' : '' ),
				'text' => wfMessage( 'pageproperties-editsemantic-label' )->text(),
				'href' => $title->getLocalURL( 'action=editsemantic' )
			];

			$keys = array_keys( $links['views'] );
			$pos = array_search( 'edit', $keys );

			$links['views'] = array_intersect_key( $links['views'], array_flip( array_slice( $keys, 0, $pos + 1 ) ) )
				+ [ 'semantic_edit' => $link ] + array_intersect_key( $links['views'], array_flip( array_slice( $keys, $pos + 1 ) ) );
		}

		if ( !empty( $GLOBALS['wgPagePropertiesDisableNavigationLink'] ) ) {
			return;
		}

		if ( !empty( $GLOBALS['wgPagePropertiesShowSlotsNavigation'] ) ) {
			$slots = \PageProperties::getSlots( $title );
			if ( $slots ) {
				$namespaces = $links['namespaces'];
				$links['namespaces'] = [];
				$selectedSlot = ( isset( $_GET['slot'] ) ? $_GET['slot'] : null );

				foreach ( $slots as $role => $slot ) {
					$selected = ( ( !$selectedSlot && $role === SlotRecord::MAIN ) || $role === $selectedSlot );

					$links['namespaces'][] = [
						'text' => ( $role === 'main' ? $namespaces[ array_key_first( $namespaces ) ]['text'] : wfMessage( 'pageproperties-slot-label-' . $role )->text() ),
						'class' => ( $selected ? 'selected' : '' ),
						'context' => 'subject',
						'exists' => 1,
						'primary' => 1,
						// @see includes/skins/SkinTemplate.php -> buildContentNavigationUrls()
						'id' => 'ca-nstab-' . $role,
						'href' => ( $role !== SlotRecord::MAIN ? wfAppendQuery( $title->getLocalURL(), 'slot=' . $role ) : $title->getLocalURL() ),
					];
				}

				foreach ( $namespaces as $value ) {
					if ( $value['context'] !== 'subject' ) {
						$links['namespaces'][] = $value;
					}
				}
			}
		}

		if ( !\PageProperties::$SMW && $title->getNamespace() === NS_CATEGORY ) {
			return;
		}

		if ( !\PageProperties::isKnownArticle( $title ) ) {
			return;
		}

		if ( $user->isAllowed( 'pageproperties-caneditpageproperties' ) ) {
			$title_ = SpecialPage::getTitleFor( 'PageProperties' );
			$links[ 'actions' ][] = [
				'text' => wfMessage( 'pageproperties-navigation' )->text(), 'href' => $title_->getLocalURL() . '/' . wfEscapeWikiText( $title->getPrefixedURL() )
			];
		}
	}

	/**
	 * @todo replace the editor for alternate slots
	 * @param EditPage $editPage
	 * @param OutputPage $output
	 * @return void
	 */
	public static function onEditPageshowEditForminitial( EditPage $editPage, OutputPage $output ) {
	}

	/**
	 * @param OutputPage $outputPage
	 * @param Skin $skin
	 * @return void
	 */
	public static function onBeforePageDisplay( OutputPage $outputPage, Skin $skin ) {
		$title = $outputPage->getTitle();

		// @TODO use resources messages and replace dynamictable.js (use OOUI widgets instead)
		$outputPage->addJsConfigVars( [
			'pageproperties-js-alert-1' => wfMessage( 'pageproperties-js-alert-1' )->text(),
			'pageproperties-js-alert-2' => wfMessage( 'pageproperties-js-alert-2' )->text()
		] );

		// @TODO use Ajax validation for page-forms
		if ( isset( $_SESSION ) && !empty( $_SESSION['pagepropertiesform-submissiondata'] ) ) {
			$outputPage->addJsConfigVars( [
				'pageproperties-submissiondata' => json_encode( $_SESSION['pagepropertiesform-submissiondata'], true ),
			] );

			if ( empty( $_POST ) ) {
				unset( $_SESSION['pagepropertiesform-submissiondata'] );
			}
		}

		$outputPage->addHeadItem( 'pageproperties_content_model', '<style>.pageproperties-content-model-text{ font-family: monospace; white-space:pre-wrap; word-wrap:break-word; }</style>' );

		// *** the rationale for this is that for background processes
		// is not a good practice to display an indicator
		// *** use instead the following $wgDefaultUserOptions['smw-prefs-general-options-show-entity-issue-panel'] = false;
		// @see https://sourceforge.net/p/semediawiki/mailman/message/58710334/

		// if ( empty( $GLOBALS['wgPagePropertiesKeepAnnoyingSMWVerticalBarLoader'] ) ) {
		// 	$outputPage->addScript( Html::inlineScript( 'var elements = document.getElementsByClassName( "smw-indicator-vertical-bar-loader" ); if ( elements.length ) { elements[0].remove(); }' ) );
		// }

		if ( $outputPage->isArticle() && \PageProperties::isKnownArticle( $title ) ) {
			if ( empty( $GLOBALS['wgPagePropertiesDisableJsonLD'] ) ) {
				\PageProperties::setJsonLD( $title, $outputPage );
			}
			\PageProperties::setMetaAndTitle( $title, $outputPage );
		}
	}

	/**
	 * @param SMWStore $store
	 * @param SemanticData $semanticData
	 * @return void
	 */
	public static function onSMWStoreBeforeDataUpdateComplete( $store, $semanticData ) {
		SemanticMediawiki::updateSemanticData( $semanticData, 'onSMWStoreBeforeDataUpdateComplete' );
	}

	/**
	 * *** open external links in a new window
	 * @param string &$url
	 * @param string &$text
	 * @param string &$link
	 * @param array &$attribs
	 * @param string $linktype
	 * @return void
	 */
	public static function onLinkerMakeExternalLink( &$url, &$text, &$link, &$attribs, $linktype ) {
		if ( !empty( $GLOBALS['wgPagePropertiesOpenExternalLinksInNewTab'] )
			&& !array_key_exists( 'target', $attribs ) ) {
			$attribs['target'] = '_blank';
		}
	}

}
