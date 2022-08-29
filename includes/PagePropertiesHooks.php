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

use MediaWiki\MediaWikiServices;

define( 'SLOT_ROLE_PAGEPROPERTIES', 'pageproperties' );
define( 'CONTENT_MODEL_PAGEPROPERTIES', 'json' );

class PagePropertiesHooks {
	/**
	 * @var array
	 */
	private static $SlotsParserOutput = [];

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
	}

	/**
	 * @param MediaWikiServices $services
	 * @return void
	 */
	public static function onMediaWikiServices( $services ) {
		$services->addServiceManipulator( 'SlotRoleRegistry', static function ( \MediaWiki\Revision\SlotRoleRegistry $registry ) {
			if ( !$registry->isDefinedRole( SLOT_ROLE_PAGEPROPERTIES ) ) {
				$registry->defineRoleWithModel( SLOT_ROLE_PAGEPROPERTIES, CONTENT_MODEL_PAGEPROPERTIES, [
					"display" => "none",
					"region" => "center",
					"placement" => "append"
				] );
			}
		} );
	}

	/**
	 * @param Title &$title
	 * @param null $unused
	 * @param OutputPage $output
	 * @param User $user
	 * @param WebRequest $request
	 * @param MediaWiki $mediaWiki
	 * @return void
	 */
	public static function onBeforeInitialize( \Title &$title, $unused, \OutputPage $output, \User $user, \WebRequest $request, \MediaWiki $mediaWiki ) {
		\PageProperties::initialize();
	}

	/**
	 * @param Content $content
	 * @param Title $title
	 * @param ParserOutput &$parserOutput
	 * @return void
	 */
	public static function onContentAlterParserOutput( Content $content, Title $title, ParserOutput &$parserOutput ) {
		if ( !defined( 'SMW_VERSION' ) ) {
			return;
		}

		// *** the following hack only seems necessary
		// on 1.38/SMW 4.0.2, on versions 1.35 - 1.37 it could be reduced to the
		// following
		// $semanticData = $parserOutput->getExtensionData( \SMW\ParserData::DATA_ID );
		//	if ( ( $semanticData instanceof \SMW\SemanticData ) ) {
		//		// *** this creates an issue on move property page
		//		\PageProperties::updateSemanticData( $semanticData, 'onContentAlterParserOutput' );
		//		$parserOutput->setExtensionData( \SMW\ParserData::DATA_ID, $semanticData );
		//	}

		$key = $title->getFullText();
		// @todo move to an appropriate hook ?
		if ( !array_key_exists( $key, self::$SlotsParserOutput ) ) {
			$wikiPage = \PageProperties::getWikiPage( $title );

			if ( !$wikiPage ) {
				return;
			}
			$revision = $wikiPage->getRevisionRecord();

			if ( !$revision ) {
				return;
			}

			$slots = $revision->getSlots()->getSlots();
			if ( !array_key_exists( SLOT_ROLE_PAGEPROPERTIES, $slots ) ) {
				return;
			}

			self::$SlotsParserOutput[ $key ] = [ 'content' => $revision->getSlots()->getContent( SLOT_ROLE_PAGEPROPERTIES ) ];
		}

		if ( !array_key_exists( 'content', self::$SlotsParserOutput[$key] ) ) {
			return;
		}

		// *** remove SemanticData from the first slot(s) and
		// attach in the pageproperties slot (it will be merged in the combined output)
		// *** this is an hack to prevent the error "Cannot use object of type SMW\SemanticData as array"
		// includes/parser/ParserOutput.php(2297)
		// includes/parser/ParserOutput.php(2163): ParserOutput::mergeMapStrategy()
		// includes/Revision/RevisionRenderer.php(271): ParserOutput->mergeHtmlMetaDataFrom()
		// includes/Revision/RevisionRenderer.php(158): MediaWiki\Revision\RevisionRenderer->combineSlotOutput()
		if ( !self::$SlotsParserOutput[ $key ][ 'content' ]->equals( $content ) ) {
			$semanticData = $parserOutput->getExtensionData( \SMW\ParserData::DATA_ID );
			if ( ( $semanticData instanceof \SMW\SemanticData ) ) {
				// *** this creates an issue on move property page
				\PageProperties::updateSemanticData( $semanticData, 'onContentAlterParserOutput' );
				self::$SlotsParserOutput[ $key ]['data'] = $semanticData;
				$parserOutput->setExtensionData( \SMW\ParserData::DATA_ID, null );
			}

		// *** this assumes that pageproperties is the last slot
		} elseif ( !empty( self::$SlotsParserOutput[ $key ]['data'] ) ) {
			$parserOutput->setExtensionData( \SMW\ParserData::DATA_ID, self::$SlotsParserOutput[ $key ]['data'] );
		}
	}

	/**
	 * @param Parser $parser
	 * @param string &$text
	 */
	public static function onParserAfterTidy( Parser $parser, &$text ) {
		$title = $parser->getTitle();

		if ( !$title->canExist() ) {
			return;
		}

		$page_properties = \PageProperties::getPageProperties( $title );

		if ( !empty( $page_properties ) ) {
			$parser->addTrackingCategory( 'pageproperties-tracking-category' );
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
		// *** since 1.36
		//$title = $revision->getPage();
		$title = Title::newFromLinkTarget( $revision->getPageAsLinkTarget() );
		$displaytitle = \PageProperties::getDisplayTitle( $title );

		// this will store displaytitle in the page_props table
		if ( $displaytitle !== false ) {
			// getRevisionParserOutput();
			$out = $renderedRevision->getSlotParserOutput( MediaWiki\Revision\SlotRecord::MAIN );
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
	 * @param array &$bar
	 * @return void
	 */
	public static function onSkinBuildSidebar( $skin, &$bar ) {
		if ( !defined( 'SMW_VERSION' ) ) {
			return;
		}

		$user = $skin->getUser();
		$specialpage_title = SpecialPage::getTitleFor( 'PageProperties' );

		$isAuthorized = \PageProperties::isAuthorized( $user, null, 'Admins' );
		if ( $isAuthorized ) {
			$bar[ wfMessage( 'pageproperties-section' )->text() ][] = [
				'text'   => wfMessage( 'manageproperties-label' )->text(),
				'href'   => $specialpage_title->getLocalURL()
			];
		}
		$title = $skin->getTitle();

		if ( strpos( $title->getFullText(), $specialpage_title->getFullText() ) === 0 ) {
			$par = str_replace( $specialpage_title->getFullText() . '/', '', $title->getFullText() );
			$title = Title::newFromText( $par, NS_MAIN );

			if ( !$title || !$title->isKnown() ) {
				return;
			}
		}

		if ( $title->canExist() && $title->getNamespace() !== SMW_NS_PROPERTY ) {
			$isAuthorized = \PageProperties::isAuthorized( $user, null, 'Editors' );

			if ( $isAuthorized ) {
				$bar[ wfMessage( 'pageproperties-section' )->text() ][] = [
					'text'   => wfMessage( 'pageproperties-label' )->text(),
					'href'   => $specialpage = $specialpage_title->getLocalURL() . '/' . wfEscapeWikiText( $title->getPrefixedURL() )
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
		if ( defined( 'SMW_VERSION' ) ) {
			return;
		}

		$title = $skin->getTitle();
		if ( !$title->canExist() ) {
			return;
		}

		$user = $skin->getUser();
		$isAuthorized = \PageProperties::isAuthorized( $user, null, 'Editors' );

		if ( !$isAuthorized ) {
			return;
		}

		$specialpage_title = SpecialPage::getTitleFor( 'PageProperties' );

		if ( strpos( $title->getFullText(), $specialpage_title->getFullText() ) === 0 ) {
			$par = str_replace( $specialpage_title->getFullText() . '/', '', $title->getFullText() );
			$title = Title::newFromText( $par, NS_MAIN );

			if ( !$title || !$title->isKnown() ) {
				return;
			}
		}

		$sidebar['TOOLBOX'][] = [
			'text'   => wfMessage( 'pageproperties-label' )->text(),
			'href'   => $specialpage = $specialpage_title->getLocalURL() . '/' . $title->getFullText()
		];
	}

	/**
	 * @param SkinTemplate $skinTemplate
	 * @param array &$links
	 * @return void
	 */
	public static function onSkinTemplateNavigation( SkinTemplate $skinTemplate, array &$links ) {
		$user = $skinTemplate->getUser();

		if ( !$user->isRegistered() ) {
			return;
		}

		$title = $skinTemplate->getTitle();

		if ( !$title->canExist() ) {
			return;
		}

		// display page properties only to authorized editors
		$isAuthorized = \PageProperties::isAuthorized( $user, $title, 'Editors' );

		if ( $isAuthorized ) {
			$title_ = SpecialPage::getTitleFor( 'PageProperties' );
			$links[ 'actions' ][] = [
				'text' => wfMessage( 'properties-navigation' )->text(), 'href' => $title_->getLocalURL() . ( !defined( 'SMW_VERSION' ) || $title->getNamespace() !== SMW_NS_PROPERTY ? '/' . wfEscapeWikiText( $title->getPrefixedURL() ) : '' )
			];
		}
	}

	/**
	 * // *** here we could alter page title through OutputPage
	 * // *** but it seems preferable to leave the original page title
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
		$outputPage->addJsConfigVars( [
			'pageproperties-js-alert-1' => wfMessage( 'pageproperties-js-alert-1' )->text(),
			'pageproperties-js-alert-2' => wfMessage( 'pageproperties-js-alert-2' )->text()
		] );

		$outputPage->addHeadItem( 'pageproperties_content_model', '<style>.pageproperties-content-model-text{ font-family: monospace; white-space:pre-wrap; word-wrap:break-word; }</style>' );

		$title = $outputPage->getTitle();
		if ( $outputPage->isArticle() && $title->canExist() ) {
			\PageProperties::setJsonLD( $title, $outputPage );
			\PageProperties::setMetaAndTitle( $title, $outputPage );
		}
	}

	/**
	 * @param SMWStore $store
	 * @param SemanticData $semanticData
	 * @return void
	 */
	public static function onSMWStoreBeforeDataUpdateComplete( $store, $semanticData ) {
		\PageProperties::updateSemanticData( $semanticData, 'onSMWStoreBeforeDataUpdateComplete' );
	}

	/**
	 * // open external links in a new window
	 * @param string &$url
	 * @param string &$text
	 * @param string &$link
	 * @param array &$attribs
	 * @param string $linktype
	 * @return void
	 */
	public static function onLinkerMakeExternalLink( &$url, &$text, &$link, &$attribs, $linktype ) {
		if ( !array_key_exists( 'target', $attribs ) ) {
			$attribs['target'] = '_blank';
		}
	}

}
