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

use MediaWiki\Revision\SlotRecord;

class PagePropertiesJobReplaceText extends Job {

	/**
	 * @param Title $title
	 * @param array|bool $params
	 */
	function __construct( $title, $params = [] ) {
		parent::__construct( 'PagePropertiesReplaceText', $title, $params );
	}

	/**
	 * @return bool
	 */
	function run() {
		// T279090
		$user = User::newFromId( $this->params['user_id'] );

		if ( !$user->isAllowed( 'pageproperties-canmanagesemanticproperties' ) ) {
			$this->error = 'PageProperties: Permission error';
			return false;
		}

		if ( $this->title === null ) {
			$this->error = "PageProperties: Invalid title";
			return false;
		}

		$title = $this->title;

		$wikiPage = \PageProperties::getWikiPage( $title );
		$oldRevisionRecord = $wikiPage->getRevisionRecord();

		if ( $oldRevisionRecord === null ) {
			$this->error = 'PagePropertiesReplaceText: No revision found';
			return false;
		}

		$slots = $oldRevisionRecord->getSlots()->getSlots();
		$slotName = SlotRecord::MAIN;

		if ( !array_key_exists( $slotName, $slots ) ) {
			$this->error = 'PagePropertiesReplaceText: Slot not found';
			return false;
		}

		$target_str = $this->params['target_str'];
		$replacement_str = $this->params['replacement_str'];
		$content = $slots[$slotName]->getContent();
		$contents = json_decode( $content->getNativeData(), true );

		if ( !$contents ) {
			$this->error = 'PagePropertiesReplaceText: Json parse error';
			return false;
		}

		switch ( $this->params['scope'] ) {
			case 'property':
				if ( !empty( $contents['pagename-formula'] ) ) {
					$contents['pagename-formula'] = preg_replace( '/\<' . preg_quote( $target_str, '/' ) . '\>/', '<' . $replacement_str . '>', $contents['pagename-formula'], -1, $num_matches );
				}

				if ( array_key_exists( $target_str, $contents['fields'] ) ) {
					\PageProperties::replaceArrayKey( $contents['fields'], $target_str, $replacement_str );
				}

				foreach ( $contents['fields'] as $key => $value ) {
					if ( !empty( $value['value-formula'] ) ) {
						$contents['fields'][$key]['value-formula'] = preg_replace( '/\<' . preg_quote( $target_str, '/' ) . '\>/', '<' . $replacement_str . '>', $contents['fields'][$key]['value-formula'], -1, $num_matches );
					}
				}
				break;

			case 'category':
				if ( !empty( $contents['categories'] ) ) {
					array_walk( $contents['categories'], static function ( &$value ) use ( $target_str, $replacement_str ) {
						$value = str_replace( $target_str, $replacement_str, $value );
					} );
				}
				break;

		}

		$modelId = $oldRevisionRecord->getSlot( $slotName )->getContent()->getContentHandler()->getModelID();

		$pageUpdater = $wikiPage->newPageUpdater( $user );
		$slotContent = ContentHandler::makeContent( json_encode( $contents ), $title, $modelId );
		$pageUpdater->setContent( $slotName, $slotContent );

		$summary = "PagePropertiesReplaceText update";
		$flags = EDIT_INTERNAL;
		$comment = CommentStoreComment::newUnsavedComment( $summary );

		$ret = $pageUpdater->saveRevision( $comment, $flags );

		return true;
	}
}
