//-----------------------------------------------
// TaskDataMgr
//
// Inherits from ChangeManager
// Uses: jquery.json-2.3.min.js

TaskDataMgr.prototype = new ChangeManager();
TaskDataMgr.prototype.constructor = TaskDataMgr;

// events fired by this object
TaskDataMgr.TASKLIST_ADDED = "TaskListAdded";		// { taskList: TaskList }
TaskDataMgr.GET_TASKLISTS_DONE = "GetTaskListsDone";

function TaskDataMgr() {
	ChangeManager.call(this);
}

TaskDataMgr.prototype.getSafeID = function(taskData) {
	if (taskData.hasOwnProperty("taskID"))
		return taskData.taskID;
	else if (taskData.hasOwnProperty("clientID"))
		return taskData.clientID;
	else
		return null;
}

TaskDataMgr.prototype.getTaskData = function(taskListID, callback) {
	var params = {taskListID:taskListID};
	$.post(
		"ws/getTasks.php",
		{'data': $.toJSON(params)},
		onGetTasksResponse,
		"json"
	).error(onGetTaskError);

	function onGetTasksResponse(json) {
		callback(json);
	}
	
	function onGetTaskError() {
		alert("Unable to get tasks");
	}
}

TaskDataMgr.prototype.getTaskLists = function() {
	var taskDataMgr = this;
	$.post(
		"ws/getTaskLists.php",
		null,
		onGetTaskListsResponse,
		"json"
	).error(onGetTaskListsError);

	function onGetTaskListsResponse(json) {
		if (json.result == 200) {
			$.each(json.taskLists, function(index, value) {
				var newTaskList = new TaskList(taskDataMgr, value);
				taskDataMgr.fire({type:TaskDataMgr.TASKLIST_ADDED, taskList:newTaskList});
			});
		}
		taskDataMgr.fire({type:TaskDataMgr.GET_TASKLISTS_DONE});
	}
	
	function onGetTaskListsError() {
		alert("Unable to get task lists");
	}
}

// taskData is a JSON obj to save
TaskDataMgr.prototype.queueTaskChange = function(taskData) {
	console.log("TaskDataMgr handling task item change.");
	var newTaskData = $.extend({}, taskData);
	var changeObj = new ChangeObject({id: this.getSafeID(taskData), data:newTaskData});
	this.addChange(changeObj);
}

TaskDataMgr.prototype.queueTaskDelete = function(taskData) {
	console.log("TaskDataMgr handling task item delete.");
	var changeObj = new ChangeObject({id: this.getSafeID(taskData), data:taskData, op:"delete"});
	this.addChange(changeObj);
}

TaskDataMgr.prototype.sendChanges = function(changes, pendingCount) {
	console.log("TaskDatMgr - sending changes...");
//	return;
	
	$.post(
		"ws/processTaskChanges.php",
		{'data': $.toJSON(changes)},		// the array of changes to save
		onSaveTasksResponse,
		"json"
	).error(onSaveTaskError);

	// response  format: { statuses: [ { id: Value, result: 200 if successful }, ... ] }
	function onSaveTasksResponse(json) {
		for (var i = 0 ; i < json.statuses.length ; i++) {
			var statusObj = json.statuses[i];
			console.log("save status: " + statusObj.result + " for ID: " + statusObj.id);
		}
	}
	
	function onSaveTaskError() {
		alert("Unable to save tasks");
	}
}

//---------------------------------------------------------------
// Web Service functions
//		saveIntentionScores - sends the pending changes to the server

ChangeManager.prototype.savePrefs = function(prefs) {
	if (this.prefsTimer) {
		clearTimeout(this.prefsTimer);
	}
	this.pendingPrefs = prefs;
	this.prefsTimer = setTimeout(function() { changeMgr.sendPrefs(); }, 5000);
};

ChangeManager.prototype.sendPrefs = function(callback) {
	this.prefsTimer = null;
	$.post(
		"../ws/savePrefs.php",
		{'prefs': $.toJSON(this.pendingPrefs)},
		callback ? callback : ChangeManager.onSavePrefsResponse,
		"json"
	);
	this.pendingPrefs = null;
};

//---------------------------------------------------------------
// Web Service response handlers
//
// Note: these are jQuery callback functions and as such are called outside of
// the IntentionLog context meaning the 'this' pointer is not the same as the 
// intentionLog object.

ChangeManager.onSaveIntentionScoresResponse = function(json) {
//	if (json.result == 200) {
//	}
	for (var i = 0 ; i < json.statuses.length ; i++) {
		var statusObj = json.statuses[i];
		console.log("save status: " + statusObj.result);
	}
};

ChangeManager.onSavePrefsResponse = function(json) {
//	if (json.result == 200) {
//	} else {
//	}
};
