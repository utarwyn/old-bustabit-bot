var BustabitBot = {

	PLAY_URL        : "https://www.bustabit.com/play",
	DEFAULT_BET     : 7, 
	DEFAULT_CASHOUT : 1.13,

	document : null,
	account  : null,
	balance  : 0.0,

	currentBet     : 0,
	currentCashOut : 0.0,




	init: function() {
		if(gBrowser) 
			gBrowser.addEventListener("DOMContentLoaded", this.onPageLoad.bind(this), false);
	},

	onPageLoad: function(aEvent) {
		var doc = aEvent.originalTarget;
		var win = doc.defaultView;
		var url = doc.location.href;

		this.document = doc;

		if (doc.nodeName != "#document") return;
		if (win.frameElement)            return;
		if (url != this.PLAY_URL)        return;

		var self = this;
		
		this.log("Extension activée. Bot disponible.");
		this.log("Tentative de connexion...");

		this._intervalLogin = setInterval(function() {
			if (self.account == null) self.tryToLogin();
			else                      clearInterval(self._intervalLogin);
		}, 1000);
	},
	tryToLogin: function() {

		// On regarde si le joueur est connecté
		if (!this.isUserConnected()) {
			this.log("En attente d'une connexion.");
			return;
		} else {
			this.refreshUserData();
			this.log("✔ Compte " + this.account + " connecté avec " + this.balance + " bits.");
		}

		var self = this;
		this.document.addEventListener("keyup", function(ev) {
			if (ev.keyCode == 82) {
				self.calcNextBet.call(self);
				self.runBet.call(self);
			}
		}, false);
	},

	isUserConnected: function() {
		return this.document.querySelector(".user-login .login") == null;
	},

	refreshUserData: function() {
		this.account = this.document.querySelector(".user-login .username a").innerHTML;

		var strBalance = this.document.querySelector(".user-login .balance-bits .balance").innerHTML;
		this.balance = parseFloat(strBalance.replace(",", ""));
	},

	calcNextBet: function() {
		this.currentBet     = this.DEFAULT_BET;
		this.currentCashOut = this.DEFAULT_CASHOUT;
	},

	runBet: function() {
		var betInput     = this.document.querySelector(".bet-container .bet-input-group input");
		var cashoutInput = this.document.querySelector(".autocash-container .bet-input-group input");

		this.writeStringInInput(betInput     , this.currentBet.toString());
		// this.writeStringInInput(cashoutInput , this.currentCashOut.toString().replace(",", "."));
	},

	writeStringInInput: function(input, str) {
		var self = this;

		input.focus();

		setInterval(function() {
			var evt = self.document.createEvent("KeyboardEvent");
			var initMethod = typeof evt.initKeyboardEvent !== 'undefined' ? "initKeyboardEvent" : "initKeyEvent";

			evt[initMethod]("keypress", true, true, self.document.defaultView, 0, 0, 0, 0, 0, 8);

			input.dispatchEvent(evt)
		}, 500);
	},


	log: function(message) {
		console.log("[BustabitBot] " + message);
	}

}


window.addEventListener("load", function load(event){
	window.removeEventListener("load", load, false); //remove listener, no longer needed
	BustabitBot.init();
}, false);