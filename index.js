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
   .option('chat_id', {
      abbr: 'i',
      help: 'specifies how often sources send messages'
   })
   .option('hash', {
      abbr: 'a',
      help: 'specifies how often sources send messages'
   })
   .option('long_polls', {
      abbr: 'l',
      help: 'specifies how many clients use long polling (as opposed to web sockets)'
   })
   .parse();


// param processing
if(!argv.chat_id || ! argv.hash) {
  console.log('Chat ID and Hash are required.');
  process.exit();
}
var chat = argv.chat_id;
var hash = argv.hash;
var server = argv.server || 'http://localhost:3000';
var clients = argv.num_clients || 10;
var sources = argv.msg_sources || 5;
var startup = argv.startup_time || clients * 1 * 1000;
var duration = argv.duration || 15 * 60 * 1000;
var freq = argv.msg_frequency || 30 * 1000;
var polling = argv.long_polls || 0;
http.globalAgent.maxSockets = 1000;


// make connections
var idx = 0;
var intervalID;

var makeConnection = function() {
  needle.get(server+'/'+hash+'err', function(error, response) {
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
      socket.options = options;
      socket.hash = hash;
      socket.chat = chat;
    });
    socket.on('ready', function() {
      var query = {
        hash: socket.hash,
        spot_id: socket.chat,
        isLSVisible: 'true',
        sortBy: 'activity',
        cookie: socket.idx
      };
      socket.emit('request', query);
    });
    if((idx % (clients / sources)) == 0) {
      // msg source
      console.log(idx + 1, ' is a source ' );
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
  needle.post(server+'/'+socket.hash, {
    operation: "add_post",
    orig: socket.idx,
    parent_id: socket.chat,
    hash: socket.hash,
    spot_id: socket.chat,
    tweet: false,
    share: false,
    fbpost: false,
    content: [],
    caseHash: socket.hash,
    post_type: 'post',
    urls: []
  }, socket.options);
  console.log(socket.idx + ' sent something');
}

// any final steps before shutdown
function shutdown() {
  console.log('shutting down...');
  process.exit();
}

