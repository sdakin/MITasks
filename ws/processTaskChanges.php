<?php

// TODO: check auth....

header("Cache-Control: max-age=0, must-revalidate");

require 'inc/db.php';

$response->result = 200;
$input = (get_magic_quotes_gpc() ? stripslashes($_POST["data"]) : $_POST["data"]);
$changes = json_decode($input);
$pdo = dboConnect();

date_default_timezone_set('America/Los_Angeles');

// get the table columns so we can be sure we only insert/update valid columns
$query = $pdo->prepare("DESCRIBE tasks");
$query->execute();
$columns = $query->fetchAll(PDO::FETCH_COLUMN);
//** $response->columns = print_r($columns, true);

$response->statuses = array();
foreach ($changes as $changeObj) {
	$obj = $changeObj->data;
	
	// check to see if the object exists
	$exists = false;
	$whereClause = "";
	$params = array();
	if (isset($obj->taskID)) {
		$whereClause = "taskID=:taskID";
		$params[":taskID"] = $obj->taskID;
	} else if (isset($obj->taskListID) && isset($obj->clientID)) {
		$whereClause = "taskListID=:taskListID AND clientID=:clientID";
		$params[":taskListID"] = $obj->taskListID;
		$params[":clientID"] = $obj->clientID;
	}
	if (strlen($whereClause) > 0) {
		$statement = $pdo->prepare("SELECT COUNT(*) FROM tasks WHERE " . $whereClause);
		$statement->execute($params);
		$exists = $statement->fetchColumn() > 0;
	}
	$operation = $exists ? "update" : "insert";
	
	// set up created and lastModified column values
	$now = date('Y-m-d H:i:s', time());
	if (!$exists) $obj->created = $now;
	$obj->lastModified = $now;
	
	// dynamically set up the column values for the current object
	$setClause = "";
	$params = array();
	foreach ($obj as $colName => $value) {
		if (in_array($colName, $columns)) {
			$varName = ":" . $colName;
			if (strlen($setClause) > 0) $setClause .= ",";
			$setClause .= $colName . "=" . $varName;
			$params[$varName] = $value;
		}
	}
	
	// check for delete operation
	if (isset($changeObj->op) && $changeObj->op == "delete") {
		if ($exists) {
			$operation = "delete";
			if (strlen($setClause) > 0) $setClause .= ",";
			$setClause .= "deleted=:deleted";
			$params[':deleted'] = '1';
		} else {
			$setClause = "";	// force an error
		}
	}
	
	// assume success
	$status->statusCode = 200;
	if (isset($obj->taskID)) $status->taskID = $obj->taskID;
	if (isset($obj->taskListID)) $status->taskListID = $obj->taskListID;
	if (isset($obj->clientID)) $status->clientID = $obj->clientID;

	// prepare and execute the sql statement
	$sql = "";
	if (strlen($setClause) > 0) {
		if ($operation == "update" || $operation == "delete") {
			// set up the WHERE clause - it can be one of two options:
			//		* taskID (preferred) or
			//		* taskListID and clientID
			//
			// TODO: do a join with the users table on userID and taskListID to ensure the
			//		 logged in user owns the list being modified.
			$whereClause = "";
			if (isset($obj->taskID)) {
				$whereClause = "taskID=:taskID";
				$params[":taskID"] = $obj->taskID;
			} else if (isset($obj->taskListID) && isset($obj->clientID)) {
				$whereClause = "taskListID=:taskListID AND clientID=:clientID";
				$params[":taskListID"] = $obj->taskListID;
				$params[":clientID"] = $obj->clientID;
			}
			if (strlen($whereClause) > 0)
				$sql = "UPDATE tasks SET " . $setClause . " WHERE " . $whereClause;
		} else if ($operation == "insert") {
			$sql = "INSERT tasks SET " . $setClause;
		}
	}
	if (strlen($sql) == 0) {
		$status->statusCode = 500;
	} else {
		$statement = $pdo->prepare($sql);
		$statement->execute($params);
		if ($statement->errorCode() != 0) {
			$status->statusCode = 500;
			$status->pdoError = $statement->errorInfo();
			$status->sql = $sql;
			//** $status->params = print_r($params, true);
		} else {
			if (!$exists)
				$status->taskID = $pdo->lastInsertId();
			$status->sql = $sql;	// *** DEBUGGING
		}
	}
	$response->statuses[] = $status;
}

echo json_encode($response);

?>
