<?php

//session_start();

// TODO: check to make sure the session has been authenticated
//if (!isset($_SESSION["userid"])) {
//	header("HTTP/1.1 401 Unauthorized");
//	echo "<html><body><h3>401 Unauthorized</h3></body></html>";
//	die;
//}

require 'inc/db.php';

header("Cache-Control: max-age=0, must-revalidate");

$response->result = 500;

//$userid = $_SESSION["userid"];
$userid = 0;

$pdo = dboConnect();
$query = $pdo->prepare("SELECT taskListID, name, position FROM taskLists " .
					   "WHERE userID=:userID ORDER BY position");
$params = array(':userID' => $userid);
$query->execute($params);
while ($row = $query->fetch(PDO::FETCH_ASSOC))
	$response->taskLists[] = $row;
$response->result = 200;

echo json_encode($response);

?>
