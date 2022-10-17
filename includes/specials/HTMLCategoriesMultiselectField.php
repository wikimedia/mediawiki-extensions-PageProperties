<?php

include_once __DIR__ . '/CategoriesMultiselectWidget.php';

if ( !class_exists( 'HTMLTagMultiselectField' ) ) {
	include_once __DIR__ . '/HTMLTagMultiselectField.php';
}

class HTMLCategoriesMultiselectField extends HTMLTagMultiselectField {
	public function getInputOOUI( $value ) {
		$params = [ 'name' => $this->mName ];

		if ( isset( $this->mParams['id'] ) ) {
			$params['id'] = $this->mParams['id'];
		}

		if ( isset( $this->mParams['disabled'] ) ) {
			$params['disabled'] = $this->mParams['disabled'];
		}

		if ( isset( $this->mParams['default'] ) ) {
			$params['default'] = $this->mParams['default'];
		}

		if ( isset( $this->mParams['placeholder'] ) ) {
			$params['placeholder'] = $this->mParams['placeholder'];
		} else {
			$params['placeholder'] = $this->msg( 'mw-widgets-tagmultiselect-placeholder' )->plain();
		}

		if ( isset( $this->mParams['max'] ) ) {
			$params['tagLimit'] = $this->mParams['max'];
		}

		if ( isset( $this->mParams['allowArbitrary'] ) ) {
			$params['allowArbitrary'] = $this->mParams['allowArbitrary'];
		}

		if ( isset( $this->mParams['allowedValues'] ) ) {
			$params['allowedValues'] = $this->mParams['allowedValues'];
		}

		if ( isset( $this->mParams['input'] ) ) {
			$params['input'] = $this->mParams['input'];
		}

		if ( $value !== null ) {
			// $value is a string, but the widget expects an array
			$params['default'] = $value === '' ? [] : explode( "\n", $value );
		}

		// Make the field auto-infusable when it's used inside a legacy HTMLForm rather than OOUIHTMLForm
		$params['infusable'] = true;
		$params['classes'] = [ 'mw-htmlform-autoinfuse' ];

		// ***edited
		$widget = new CategoriesMultiselectWidget( $params );
		$widget->setAttributes( [ 'data-mw-modules' => implode( ',', $this->getOOUIModules() ) ] );

		return $widget;
	}

	protected function getOOUIModules() {
		// return [ 'mediawiki.widgets.CategoryMultiselectWidget' ];
		return [ 'ext.PageProperties.CategoryMultiselectWidgetPageProperties' ];
	}

}
