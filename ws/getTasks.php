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
$input = (get_magic_quotes_gpc() ? stripslashes($_POST["data"]) : $_POST["data"]);
$inputParams = json_decode($input);
if (isset($inputParams->taskListID)) {
	$pdo = dboConnect();
	
	// TODO: make sure userid owns taskList with the specific taskListiD
	//$userid = $_SESSION["userid"];
	$userid = 0;
	
	$pdo = dboConnect();
	// TODO: need to order by position
	$query = $pdo->prepare("SELECT * FROM tasks WHERE taskListID=:taskListID AND deleted IS NULL ORDER BY taskID");
	$params = array(':taskListID' => $inputParams->taskListID);
	$query->execute($params);
	while ($row = $query->fetch(PDO::FETCH_ASSOC))
		$response->tasks[] = $row;
	$response->result = 200;
}

echo json_encode($response);

?>
