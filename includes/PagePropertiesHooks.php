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
 * @copyright Copyright ©2021-2024, https://wikisphere.org
 */

use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\SlotRecord;

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
		// @FIXME delete related-article data ?
		// we leave it to keep data in case article is restored
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

		if ( !empty( $GLOBALS['wgPagePropertiesAddTrackingCategory'] ) ) {
			$pageProperties = \PageProperties::getPageProperties( $title );
			if ( !empty( $pageProperties ) ) {
				$parser->addTrackingCategory( 'pageproperties-tracking-category' );
			}
		}
	}

	/**
	 * @param DatabaseUpdater|null $updater
	 */
	public static function onLoadExtensionSchemaUpdates( DatabaseUpdater $updater = null ) {
		$base = __DIR__;
		$db = $updater->getDB();
		$dbType = $db->getType();

		$tables = [ 'pageproperties_pageproperties' ];

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
	 * @param OutputPage $out
	 * @param ParserOutput $parserOutput
	 * @return void
	 */
	public static function onOutputPageParserOutput( OutputPage $out, ParserOutput $parserOutput ) {
		$parserOutput->addWrapperDivClass( 'pageproperties-content-model-' . $out->getTitle()->getContentModel() );
	}

	/**
	 * @param Skin $skin
	 * @param array &$sidebar
	 * @return void
	 */
	public static function onSidebarBeforeOutput( $skin, &$sidebar ) {
		if ( !empty( $GLOBALS['wgPagePropertiesDisableSidebarLink'] ) ) {
			return;
		}
		$user = $skin->getUser();
		if ( !$user->isAllowed( 'pageproperties-caneditpageproperties' ) ) {
			return;
		}
		$title = $skin->getTitle();

		// if ( $title->isSpecialPage() ) {
		//	return;
		// }
		if ( !$title || !$title->canExist() ) {
			return;
		}

		$specialpage_title = SpecialPage::getTitleFor( 'PageProperties' );
		if ( strpos( $title->getFullText(), $specialpage_title->getFullText() ) === 0 ) {
			$par = str_replace( $specialpage_title->getFullText() . '/', '', $title->getFullText() );
			$title = Title::newFromText( $par, NS_MAIN );
		}
		$sidebar['TOOLBOX'][] = [
			'text'   => wfMessage( 'pageproperties-label' )->text(),
			'href'   => $specialpage_title->getLocalURL() . '/' . wfEscapeWikiText( $title->getPrefixedURL() )
		];
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

		if ( !empty( $GLOBALS['wgPagePropertiesDisableNavigationLink'] ) ) {
			return;
		}

		if ( $title->getNamespace() === NS_CATEGORY ) {
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

		$outputPage->addHeadItem( 'pageproperties_content_model', '<style>.pageproperties-content-model-text{ font-family: monospace; white-space:pre-wrap; word-wrap:break-word; }</style>' );

		if ( $outputPage->isArticle() && \PageProperties::isKnownArticle( $title ) ) {
			if ( empty( $GLOBALS['wgPagePropertiesDisableJsonLD'] ) ) {
				\PageProperties::setJsonLD( $title, $outputPage );
			}
			\PageProperties::setMetaAndTitle( $title, $outputPage );
		}
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
