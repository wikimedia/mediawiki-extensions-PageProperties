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
 * @author thomas-topway-it <support@topway.it>
 * @copyright Copyright ©2023, https://wikisphere.org
 */

namespace MediaWiki\Extension\PageProperties\Utils;

use Html;

/**
 * @credits mwjames
 */
class HtmlTable {

	/** @var array */
	public $headers = [];

	/** @var array */
	public $cells = [];

	/** @var array */
	public $rows = [];

	/**
	 * @param string &$content
	 */
	public function formatContent( &$content ) {
		if ( $content === '' ) {
			$content = '&nbsp;';
		}
	}

	/**
	 * @param string $content
	 * @param array $attributes
	 */
	public function header( $content = '', $attributes = [] ) {
		$this->formatContent( $content );
		$this->headers[] = [ 'content' => $content, 'attributes' => $attributes ];
	}

	/**
	 * @param string $content
	 * @param array $attributes
	 */
	public function cell( $content = '', $attributes = [] ) {
		$this->formatContent( $content );
		$this->cells[] = Html::rawElement( 'td', $attributes, $content );
	}

	/**
	 * @param array $attributes
	 */
	public function row( $attributes = [] ) {
		if ( $this->cells !== [] ) {
			$this->rows[] = [ 'cells' => $this->cells, 'attributes' => $attributes ];
			$this->cells = [];
		}
	}

	/**
	 * @param array $attributes
	 * @return string
	 */
	public function table( $attributes = [] ) {
		$table = $this->buildTable();

		$this->headers = [];
		$this->rows = [];
		$this->cells = [];

		if ( $table !== '' ) {
			return Html::rawElement( 'table', $attributes, $table );
		}

		return '';
	}

	/**
	 * @return string
	 */
	private function buildTable() {
		$headers = [];
		$rows = [];

		foreach ( $this->headers as $i => $header ) {
			$headers[] = Html::rawElement( 'th', $header['attributes'], $header['content'] );
		}

		if ( count( $this->cells ) ) {
			$this->row();
		}

		foreach ( $this->rows as $row ) {
			$rows[] = $this->createRow( implode( '', $row['cells'] ), $row['attributes'], count( $rows ) );
		}

		$ret = '';
		if ( count( $headers ) ) {
			$ret .= $this->concatenateHeaders( $headers );
		}
		if ( count( $rows ) ) {
			$ret .= $this->concatenateRows( $rows );
		}

		return $ret;
	}

	/**
	 * @param string $content
	 * @param array $attributes
	 * @param int $count
	 * @return string
	 */
	private function createRow( $content, $attributes, $count ) {
		$alternate = $count % 2 == 0 ? 'row-odd' : 'row-even';

		if ( isset( $attributes['class'] ) ) {
			$attributes['class'] = $attributes['class'] . ' ' . $alternate;
		} else {
			$attributes['class'] = $alternate;
		}

		return Html::rawElement( 'tr', $attributes, $content );
	}

	/**
	 * @param array $headers
	 * @return string
	 */
	private function concatenateHeaders( $headers ) {
		return Html::rawElement( 'thead', [], implode( '', $headers ) );
	}

	/**
	 * @param array $rows
	 * @return string
	 */
	private function concatenateRows( $rows ) {
		return Html::rawElement( 'tbody', [], implode( '', $rows ) );
	}
}
