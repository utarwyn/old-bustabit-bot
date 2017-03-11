var BustabitBot = {

	GAME_URL        : "https://www.bustabit.com/play",
	MAX_LOOSE       : 5,
	DEFAULT_BET     : 9, 
	DEFAULT_CASHOUT : 1.13,
	BET_MULTIPLIER  : 4.0,

	document : null,
	account  : null,
	balance  : 0.0,

	currentBet     : 0,
	currentCashOut : 0.0,
	cumulBitLost   : 0.0,
	firstGame      : true,



	init: function() {
		if(gBrowser) 
			gBrowser.addEventListener("DOMContentLoaded", this.onPageLoad.bind(this), false);
	},

	onPageLoad: function(aEvent) {
		var doc = aEvent.originalTarget;
		var win = doc.defaultView;
		var url = doc.location.href;

		this.account      = null;
		this.balance      = 0.0;
		this.firstGame    = true;
		this.cumulBitLost = 0.0;
		this.document     = doc;

		if (doc.nodeName != "#document") return;
		if (win.frameElement)            return;
		if (url != this.GAME_URL)        return;

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


			if (this._intervalGame != null) clearInterval(this._intervalGame);

			this.startGameDetection();
			this.personalizeIHM();
		}
	},

	isUserConnected: function() {
		return this.document.querySelector(".user-login .login") == null;
	},

	refreshUserData: function() {
		this.account = this.document.querySelector(".user-login .username a").innerHTML;

		var strBalance = this.document.querySelector(".user-login .balance-bits .balance").innerHTML;
		this.balance = parseFloat(strBalance.replace(",", ""));

		var bestBet = this.calcBestBet();
		if (bestBet > this.currentBet) {
			this.log("La mise initiale a été trouvée : " + bestBet + " !");
			this.DEFAULT_BET = this.currentBet;
		}
	},
	startGameDetection: function() {
		var self = this;
		this._intervalGame = setInterval(function() {
			if (self.account == null) return;

			var gameStarting = self.document.querySelector("#game-right-container .bet-bar-starting") != null;

			if (!self._lastGameStatut && gameStarting)
				self.onGameStarting.call(self);

			self._lastGameStatut = gameStarting;
		}, 100);
	},
	personalizeIHM: function() {
		var betTabs    = this.document.querySelectorAll(".buttons-container .button-holder");
		var betBtn     = this.document.querySelector("button.bet-button");
		var bottomTabs = this.document.querySelectorAll("#tabs-controls-col .tab-container li");

		betTabs[0].querySelector("a").innerHTML = "BOT Bustabit";
		betTabs[1].parentNode.removeChild(betTabs[1]);

		betBtn.height = "10px";

		bottomTabs[0].querySelector("a").innerHTML = "Historique";
		bottomTabs[1].querySelector("a").innerHTML = "Graphique";
	},


	onGameStarting: function() {
		this.info("Une nouvelle partie vient de commencer !");

		this.calcNextBet();
		this.runBet();

		this.info("On tente de jouer " + this.currentBet + " bits à " + this.currentCashOut + "x.");
	},


	calcNextBet: function() {
		var lastCrashOut = this.getGameCrashOut(0);

		if (this.currentBet     == 0) this.currentBet     = this.DEFAULT_BET;
		if (this.currentCashOut == 0) this.currentCashOut = this.DEFAULT_CASHOUT;

		// On a perdu à la partie précédente
		if (!this.firstGame && lastCrashOut < this.currentCashOut) {
			this.info("Partie précedente perdue :'( On joue plus !");

			// On joue pour gagner ce que l'on a perdu
			this.cumulBitLost   += this.getLastLooseGameBit(0);
			this.currentBet     *= this.BET_MULTIPLIER;
			this.currentCashOut = round(this.cumulBitLost / this.currentBet + 1, 2);

		} else if (!this.firstGame) {
			this.log("Partie gagnée ! On garde notre mise ❤.");
			// On remet tout par défaut en cas de victoire
			this.cumulBitLost   = 0.0;
			this.currentBet     = this.DEFAULT_BET;
			this.currentCashOut = this.DEFAULT_CASHOUT;
			
			/*  On regarde ensuite si on peut jouer une mise plus intéressante !  */
			var bestBet = this.calcBestBet();
			if (bestBet > this.currentBet) {
				this.log("Une meilleure mise a été trouvée (" + bestBet + ") !");
				this.currentBet  = bestBet;
				this.DEFAULT_BET = this.currentBet;
			}
		}

		this.firstGame = false;
	},
	calcBestBet: function() {
		/*  ----------------------------------------------------------------------
			 On calcule la meilleure mise que l'on peut mettre en jeu pour ne pas 
			 perdre 5x de suite et se retrouver à zéro ou dans le négatif.
		    ----------------------------------------------------------------------  */
		var lastGoodBet  = this.DEFAULT_BET;
		var maxBotBet    = 1000;
		var calcLooseBets;
		var sumDefeats   ;

		for (var sBet = 1; sBet < maxBotBet; sBet++) {
			calcLooseBets = sBet;
			sumDefeats    = 0.0;

			for (var looses = 0; looses < this.MAX_LOOSE; looses++) {
				calcLooseBets *= this.BET_MULTIPLIER;
				sumDefeats    += calcLooseBets;
			}

			if (sumDefeats > this.balance)
				return lastGoodBet;

			lastGoodBet = sBet;
		}

		return this.DEFAULT_BET;
	},

	getGameCrashOut: function(position) {
		var table = this.document.querySelector("table.games-log tbody");
		if (table == null) return -1;
		var line  = table.querySelectorAll("tr")[position];
		if (line == null) return -1;

		return parseFloat(line.querySelector("a span").innerHTML);
	},
	getLastLooseGameBit: function() {
		var table = this.document.querySelector("table.games-log tbody");
		if (table == null) return 0;
		var r = 0;

		for (var line of table.querySelectorAll("tr")) {
			if (r > 0) break;
			var strProfit = line.querySelectorAll("td")[4];

			if (strProfit.innerHTML == "-") continue;
			var profit = parseFloat(strProfit.innerHTML);

			if (profit < 0)
				r = Math.abs(profit);
		}

		return r;
	},

	runBet: function() {
		var betInput     = this.document.querySelector(".bet-container .bet-input-group input");
		var cashoutInput = this.document.querySelector(".autocash-container .bet-input-group input");
		var button       = this.document.querySelector(".bet-button-container .bet-button");

		this.writeStringInInput(betInput     , this.currentBet.toString()                      );
		this.writeStringInInput(cashoutInput , this.currentCashOut.toString().replace(",", "."));

		// On clique sur le bouton
		button.click();
	},


	writeStringInInput: function(input, value) {
		input.value = value;
		var event = this.document.createEvent('Event');

		event.initEvent('input', true, false);
		input.dispatchEvent(event);
	},


	log: function(message) {
		console.log("[BustabitBot] " + message);
	},
	info: function(message) {
		console.info("[BustabitBot] " + message);
	},
	err: function(message) {
		console.error("[BustabitBot] " + message);
	}

}


window.addEventListener("load", function load(event){
	window.removeEventListener("load", load, false);
	BustabitBot.init();
}, false);

function round(value, exp) {
	if (typeof exp === 'undefined' || +exp === 0)
		return Math.round(value);

	value = +value;
	exp = +exp;

	if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0))
		return NaN;

	// Shift
	value = value.toString().split('e');
	value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp)));

	// Shift back
	value = value.toString().split('e');
	return +(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp));
}