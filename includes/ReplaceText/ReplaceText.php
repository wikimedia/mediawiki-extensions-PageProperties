<?php

/**
 * @credits https://www.mediawiki.org/wiki/Extension:Replace_Text
 */

namespace MediaWiki\Extension\PageProperties\ReplaceText;

use MediaWiki\MediaWikiServices;
use Title;

class ReplaceText {

	public function __construct() {
	}

	/**
	 * @param string $target
	 * @param array $selected_namespaces
	 * @param string $category
	 * @param string $prefix
	 * @param bool $use_regex
	 * @return array
	 */
	function getTitlesForEditingWithContext( $target, $selected_namespaces, $category, $prefix, $use_regex ) {
		$titles_for_edit = [];

		$res = Search::doSearchQuery(
			$target,
			$selected_namespaces,
			$category,
			$prefix,
			$use_regex
		);

		foreach ( $res as $row ) {
			$title = Title::makeTitleSafe( $row->page_namespace, $row->page_title );
			if ( $title == null ) {
				continue;
			}

			// ***edited
			// $context = $this->extractContext( $row->old_text, $this->target, $this->use_regex );
			$context = null;
			$role = $this->extractRole( (int)$row->slot_role_id );
			$titles_for_edit[] = [ $title, $context, $role ];
		}

		return $titles_for_edit;
	}

	/**
	 * @param int $role_id
	 * @return string
	 */
	private function extractRole( $role_id ) {
		$roleStore = MediaWikiServices::getInstance()->getSlotRoleStore();
		return $roleStore->getName( $role_id );
	}

}
