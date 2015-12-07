/**
* RPTree 2015 Server: Data module
*/

// Get link to main module
var app = require.main.exports;

// Load required modules
var _			= require('lodash'),
	Promise		= require('bluebird'),
	db			= require('monk')( app.config.db ),
	uuid		= require('node-uuid');

var data = _.bindAll({

	init: function() {

		this.defineTweets();
		this.definePlayers();

		app.emit( 'data:ready' );
		console.log( 'Data initialized' );
	},

	defineTweets: function() {
		// Set up tweets collection
		this.tweets = db.get( 'tweets' );

		// Ensure indexes
		this.tweets.index({ 'id': -1 }, { unique: true });
		this.tweets.index({ 'timestamp': -1 });
	},

	definePlayers: function() {
		// Set up players collection
		this.players = db.get( 'players' );

		// Ensure indexes
		this.players.index({ 'id': 1 }, { unique: true });
	},

	listTweets: function(params) {
		var opts = {
			skip: _.parseInt( params.skip ) || 0,
			limit: _.parseInt( params.limit ) || app.config.feed.pagesize,
			sort: { id: -1 }
		};
		var query = {
			hidden: { $exists: false }
		};
		if(params.before && Date.parse( params.before )) {
			_.assign(query, { timestamp: { $lt: new Date( params.before ) } });
		}
		if(params.after && Date.parse( params.after )) {
			_.assign(query, { timestamp: { $gt: new Date( params.after ) } });
		}
		if(params.since && !_.isNaN( parseInt( params.since ) )) {
			_.assign(query, { id: { $gt: params.since } });
		}
		if(params.priorTo && !_.isNaN( parseInt( params.priorTo ) )) {
			_.assign(query, { id: { $lt: params.priorTo } });
		}

		var result = this.tweets.find( query, opts )
		.error(function(err) {
			console.log( '## Data error: ', err );
		});
		return Promise.cast( result );
	},

	saveTweet: function(tweet) {
		var result = this.tweets.findAndModify(
			{ id: tweet.id },
			{ $set: tweet },
			{ upsert: true, new: true }
		)
		.error(function(err) {
			console.log( '## Data error: ', err );
		});
		return Promise.cast( result );
	},

	savePlayer: function(player) {
		if( ! player.id ) {
			player.id = uuid.v1();
		}
		player = _.omit( player, '_id' );
		player.highScore = parseInt( player.highScore );
		player.lastScore = parseInt( player.lastScore );
		var result = this.players.findAndModify(
			{ id: player.id },
			{ $set: player },
			{ upsert: true, new: true }
		)
		.error(function(err) {
			console.log( '## Data error: ', err );
		});
		return Promise.cast( result );
	},

});

app.on( 'application:start', data.init );

// Set module export
module.exports = data;