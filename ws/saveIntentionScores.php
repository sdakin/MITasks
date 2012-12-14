<?php

header("Cache-Control: max-age=0, must-revalidate");

session_start();

// check to make sure the session has been authenticated
if (!isset($_SESSION["userid"])) {
	header("HTTP/1.1 401 Unauthorized");?>
	<html><body><h3>401 Unauthorized</h3></body></html><?php
	die("unauthorized");
}

require '../inc/db.php';

$response->result = 500;
$mentorID = $_SESSION["userid"];
$input = (get_magic_quotes_gpc() ? stripslashes($_POST["scores"]) : $_POST["scores"]);
$scores = json_decode($input);
if (is_array($scores)) {
	$pdo = dboConnect();
	$count = $pdo->prepare("SELECT COUNT(*) FROM intentionMentors WHERE mentorID=:mentorID AND intentionID=:intentionID AND role=0");
	$noteCount = $pdo->prepare("SELECT COUNT(*) FROM intentionMentors as m, intentions as i ".
														 "WHERE m.mentorID=:mentorID AND m.intentionID=i.intentionID AND m.role<=1 AND i.menteeID=:menteeID");
	$update = $pdo->prepare("UPDATE intentionScores SET score=:score, note=:note, altMenteeID=:altMenteeID " .
													"WHERE mentorID=:mentorID AND intentionID=:intentionID AND scoreDate=:scoreDate");
	$insert = $pdo->prepare("INSERT INTO intentionScores VALUES (:mentorID, :intentionID, :scoreDate, :score, :note, :altMenteeID)");
	
	// at this point we're assuming a successful response
	$response->result = 200;
	
	// iterate all of the score objects in the scores array
	foreach ($scores as $scoreObj) {
		$statusObj = (object) NULL;

		// verify that the mentorID from the session params has a scorer role for the intention record being modified
		$hasPerms = false;
		if ($scoreObj->intentionID == 0) {		// daily note?
			$params = array(':mentorID' => $mentorID, ':menteeID' => $scoreObj->menteeID);
			$noteCount->execute($params);
			$hasPerms = $noteCount->fetchColumn() > 0;
		} else {
			$params = array(':mentorID' => $mentorID, ':intentionID' => $scoreObj->intentionID);
			$count->execute($params);
			$hasPerms = $count->fetchColumn() > 0;
		}
		if ($hasPerms) {
			$altMenteeID = $scoreObj->intentionID == 0 ? $scoreObj->menteeID : NULL;
			
			// set up the parameters for the queries we will execute
			$params = array(':mentorID' => $mentorID, ':intentionID' => $scoreObj->intentionID, ':scoreDate' => $scoreObj->scoreDate,
											':score' => $scoreObj->score, ':note' => $scoreObj->note, ':altMenteeID' => $altMenteeID);
			$update->execute($params);
			$rowCount = $update->rowCount();
			if ($rowCount == 0) {
				$insert->execute($params);
				$rowCount = $insert->rowCount();
			}
			$statusObj->result = $rowCount > 0 ? 200 : 404;
			
			// ***** TESTING
			if ($statusObj->result != 200) $statusObj->params = $params;
		} else {
			$statusObj->result = 403;
		}
		
		$statusObj->scoreID = $scoreObj->scoreID;
		$statusObj->timestamp = $scoreObj->timestamp;
		$response->statuses[] = $statusObj;
	}
}

echo json_encode($response);

?>
