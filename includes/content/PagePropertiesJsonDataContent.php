<?php

class PagePropertiesJsonDataContent extends \JsonContent {
	/**
	 * @inheritDoc
	 */
	public function __construct( $text, $modelId = CONTENT_MODEL_PAGEPROPERTIES_JSONDATA ) {
		parent::__construct( $text, $modelId );
	}

}
