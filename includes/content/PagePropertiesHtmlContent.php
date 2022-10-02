<?php

class PagePropertiesHtmlContent extends \TextContent {
	/**
	 * @inheritDoc
	 */
	public function __construct( $text ) {
		parent::__construct( $text, CONTENT_MODEL_PAGEPROPERTIES_HTML );
	}
}
