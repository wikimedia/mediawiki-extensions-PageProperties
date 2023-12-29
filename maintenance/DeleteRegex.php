<?php

/**
 * This file is part of the MediaWiki extension PageProperties.
 *
 * ContactManager is free software: you can redistribute it and/or modify
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

$IP = getenv( 'MW_INSTALL_PATH' );
if ( $IP === false ) {
	$IP = __DIR__ . '/../../..';
}
require_once "$IP/maintenance/Maintenance.php";

if ( is_readable( __DIR__ . '/../vendor/autoload.php' ) ) {
	include_once __DIR__ . '/../vendor/autoload.php';
}

class DeleteRegex extends Maintenance {
	/** @var User */
	private $user;

	/** @var limit */
	private $limit;

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'delete regex' );
		$this->requireExtension( 'PageProperties' );

		// name,  description, required = false,
		//	withArg = false, shortName = false, multiOccurrence = false
		//	$this->addOption( 'format', 'import format (csv or json)', true, true );

		$this->addOption( 'regex', 'regex', true, true );
		$this->addOption( 'namespace', 'namespace', false, true );
		$this->addOption( 'limit', 'limit pages to be imported', false, true );
	}

	/**
	 * @return null
	 */
	private function getRequestId() {
		return null;
	}

	/**
	 * inheritDoc
	 * @return string|void
	 */
	public function execute() {
		$limit = $this->getOption( 'limit' ) ?? false;
		$regex = $this->getOption( 'regex' ) ?? '';
		$namespace = $this->getOption( 'namespace' ) ?? '';

		if ( empty( $regex ) ) {
			return 'no regex';
		}

		$dbr = wfGetDB( DB_MASTER );

		$user = User::newSystemUser( 'Maintenance script', [ 'steal' => true ] );

		$this->user = $user;

		$conds = [
			'page_is_redirect' => 0
		];

		if ( !empty( $namespace ) ) {
			$formattedNamespaces = MediaWikiServices::getInstance()
				->getContentLanguage()->getFormattedNamespaces();

			$ns = array_search( $formattedNamespaces, $namespace );
			if ( !empty( $ns ) ) {
				$conds['page_namespace'] = $ns;
			}
		}

		$conds[] = 'page_title REGEXP ' . $dbr->addQuotes( $regex );

		$options = [
			'USE INDEX' => ( version_compare( MW_VERSION, '1.36', '<' ) ? 'name_title' : 'page_name_title' )
		];

		if ( $limit !== false ) {
			$options['LIMIT'] = (int)$limit;
		}

		$res = $dbr->select(
			'page',
			[ 'page_namespace', 'page_title', 'page_id' ],
			$conds,
			__METHOD__,
			$options
		);

		if ( !$res->numRows() ) {
			return 'no pages';
		}

		$ret = [];
		foreach ( $res as $row ) {
			$title = Title::newFromRow( $row );
			echo 'deleting ' . $title->getFullText() . PHP_EOL;
			$ret = $this->deletePageJob( $title );
			if ( $ret ) {
				$title = Title::newFromRow( $row );
				echo 'done ' . PHP_EOL;
			}
		}
	}

	/**
	 * @see DeletePageJob
	 * @param Title $title
	 * @return Status|false
	 */
	private function deletePageJob( $title ) {
		$jobParams = [
			'namespace' => $title->getNamespace(),
			'title' => $title->getDBkey(),
			'wikiPageId' => $title->getArticleId(),
			// 'requestId' => $webRequestId ?? $this->webRequestID,
			'reason' => 'DeleteRegex',
			'suppress' => 'delete',
			'userId' => $this->user->getID(),
			'tags' => json_encode( [] ),
			'logsubtype' => 'delete',
			'pageRole' => null,
		];

		$job = new DeletePageJob( $jobParams );
		// \PageProperties::pushJobs( $job );
		$job->run();
		return true;
	}
}

$maintClass = DeleteRegex::class;
require_once RUN_MAINTENANCE_IF_MAIN;
