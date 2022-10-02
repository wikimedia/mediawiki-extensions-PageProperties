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
 * @author thomas-topway-it <thomas.topway.it@mail.com>
 * @copyright Copyright ©2021-2022, https://wikisphere.org
 */

class OOUIHTMLFormTabs extends OOUIHTMLForm {
	protected $html_fragments = [];

	/**
	 * @stable to call
	 * @inheritDoc
	 */
	public function __construct( $descriptor, $context = null, $messagePrefix = '' ) {
		// ***edited
		$symbols = [ 'append_html', 'prepend_html' ];

		foreach ( $descriptor as $key => $value ) {
			foreach ( $symbols as $symbol ) {
				if ( !empty( $value[$symbol] ) ) {
					$this->html_fragments[$value['section']][$key][$symbol] = $value[$symbol];
					unset( $value[$symbol] );
				}
			}
		}

		parent::__construct( $descriptor, $context, $messagePrefix );
		$this->getOutput()->enableOOUI();
		$this->getOutput()->addModuleStyles( 'mediawiki.htmlform.ooui.styles' );
	}

	/**
	 * @see includes/specials/forms/PreferencesFormOOUI.php
	 * @return string
	 */
	function getBody() {
		if ( count( $this->mFieldTree ) == 1 ) {
			$key = key( $this->mFieldTree );
			$val = reset( $this->mFieldTree );
			$html = $this->msg( $this->mMessagePrefix . '-' . $key . '-label' )->parse()
				. $this->displaySection( $val, $key, "mw-prefsection-$key-" )
				. $this->getFooterText( $key );

			return $this->formatFormHeader() . $html;
		}

		$tabPanels = [];
		foreach ( $this->mFieldTree as $key => $val ) {
			if ( !is_array( $val ) ) {
				wfDebug( __METHOD__ . " encountered a field not attached to a section: '$key'" );
				continue;
			}
			$label = $this->getLegend( $key );
			$content =
				// ***edited
				// $this->getHeaderText( $key ) .
				$this->msg( $this->mMessagePrefix . '-' . $key . '-label' )->parse()
					. $this->displaySection(
						$val,
						// ***edited
						$key,
						"mw-prefsection-$key-"
				)
				. $this->getFooterText( $key );

			$tabPanels[] = new OOUI\TabPanelLayout(
				'mw-prefsection-' . $key,
				[
					// ***edited
					// see resources/src/mediawiki.htmlform/autoinfuse.js
					// 'classes' => [ 'mw-htmlform-autoinfuse-lazy' ],
					'label' => $label,
					'content' => new OOUI\FieldsetLayout(
						[
							'classes' => [ 'mw-prefs-section-fieldset' ],
							'id' => "mw-prefsection-$key",
							'label' => $label,
							'items' => [
								new OOUI\Widget(
									[
										'content' => new OOUI\HtmlSnippet( $content )
									]
								),
							],
						]
					),
					'expanded' => false,
					'framed' => true,
				]
			);
		}

		$indexLayout = new OOUI\IndexLayout(
			[
				'infusable' => true,
				'expanded' => false,
				'autoFocus' => false,
				'classes' => [ 'mw-prefs-tabs' ],
			]
		);
		$indexLayout->addTabPanels( $tabPanels );

		$header = $this->formatFormHeader();
		$form = new OOUI\PanelLayout(
			[
				'framed' => true,
				'expanded' => false,
				'classes' => [ 'mw-prefs-tabs-wrapper' ],
				'content' => $indexLayout
			]
		);

		return $header . $form;
	}

	/**
	 * @ see includes/specials/forms/PreferencesFormOOUI.php
	 * @return string
	 */
	public function getButtons() {
		// *** edited
		// if ( !$this->areOptionsEditable() && !$this->isPrivateInfoEditable() ) {
		//	return '';
		// }

		$html = parent::getButtons();

		// *** edited
		// if ( $this->areOptionsEditable() ) {
		// ***set to true to enable sticky footer
		// @phpcs:ignore Generic.CodeAnalysis.UnconditionalIfStatement.Found
		if ( false ) {
			$t = $this->getTitle()->getSubpage( 'reset' );

			$html .= new OOUI\ButtonWidget( [
				'infusable' => true,
				'id' => 'mw-prefs-restoreprefs',
				// *** edited
				// 'label' => $this->msg( 'restoreprefs' )->text(),
				'href' => $t->getLinkURL(),
				'flags' => [ 'destructive' ],
				'framed' => false,
			] );

			$html = Xml::tags( 'div', [ 'class' => 'mw-prefs-buttons' ], $html );
		}

		return $html;
	}

	/**
	 * @see includes/htmlform/HTMLForm.php
	 * @param array $fields
	 * @param string $sectionName
	 * @param string $fieldsetIDPrefix
	 * @param bool &$hasUserVisibleFields
	 * @return string
	 */
	public function displaySection(
		$fields,
		$sectionName = '',
		$fieldsetIDPrefix = '',
		&$hasUserVisibleFields = false
	) {
		if ( $this->mFieldData === null ) {
			throw new LogicException(
				'HTMLForm::displaySection() called on uninitialized field data. '
					. 'You probably called displayForm() without calling prepareForm() first.'
			);
		}

		$displayFormat = $this->getDisplayFormat();

		$html = [];
		$subsectionHtml = '';
		$hasLabel = false;

		// Conveniently, PHP method names are case-insensitive.
		// For grep: this can call getDiv, getRaw, getInline, getVForm, getOOUI
		$getFieldHtmlMethod = $displayFormat === 'table' ? 'getTableRow' : ( 'get' . $displayFormat );

		$n = 0;
		foreach ( $fields as $key => $value ) {
			if ( $value instanceof HTMLFormField ) {
				$v = array_key_exists( $key, $this->mFieldData ) ? $this->mFieldData[$key] : $value->getDefault();

				// ***edited
				$retval = '';

				if ( !empty( $this->html_fragments[$sectionName][$key]['prepend_html'] ) ) {
					$retval = $this->html_fragments[$sectionName][$key]['prepend_html'];
				}

				// check, if the form field should be added to
				// the output.
				if ( $value->hasVisibleOutput() ) {
					$retval .= (string)$value->$getFieldHtmlMethod( $v );
				}

				if ( !empty( $this->html_fragments[$sectionName][$key]['append_html'] ) ) {
					$retval .= $this->html_fragments[$sectionName][$key]['append_html'];
				}

				// ***edited
				if ( !empty( $retval ) ) {
					$html[] = $retval;

					$labelValue = trim( $value->getLabel() );
					if ( $labelValue !== "\u{00A0}" && $labelValue !== '&#160;' && $labelValue !== '' ) {
						$hasLabel = true;
					}

					$hasUserVisibleFields = true;

					$n++;
				}

			} elseif ( is_array( $value ) ) {
				$subsectionHasVisibleFields = false;
				$section = $this->displaySection(
					$value,

					// ***edited
					// "mw-htmlform-$key",
					"$sectionName/$key",
					"$fieldsetIDPrefix$key-",
					$subsectionHasVisibleFields
				);
				$legend = null;

				if ( $subsectionHasVisibleFields === true ) {
					// Display the section with various niceties.
					$hasUserVisibleFields = true;

					$legend = $this->getLegend( $key );
					$section = $this->getHeaderText( $key )
						. $section
						. $this->getFooterText( $key );

					$attributes = [];
					if ( $fieldsetIDPrefix ) {
						$attributes['id'] = Sanitizer::escapeIdForAttribute( "$fieldsetIDPrefix$key" );
					}
					$subsectionHtml .= $this->wrapFieldSetSection(
						$legend,
						$section,
						$attributes,
						$fields === $this->mFieldTree
					);
				} else {
					// Just return the inputs, nothing fancy.
					$subsectionHtml .= $section;
				}
			}
		}

		$html = $this->formatSection( $html, $sectionName, $hasLabel );

		if ( $subsectionHtml ) {
			if ( $this->mSubSectionBeforeFields ) {
				return $subsectionHtml . "\n" . $html;
			} else {
				return $html . "\n" . $subsectionHtml;
			}
		} else {
			return $html;
		}
	}
}
