<?php

class PagePropertiesSemanticContentHandler extends \JsonContentHandler {
	/**
	 * @inheritDoc
	 */
	public function __construct( $modelId = CONTENT_MODEL_PAGEPROPERTIES_SEMANTIC ) {
		parent::__construct( $modelId, [ CONTENT_FORMAT_JSON ] );
	}

	/**
	 * @return string
	 */
	protected function getContentClass() {
		return PagePropertiesSemanticContent::class;
	}

}
