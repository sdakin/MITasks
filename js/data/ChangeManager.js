/**
 * The ChangeManager module optimizes the sending of changes to a
 * remote server by queueing them up and sending them in batches
 * after a certain amount of time has passed since either no change
 * was queued or a maximum delay threshold has been reached.
 *
 * @module ChangeManager
 * @uses jquery
 * @uses jquery.json-2.3.min.js
 * @uses util.js (for EventTarget)
 */

/**
 * Base class for all objects managed by the ChangeManager.
 *
 * @class ChangeObject
 * @constructor
 * @param spec a hash that is used to initialize this ChangeObject
 */
function ChangeObject(spec) {
	$.extend(this, spec);
}

/**
 * Accessor for retrieving the id property of the ChangeObject.
 * Classes that extend ChangeManager can override this method
 * to return a customized id.
 *
 * @method getID
 * @return the id property of this ChangeObject
 */
ChangeObject.prototype.getID = function() { return this.id; }


/**
 * The class that manages changes for an application. This is intended to
 * be a singleton but there is no reason why an application cannot use
 * multiple ChangeManager instances.
 *
 * @class ChangeManager
 * @extends EventTarget
 * @constructor
 */
function ChangeManager() {
	EventTarget.call(this);

	/**
	 * The timer that keeps track of the delay between checks for
	 * whether to send any pending changes to the server.
	 *
	 * @property changeTimer
	 * @type Timer
	 */
	this.changeTimer = null;

	/**
	 * The timestamp of the last time a change was queued.
	 *
	 * @property lastChangeTime
	 * @type Number (Javascript time)
	 */
	this.lastChangeTime = null;

	/**
	 * The timestamp of the last time changes were sent to the server.
	 * This is used to create an upper bound on the longest time the
	 * ChangeManager will wait before sending pending changes.
	 *
	 * @property lastSendTime
	 * @type Number (Javascript time)
	 */
	this.lastSendTime = null;

	/**
	 * A hash of the changes that have been queued. The key of the hash is
	 * each ChangeObject's id and the value is the ChangeObject itself.
	 *
	 * @property pendingChanges
	 * @type Object
	 */
	this.pendingChanges = {};

	/**
	 * An array of the changes to be sent to the server. This is different
	 * from the pendingChanges object in that it keeps track of the changes
	 * that have been sent to the server.
	 *
	 * @property changesToSend
	 * @type Array
	 */
	this.changesToSend = [];
}

ChangeManager.prototype = new EventTarget();
ChangeManager.prototype.constructor = ChangeManager;

// events fired by this object
ChangeManager.CHANGES_QUEUED = "ChangesQueued";		// { count: Number }
ChangeManager.SEND_CHANGES = "SendChanges";			// { changes: [ {}, ... ], pendingCount: Number }

// ChangeManager object properties
ChangeManager.prototype.checkDelay = 1000;
ChangeManager.prototype.sendDelay = 5000;
ChangeManager.prototype.maxSendDelay = 30000;

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
						changes: changes, 
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
*/
