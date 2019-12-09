

// myapp.js
var stats;
var timer;
var tempoAtual = 0;
var manifestUri = 'http://rdmedia.bbc.co.uk/dash/ondemand/elephants_dream/1/client_manifest-all.mpd';
// var manifestUri = 'https://yt-dash-mse-test.commondatastorage.googleapis.com/media/car-20120827-manifest.mpd';

// if disabled, you can choose variants using player.selectVariantTrack(track: Variant, clearBuffer: boolean)
const enableABR = true

const evaluator = {
	currentTrack: false,
	evaluate: () => {},
}

const { Logger } = require('./src/logger');
const { Event } = require('./src/event');
const { CredentialManager } = require('./src/credential');

const email = 'nabson.paiva@icomp';
const password = '1nabson.paiva2';
let logger;
let econtrols;
let emedia;

CredentialManager.login(email, password).then(({ token })=>{
	logger = new Logger(email, token);
	logger.
	econtrols = new Event();
	emedia = new Event();
});

// Adaptation Strategy
evaluator.evaluate = (tracks,currentBandwidth,startBuffer,endBuffer) => {
	
	var buffer = tempoAtual - startBuffer;
	var i = 0

	if (currentBandwidth < 1000000) {
		i = 0
		console.warn('VIDEO COM QUALIDADE 0',currentBandwidth);
	} else {
		if (currentBandwidth < 5000000) {
			i = 1
			console.warn('VIDEO COM QUALIDADE 1',currentBandwidth);
		} else {
			if (currentBandwidth < 10000000) {
				i = 2
				console.warn('VIDEO COM QUALIDADE 2',currentBandwidth);
			} else {
				if (currentBandwidth < 15000000) {
					i = 3
					console.warn('VIDEO COM QUALIDADE 3',currentBandwidth);
				} else {
					i = 4
					console.warn('VIDEO COM QUALIDADE 4',currentBandwidth);
				}
			}
		}
	}

	// Se o vídeo estiver perto do limite, diminui a qualidade para receber mais frames em menos espaço
	if (buffer > 0 && buffer < 5) {
		if (i > 1) i = i - 2
	} else {
		if (buffer < 10) {
			if (i > 0) i = i - 1
		}
	}

	selected = tracks[i]
	return selected
}

function initApp() {
	// Install built-in polyfills to patch browser incompatibilities.
	shaka.polyfill.installAll();
	
	// Check to see if the browser supports the basic APIs Shaka needs.
	if (shaka.Player.isBrowserSupported()) {
		// Everything looks good!
		initPlayer();
	} else {
		// This browser does not have the minimum set of APIs we need.
		console.error('Browser not supported!');
	}
}

function initPlayer() {
	// Create a Player instance.
	var video = document.getElementById('video');
	var player = new shaka.Player(video);
	
	// Attach player to the window to make it easy to access in the JS console.
	window.player = player;
	// Attach evaluator to player to manage useful variables
	player.evaluator = evaluator;
	
	
	// create a timer
	timer = new shaka.util.Timer(onTimeCollectStats)
	//stats = new shaka.util.Stats(video)
	
	
	video.addEventListener('ended', onPlayerEndedEvent)
	video.addEventListener('play', onPlayerPlayEvent)
	video.addEventListener('pause', onPlayerPauseEvent)
	video.addEventListener('progress', onPlayerProgressEvent)
	
	// // Listen for error events.
	player.addEventListener('error', onErrorEvent);
	// player.addEventListener('onstatechange',onStateChangeEvent);
	// player.addEventListener('buffering', onBufferingEvent);
	
	// configure player: see https://github.com/google/shaka-player/blob/master/docs/tutorials/config.md
	player.configure({
		abr: {
			enabled: enableABR,
			switchInterval: 1,
		}
	})

	/**
	 * Our SimplesAbrManager.prototype.chooseVariant code
	 * @override
	 */

	shaka.abr.SimpleAbrManager.prototype.chooseVariant = function() {
		this.enabled_ = true;
		// console.error('Choosing variants...');
		// get variants list and sort down to up
		var tracks =  this.variants_.sort((t1, t2) => t1.video.height - t2.video.height)

		// BANDA ATUAL
		let currentBandwidth = this.bandwidthEstimator_.getBandwidthEstimate(
			this.config_.defaultBandwidthEstimate);


		console.log('tracks: ', this.variants_)

		var startBuffer = -1
		var endBuffer = -1
		console.warn(video.buffered);
		if(video.buffered.length > 0){
			startBuffer = video.buffered.start(0);
			endBuffer = video.buffered.end(0)
			console.warn('Buffer range: [', startBuffer, ',', endBuffer,'].');
		}
		const selectedTrack = evaluator.evaluate(tracks, currentBandwidth,startBuffer,endBuffer)

		evaluator.currentTrack = selectedTrack
		
		console.log('options: ', tracks)
		console.log('selected: ', evaluator.currentTrack);
		this.lastTimeChosenMs_ = Date.now();
		return evaluator.currentTrack;
	}

	// Try to load a manifest.
	// This is an asynchronous process.
	player.load(manifestUri).then(function() {
		// This runs if the asynchronous load is successful.
		console.log('The video has now been loaded!');

	}).catch(onError);  // onError is executed if the asynchronous load fails.
}

function onPlayerEndedEvent(ended) {
	console.log('Video playback ended', ended);
	if(logger){
		logger.info('Video playback ended', ended);
	}
	timer.stop();
}

function onPlayerPlayEvent(play){
	console.log('Video play hit', play);
	if(logger){
		logger.info('Video play hit', play); 
	}
}

function onPlayerPauseEvent(pause){
	console.log('Video pause hit', pause);
	if(logger){
		logger.info('Video pause hit', pause); 
	}
}

function onPlayerProgressEvent(event) {
	console.log('Progress Event: ', event);
	if(logger){
		logger.info('Progress Event', event); 
	}
	tempoAtual = event.path[0].currentTime;
}

function onErrorEvent(event) {
	// Extract the shaka.util.Error object from the event.
	onError(event.detail);
}

function onError(error) {
	// Log the error.
	console.error('Error code', error.code, 'object', error);
}

function onStateChangeEvent(state){
	console.log('State Change', state)
	if (state['state'] == "load"){
		timer.tickEvery(10);
	}
}

function onTimeCollectStats(){
	console.log('timer is ticking');
	console.log('switchings over last 10s',stats.getSwitchHistory());
}

function onBufferingEvent(buffering){
	bufferingEvent(buffering);
}

function bufferingEvent(buffering){
	console.log("Buffering: ", buffering);
}


document.addEventListener('DOMContentLoaded', initApp);
