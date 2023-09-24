//Server for sequence sandbox

//library variables
var express = require('express');
var compression = require('compression');
var app = express();
var cors = require('cors');
var brotli = require('iltorb').compressStream;
const fs = require('fs');
var http = require('http');
var server = http.createServer(app);
var port =  process.env.PORT;
var io = require('socket.io').listen(server);

var gameSocket = null;

//game variables
var balls = [];
var playerSpawnPoints = [];
var clients = [];
var phones = [];
var phonespawnPoints = [];


//permissions
app.use(cors());
function onRequest (req, res) {
			fs.createReadStream(__dirname+"/TemplateData").pipe(brotli()).pipe(res);

}
//app.use("/TemplateData", express.static(__dirname+"/TemplateData"));
app.use("/Build", express.static(__dirname+"/Build", {
	setHeaders: function(res, path) {
		if(path.endsWith(".unityweb")){
            res.set("Content-Encoding", "br");
		}
	}
}));
//app.use(compression());
app.use(express.static(__dirname));

//start server

if (port == null || port == ''){
	port = 3000;
}

server.listen(port, function(){
	console.log('listening to server: \n --- server is running...');
});

//redirect response to serve index.html
app.get('/', function(req, res) {
	res.sendFile(__dirname+ 'index.html');
});

var roomNo = 1;
var mega = 1;
//implement socket functionality
gameSocket = io.on('connection', function(socket){
	//send socket connection messages
	var currentPlayer = {};
	var currentBall = {};
	var currentPhone = {};
	currentPlayer.name = 'unknown';

	console.log('socket connected' + socket.id);
	socket.on('disconnect', function(){
	console.log('socket disconnected'+ socket.id);
	});

	socket.on('player linked', function(){
		console.log(' recv: player linked');
	});

	//new player connected data
	socket.on('player connect', function(){
			
	//create rooms
	if(io.nsps['/'].adapter.rooms["shoes"+roomNo] && io.nsps['/'].adapter.rooms["shoes"+roomNo].length > 5) roomNo++;
	if(io.nsps['/'].adapter.rooms["megaphone"+roomNo+mega] && io.nsps['/'].adapter.rooms["megaphone"+roomNo+mega].length > 2) mega++;

	socket.join("shoes"+roomNo);
	console.log("shoes"+roomNo);	

		console.log(currentPlayer.name + ' recv: player connect');
		for (var i = 0; i<clients.length; i++){	

			var playerConnected = {
				name:clients[i].name,
				position:clients[i].position,
				rotation:clients[i].rotation,
				room: roomNo,
				megaroom: mega
			}	
		socket.emit('other player connected', playerConnected);
		console.log(currentPlayer.name+' emit: other player connected: '+roomNo);
		}
	});

	socket.on('play', function(data){
		console.log(currentPlayer.name+' recv: play: '+roomNo);

		//if user is first player to enter

		if(clients.length === 0){
			console.log('first player has entered');

			//create tennis ball
			numberOfBalls = data.ballSpawnPoints.length;
			balls = [];
			data.ballSpawnPoints.forEach(function(ballSpawnPoint){
				var ball = {
					name: "tennisBall",
					position: ballSpawnPoint.position,
					rotation: ballSpawnPoint.rotation
				};
				balls.push(ball);
			});

			//create spawn points
			playerSpawnPoints = [];
			data.playerSpawnPoints.forEach(function(_playerSpawnPoint){
				var playerSpawnPoint = {
					position: _playerSpawnPoint.position,
					rotation: _playerSpawnPoint.rotation,
				};
				playerSpawnPoints.push(playerSpawnPoint);
			});
		}

		var ballsResponse = {
			balls: balls
		};

		//emit balls
		console.log(currentPlayer.name+' emit: balls: '+JSON.stringify(ballsResponse));
		socket.emit('tennisBalls', ballsResponse);

		//joining players
		var randomSpawnPoint = playerSpawnPoints[Math.floor(Math.random() * playerSpawnPoints.length)];
		currentPlayer = {
			name:data.name,
			position: randomSpawnPoint.position,
			rotation: randomSpawnPoint.rotation,
			room: roomNo,
			megaroom: mega
		};

		clients.push(currentPlayer);
		//tell you that you have joined
		console.log(currentPlayer.name+ ' emit: play: '+JSON.stringify(currentPlayer));
		socket.emit('play', currentPlayer);
		//tell other players about you
		socket.broadcast.emit('other player connected', currentPlayer);
	});

	socket.on("sceneChange", function(data){
	if(data.sceneName =="shoes"){
	{
		socket.join("shoes"+currentPlayer.room);
		socket.emit(data.sceneName);
		console.log(data.sceneName+currentPlayer.room);
	}
	}else if (data.sceneName =="wallBall"){
		socket.leave("shoes"+currentPlayer.room);
		socket.join("wallBall"+currentPlayer.room);
		socket.emit(data.sceneName);
		console.log(data.sceneName+currentPlayer.room);
	} else if(data.sceneName == "megaphone"){
		socket.leave("wallBall"+currentPlayer.room);
		socket.join("megaphone"+currentPlayer.room);
		socket.join("megaphone"+currentPlayer.room+currentPlayer.megaroom);
		socket.emit(data.sceneName);
		console.log(data.sceneName+currentPlayer.room);
	}else if(data.sceneName == "running"){
		socket.leave("megaphone"+currentPlayer.room);
		socket.leave("megaphone"+currentPlayer.room+currentPlayer.megaroom)
		socket.join("running"+currentPlayer.room);
		socket.emit(data.sceneName);
		console.log(data.sceneName+currentPlayer.room);
	}else{
		socket.leave("room-"+currentPlayer.room);
		socket.join("shoes"+currentPlayer.room);
		socket.emit(data.sceneName);
		console.log(data.sceneName+currentPlayer.room);
	}
	});

	socket.on('player move', function(data){
		//console.log('recv: p move: '+JSON.stringify(data));
		currentPlayer.position = data.position;
		socket.to("wallBall"+currentPlayer.room).emit('player move', currentPlayer);
	});

	socket.on('megamove', function(data){
		//console.log('recv: p move: '+JSON.stringify(data));
		currentPlayer.position = data.position;
		socket.to("megaphone"+currentPlayer.room).emit('megamove', currentPlayer);
	});

	socket.on('player turn', function(data){
		//console.log('recv: p turn: '+JSON.stringify(data));
		currentPlayer.rotation = data.rotation;
		socket.to("wallBall"+currentPlayer.room).emit('player turn', currentPlayer);
	});

	socket.on('ball move', function(data){
		console.log('recv: b move: '+JSON.stringify(data));
		currentBall.position = data.position;
		socket.to("wallBall"+currentPlayer.room).emit('ball move', currentBall);
	});

	socket.on('ball parent', function(data){
		console.log('recv: b parent: '+JSON.stringify(data));
		currentBall.parent = data.parent;
		socket.to("wallBall"+currentPlayer.room).emit('ball parent', currentBall);
	});

	socket.on('local ball', function(data){
		console.log('recv: local ball: '+JSON.stringify(data));
		currentBall.isLocalBall = data.isLocalBall;
		socket.to("wallBall"+currentPlayer.room).emit('local ball', currentBall);
	});

	socket.on('ball gravity', function(data){
		console.log('recv: ball gravity: '+JSON.stringify(data));
		currentBall.useGravity = data.useGravity
		socket.to("wallBall"+currentPlayer.room).emit('ball gravity', currentBall);
	});

	socket.on('ball velocity', function(data){
		console.log('recv: ball velocity: '+JSON.stringify(data));
		currentBall.ballVelocity = data.ballVelocity;
		socket.to("wallBall"+currentPlayer.room).emit('ball velocity', currentBall);
	});

	socket.on('clap', function(data){
		console.log('recv: clap: '+JSON.stringify(data));
		currentPlayer.clap = data.clap;
		socket.to("wallBall"+currentPlayer.room).emit('clap', currentPlayer);
	});

	socket.on('player shoot', function(){
		console.log(currentPlayer.name+'recv: shoot');
		var data = {
			name: currentPlayer.name
		};
		console.log(currentPlayer.name+'bcst: player shoot'+JSON.stringify(data)+"shoes"+currentPlayer.room);
		io.to("shoes"+currentPlayer.room).emit('player shoot', data);
	});
	
	socket.on('glow', function(data){
		currentPlayer.glow = data.glow;
		socket.to("megaphone"+currentPlayer.room).emit('glow', currentPlayer);
	});

	socket.on('message', function(data){
		console.log('recv: is recording: '+JSON.stringify(data));
		currentBall.isRecording = data.isRecording;
		socket.to("megaphone"+currentPlayer.room+currentPlayer.megaroom).emit('message', currentBall);
	});

	socket.on('stop audio', function(data){
		console.log('recv: play audio: '+JSON.stringify(data));
		currentBall.samples = data.samples;
		socket.to("megaphone"+currentPlayer.room+currentPlayer.megaroom).emit('stop audio', currentBall);
	});

	socket.on('disconnect', function(){
		console.log(currentPlayer.name+' recv: disconnect '+currentPlayer.name);
		socket.broadcast.emit('disconnected', currentPlayer);
		console.log(currentPlayer.name+' bcst: disconnected '+JSON.stringify(currentPlayer));
		for (var i = 0; i <clients.length; i++) {
			if(clients[i].name === currentPlayer.name) {
				clients.splice(i, 1);
			}
		}
	});
});


function guid() {
	function s4(){
		return Math.floor((1+Math.random())*0x10000).toString(16).substring(1);
	}
	return s4()+s4()+'-'+ s4()+'-'+s4()+'-'+s4()+'-'+s4()+s4()+s4();
}