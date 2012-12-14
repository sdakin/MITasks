//-----------------------------------------------------------------------------------
//
// ToolbarUI
//
// Inherits from EventTarget
//

ToolbarUI.prototype = new EventTarget();
ToolbarUI.prototype.constructor = ToolbarUI;

function ToolbarUI(taskListUI) {
	EventTarget.call(this);

	this.taskListUI = taskListUI;
	taskListUI.addListener(TaskListUI.SELECTION_CHANGED, this.onTaskListSelectionChanged);
	
	var $btns = $(".toolbar-btns a");
	$btns.attr("disabled", "true");		// disabled by default
	var self = this;
	$btns.click(function(event) { self.onButtonClick(event) });
}

ToolbarUI.prototype.onButtonClick = function(event) {
	var $btn = $(event.currentTarget);
	if ($btn.attr("disabled")) return;
	var taskModel = this.taskListUI.getTaskListModel();
	switch($btn.attr("action")) {
		case "indent":
			taskModel.onIndentTask(event);
			break;
		case "outdent":
			taskModel.onOutdentTask(event);
			break;
		case "delete":
			taskModel.onRemoveTask();
			this.taskListUI.updateTaskSelection();
			break;
	}
}

ToolbarUI.prototype.onTaskListSelectionChanged = function(event) {
	var $btns = $(".toolbar-btns a");
	if (event.selectedIndex >= 0)
		$btns.removeAttr("disabled");
	else
		$btns.attr("disabled", "true");
}


//-----------------------------------------------------------------------------------
//
// TaskListUI
//
// Inherits from EventTarget
//

TaskListUI.prototype = new EventTarget();
TaskListUI.prototype.constructor = TaskListUI;

// events fired by this object
TaskListUI.SELECTION_CHANGED = "SelectionChanged";	// { selectedIndex:Number }

function TaskListUI(taskDataMgr) {
	EventTarget.call(this);
	
	// data members
	this.taskLists = [];
	
	var self = this;
	taskDataMgr.addListener(TaskDataMgr.TASKLIST_ADDED, onTaskListAdded);
	taskDataMgr.addListener(TaskDataMgr.GET_TASKLISTS_DONE, onGetTaskListsDone);
	
	function onTaskListAdded(event) {
		var newTaskList = event.taskList;
		self.taskLists.push(newTaskList);
		var $entry = $("#templates .tasklist-entry").clone();
		$entry.attr("id", "tasklistid-" + newTaskList.taskListID);
		$entry.click({taskList:newTaskList}, onTaskListSelected);
		$entry.text(newTaskList.name);
		$("#list-frame .toc").append($entry);
		newTaskList.addListener(TaskList.TASKDATA_LOADED, onTaskDataLoaded);
	}
	
	function onGetTaskListsDone(event) {
		if (self.taskLists.length > 0) {
			self.selectTaskList(self.taskLists[0]);
		}
	}
	
	function onTaskDataLoaded(event) {
		self.reloadList(event.target);
	}
		
	function onTaskListSelected(event) {
		self.selectTaskList(event.data.taskList);
	}
}

TaskListUI.prototype.clearListUI = function() {
	this.getListUI().empty();
	this.selectTask(-1);
}

TaskListUI.prototype.getListUI = function() { return $("#tasks-list"); }

TaskListUI.prototype.getSelectionIndicator = function() { return $("#sel-indicator"); }

TaskListUI.prototype.getTaskListModel = function() {
	var result = null;
	var self = this;
	var $entries = $("#list-frame .tasklist-entry");
	$.each($entries, function(index, value) {
		if ($(value).hasClass("selected")) {
			result = self.taskLists[index];
			return false;
		}
	});
	return result;
}

TaskListUI.prototype.handleKeyDown = function(event) {
	function inInputField() {
		return (document.activeElement.tagName.toLowerCase() == "input");
	}
	
	var handled = false;
	var taskListModel = this.getTaskListModel();
	if (taskListModel) {
		switch (event.keyCode) {
			case 37:		// left arrow key
				if (!inInputField()) {
					taskListModel.onOutdentTask(event);
					handled = true;
				}
				break;
			case 38:		// up arrow key
				if (taskListModel.selectedIndex != 0)
					this.selectTask(Math.max(taskListModel.selectedIndex - 1, 0));
				handled = true;
				break;
			case 39:		// right arrow key
				if (!inInputField()) {
					taskListModel.onIndentTask(event);
					handled = true;
				}
				break;
			case 40:		// down arrow key
				if (taskListModel.selectedIndex < taskListModel.tasks.length - 1)
					this.selectTask(Math.max(taskListModel.selectedIndex + 1, 0));
				handled = true;
				break;
			case 9:			// tab key
				if (taskListModel.getSelectedTask()) {
					if (event.shiftKey)
						taskListModel.onOutdentTask(event);
					else
						taskListModel.onIndentTask(event);
					handled = true;
				}
				break;
			case 13:		// enter/return key
				var task = taskListModel.getSelectedTask();
				if (task) {
					var spec = {status:"incomplete", level:task.getLevel()};
					var newIndex = taskListModel.selectedIndex + (event.shiftKey ? 0 : 1);
					taskListModel.addTask(spec, newIndex);
					console.log("TODO: need to do a smart DOM insertion when adding a new task");
					this.reloadList(taskListModel);
					this.selectTask(newIndex);
					var $taskUI = taskListModel.tasks[newIndex].getUI();
					$taskUI.find(".task-title").focus();
				}
				break;
			case 27:		// escape key
				if (!inInputField()) {
					if (taskListModel.selectedIndex != -1) {
						taskListModel.selectedIndex = -1;
						this.selectTask(-1);
						handled = true;
					}
				}
				document.activeElement.blur();
				break;
			case 8:        // backspace key
				if (!inInputField()) {
					console.log("should intelligently handle the backspace key");
					handled = true;
				}
				break;
			default:
				console.log("TaskList handling key down - keyCode: " + event.keyCode);
		}
	}
	if (handled) {
		event.stopPropagation();
		event.preventDefault();
	}
}

TaskListUI.prototype.onTaskSelected = function(event) {
	var index = $.inArray(event.target, this.getTaskListModel().tasks);
	this.selectTask(index);
}

TaskListUI.prototype.reloadList = function(taskList) {
	var $listUI = this.getListUI();
	$listUI.empty();
	this.selectTask(-1);
	var self = this;
	$.each(taskList.tasks, function(index, value) {
		var $uiObj = value.createUI();
		$listUI.append($uiObj);
		value.adjustUI($uiObj);
		value.addListener(TaskItem.TASK_SELECTED, function(event) { self.onTaskSelected(event); } );
	});
}

TaskListUI.prototype.selectTask = function(index) {
	var $selInd = this.getSelectionIndicator();
	var taskListModel = this.getTaskListModel();
	taskListModel.selectedIndex = index;
	if (index >= 0 && index < taskListModel.tasks.length) {
		var pos = $("#tasks-list").position();
		var topStr = String(Number(pos.top) + (index * 20)) + "px";
		var leftStr = String(Number(pos.left) + 1) + "px";
		$selInd.css("top", topStr);
		$selInd.css("left", leftStr);
		$selInd.show();
		
		if (document.activeElement) {
			if ($(document.activeElement).hasClass("task-title")) {
				var $taskUI = taskListModel.tasks[index].getUI();
				$taskUI.find(".task-title").focus();
			}
		}
	} else
		$selInd.hide();
	this.fire({type: TaskListUI.SELECTION_CHANGED, selectedIndex: index});
}

TaskListUI.prototype.selectTaskList = function(taskList) {
	$("#list-frame .tasklist-entry").removeClass("selected");
	var $entry = $("#tasklistid-" + taskList.taskListID);
	$entry.addClass("selected");
	this.clearListUI();
	taskList.loadTaskData();
}

TaskListUI.prototype.updateTaskSelection = function() {
	this.selectTask(this.getTaskListModel().selectedIndex);
}
