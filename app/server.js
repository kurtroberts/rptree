/**
* RPTree 2015 Server: Restify server
*/

// Get link to main module
app = require.main.exports;

// Initialize Restify server
var restify = require('restify'),
server = restify.createServer(app.config.server.options);

// Load Restify middleware
server.use(restify.queryParser());
server.use(restify.CORS());

// Define REST route to retrieve tweets from Mongo (used by Backbone)
server.get('/feed', function(req, res) {
	app.config.debug && console.log("<SRV> Feed request, params = " + JSON.stringify(req.params));
	app.data.listTweets(req.params)
	.then(function(tweets) {
		res.json(tweets);
	})
	.catch(function(err) {
		app.config.debug && console.log("<SRV> !!! ERROR: ", err);
		res.status(500);
	});
});

// Define tree-testing endpoint
server.get('/test-tree', function(req, res) {
	app.config.debug && console.log("<SRV> * Tree Test, params = " + JSON.stringify(req.params));
	var command = req.params.command || 'TEST';
	app.tree.send(command);
	res.json({
		command: command,
		clients: app.tree.clients.length
	});
});

// Create static route
server.get(/.*/, restify.serveStatic({
	directory: './www',
	default: 'index.html'
}));

// Start Restify server
server.listen(app.config.server.port, function() {
	console.log('<SRV> %s listening at %s', server.name, server.url);
});

// Export server
module.exports = server;