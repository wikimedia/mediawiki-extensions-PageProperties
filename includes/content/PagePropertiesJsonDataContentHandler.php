<?php

class PagePropertiesJsonDataContentHandler extends \JsonContentHandler {
	/**
	 * @inheritDoc
	 */
	public function __construct( $modelId = CONTENT_MODEL_PAGEPROPERTIES_JSONDATA ) {
		parent::__construct( $modelId, [ CONTENT_FORMAT_JSON ] );
	}

	/**
	 * @return string
	 */
	protected function getContentClass() {
		return PagePropertiesJsonDataContent::class;
	}

}
