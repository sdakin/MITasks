//-----------------------------------------------
//		ChangeManager component
//    
//    	uses: jquery.json-2.3.min.js

//-----------------------------------------------
// ChangeObject

function ChangeObject(spec) {
	for (var prop in spec)
		this[prop] = spec[prop];
}

ChangeObject.prototype.getID = function() { return this.id; }


//-----------------------------------------------
// ChangeManager
// Inherits from EventTarget

ChangeManager.prototype = new EventTarget();
ChangeManager.prototype.constructor = ChangeManager;

// events fired by this object
ChangeManager.CHANGES_QUEUED = "ChangesQueued";		// { count: Number }
ChangeManager.SEND_CHANGES = "SendChanges";			// { changes: [ {}, ... ], pendingCount: Number }

// ChangeManager constructor
function ChangeManager() {
	EventTarget.call(this);

	// data members
	this.changeTimer = null;
	this.lastChangeTime = null;
	this.lastSendTime = null;
	this.pendingChanges = {};
	this.changesToSend = [];
}

// ChangeManager object properties
ChangeManager.prototype.checkDelay = 1000;
ChangeManager.prototype.sendDelay = 5000;
ChangeManager.prototype.maxSendDelay = 30000;
//ChangeManager.prototype.prefsTimer = null;
//ChangeManager.prototype.pendingPrefs = null;
//ChangeManager.prototype.sendAllCallback = null;

// Adds a change to the queue or updates one if it's already in the queue
// and then fires a CHANGES_QUEUED event.
ChangeManager.prototype.addChange = function(changeObj) {
	var objID = changeObj.getID();
	console.log("queueing change with ID: " + objID + " at: " + new Date().getTime());
	changeObj.timestamp = new Date().getTime();
	this.pendingChanges[objID] = changeObj;
	
	// if our change timer doesn't exist then call updateChangeTimer to set it up
	if (!this.changeTimer) {
		this.updateChangeTimer();
	}
	
	var changeKeys = $.map(this.pendingChanges, function(value, key) { return key; });
	var changeEvent = { type: ChangeManager.CHANGES_QUEUED, count: changeKeys.length };
	this.fire(changeEvent);
	this.lastChangeTime = new Date().getTime();
};

ChangeManager.prototype.checkChanges = function () {
	var now = new Date().getTime();
	
	// we only want to check for pending changes to be sent if either of the following is true:
	//	* we haven't received a new change for at least 5 seconds
	//	* it has been at least 30 seconds since our last send
	var doSendCheck = false;
	if (this.lastChangeTime === null || now - this.lastChangeTime > this.sendDelay) {
		doSendCheck = true;
	} else if (this.lastSendTime !== null && now - this.lastSendTime > this.maxSendDelay) {
		doSendCheck = true;
	}
	
	if (doSendCheck) {
		var changeKeys = $.map(this.pendingChanges, function(value, key) { return key; });
		var pendingChangeCount = changeKeys.length;
		if (pendingChangeCount > 0) {
			var self = this;
			$.each(changeKeys, function(index, key) {
				var changeObj = self.pendingChanges[key];
				if (now - changeObj.timestamp > self.sendDelay) {
					// first check to see if the changeObj is already in our array of
					// objects to send (i.e., in progress); if so then replace it
					var inQueue = false;
					$.each(self.changesToSend, function(index, value) {
						if (value.id == changeObj.id) {
							self.changesToSend[index] = changeObj;
							inQueue = true;
							return false;
						}
					});
					if (!inQueue)
						self.changesToSend.push(changeObj);
					delete self.pendingChanges[key];
					pendingChangeCount -= 1;
				}
			});
			this.sendChanges(this.changesToSend, pendingChangeCount);
			this.updateChangeTimer();
		}
	} else {
		var self = this;
		this.changeTimer = setTimeout(function() { self.checkChanges(); }, this.checkDelay);
	}
}

ChangeManager.prototype.sendChanges = function(changes, pendingCount) {
	var changeEvent = { type: ChangeManager.SEND_CHANGES,
						changes: this.changesToSend, 
						pendingCount: pendingChangeCount };
	this.fire(changeEvent);
}

ChangeManager.prototype.updateChangeTimer = function() {
	var changeKeys = $.map(this.pendingChanges, function(value, key) { return key; });
	if (changeKeys.length === 0) {
		delete this.changeTimer;
		this.changeTimer = null;
	} else {
		var self = this;
		this.changeTimer = setTimeout(function() { self.checkChanges(); }, this.checkDelay);
	}
}

/*
ChangeManager.prototype.sendAll = function (completionCallback) {
	this.sendAllCallback = completionCallback;
	if (this.changeTimer) { clearTimeout(this.changeTimer); }
	if (this.prefsTimer) { clearTimeout(this.prefsTimer); }
	
	var changesToSend = [];
	if (this.pendingChanges) {
		var changeKeys = $.map(this.pendingChanges, function(value, key) { return key; });
		var pendingChangeCount = changeKeys.length;
		if (pendingChangeCount > 0) {
			$.each(changeKeys, function(index, key) {
				var changeObj = changeMgr.pendingChanges[key];
				changesToSend.push(changeObj);
				delete changeMgr.pendingChanges[key];
			});
		}
	}
	
	if (changesToSend.length > 0) {
		this.sendChanges(changesToSend, ChangeManager.changesSent);
	} else {
		ChangeManager.changesSent();
	}
};

ChangeManager.changesSent = function() {
	console.log("changes sent.");
	if (changeMgr.pendingPrefs) {
		changeMgr.sendPrefs(ChangeManager.prefsSent);
	} else {
		ChangeManager.prefsSent();
	}
};

ChangeManager.prefsSent = function() {
	console.log("prefs sent.");
	if (changeMgr.sendAllCallback) {
		changeMgr.sendAllCallback();
	}
};

ChangeManager.prototype.sendChanges = function(changes, callback) {
	if (changes.length > 0) {
		console.log("sending changes at: " + new Date().getTime());
		this.saveIntentionScores(changes, callback);
	}
};
*/
