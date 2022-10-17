<?php

class CategoriesMultiselectWidget extends MediaWiki\Widget\TagMultiselectWidget {

	/**
	 * @param array $config Configuration options
	 */
	public function __construct( array $config = [] ) {
		parent::__construct( $config );
	}

	protected function getJavaScriptClassName() {
		return 'mw.widgets.CategoryMultiselectWidgetPageProperties';
	}

}
