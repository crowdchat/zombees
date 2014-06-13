#! /usr/bin/env node

// includes
var io = require('socket.io-client');
var needle = require('needle');
var http = require('http');

// specify paramaters
var argv = require('nomnom')
   .option('server', {
      abbr: 's',
      help: 'server that connections will target'
   })
   .option('num_clients', {
      abbr: 'n',
      help: 'number of client connections to create'
   })
   .option('startup_time', {
      abbr: 't',
      help: 'specifies amount of time to create connections over evenly'
   })
   .option('duration', {
      abbr: 'd',
      help: 'specifies amount of time to maintain connections'
   })
   .option('msg_sources', {
      abbr: 'm',
      help: 'specifies how many connections send messages periodically'
   })
   .option('msg_frequency', {
      abbr: 'f',
      help: 'specifies how often sources send messages'
   })
   .option('query', {
      abbr: 'q',
      help: 'specifies socket io query'
   })
   .option('', {
      abbr: 'p',
      help: 'specifies ajax post data'
   })
   .option('long_polls', {
      abbr: 'l',
      help: 'specifies how many clients use long polling (as opposed to web sockets)'
   })
   .parse();


// param processing
var server = argv.server || 'http://localhost:3000';
var clients = argv.num_clients || 10;
var sources = argv.msg_sources || 5;
var startup = argv.startup_time || clients * 1 * 1000;
var duration = argv.duration || 15 * 60 * 1000;
var freq = argv.msg_frequency || 30 * 1000;
var polling = argv.long_polls || 0;
var query = argv.query || {};
var postData = argv.postData || {};
http.globalAgent.maxSockets = 1000;


// make connections
var idx = 0;
var intervalID;

var makeConnection = function() {
  needle.get(server, function(error, response) {
    if(!response) {
      console.log(idx,' could not connect');
      return;
    }
    var cookies = response.headers['set-cookie'];
    var cookie = cookies.join(';');
    var options = {
      headers: { 'Cookie': cookie }
    };
    var socket;
    if(polling>0) {
      console.log('starting polling connection: ' + polling);
      polling -= 1;
      socket = io.connect(server, { 'force new connection': true, transports: ['xhr-polling'] });
    } else {
      socket = io.connect(server, { 'force new connection': true});
    }
    socket.on('connect', function() {
      socket.emit('spoofSession', {'cookies':cookies,'cookie':cookie, 'loggedIn': true});
      socket.idx = idx;
    });
    socket.on('ready', function() {
      socket.emit('request', query);
    });
    if((idx % (clients / sources)) == 0) {
      setInterval(function() { postSomething(socket); }, freq);
    }
    idx++;
    if (idx === clients) {
      clearInterval(intervalID);
      setTimeout(shutdown, duration);
    }
  });
};


intervalID = setInterval(makeConnection, startup/clients);

// send messages from sources
function postSomething(socket) {
  needle.post(server, postData, socket.options);
  console.log(socket.idx + ' sent something');
}

// any final steps before shutdown
function shutdown() {
  console.log('shutting down...');
  process.exit();
}

