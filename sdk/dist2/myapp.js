

// myapp.js
var historico = []
var quali = 0
var stats;
var timer;
var tempoAtual = 0;
var tempoAnt = 0;
var rtt = 0
var endBufferAnt = -1
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

const email = 'icc453@icomp'; //nabson.paiva@icomp
const password = 'batman'; //1nabson.paiva2
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

	var buffer = (endBuffer - tempoAtual)/(endBuffer - startBuffer);
	var media = 0;
	var dp = 0

	// Analisa SE O VÍDEO ESTÁ CORRENDO MAIS QUE CARREGANDO
	if (endBufferAnt != -1) {
		var taxa = (tempoAtual-tempoAnt)/(endBuffer - endBufferAnt)
		if (taxa < 0.2) {
			if (quali > 0) quali = 4
			else quali+=3
		} else {
			if (quali < 0.5) {
				if (quali > 1) quali = 4
				else quali += 2
			} else {
				if (quali < 0.75) {
					if (quali > 2) quali = 4
					else quali++
				} else {
					if (quali > 0) quali--
				}
			}
		}
		console.warn('TAXA DE CONSUMO',taxa);
	}

	// ANALISA SE A REDE ESTÁ INSTÁVEL
	if (historico.length < 10) {
		historico.push(currentBandwidth)
	} else {
		historico.shift()
		historico.push(currentBandwidth)
	}
	var t = historico.length
	// Calculando a média
	for(var i=0; i<t; i++) media += historico[i]
	media = media/t;
	// Calculando o Desvio Padrão
	for(var i=0; i<t; i++) dp += Math.pow(historico[i] - media,2)
	dp = dp/(t-1);
	dp = Math.sqrt(dp)
	// Confere se a banda está dentro do intervalo da Media +- DP
	if (currentBandwidth > media + dp && quali < 4) {
		quali++;
	} else {
		if (currentBandwidth < media - dp && quali > 0) {
			quali--;
		}
	}
	console.warn('BANDA ATUAL',currentBandwidth);
	console.warn('BAND RANGE [',media-dp,',',media+dp,']');

	// ANALISA O QUANTO DO BUFFER JÁ FOI BAIXADO
	if (buffer > 0 && buffer < 0.1) {
		if (quali > 1) quali = quali - 2
		else if (quali > 0) quali = quali - 1
	} else {
		if (buffer < 0.2) {
			if (quali > 0) quali = quali - 1
		}
	}
	console.warn('BUFFER CARREGADO: ',buffer);
	console.warn('TEMPO ATUAL: ',tempoAtual);
	console.warn('BUFFER RANGE: [', startBuffer, ',', endBuffer,'].');

	selected = tracks[quali]
	endBufferAnt = endBuffer
	console.warn('VIDEO COM QUALIDADE',quali);
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
	video.addEventListener('stalled', onStallEvent);

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


		var startBuffer = -1
		var endBuffer = -1
		// console.warn('BUFFER:',video.buffered)
		if(video.buffered.length > 0){
			startBuffer = video.buffered.start(0);
			endBuffer = video.buffered.end(0)
		}
		const selectedTrack = evaluator.evaluate(tracks, currentBandwidth,startBuffer,endBuffer)

		evaluator.currentTrack = selectedTrack

		console.log('OPTIONS: ', tracks)
		console.log('SELECTED: ', evaluator.currentTrack);
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

function onStallEvent(stall){
	console.error('Video stalled.', stall);
	if(logger){
		logger.info('Video stalled', stall);
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
	tempoAnt = tempoAtual
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
