<?php

class PagePropertiesSemanticContent extends \JsonContent {
	/**
	 * @inheritDoc
	 */
	public function __construct( $text, $modelId = CONTENT_MODEL_PAGEPROPERTIES_SEMANTIC ) {
		parent::__construct( $text, $modelId );
	}

}
