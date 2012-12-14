// Inherit from EventTarget
TaskItem.prototype = new EventTarget();
TaskItem.prototype.constructor = TaskItem;

// events fired by this object
TaskItem.TASK_SELECTED = "TaskSelected";
TaskItem.TASK_CHANGED = "TaskChanged";			// { taskItem: TaskItem }

TaskItem.indentPerLevel = 21;

function TaskItem(spec) {
	EventTarget.call(this);
	for (var prop in spec)
		this[prop] = spec[prop];
	if (!this.hasOwnProperty("level")) this.level = 0;
	this.tags = [];
	if (this.status && (this.status == "incomplete" || this.status == "completed"))
		this.tags.push("checkbox");
	if (this.starred) this.tags.push("starred");
}

TaskItem.prototype.addTag = function(tagName) {
	var index = $.inArray(tagName, this.tags);
	if (index < 0) this.tags.push(tagName);
}

TaskItem.prototype.adjustUI = function($uiObj) {
	var width = $("#tasks-list").width();
	var $row = $uiObj.find(".task-item-row");
	var $items = $row.children();
	$.each($items, function(index, value) {
		if ($(value).hasClass("task-title")) {
			$(value).width(width - parseInt($(value).css("padding-left")));
		} else
			width -= $(value).width();
	});
}

TaskItem.prototype.createUI = function() {
	var $uiObj = $("#templates").find(".task-item").clone();
	var $titleUI = $uiObj.find(".task-title");
	$uiObj.attr("id", "taskid-" + this.getID());
	$uiObj.click({taskItem: this}, function(e) {
		var taskItem = e.data.taskItem;
		taskItem.fire(TaskItem.TASK_SELECTED);
		if (taskItem.isPrompt) {
			taskItem.nextCheckboxState();
			taskItem.getUI().find(".tag-checkbox").click({taskItem: taskItem}, taskItem.onCheckboxClick);
			$titleUI.val("");
			$titleUI.css("font-style", "normal");
			$titleUI.focus();
		}
	});
	if (this.isPrompt) {
		$titleUI.val("Click to enter a new task...");
		$titleUI.css("font-style", "italic");
	} else
		$titleUI.val(this.title);
	$titleUI.keydown({taskItem: this}, TaskItem.onTitleKeydown);
	var taskItem = this;
	$titleUI.bind('textchange', function (event, previousText) {
		if (taskItem.isPrompt) taskItem.isPrompt = false;
		taskItem.title = $(event.target).val();
		taskItem.onChange();
	});
	
	addTagUIs(this);
	this.setupIndent($uiObj);
	return $uiObj;
	
	function addTagUIs(taskItem) {
		var self = taskItem;
		$.each(taskItem.tags, function(index, value) {
			var tagUI;
			switch(value) {
				case "checkbox":
					if (self.status == "completed")
						tagUI = $("#templates .tpl-checkbox-completed").clone();
					else
						tagUI = $("#templates .tpl-checkbox-incomplete").clone();
					tagUI.click({taskItem: self}, self.onCheckboxClick);
					break;
				case "starred":
					tagUI = $("#templates .tpl-starred").clone();
					break;
			}
			if (tagUI) {
				$titleUI.before(tagUI);
			}
		});
		if (taskItem.tags.length > 0) {
			$titleUI.css("padding-left", "2px");
		}
	}
}

TaskItem.prototype.getBaseData = function() {
	var task = this;
	var result = {};
	addProp("taskID");
	addProp("clientID");
	addProp("taskListID");
	
	function addProp(propName) {
		if (task.hasOwnProperty(propName))
			result[propName] = task[propName];
	}
	
	return result;
}

TaskItem.prototype.getData = function() {
	var task = this;
	var result = this.getBaseData();
	result.title = this.getTitle();
	result.level = this.getLevel();
	addProp("status");
	
	function addProp(propName) {
		if (task.hasOwnProperty(propName))
			result[propName] = task[propName];
	}
	
	return result;
}

TaskItem.prototype.getID = function() {
	if (!this.hasOwnProperty("clientID")) {
		this.clientID = new Date().getTime();
	}
	return this.clientID;
}

TaskItem.prototype.getIndent = function() {
	var result = 0;
	var indent = this.getUI().find(".indent");
	if (indent.length) {
		var width = $(indent).css("width");
		if (width.length) {
			result = parseInt(width);
		}
	}
	return result;
}

TaskItem.prototype.getLevel = function() {
	return (this.level) ? Number(this.level) : 0;
}

TaskItem.prototype.getTitle = function() {
	var $titleUI = this.getUI().find(".task-title");
	return ($titleUI.length > 0 ? $titleUI.val() : "");
}

TaskItem.prototype.getUI = function() {
	return $("#taskid-" + this.getID());
}

TaskItem.prototype.hasTag = function(tagName) {
	return ($.inArray(tagName, this.tags) >= 0);
}

TaskItem.prototype.nextCheckboxState = function() {
	var $uiObj = this.getUI();
	if (this.status == "incomplete") {
		var $cbUI = $uiObj.find(".tpl-checkbox-incomplete");
		$cbUI.removeClass("tpl-checkbox-incomplete");
		$cbUI.addClass("tpl-checkbox-completed");
		$cbUI.find("img").attr("src", "img/completed.png");
		this.status = "completed";
	} else if (this.status == "completed") {
		var $cbUI = $uiObj.find(".tpl-checkbox-completed");
		$cbUI.remove();
		var $titleUI = $uiObj.find(".task-title");
		$titleUI.width($titleUI.width() + 20);
		this.status = null;
		this.removeTag("checkbox");
	} else {
		var $cbUI = $("#templates .tpl-checkbox-incomplete").clone();
		var $items = $uiObj.find(".task-item-row").children().not("div");
		var $titleUI = $uiObj.find(".task-title");
		$titleUI.width($titleUI.width() - 20);
		$items.eq(0).before($cbUI);
		this.status = "incomplete";
		this.addTag("checkbox");
	}
	this.onChange();
}

TaskItem.prototype.onChange = function() {
	if (!this.isPrompt)
		this.fire({type: TaskItem.TASK_CHANGED, taskItem: this});
}

TaskItem.prototype.onCheckboxClick = function(event) {
	var completed = (event.target.src.indexOf("completed") > 0);
	if (completed) {
		event.target.src = "img/incomplete.png";
		event.data.taskItem.status = "incomplete";
	} else {
		event.target.src = "img/completed.png";
		event.data.taskItem.status = "completed";
	}
	event.data.taskItem.onChange();
}

TaskItem.onTitleKeydown = function(event) {
	var $taskItem = event.data.taskItem;
	var handled = false;
	var keyCode = (event.keyCode) ? event.keyCode : event.which;
	if (event.ctrlKey) {
		if (keyCode == 49) {			// '1'
			$taskItem.nextCheckboxState();
			handled = true;
		} else if (keyCode == 50) {		// '2'
			$taskItem.toggleStarred();
			handled = true;
		}
	}
	return !handled;
}

TaskItem.prototype.removeTag = function(tagName) {
	var index = $.inArray(tagName, this.tags);
	if (index >= 0) this.tags.splice(index, 1);
}

TaskItem.prototype.setupIndent = function($uiObj) {
	var indent = $uiObj.find(".indent");
	var indentAmount = this.level * TaskItem.indentPerLevel;

	// special case 0 indent amount
	if (indentAmount == 0) {
		if (indent.length > 0) {
			var $titleUI = $uiObj.find(".task-title");
			$titleUI.width($titleUI.width() + indent.width());
			indent.remove();
		}
	} else {
		var deltaWidth = -indentAmount;
		if (!indent.length) {
			indent = $("#templates").find(".indent").clone();
			$uiObj.find(".task-item-row").prepend(indent);
		} else
			deltaWidth += indent.width();
		var $titleUI = $uiObj.find(".task-title");
		$titleUI.width($titleUI.width() + deltaWidth);
		indent.css("width", indentAmount);
	}
	
	// if the task item is not a checkbox and it's level is 0 then make it a heading
	if ($uiObj.find(".tpl-checkbox-completed").length == 0 &&
		$uiObj.find(".tpl-checkbox-incomplete").length == 0 &&
		(!this.level || this.level == 0) && !this.isPrompt) {
		$uiObj.addClass("task-heading");
	} else {
		$uiObj.removeClass("task-heading");
	}
}

TaskItem.prototype.setLevel = function(newLevel) {
	if (this.level != newLevel) {
		this.level = newLevel;
		this.onChange();
	}
	this.setupIndent(this.getUI());
}

TaskItem.prototype.toggleStarred = function() {
	var $uiObj = this.getUI();
	var tag = "starred";
	if (this.hasTag(tag)) {
		this.removeTag(tag);
		$uiObj.find(".tpl-starred").remove();
	} else {
		this.addTag(tag);
		var $items = $uiObj.find(".task-item-row").children().not("div");
		var index = $.inArray(tag, this.tags);
		var $tagUI = $("#templates .tpl-starred").clone();
		var $titleUI = $uiObj.find(".task-title");
		$titleUI.width($titleUI.width() - 20);
		$items.eq(index).before($tagUI);
	}
	this.onChange();
}


//-----------------------------------------------------------------------------------

// Inherit from EventTarget
TaskList.prototype = new EventTarget();
TaskList.prototype.constructor = TaskList;

// events fired by this object
TaskList.TASKDATA_LOADED = "TaskDataLoaded";		// { taskList:TaskList }

function TaskList(taskDataMgr, spec) {
	EventTarget.call(this);

	// data members
	this.dataMgr = taskDataMgr;
	this.tasks = [];
	this.listMode = "all";
	this.selectedIndex = -1;
	
	// load properties from spec obj
	for (var prop in spec)
		this[prop] = spec[prop];
}

TaskList.prototype.initTaskData = function(taskData) {
	this.tasks = [];
	for (var i = 0 ; i < taskData.tasks.length ; i++)
		this.addTask(taskData.tasks[i]);
	if (this.tasks.length == 0) {
		var promptTask = new TaskItem({});
		promptTask.isPrompt = true;
		this.addTask(promptTask);
	}
}

TaskList.prototype.addTask = function(taskData, atPosition) {
	var taskItem = new TaskItem(taskData);
	taskItem.taskListID = this.taskListID;
	if (!taskItem.hasOwnProperty("clientID")) {
		taskItem.clientID = String(new Date().getTime()) + "-" + String(this.tasks.length + 1);
	}
	if (typeof atPosition === "undefined" || atPosition >= this.tasks.length)
		this.tasks.push(taskItem);
	else
		this.tasks.splice(Math.max(0, atPosition), 0, taskItem);
	var self = this;
	taskItem.addListener(TaskItem.TASK_CHANGED, function(event) { self.dataMgr.queueTaskChange(event.taskItem.getData()); } );
	return taskItem;
}

TaskList.prototype.getSelectedTask = function() {
	var result = null;
	if (this.selectedIndex >= 0 && this.selectedIndex < this.tasks.length)
		result = this.tasks[this.selectedIndex];
	return result;
}

TaskList.prototype.loadTaskData = function() {
	if (this.tasks && this.tasks.length > 0) {
		this.fire(TaskList.TASKDATA_LOADED);
	} else {
		var self = this;
		this.dataMgr.getTaskData(this.taskListID, onLoadTaskData);
		
		function onLoadTaskData(data) {
			self.initTaskData(data);
			self.fire({type:TaskList.TASKDATA_LOADED, taskList:self});
		}
	}
}

TaskList.prototype.onChangeListMode = function(mode) {
	mode = mode.toLowerCase();
	if (mode != this.listMode) {
		this.listMode = mode;
		this.tasks.sort(sortFunction);
		this.fire({type:TaskList.TASKDATA_LOADED, taskList:self});
	}
	
	function sortFunction(a, b) {
		if (mode == "mi") {
			var aStarred = a.hasTag("starred");
			var bStarred = b.hasTag("starred");
			if (aStarred && !bStarred) return -1;
			if (bStarred && !aStarred) return 1;
		}
		return a.order - b.order;
	}
}

// if the CTRL key is held down then also indent the 
// children of the selected task
TaskList.prototype.onIndentTask = function(event) {
	if (this.selectedIndex > 0 && this.selectedIndex < this.tasks.length) {
		var task = this.tasks[this.selectedIndex];
		// cannot indent more than 1 level
		if (task.getLevel() <= this.tasks[this.selectedIndex - 1].getLevel()) {
			task.setLevel(task.getLevel() + 1);
			if (event.ctrlKey) {
				for (var index = this.selectedIndex + 1 ; index < this.tasks.length ; index++) {
					if (this.tasks[index].getLevel() >= task.getLevel())
						this.tasks[index].setLevel(this.tasks[index].getLevel() + 1);
					else
						break;
				}
			}
		}
	}
}

// if the CTRL key is held down then also outdent the 
// children of the selected task
TaskList.prototype.onOutdentTask = function(event) {
	if (this.selectedIndex >= 0 && this.selectedIndex < this.tasks.length) {
		var task = this.tasks[this.selectedIndex];
		if (task.getLevel() > 0) {
			var taskLevel = task.getLevel();
			task.setLevel(taskLevel - 1);
			if (event.ctrlKey) {
				for (var index = this.selectedIndex + 1 ; index < this.tasks.length ; index++) {
					if (this.tasks[index].getLevel() > taskLevel)
						this.tasks[index].setLevel(this.tasks[index].getLevel() - 1);
					else
						break;
				}
			}
		}
	}
}

TaskList.prototype.onRemoveTask = function() {
	if (this.selectedIndex >= 0 && this.selectedIndex < this.tasks.length) {
		var task = this.tasks[this.selectedIndex];
		this.dataMgr.queueTaskDelete(task.getBaseData());
		task.getUI().remove();
		this.tasks.splice(this.selectedIndex, 1);
		this.selectedIndex = Math.min(this.selectedIndex, this.tasks.length - 1);
	}
}
