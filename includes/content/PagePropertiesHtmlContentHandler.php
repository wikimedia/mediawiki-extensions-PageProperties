<?php

use MediaWiki\Content\Renderer\ContentParseParams;
use MediaWiki\MediaWikiServices;

class PagePropertiesHtmlContentHandler extends \TextContentHandler {
	/**
	 * @inheritDoc
	 */
	public function __construct( $modelId = CONTENT_MODEL_PAGEPROPERTIES_HTML, $formats = [ 'text/html' ] ) {
		parent::__construct( $modelId, $formats );
	}

	/**
	 * @return string
	 */
	protected function getContentClass() {
		return PagePropertiesHtmlContent::class;
	}

	/**
	 * @param Content $content
	 * @param ContentParseParams $cpoParams
	 * @param ParserOutput &$output The output object to fill (reference).
	 */
	protected function fillParserOutput(
		Content $content,
		ContentParseParams $cpoParams,
		ParserOutput &$output
	) {
		$textModelsToParse = MediaWikiServices::getInstance()->getMainConfig()->get( 'TextModelsToParse' );
		'@phan-var TextContent $content';
		if ( in_array( $content->getModel(), $textModelsToParse ) ) {
			// parse just to get links etc into the database, HTML is replaced below.
			$output = MediaWikiServices::getInstance()->getParser()
				->parse(
					$content->getText(),
					$cpoParams->getPage(),
					$cpoParams->getParserOptions(),
					true,
					true,
					$cpoParams->getRevId()
				);
		}

		if ( $cpoParams->getGenerateHtml() ) {
			// Temporary changes as getHtml() is deprecated, we are working on removing usage of it.
			if ( method_exists( $content, 'getHtml' ) ) {
				$method = new ReflectionMethod( $content, 'getHtml' );
				$method->setAccessible( true );
				$html = $method->invoke( $content );
			} else {
				// Return an HTML representation of the content
				// ***edited
				// $html = htmlspecialchars( $content->getText(), ENT_COMPAT );
				$html = $content->getText();
			}
		} else {
			$html = '';
		}

		$output->clearWrapperDivClass();
		$output->setText( $html );
	}

}
