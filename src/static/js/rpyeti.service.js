var RPYeti = RPYeti || {};

RPYeti.service = (function() {
	var self;

	return {
		player: null,

		init: function() {
			// save singleton context
			self = this;

			// save global event publisher (document)
			this.publisher = $(document);

			// get RPTree cookie
			var cookie = Cookies.getJSON( 'rp3.rptree' );

			// check that cookie has server ID
			if( cookie && cookie.player && cookie.player.id ) {
				self.player = cookie.player;

				// if player has chosen charity, start game
				if ( cookie.player.charity && !RPYeti.config.debug ) {
					RPYeti.game.startLevel = 1;
				}
			} else {
				// if no cookie, get ID from server and set cookie
				self.player = {
					lastScore: 0,
					highScore: 0,
					browser: navigator.userAgent,
				};
				self.savePlayer();
			}

			// add listeners to catch game events and report to server
			this.publisher.on( 'rpyeti.game.score', this.updateScore );
			this.publisher.on( 'rpyeti.game.charity', this.updateCharity );

		},

		// save player object to server and store in cookie
		savePlayer: function() {
			// save player to cookie first
			Cookies.set( 'rp3.rptree', { player: self.player }, { expires: 365 } );

			// send to server and store server modified player to cookie
			$.getJSON( '/api/player', self.player, function( player ) {
				Cookies.set( 'rp3.rptree', { player: player }, { expires: 365 } );
				self.player = player;
			}).fail( jQuery.noop );
		},

		updateScore: function(event, score) {
			self.player.lastScore = score;
			if( ! self.player.highScore || self.player.highScore < score) {
				self.player.highScore = score;
			}
			self.savePlayer();
		},

		updateCharity: function(event, charity) {
			if( ! self.player.charity ) {
				self.player.charity = charity;
				self.savePlayer();
			}
		},

	};

})();

$(function() {

	RPYeti.service.init();

});
