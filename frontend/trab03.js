(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
exports.__esModule = true;
exports.environment = {
    log: { url: 'http://localhost:3000' }
};

},{}],2:[function(require,module,exports){


// myapp.js
var historico = []
var qualidades = []
var bandas = []
var buffers = []
var stalls = []
var quali = 0
var stats;
var timer;
var tempoAtual = 0;
var tempoAnt = -1;
var carregouVideo = -1.0;
var rtt = 0
var videoGlobal = -1
var endBufferAnt = -1
var manifestUri = 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd';
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

const email = 'nabson.paiva@icomp.ufam.edu.br'; //nabson.paiva@icomp
const password = '1nabson.paiva2'; //1nabson.paiva2
let logger;
let econtrols;
let emedia;

CredentialManager.login(email, password).then(({ token })=>{
    logger = new Logger(email,token)
    econtrols = new Event()
    emedia = new Event()
    console.log("Login realizado com sucesso.");
}).catch(error=>{
    console.error('Falha ao logar.')
    throw error
})

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
	if (buffer > 0 && buffer < 0.2) {
		if (quali > 1) quali = quali - 2
		else if (quali > 0) quali = quali - 1
	} else {
		if (buffer < 0.3) {
			if (quali > 0) quali = quali - 1
		}
	}
	console.warn('BUFFER CARREGADO: ',buffer);
	console.warn('TEMPO ATUAL: ',tempoAtual);
	console.warn('BUFFER RANGE: [', startBuffer, ',', endBuffer,'].');

	selected = tracks[quali]
	endBufferAnt = endBuffer
	console.warn('VIDEO COM QUALIDADE',quali);
	if (econtrols) {
		econtrols.push('troca_qualidade',quali)
		econtrols.push('bandwidth',selected.bandwidth)
	}
	qualidades.push(quali)
	bandas.push(currentBandwidth)
	buffers.push(buffer)
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
	videoGlobal = video
	var player = new shaka.Player(video);

	// Attach player to the window to make it easy to access in the JS console.
	window.player = player;
	// Attach evaluator to player to manage useful variables
	player.evaluator = evaluator;

	carregouVideo = video.currentTime

	// create a timer
	timer = new shaka.util.Timer(onTimeCollectStats)
	//stats = new shaka.util.Stats(video)


	video.addEventListener('ended', onPlayerEndedEvent)
	video.addEventListener('play', onPlayerPlayEvent)
	video.addEventListener('pause', onPlayerPauseEvent)
	video.addEventListener('progress', onPlayerProgressEvent)
	video.onwaiting = function(stall){
				console.error('Video stalled.', stall);
				stalls.push(videoGlobal.currentTime)
				if(emedia){
					emedia.push('stall',videoGlobal.currentTime)
				}
			};

	// // Listen for error events.
	player.addEventListener('error', onErrorEvent);
	// player.addEventListener(	'onstatechange',onStateChangeEvent);
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

function wrapup(){
  logger.info("Viewer:player-controls", econtrols.dump() )
  logger.info("Media:tracking", emedia.dump() )
}

function onPlayerEndedEvent(ended) {
	console.log('Video playback ended', ended);
	if(econtrols && logger){
		econtrols.push('ended',videoGlobal.currentTime)
		wrapup()
		console.warn("LOGS ENVIADOS PARA API.");
	} else {
		console.warn("IMPOSSÍVEL ENVIAR LOGS PARA API.");
	}
	console.warn("Histórico de qualidades:",qualidades);
	console.warn("Histórico de Bandas:",bandas);
	console.warn("Histórico de Taxa disponível de Buffer:",buffers);
	console.warn("Tempos em que aconteceram stalls:",stalls);
}

function onPlayerPlayEvent(play){
	console.log('Video play hit', play);
	if(econtrols){
		econtrols.push('play',videoGlobal.currentTime)
	}
}

function onPlayerPauseEvent(pause){
	console.log('Video pause hit', pause);
	if(econtrols){
		econtrols.push('ended',videoGlobal.currentTime)
	}
}

function onPlayerProgressEvent(event) {
	if (tempoAnt == -1) {
		var atraso = videoGlobal.currentTime-carregouVideo
		if (econtrols) {
			econtrols.push('atraso_inicial',atraso)
		}
		console.warn('Atraso Inicial:',atraso);
	}
	console.log('Progress Event: ', event);
	if(emedia){
		// logger.info('Progress Event', event);
		emedia.push('progress',videoGlobal.currentTime)
	}
	tempoAnt = tempoAtual
	tempoAtual = event.path[0].currentTime;
}

function onErrorEvent(event) {
	// Extract the shaka.util.Error object from the event.
	onError(event.detail);
	if(econtrols){
		econtrols.push('Error', event);
		// emedia.push('error',document.getElementById('video').currentTime)
	}
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

},{"./src/credential":3,"./src/event":4,"./src/logger":5}],3:[function(require,module,exports){
"use strict";
exports.__esModule = true;
var environment_1 = require("../common/environment");
var node_fetch_1 = require("node-fetch");
var CredentialManager = /** @class */ (function () {
    function CredentialManager() {
    }
    Object.defineProperty(CredentialManager.prototype, "token", {
        get: function () { return this._token; },
        set: function (token) { this._token = token; },
        enumerable: true,
        configurable: true
    });
    CredentialManager.login = function (email, password) {
        var body = {
            'email': email,
            'password': password
        };
        return new Promise(function (resolve, reject) {
            node_fetch_1["default"](environment_1.environment.log.url + '/users/authenticate', {
                headers: { "Content-Type": "application/json; charset=utf-8" },
                method: 'POST',
                body: JSON.stringify(body)
            })
                .then(function (response) { return response.json(); })
                .then(function (json) {
                console.log(json['accessToken']);
                var credential = new CredentialManager();
                credential._token = json['accessToken'];
                resolve(credential);
            })["catch"](function (error) {
                reject(error);
            });
        });
    };
    return CredentialManager;
}());
exports.CredentialManager = CredentialManager;

},{"../common/environment":1,"node-fetch":6}],4:[function(require,module,exports){
"use strict";
exports.__esModule = true;
var Event = /** @class */ (function () {
    function Event() {
        this.logs = new Map();
        //    this.logs = new Object()
    }
    Event.prototype.set = function (key, records) {
        this.logs.set(key, records);
    };
    Event.prototype.get = function (key) {
        return this.logs.get(key);
    };
    Event.prototype.push = function (key, value) {
        var records = this.logs.get(key);
        if (records !== undefined) {
            records.push(value);
        }
        else {
            this.logs.set(key, [value]);
        }
    };
    Event.prototype.dump = function () {
        return this.logs;
    };
    return Event;
}());
exports.Event = Event;

},{}],5:[function(require,module,exports){
"use strict";
exports.__esModule = true;
var environment_1 = require("../common/environment");
var node_fetch_1 = require("node-fetch");
var Logger = /** @class */ (function () {
    function Logger(userId, sessionId) {
        this.userId = userId;
        this.sessionId = sessionId;
    }
    Logger.prototype.debug = function (primaryMessage) {
        var supportingData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            supportingData[_i - 1] = arguments[_i];
        }
        this.emitLogMessage("debug", primaryMessage, supportingData);
    };
    Logger.prototype.warn = function (primaryMessage) {
        var supportingData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            supportingData[_i - 1] = arguments[_i];
        }
        this.emitLogMessage("warn", primaryMessage, supportingData);
    };
    Logger.prototype.error = function (primaryMessage) {
        var supportingData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            supportingData[_i - 1] = arguments[_i];
        }
        this.emitLogMessage("error", primaryMessage, supportingData);
    };
    Logger.prototype.info = function (primaryMessage) {
        var supportingData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            supportingData[_i - 1] = arguments[_i];
        }
        this.emitLogMessage("info", primaryMessage, supportingData);
    };
    Logger.prototype.emitLogMessage = function (msgType, msg, supportingDetails) {
        var mapa = supportingDetails[0];
        var iterador = mapa.entries();
        var obj = {};
        var aux = iterador.next().value;
        while (aux !== undefined) {
            obj[aux[0]] = aux[1];
            aux = iterador.next().value;
        }
        var body = { 'msgType': msgType,
            'msg': msg,
            'userId': this.userId,
            'sessionId': this.sessionId,
            'log': obj
        };
        console.warn('Sending...', body);
        console.log(JSON.stringify(body));
        node_fetch_1["default"](environment_1.environment.log.url + '/events', {
            headers: { "Content-Type": "application/json; charset=utf-8",
                "Authorization": "Bearer " + this.sessionId
            },
            method: 'POST',
            body: JSON.stringify(body)
        }).then(function (response) { return response.json(); })
            .then(function (json) { return console.log(json); })["catch"](function (error) {
        });
    };
    return Logger;
}());
exports.Logger = Logger;

},{"../common/environment":1,"node-fetch":6}],6:[function(require,module,exports){
(function (global){
"use strict";

// ref: https://github.com/tc39/proposal-global
var getGlobal = function () {
	// the only reliable means to get the global object is
	// `Function('return this')()`
	// However, this causes CSP violations in Chrome apps.
	if (typeof self !== 'undefined') { return self; }
	if (typeof window !== 'undefined') { return window; }
	if (typeof global !== 'undefined') { return global; }
	throw new Error('unable to locate global object');
}

var global = getGlobal();

module.exports = exports = global.fetch;

// Needed for TypeScript and Webpack.
exports.default = global.fetch.bind(global);

exports.Headers = global.Headers;
exports.Request = global.Request;
exports.Response = global.Response;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[2]);
