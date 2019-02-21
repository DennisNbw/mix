(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Recorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
    "use strict";
    
    module.exports = require("./recorder").Recorder;
    
    },{"./recorder":2}],2:[function(require,module,exports){
    'use strict';
    
    var _createClass = (function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
            }
        }return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
        };
    })();
    
    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.Recorder = undefined;
    
    var _inlineWorker = require('inline-worker');
    
    var _inlineWorker2 = _interopRequireDefault(_inlineWorker);
    
    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
    }
    
    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }
    
    var Recorder = exports.Recorder = (function () {
        function Recorder(source, cfg) {
            var _this = this;
    
            _classCallCheck(this, Recorder);
    
            this.config = {
                bufferLen: 4096,
                numChannels: 2,
                mimeType: 'audio/wav'
            };
            this.recording = false;
            this.callbacks = {
                getBuffer: [],
                exportWAV: []
            };
    
            Object.assign(this.config, cfg);
            this.context = source.context;
            this.node = (this.context.createScriptProcessor || this.context.createJavaScriptNode).call(this.context, this.config.bufferLen, this.config.numChannels, this.config.numChannels);
    
            this.node.onaudioprocess = function (e) {
                if (!_this.recording) return;
    
                var buffer = [];
                for (var channel = 0; channel < _this.config.numChannels; channel++) {
                    buffer.push(e.inputBuffer.getChannelData(channel));
                }
                _this.worker.postMessage({
                    command: 'record',
                    buffer: buffer
                });
            };
    
            source.connect(this.node);
            this.node.connect(this.context.destination); //this should not be necessary
    
            var self = {};
            this.worker = new _inlineWorker2.default(function () {
                var recLength = 0,
                    recBuffers = [],
                    sampleRate = undefined,
                    numChannels = undefined;
    
                self.onmessage = function (e) {
                    switch (e.data.command) {
                        case 'init':
                            init(e.data.config);
                            break;
                        case 'record':
                            record(e.data.buffer);
                            break;
                        case 'exportWAV':
                            exportWAV(e.data.type);
                            break;
                        case 'getBuffer':
                            getBuffer();
                            break;
                        case 'clear':
                            clear();
                            break;
                    }
                };
    
                function init(config) {
                    sampleRate = config.sampleRate;
                    numChannels = config.numChannels;
                    initBuffers();
                }
    
                function record(inputBuffer) {
                    for (var channel = 0; channel < numChannels; channel++) {
                        recBuffers[channel].push(inputBuffer[channel]);
                    }
                    recLength += inputBuffer[0].length;
                }
    
                function exportWAV(type) {
                    var buffers = [];
                    for (var channel = 0; channel < numChannels; channel++) {
                        buffers.push(mergeBuffers(recBuffers[channel], recLength));
                    }
                    var interleaved = undefined;
                    if (numChannels === 2) {
                        interleaved = interleave(buffers[0], buffers[1]);
                    } else {
                        interleaved = buffers[0];
                    }
                    var dataview = encodeWAV(interleaved);
                    var audioBlob = new Blob([dataview], { type: type });
    
                    self.postMessage({ command: 'exportWAV', data: audioBlob });
                }
    
                function getBuffer() {
                    var buffers = [];
                    for (var channel = 0; channel < numChannels; channel++) {
                        buffers.push(mergeBuffers(recBuffers[channel], recLength));
                    }
                    self.postMessage({ command: 'getBuffer', data: buffers });
                }
    
                function clear() {
                    recLength = 0;
                    recBuffers = [];
                    initBuffers();
                }
    
                function initBuffers() {
                    for (var channel = 0; channel < numChannels; channel++) {
                        recBuffers[channel] = [];
                    }
                }
    
                function mergeBuffers(recBuffers, recLength) {
                    var result = new Float32Array(recLength);
                    var offset = 0;
                    for (var i = 0; i < recBuffers.length; i++) {
                        result.set(recBuffers[i], offset);
                        offset += recBuffers[i].length;
                    }
                    return result;
                }
    
                function interleave(inputL, inputR) {
                    var length = inputL.length + inputR.length;
                    var result = new Float32Array(length);
    
                    var index = 0,
                        inputIndex = 0;
    
                    while (index < length) {
                        result[index++] = inputL[inputIndex];
                        result[index++] = inputR[inputIndex];
                        inputIndex++;
                    }
                    return result;
                }
    
                function floatTo16BitPCM(output, offset, input) {
                    for (var i = 0; i < input.length; i++, offset += 2) {
                        var s = Math.max(-1, Math.min(1, input[i]));
                        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                    }
                }
    
                function writeString(view, offset, string) {
                    for (var i = 0; i < string.length; i++) {
                        view.setUint8(offset + i, string.charCodeAt(i));
                    }
                }
    
                function encodeWAV(samples) {
                    var buffer = new ArrayBuffer(44 + samples.length * 2);
                    var view = new DataView(buffer);
    
                    /* RIFF identifier */
                    writeString(view, 0, 'RIFF');
                    /* RIFF chunk length */
                    view.setUint32(4, 36 + samples.length * 2, true);
                    /* RIFF type */
                    writeString(view, 8, 'WAVE');
                    /* format chunk identifier */
                    writeString(view, 12, 'fmt ');
                    /* format chunk length */
                    view.setUint32(16, 16, true);
                    /* sample format (raw) */
                    view.setUint16(20, 1, true);
                    /* channel count */
                    view.setUint16(22, numChannels, true);
                    /* sample rate */
                    view.setUint32(24, sampleRate, true);
                    /* byte rate (sample rate * block align) */
                    view.setUint32(28, sampleRate * 4, true);
                    /* block align (channel count * bytes per sample) */
                    view.setUint16(32, numChannels * 2, true);
                    /* bits per sample */
                    view.setUint16(34, 16, true);
                    /* data chunk identifier */
                    writeString(view, 36, 'data');
                    /* data chunk length */
                    view.setUint32(40, samples.length * 2, true);
    
                    floatTo16BitPCM(view, 44, samples);
    
                    return view;
                }
            }, self);
    
            this.worker.postMessage({
                command: 'init',
                config: {
                    sampleRate: this.context.sampleRate,
                    numChannels: this.config.numChannels
                }
            });
    
            this.worker.onmessage = function (e) {
                var cb = _this.callbacks[e.data.command].pop();
                if (typeof cb == 'function') {
                    cb(e.data.data);
                }
            };
        }
    
        _createClass(Recorder, [{
            key: 'record',
            value: function record() {
                this.recording = true;
            }
        }, {
            key: 'stop',
            value: function stop() {
                this.recording = false;
            }
        }, {
            key: 'clear',
            value: function clear() {
                this.worker.postMessage({ command: 'clear' });
            }
        }, {
            key: 'getBuffer',
            value: function getBuffer(cb) {
                cb = cb || this.config.callback;
                if (!cb) throw new Error('Callback not set');
    
                this.callbacks.getBuffer.push(cb);
    
                this.worker.postMessage({ command: 'getBuffer' });
            }
        }, {
            key: 'exportWAV',
            value: function exportWAV(cb, mimeType) {
                mimeType = mimeType || this.config.mimeType;
                cb = cb || this.config.callback;
                if (!cb) throw new Error('Callback not set');
    
                this.callbacks.exportWAV.push(cb);
    
                this.worker.postMessage({
                    command: 'exportWAV',
                    type: mimeType
                });
            }
        }], [{
            key: 'forceDownload',
            value: function forceDownload(blob, filename) {
                var url = (window.URL || window.webkitURL).createObjectURL(blob);
                var link = window.document.createElement('a');
                link.href = url;
                link.download = filename || 'output.wav';
                var click = document.createEvent("Event");
                click.initEvent("click", true, true);
                link.dispatchEvent(click);
            }
        }]);
    
        return Recorder;
    })();
    
    exports.default = Recorder;
    
    },{"inline-worker":3}],3:[function(require,module,exports){
    "use strict";
    
    module.exports = require("./inline-worker");
    },{"./inline-worker":4}],4:[function(require,module,exports){
    (function (global){
    "use strict";
    
    var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();
    
    var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };
    
    var WORKER_ENABLED = !!(global === global.window && global.URL && global.Blob && global.Worker);
    
    var InlineWorker = (function () {
      function InlineWorker(func, self) {
        var _this = this;
    
        _classCallCheck(this, InlineWorker);
    
        if (WORKER_ENABLED) {
          var functionBody = func.toString().trim().match(/^function\s*\w*\s*\([\w\s,]*\)\s*{([\w\W]*?)}$/)[1];
          var url = global.URL.createObjectURL(new global.Blob([functionBody], { type: "text/javascript" }));
    
          return new global.Worker(url);
        }
    
        this.self = self;
        this.self.postMessage = function (data) {
          setTimeout(function () {
            _this.onmessage({ data: data });
          }, 0);
        };
    
        setTimeout(function () {
          func.call(self);
        }, 0);
      }
    
      _createClass(InlineWorker, {
        postMessage: {
          value: function postMessage(data) {
            var _this = this;
    
            setTimeout(function () {
              _this.self.onmessage({ data: data });
            }, 0);
          }
        }
      });
    
      return InlineWorker;
    })();
    
    module.exports = InlineWorker;
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{}]},{},[1])(1)
    });
    (function(e){if(typeof define==="function"&&define.amd){define(["jquery"],e)}else{e(jQuery)}})(function(e){"use strict";var t={},n=Math.max,r=Math.min;t.c={};t.c.d=e(document);t.c.t=function(e){return e.originalEvent.touches.length-1};t.o=function(){var n=this;this.o=null;this.$=null;this.i=null;this.g=null;this.v=null;this.cv=null;this.x=0;this.y=0;this.w=0;this.h=0;this.$c=null;this.c=null;this.t=0;this.isInit=false;this.fgColor=null;this.pColor=null;this.dH=null;this.cH=null;this.eH=null;this.rH=null;this.scale=1;this.relative=false;this.relativeWidth=false;this.relativeHeight=false;this.$div=null;this.run=function(){var t=function(e,t){var r;for(r in t){n.o[r]=t[r]}n._carve().init();n._configure()._draw()};if(this.$.data("kontroled"))return;this.$.data("kontroled",true);this.extend();this.o=e.extend({min:this.$.data("min")!==undefined?this.$.data("min"):0,max:this.$.data("max")!==undefined?this.$.data("max"):100,stopper:true,readOnly:this.$.data("readonly")||this.$.attr("readonly")==="readonly",cursor:this.$.data("cursor")===true&&30||this.$.data("cursor")||0,thickness:this.$.data("thickness")&&Math.max(Math.min(this.$.data("thickness"),1),.01)||.35,lineCap:this.$.data("linecap")||"butt",width:this.$.data("width")||200,height:this.$.data("height")||200,displayInput:this.$.data("displayinput")==null||this.$.data("displayinput"),displayPrevious:this.$.data("displayprevious"),fgColor:this.$.data("fgcolor")||"#4d8aff",inputColor:this.$.data("inputcolor"),font:this.$.data("font")||"Arial",fontWeight:this.$.data("font-weight")||"bold",inline:false,step:this.$.data("step")||1,rotation:this.$.data("rotation"),draw:null,change:null,cancel:null,release:null,format:function(e){return e},parse:function(e){return parseFloat(e)}},this.o);this.o.flip=this.o.rotation==="anticlockwise"||this.o.rotation==="acw";if(!this.o.inputColor){this.o.inputColor=this.o.fgColor}if(this.$.is("fieldset")){this.v={};this.i=this.$.find("input");this.i.each(function(t){var r=e(this);n.i[t]=r;n.v[t]=n.o.parse(r.val());r.bind("change blur",function(){var e={};e[t]=r.val();n.val(n._validate(e))})});this.$.find("legend").remove()}else{this.i=this.$;this.v=this.o.parse(this.$.val());this.v===""&&(this.v=this.o.min);this.$.bind("change blur",function(){n.val(n._validate(n.o.parse(n.$.val())))})}!this.o.displayInput&&this.$.hide();this.$c=e(document.createElement("canvas")).attr({width:this.o.width,height:this.o.height});this.$div=e('<div style="'+(this.o.inline?"display:inline;":"")+"width:"+this.o.width+"px;height:"+this.o.height+"px;"+'"></div>');this.$.wrap(this.$div).before(this.$c);this.$div=this.$.parent();if(typeof G_vmlCanvasManager!=="undefined"){G_vmlCanvasManager.initElement(this.$c[0])}this.c=this.$c[0].getContext?this.$c[0].getContext("2d"):null;if(!this.c){throw{name:"CanvasNotSupportedException",message:"Canvas not supported. Please use excanvas on IE8.0.",toString:function(){return this.name+": "+this.message}}}this.scale=(window.devicePixelRatio||1)/(this.c.webkitBackingStorePixelRatio||this.c.mozBackingStorePixelRatio||this.c.msBackingStorePixelRatio||this.c.oBackingStorePixelRatio||this.c.backingStorePixelRatio||1);this.relativeWidth=this.o.width%1!==0&&this.o.width.indexOf("%");this.relativeHeight=this.o.height%1!==0&&this.o.height.indexOf("%");this.relative=this.relativeWidth||this.relativeHeight;this._carve();if(this.v instanceof Object){this.cv={};this.copy(this.v,this.cv)}else{this.cv=this.v}this.$.bind("configure",t).parent().bind("configure",t);this._listen()._configure()._xy().init();this.isInit=true;this.$.val(this.o.format(this.v));this._draw();return this};this._carve=function(){if(this.relative){var e=this.relativeWidth?this.$div.parent().width()*parseInt(this.o.width)/100:this.$div.parent().width(),t=this.relativeHeight?this.$div.parent().height()*parseInt(this.o.height)/100:this.$div.parent().height();this.w=this.h=Math.min(e,t)}else{this.w=this.o.width;this.h=this.o.height}this.$div.css({width:this.w+"px",height:this.h+"px"});this.$c.attr({width:this.w,height:this.h});if(this.scale!==1){this.$c[0].width=this.$c[0].width*this.scale;this.$c[0].height=this.$c[0].height*this.scale;this.$c.width(this.w);this.$c.height(this.h)}return this};this._draw=function(){var e=true;n.g=n.c;n.clear();n.dH&&(e=n.dH());e!==false&&n.draw()};this._touch=function(e){var r=function(e){var t=n.xy2val(e.originalEvent.touches[n.t].pageX,e.originalEvent.touches[n.t].pageY);if(t==n.cv)return;if(n.cH&&n.cH(t)===false)return;n.change(n._validate(t));n._draw()};this.t=t.c.t(e);r(e);t.c.d.bind("touchmove.k",r).bind("touchend.k",function(){t.c.d.unbind("touchmove.k touchend.k");n.val(n.cv)});return this};this._mouse=function(e){var r=function(e){var t=n.xy2val(e.pageX,e.pageY);if(t==n.cv)return;if(n.cH&&n.cH(t)===false)return;n.change(n._validate(t));n._draw()};r(e);t.c.d.bind("mousemove.k",r).bind("keyup.k",function(e){if(e.keyCode===27){t.c.d.unbind("mouseup.k mousemove.k keyup.k");if(n.eH&&n.eH()===false)return;n.cancel()}}).bind("mouseup.k",function(e){t.c.d.unbind("mousemove.k mouseup.k keyup.k");n.val(n.cv)});return this};this._xy=function(){var e=this.$c.offset();this.x=e.left;this.y=e.top;return this};this._listen=function(){if(!this.o.readOnly){this.$c.bind("mousedown",function(e){e.preventDefault();n._xy()._mouse(e)}).bind("touchstart",function(e){e.preventDefault();n._xy()._touch(e)});this.listen()}else{this.$.attr("readonly","readonly")}if(this.relative){e(window).resize(function(){n._carve().init();n._draw()})}return this};this._configure=function(){if(this.o.draw)this.dH=this.o.draw;if(this.o.change)this.cH=this.o.change;if(this.o.cancel)this.eH=this.o.cancel;if(this.o.release)this.rH=this.o.release;if(this.o.displayPrevious){this.pColor=this.h2rgba(this.o.fgColor,"0.4");this.fgColor=this.h2rgba(this.o.fgColor,"0.6")}else{this.fgColor=this.o.fgColor}return this};this._clear=function(){this.$c[0].width=this.$c[0].width};this._validate=function(e){var t=~~((e<0?-.5:.5)+e/this.o.step)*this.o.step;return Math.round(t*100)/100};this.listen=function(){};this.extend=function(){};this.init=function(){};this.change=function(e){};this.val=function(e){};this.xy2val=function(e,t){};this.draw=function(){};this.clear=function(){this._clear()};this.h2rgba=function(e,t){var n;e=e.substring(1,7);n=[parseInt(e.substring(0,2),16),parseInt(e.substring(2,4),16),parseInt(e.substring(4,6),16)];return"rgba("+n[0]+","+n[1]+","+n[2]+","+t+")"};this.copy=function(e,t){for(var n in e){t[n]=e[n]}}};t.Dial=function(){t.o.call(this);this.startAngle=null;this.xy=null;this.radius=null;this.lineWidth=null;this.cursorExt=null;this.w2=null;this.PI2=2*Math.PI;this.extend=function(){this.o=e.extend({bgColor:this.$.data("bgcolor")||"#222222",angleOffset:this.$.data("angleoffset")||0,angleArc:this.$.data("anglearc")||360,inline:true},this.o)};this.val=function(e,t){if(null!=e){e=this.o.parse(e);if(t!==false&&e!=this.v&&this.rH&&this.rH(e)===false){return}this.cv=this.o.stopper?n(r(e,this.o.max),this.o.min):e;this.v=this.cv;this.$.val(this.o.format(this.v));this._draw()}else{return this.v}};this.xy2val=function(e,t){var i,s;i=Math.atan2(e-(this.x+this.w2),-(t-this.y-this.w2))-this.angleOffset;if(this.o.flip){i=this.angleArc-i-this.PI2}if(this.angleArc!=this.PI2&&i<0&&i>-.5){i=0}else if(i<0){i+=this.PI2}s=i*(this.o.max-this.o.min)/this.angleArc+this.o.min;this.o.stopper&&(s=n(r(s,this.o.max),this.o.min));return s};this.listen=function(){var t=this,i,s,o=function(e){e.preventDefault();var o=e.originalEvent,u=o.detail||o.wheelDeltaX,a=o.detail||o.wheelDeltaY,f=t._validate(t.o.parse(t.$.val()))+(u>0||a>0?t.o.step:u<0||a<0?-t.o.step:0);f=n(r(f,t.o.max),t.o.min);t.val(f,false);if(t.rH){clearTimeout(i);i=setTimeout(function(){t.rH(f);i=null},100);if(!s){s=setTimeout(function(){if(i)t.rH(f);s=null},200)}}},u,a,f=1,l={37:-t.o.step,38:t.o.step,39:t.o.step,40:-t.o.step};this.$.bind("keydown",function(i){var s=i.keyCode;if(s>=96&&s<=105){s=i.keyCode=s-48}u=parseInt(String.fromCharCode(s));if(isNaN(u)){s!==13&&s!==8&&s!==9&&s!==189&&(s!==190||t.$.val().match(/\./))&&i.preventDefault();if(e.inArray(s,[37,38,39,40])>-1){i.preventDefault();var o=t.o.parse(t.$.val())+l[s]*f;t.o.stopper&&(o=n(r(o,t.o.max),t.o.min));t.change(t._validate(o));t._draw();a=window.setTimeout(function(){f*=2},30)}}}).bind("keyup",function(e){if(isNaN(u)){if(a){window.clearTimeout(a);a=null;f=1;t.val(t.$.val())}}else{t.$.val()>t.o.max&&t.$.val(t.o.max)||t.$.val()<t.o.min&&t.$.val(t.o.min)}});this.$c.bind("mousewheel DOMMouseScroll",o);this.$.bind("mousewheel DOMMouseScroll",o)};this.init=function(){if(this.v<this.o.min||this.v>this.o.max){this.v=this.o.min}this.$.val(this.v);this.w2=this.w/2;this.cursorExt=this.o.cursor/100;this.xy=this.w2*this.scale;this.lineWidth=this.xy*this.o.thickness;this.lineCap=this.o.lineCap;this.radius=this.xy-this.lineWidth/2;this.o.angleOffset&&(this.o.angleOffset=isNaN(this.o.angleOffset)?0:this.o.angleOffset);this.o.angleArc&&(this.o.angleArc=isNaN(this.o.angleArc)?this.PI2:this.o.angleArc);this.angleOffset=this.o.angleOffset*Math.PI/180;this.angleArc=this.o.angleArc*Math.PI/180;this.startAngle=1.5*Math.PI+this.angleOffset;this.endAngle=1.5*Math.PI+this.angleOffset+this.angleArc;var e=n(String(Math.abs(this.o.max)).length,String(Math.abs(this.o.min)).length,2)+2;this.o.displayInput&&this.i.css({width:(this.w/2+4>>0)+"px",height:(this.w/3>>0)+"px",position:"absolute","vertical-align":"middle","margin-top":(this.w/3>>0)+"px","margin-left":"-"+(this.w*3/4+2>>0)+"px",border:0,background:"none",font:this.o.fontWeight+" "+(this.w/e>>0)+"px "+this.o.font,"text-align":"center",color:this.o.inputColor||this.o.fgColor,padding:"0px","-webkit-appearance":"none"})||this.i.css({width:"0px",visibility:"hidden"})};this.change=function(e){this.cv=e;this.$.val(this.o.format(e))};this.angle=function(e){return(e-this.o.min)*this.angleArc/(this.o.max-this.o.min)};this.arc=function(e){var t,n;e=this.angle(e);if(this.o.flip){t=this.endAngle+1e-5;n=t-e-1e-5}else{t=this.startAngle-1e-5;n=t+e+1e-5}this.o.cursor&&(t=n-this.cursorExt)&&(n=n+this.cursorExt);return{s:t,e:n,d:this.o.flip&&!this.o.cursor}};this.draw=function(){var e=this.g,t=this.arc(this.cv),n,r=1;e.lineWidth=this.lineWidth;e.lineCap=this.lineCap;if(this.o.bgColor!=="none"){e.beginPath();e.strokeStyle=this.o.bgColor;e.arc(this.xy,this.xy,this.radius,this.endAngle-1e-5,this.startAngle+1e-5,true);e.stroke()}if(this.o.displayPrevious){n=this.arc(this.v);e.beginPath();e.strokeStyle=this.pColor;e.arc(this.xy,this.xy,this.radius,n.s,n.e,n.d);e.stroke();r=this.cv==this.v}e.beginPath();e.strokeStyle=r?this.o.fgColor:this.fgColor;e.arc(this.xy,this.xy,this.radius,t.s,t.e,t.d);e.stroke()};this.cancel=function(){this.val(this.v)}};e.fn.dial=e.fn.knob=function(n){return this.each(function(){var r=new t.Dial;r.o=n;r.$=e(this);r.run()}).parent()}})
    //v1.0.3
    //31/05/2016
    var Jcmix = function() {
        //DOM
    
    
        this.JCmix               = $('#jcmix');
        this.DOMbody             = $('body'); 
        this.DOMhead             = $('head');
        this.DOMdocument         = $(document);
        this.playButton;    // DOM for transport play button
        this.startButton;   // DOM for transport back to beginning button
        this.recordButton;   // DOM for transport back to beginning button
        this.toggleRecordingsButton; 
        this.clearRecordingsButton; 
        this.recordinglist;
        this.channelStrip;  // DOM for channel strip
        this.timer;         // DOM for timer
        this.timerProgress; // DOM for progres time of track
        this.timerTotal;    // DOM for total time of track
        this.transport      // DOM for transport pannel
        this.timeline;      // DOM for transport timeline
        this.progressbar;   // DOM for transport timeline progress bar
        this.percentLoaded; // the ammount loaded (initial load)
        this.loader;        // the initial loader
        this.mixer;         // DOM for mixer
        
        ////////////////////////////////////////////////////////////////////////
        
        
        //////////////////////////////////////////////////////
        
        // LITERALS
        
        this.meterHeight         = 400; // height of meter in pixels (you also need ot change height var in scss)
        this.meterWidth          = 10; // height of meter in pixels
        this.stylesheetURL       = "assets/css/jcmix.min.css"; // Location of stylesheet
        
        
        // VARS
        this.recording = false; // toggle recording
        this.allowRecord = false; // toggle recording
        this.title;
        this.rec = false; // recordin gelement
        this.loop                = 0; // count loops
        this.currentLoopProgress = 0; // progress through each loop in milliseconds
        this.totalLength         = 0; // total length of track
        this.timelineClickPaused = false // only allow timeline to be updated once every few seconds
        this.replay              = false;
        this.replayFrom          = false;
        this.fingerPosition          = 0;
        
        this.loading             = true; // the app is loading
        this.ajaxURL             = false;
        this.loading             = 0;
        this.playing             = []; // whuich are currently playing
        this.context;
        this.bufferLoader;
        this.javascriptNode      = [];
        this.leftAnalysers       = [];
        this.rightAnalysers      = [];
        this.splitters           = [];
        this.gainNodes           = []; // the gain nodes themselves
        this.pannerNodes           = []; // the gain nodes themselves
        this.gainValues          = []; // gain value to resume to after unmute
        this.muted               = []; // bool if track is muted
        this.timelinedrag        = false; // don't update timeline if dragging progress bar
        this.masterGainNodes;
        
        this.urlList             = [];            // The list of tracks to be loaded
        this.bufferList          = [];
        this.loadCount           = 0; // the number of tracks loaded
        
        this.startedAt;          // When did the track start playing
        this.paused              = true; // is the track paused?
        
        // ARRAYS
        this.audios              = []; 
        this.buffer              = []; 
        this.bouncerleft         = []; 
        this.bouncerright        = []; 
        
    };
    
    
    
    Jcmix.prototype = { 
    
        /**
         * INIT
         * Initialization
         *
         **/
        init: function(){
            this.addStylesheet();
            this.createLoader();
            this.buildTracks(); // get user tracks from frontend        
            this.bindMouseandTouch();
        },
    
         /**
         * BUILD TRACKS
         * build the tracks from the frontend
         *
         **/
    
        buildTracks: function(){
          var that = this;
          var count = 0;
          this.JCmix.children('.track').each(function(){
            count++;
            that.urlList.push($(this).attr('data-url'));
            if(count == that.JCmix.children('.track').length)
              that.setupAudioContext();
          });
        },
    
        /**
         * SETUP AUDIO CONTEXT
         * setup the audio context
         *
         **/
    
        setupAudioContext: function(){
    
          // Fix up prefixing
          window.AudioContext = window.AudioContext || window.webkitAudioContext;
          if(window.AudioContext){
            this.context = new AudioContext();
            this.load();
          }else{
    
            var head      = document.getElementsByTagName('head')[0];
            var stylesheet    = document.createElement('link');
            stylesheet.rel = "stylesheet";
            stylesheet.type= "text/css"; 
            stylesheet.href= "https://fonts.googleapis.com/css?family=Open+Sans";
            head.appendChild(stylesheet);
            var nosupport = document.createElement("div");
            nosupport.id = "nosupport";
            nosupport.innerHTML = "You are using a browser that does not support HTML5 Audio. <br><a href='https://www.google.com/chrome/' target='_blank'>Click here to download Google Chrome, and experience a better web.</a><br><br><a href='#' onclick='closeSupport()'>Close This Message</a>";
            document.body.appendChild(nosupport);
          }
    
        },
    
         /**
         * ADD STYLESHEET
         * add in the style sheet to the header
         *
         **/
        addStylesheet: function(){
          /*var stylesheet    = document.createElement('link');
          stylesheet.rel = "stylesheet";
          stylesheet.type= "text/css"; 
          stylesheet.href= this.stylesheetURL;
          this.DOMhead.append(stylesheet);*/
    
          // fonts
          var stylesheet    = document.createElement('link');
          stylesheet.rel = "stylesheet";
          stylesheet.type= "text/css"; 
          stylesheet.href= "https://fonts.googleapis.com/css?family=Open+Sans";
          this.DOMhead.append(stylesheet);
    
          // fonts
          var stylesheet    = document.createElement('link');
          stylesheet.rel = "stylesheet";
          stylesheet.type= "text/css"; 
          stylesheet.href= "https://fonts.googleapis.com/css?family=Share+Tech+Mono";
          this.DOMhead.append(stylesheet);
    
        },
        /**
         * CREATE LOADER
         * create the loader div
         *
         **/
    
    
        createLoader: function(){
          var loader = "<div class=\"loader\">";
          loader     +=   "<div class=\"loader-inner ball-clip-rotate-multiple\">";
          loader     +=      "<div></div>";
          loader     +=      "<div></div>";
          loader     +=   "</div>";
          loader     +=    "<p>Loading... <span>0</span>%</p>";
          loader     += "</div>";
    
          this.JCmix.append(loader); // Aoppend to body
          this.percentLoaded = $('.loader p span'); // create the DOM element
          this.loader = $('.loader');
        },
    
         /**
         * HIDE LOADER 
         * Hide the laoding screen once loaded
         *
         **/
    
        hideLoader: function(){
          var that = this;
            this.loader.hide()
            that.resizeLabels();
            that.mixer.fadeTo('slow', 1);
            
        },
    
    
        /**
         * RESIZE LABELS
         * resize labels so that they all the same
         *
         **/
    
        resizeLabels: function(){
    
          var height = 0;
           $('.track-label').each(function(){
            if($(this).height() > height)
             $('.track-label').css('height', $(this).height());
           });
    
        },
    
        /**
         * BUILD FRONTEND 
         * Build frontend elements after loading
         *
         **/
    
        buildFrontEnd: function(){
    
          this.createMixer();
          this.createTransport();
          this.addInfo();
    
        },
    
        /**
         * ADD INFO TEXT
         * add ino text to bottom
         *
         **/
    
        addInfo: function(){
    
          var info = "<p id=\"info\">";
              info +=      "Built by <a href='http://www.juliancole.co.uk' target='_blank'>Julian Cole</a> for <a href='http://www.realstrings.com' target='_blank'>Realstrings.com</a>"
              info += "</p>";
    
          this.mixer.append(info); // Aoppend to body
    
        },
    
        /**
         * CREATE TRANSPORT
         * create transport element
         *
         **/
    
        createTransport: function(){
          if(this.JCmix.attr('data-record') == 'true')
            this.allowRecord = true;
          var transport = "<div id=\"transport\">";
          transport +=      "<a type=\"button\" id=\"play\">";
          transport +=      "<a type=\"button\" id=\"start\">";
          if(this.allowRecord)
            transport +=      "<a type=\"button\" id=\"record\">";
          transport +=    "</div>";
    
    
          this.mixer.append(transport); // Aoppend to body
          this.transport = $('#transport');
          this.playButton = $('#play'); // create the DOM element
          this.startButton = $('#start');
    
          var that = this;
    
          // TRANSPORT CLICK HANDLERS
          this.playButton.on('click',function(e) {
              e.preventDefault();
              if(this.dataset.state == "pause"){
                  this.dataset.state = "play";
                  $(this).removeClass('active');
              }
              else{
                  this.dataset.state = "pause";
                  $(this).addClass('active');
              }
              that.togglePlay(this.dataset.state);
          });
    
          if(this.allowRecord){ // only do this if allowing recording
            this.transport.addClass('recording');
            this.mixer.append("<div id=\"recordListButtons\"><a type=\"button\" id=\"toggleRecordings\" >Hide recordings<a><a type=\"button\" id=\"clearRecordings\" >Clear recordings<a></div>"); // Aoppend to body
            this.mixer.append("<ul id=\"recordinglist\"></ul>"); // Aoppend to body
            this.recordButton = $('#record');
            this.recordinglist = $('#recordinglist');
            this.toggleRecordingsButton = $('#toggleRecordings');
            this.clearRecordingsButton = $('#clearRecordings');
    
            this.recordButton.on('click',function(e) {
                if(!that.paused) //can't toggle if currenty playing
                  return false;
                e.preventDefault();
                if(this.dataset.state == 'record'){
                    this.dataset.state = 'non';
                    $(this).removeClass('active');
                    that.recording = false;
                }
                else{
                    this.dataset.state = 'record';
                    $(this).addClass('active');
                    that.recording = true;
                }
            });
    
            this.toggleRecordingsButton.on('click',function(e) {
                if($(this).html() == 'Hide recordings'){
                  $(this).html('Show recordings');
                  that.recordinglist.slideUp();
                }
                else{
                  $(this).html('Hide recordings');
                  that.recordinglist.slideDown();
                }
    
            });
    
            this.clearRecordingsButton.on('click',function(e) {
                that.recordinglist.html('');
            });
          }
    
          this.startButton.on('click', function(){
            that.rewindToBeginning();  
          });
    
        },
    
        /**
         * CREATE MIXER
         * create mixer element
         *
         **/
    
        createMixer: function(){
              this.title = this.JCmix.attr('data-title');
              var mixer = "<div id=\"mixer\">";
              mixer +=      "<h1>"+this.title+"</h1>";
              mixer +=      "<div id=\"channelstrip\"></div>";          
              mixer +=      "<div class=\"paddingholder\">";
              mixer +=        "<div id=\"timeline\">";
              mixer +=          "<div id=\"progress\" ></div>";
              mixer +=        "</div>";
              mixer +=      "</div>";
              mixer +=      "<div class=\"paddingholder\">";
              mixer +=        "<div id=\"timer\">";
              mixer +=          "<span class=\"progress\">00:00:000</span>";
              // mixer +=          "<span> / </span> ";
              mixer +=          "<span class=\"total\"></span>";
              mixer +=        "</div>";
              mixer +=      "</div>";          
              mixer +=    "</div>";
    
              this.JCmix.append(mixer); // Aoppend to body
              // create the DOM elements
              this.mixer         = $('#mixer');
              this.channelStrip  = $('#channelstrip');
              this.timer         = $('#timer');
              this.timerProgress = $('#timer .progress');
              this.timerTotal    = $('#timer .total');
              this.timeline      = $('#timeline');
              this.progressbar   = $('#progress');
              
              this.setTransportEventHandlers();
        },
    
        /**
         * SET TRANSPORT EVENT HANDLERS
         * set event handlers for dragging the transport bar
         *
         **/
    
        setTransportEventHandlers: function(){
            var that = this;
           // timeline dragging event handlers
            this.DOMdocument.on(TouchMouseEvent.DOWN,function(e){
    
                if( e.target.id=="timeline" || e.target.id=="progress"){
                  that.timelinedrag = true;
                  that.fingerPosition = e.pageX-parseFloat(that.JCmix.offset().left); // distance from side of timeline to page
                  $(this).on(TouchMouseEvent.MOVE,function(e){
                    that.fingerPosition = e.pageX-parseFloat(that.JCmix.offset().left); // distance from side of timeline to page
                    that.timelineClick(that.fingerPosition, false);
                  });
    
                  that.DOMdocument.on(TouchMouseEvent.UP, function(e){
    
                      $(this).unbind(TouchMouseEvent.MOVE);
                      $(this).unbind(TouchMouseEvent.UP);
                      that.timelinedrag = false;
                      //if( e.target.id=="timeline" || e.target.id=="progress"){
    
                      if(e.pageX !== null)
                        distance = e.pageX-parseFloat(that.JCmix.offset().left);
    
                        that.timelineClick(that.fingerPosition, true);
                      //}
                      
                  });
                }
            });
    
            // on slider changes
            this.DOMbody.on('change', 'input[type=range][data-slider]', function() {
               that.sliderChange($(this).attr('data-slider'), $(this).val()); 
            });
    
            // on mute changes
            this.DOMbody.on('change', 'input[data-mute]', function() {
               that.muteChange($(this).attr('data-mute'), $(this).is(":checked"));
            });
    
            // on panner changes
            /*this.DOMbody.on('change', 'input[data-panner]', function() {
               that.panChange($(this).attr('data-panner'), $(this).val());
            });*/
    
        },
    
    
        getHighestVolume: function(array){
          return Math.max.apply( Math, array );
        },
    
     
        getAverageVolume: function(array) {
            var values = 0;
            var average;
    
            var length = array.length;
    
            // get all the frequency amplitudes
            for (var i = 0; i < length; i++) {
                values += array[i];
            }
    
            average = values / length;
            return average;
        },
    
         /**
        * UPDATE LOADING PERCENT
        * Update the percent loaded
        *
        **/
    
        updateLoadingPercent: function(){
          var percent = (100 / this.urlList.length) * this.loadCount;
          this.percentLoaded.html(Math.round(percent));
        },
    
    
        /**
        * LOAD BUFFER
        * Get the audio files
        *
        **/
    
    
        loadBuffer: function(url, index) {
          // Load buffer asynchronously
          var request = new XMLHttpRequest();
          request.open("GET", url, true);
          request.responseType = "arraybuffer";
    
          var loader = this;
    
          request.onload = function() {
            // Asynchronously decode the audio file data in request.response
            loader.context.decodeAudioData(
              request.response,
              function(buffer) {
                if (!buffer) {
                  alert('error decoding file data: ' + url);
                  return;
                }
                loader.bufferList[index] = buffer;
                if (++loader.loadCount == loader.urlList.length)
                  loader.finishedLoading(loader.bufferList);
    
                loader.updateLoadingPercent();
              },
              function(error) {
                console.error('decodeAudioData error', error);
              }
            );
          }
    
          request.onerror = function() {
            //  alert('Failed to load audio. Ensure that your audio files are hosted on the same server as your website, or that you allow cross origin resource sharing (CORS) if you are hosting them on a different server.');
          }
    
          request.send();
        },
    
        /**
        * LOAD
        * Ready the audio 
        *
        **/
    
        load: function() {
          for (var i = 0; i < this.urlList.length; ++i)
            this.loadBuffer(this.urlList[i], i);
        },
    
        /**
        * SET DEFAULT VALUES
        * Set values as defined by user
        *
        **/
    
        setDefaultValues: function(){
    
          var that = this;
          var count = 0;
          this.JCmix.children('.track').each(function(){
            // change mute attribute
            var mute = $(this).attr('data-start-muted');
            if(mute == 'true')
              $('[data-mute='+count+']').prop('checked', true).trigger('change');
    
            // change iniital volume attribute
            var initialVol = $(this).attr('data-initial-volume');
            $('[data-slider='+count+']').val(initialVol).trigger('change');
    
            var initialPan = $(this).attr('data-initial-pan');
            $('[data-panner='+count+']').val(initialPan).trigger('change');
    
    
            var label = $(this).attr('data-label');
            $('[data-label='+count+']').html(label);
    
            count++;
            // we've done with the default divs now, so we can delete them
            if(count == that.JCmix.children('.track').length)
              that.deleteDefaultDivs();
            $('[data-label='+count+']').html('Master');
    
            
    
          });
    
        },
    
        /**
        * DELETE DEFAULT DIVS
        * Delete use setting divs.
        *
        **/
    
        deleteDefaultDivs: function(){
          this.JCmix.children('.track').each(function(){
            $(this).remove();
          });
    
        },
    
        /**
        * FINISHED LOADING 
        * Buffer the audio
        *
        **/
    
        finishedLoading: function (bufferList) {
    
          this.buildFrontEnd();
          this.buffer = [];
          for (var i = 0; i < this.urlList.length; i++){
            this.buffer.push(bufferList[i]);
          }
          this.createElements(); // remove for autoplay;
          this.setDefaultValues();
          this.setDuration(); // set duration of piece
          this.hideLoader();
    
        }, 
    
        /**
        * Build a new meter
        * Buffer the audio
        *
        **/
    
        createMeter: function(i)
        {
    
          // Create left analyser
          var analyser = this.context.createAnalyser();
          this.leftAnalysers.push(analyser);
          this.leftAnalysers[i].smoothingTimeConstant = 0.3;
          this.leftAnalysers[i].fftSize = 1024;
    
          // Create right analyser
          var analyser2 = this.context.createAnalyser();
          this.rightAnalysers.push(analyser2);
          this.rightAnalysers[i].smoothingTimeConstant = 0.0;
          this.rightAnalysers[i].fftSize = 1024;
    
          // setup a javascript node
          // connect to destination, else it isn't called
    
          // create [a buffer source node
          var splitter = this.context.createChannelSplitter();
          this.splitters.push(splitter);
    
          // connect the source to the analyser and the splitter
          if(i < this.pannerNodes.length-1) // if this is a regular channels trip
            this.pannerNodes[i].connect(this.splitters[i]);
          else // master channel doesn't use a panner
            this.gainNodes[i].connect(this.splitters[i]);
    
          // connect one of the outputs from the splitter to
          // the analyser
          this.splitters[i].connect(this.leftAnalysers[i],0,0);
          this.splitters[i].connect(this.rightAnalysers[i],1,0);
    
          // connect the splitter to the javascriptnode
          // we use the javascript node to draw at a
          // specific interval.
          this.leftAnalysers[i].connect(this.javascriptNode[i]);
    
    
          this.javascriptNode[i].connect(this.context.destination);
    
          if(i < this.pannerNodes.length-1){ // if this is a regular channels trip
            this.pannerNodes[i].connect(this.gainNodes[this.gainNodes.length-1]);
          }
          else{ // this is the master chjannel strip
            this.gainNodes[i].connect(this.context.destination);
            this.rec = new Recorder(this.gainNodes[i]);
          }
    
          this.drawCanvas(this.leftAnalysers[i], this.rightAnalysers[i], this, i); 
    
        },
    
     
        
    
    
        /*
        * SLIDER CHANGE
        * Event for when a slider changes
        */
    
        sliderChange: function(audio_id,value){
    
          if(!this.muted[audio_id])
            this.gainNodes[audio_id].gain.value = value;
          
          this.gainValues[audio_id] = value; // store gain value
    
        },
    
        /*
        * MUTE CHANGE
        * Event when mute changes
        */
    
        muteChange: function(audio_id,value){
          if(value){
            this.gainValues[audio_id] = this.gainNodes[audio_id].gain.value; // store gain value
            this.gainNodes[audio_id].gain.value = 0; // mute the gain node
            this.muted[audio_id] = true;
          }
          else{
            this.muted[audio_id] = false;
            this.gainNodes[audio_id].gain.value = this.gainValues[audio_id]; // restore previous gain value
          }
    
        },
    
        /* PAD 
        * pad string with leading zeros
        */
    
        pad: function(str, max) {
            str = str.toString();
            return str.length < max ? this.pad("0" + str, max) : str;
        },
    
        /* 
        * FORMAT TIME
        * Convert milliseconds to readable format
        */
    
        formatTime: function(millis){
    
          
          var hours = Math.floor(millis / 36e5),
              mins = Math.floor((millis % 36e5) / 6e4),
              secs = Math.floor((millis % 6e4) / 1000);
              mill = Math.floor(millis % 1000);
              var returns = "<span>"+this.pad(mins,2)+"</span>:<span>"+this.pad(secs,2)+"</span>:<span>"+this.pad(mill, 2).substring(2, 0);+"</span>";
            return returns;
        },
    
        /* 
        * COUNT LOOP
        * count the number of loops
        */
    
        countLoops: function(current){
    
          this.loops = Math.floor(current/this.totalLength);
          this.currentLoopProgress= (Date.now() - this.startedAt)-(this.loops*(this.buffer[0].duration*1000));
    
        }, 
    
    
        /* 
        * UPDATE TIMER
        * Update time to current starte
        */
    
        updateTimer: function(){
    
          var current = this.formatTime(this.currentLoopProgress);
          var totalLength = this.formatTime(this.totalLength); 
          this.timerProgress.html(current);
          this.timerTotal.html(totalLength);
          this.updateTimeline();
    
        },
    
    
        /*
        * Update position of progress bar
        */
    
        updateTimeline: function(){
    
          if(this.timelinedrag)
            return false;
    
    
          var current = Date.now() - this.startedAt;
          this.countLoops(current); // work out number of times looped
          var percent = (100/this.totalLength)*this.currentLoopProgress;
          var left = (this.timeline.width()/100) * percent;
          this.progressbar.css('left',left);
    
        },
    
        
    
        /* 
        * DRAW CANVAS
        * Create the listener which draws the sound bar onto the canvas
        */
    
        drawCanvas: function(leftAnalyser, rightAnalyser, ctx, i)
        {
    
            var canvas =  $('#c'+i).get()[0].getContext("2d");
            ctx.bouncerleft.push({ "average":0 , "opacity":1 });
            ctx.bouncerright.push({ "average":0 , "opacity":1 });
            gradient = canvas.createLinearGradient(0,0,0,400);
            gradient.addColorStop(1,'#4D8AFF');
            gradient.addColorStop(0.75,'#4D8AFF');
            gradient.addColorStop(0.25,'#4D8AFF');
            gradient.addColorStop(0,'#4D8AFF');
    
            // when the javascript node is called
            // we use information from the analyzer node
            // to draw the volume
            ctx.javascriptNode[i].onaudioprocess = function(event) {
    
                ctx.updateTimer();
    
                // get the average for the first channel
                var array =  new Uint8Array(leftAnalyser.frequencyBinCount);
                leftAnalyser.getByteFrequencyData(array);
                var average = ctx.getAverageVolume(array);
    
                // get the average for the second channel
                var array2 =  new Uint8Array(rightAnalyser.frequencyBinCount);
                rightAnalyser.getByteFrequencyData(array2);
                var average2 = ctx.getAverageVolume(array2);
    
                // bouncers left
                if(average > ctx.bouncerleft[i].average){
                  ctx.bouncerleft[i].average = average;
                  ctx.bouncerleft[i].opacity = 1;
                }
                else{
                  if(ctx.bouncerleft[i].opacity > 0.1) // fade out
                    ctx.bouncerleft[i].opacity = ctx.bouncerleft[i].opacity -0.1;
                  else
                    ctx.bouncerleft[i].opacity = 0;
                  ctx.bouncerleft[i].average--; // make it fall
                }
    
                // bouncers right
                if(average2 > ctx.bouncerright[i].average){
                  ctx.bouncerright[i].opacity = 1;
                  ctx.bouncerright[i].average = average2;
                }
                else{
                  if(ctx.bouncerright[i].opacity > 0.1)// fade out
                    ctx.bouncerright[i].opacity = ctx.bouncerright[i].opacity -0.1;
                  else
                    ctx.bouncerright[i].opacity = 0;
                  ctx.bouncerright[i].average--;// make it fall
                }
    
    
                // clear the current state
                canvas.clearRect(0, 0, 60, ctx.meterHeight);
    
                canvas.fillStyle="#5151CE";
    
                // create background to meters
                canvas.fillRect(0,0,ctx.meterWidth,ctx.meterHeight+200);
                canvas.fillRect(ctx.meterWidth+5,0,ctx.meterWidth,ctx.meterHeight+200);
    
                // set the fill style
                canvas.fillStyle=gradient;
                // create the delayed max meter bar
                if(average > 0)
                  canvas.fillRect(0,ctx.meterHeight-(ctx.bouncerleft[i].average*(ctx.meterHeight/100))-2,ctx.meterWidth,ctx.bouncerleft[i].opacity);
                if(average2 > 0)
                  canvas.fillRect(ctx.meterWidth+5,ctx.meterHeight-(ctx.bouncerright[i].average*(ctx.meterHeight/100))-2,ctx.meterWidth,ctx.bouncerright[i].opacity);
    
                // create the meters (ctx.meterHeight/100) is 1% of the meter height
                canvas.fillRect(0,ctx.meterHeight-(average*(ctx.meterHeight/100)),ctx.meterWidth,ctx.meterHeight+200);
                canvas.fillRect(ctx.meterWidth+5,ctx.meterHeight-(average2*(ctx.meterHeight/100)),ctx.meterWidth,ctx.meterHeight+200);
    
                if(parseFloat(Date.now() - ctx.startedAt)+50 >= parseFloat(ctx.totalLength)){ // disable looping for now
                    $('#play').removeClass('active');
                    ctx.stop();
                    ctx.rewindToBeginning();
                  return false;
                }
    
            }
    
        },
    
        panChange: function(audio_id,value) {
            var xDeg = parseInt(value);
            var zDeg = xDeg + 90;
            if (zDeg > 90) {
              zDeg = 180 - zDeg;
            }
            var x = Math.sin(xDeg * (Math.PI / 180));
            var z = Math.sin(zDeg * (Math.PI / 180));
            this.pannerNodes[audio_id].setPosition(x, 0, z);
          },
    
    
        /**
        * CREATE GAIN NODES
        * Create a gain node for index
        *
        **/
    
        createGainNode: function(i, master){
    
          // Create a gain node.
          var gainnode = this.context.createGain();
          var pannernode = this.context.createPanner();
          pannernode.panningModel = "equalpower";
          this.gainValues.push(1);
          this.muted.push(false);
          this.gainNodes.push(gainnode);
          this.pannerNodes.push(pannernode);
          // Connect the source to the gain node.
          if(!master){
           // this.audios[i].connect(this.pannerNodes[i]);
           // this.pannerNodes[i].connect(this.gainNodes[i]);
            this.audios[i].connect(this.gainNodes[i]);
            this.gainNodes[i].connect(this.pannerNodes[i]);
    
          }
    
        //  this.panChange(i,0); // set pan to 0
    
          this.DOMbody.find("[data-panner="+i+"]").trigger('change');
          $("[data-slider="+i+"]").trigger('change'); // set gain note to value of visual slider
          $("[data-mute="+i+"]").trigger('change'); // set gain note to value of mute
    
    
        },
    
    
        /**
        * RESERT ARRAYS
        * Reset arrays to defaults
        *
        **/
    
        resetArrays: function(){
    
          this.bouncerleft = [];
          this.bouncerright = [];
          this.leftAnalysers = [];
          this.rightAnalysers = [];
          this.splitters = [];
    
          this.audios = [];
          this.gainNodes = [];
          this.pannerNodes = [];
          this.gainValues = [];
          this.javascriptNode = [];
          this.muted = [];
          this.loop = 0; // reset loops loops
        },
    
        /**
        * Load visuals and audio nodes
        *
        **/
    
        createElements: function(){
          this.resetArrays();
           // Create two sources and play them both together.
          for (var i = 0; i < this.urlList.length; i++){
            var source1 = this.context.createBufferSource();
            source1.buffer = this.buffer[i];
    
              source1.loop = false; // flase to stop looping
    
            this.audios.push(source1);
    
            this.audios[i].muted = true;
            // create a new javascript node ready for the meter
            javascriptNode = this.context.createScriptProcessor(2048, 1, 1);
            // create a gain controller
            this.createGainNode(i, false);
            // Connect the gain node to the destination.
            this.javascriptNode.push(javascriptNode);
            // create a meter visualisation
    
            var channel = this.createChannel(i);
            // create a new canvas
            var canvas = this.createCanvas(i, channel);
            // create Sliders
            this.createSlider(i, channel);
            this.createMute(i, channel);
            this.createPanner(i, channel);
            this.createLabel(i, channel);
    
          }
    
          // Create master elements
          javascriptNode = this.context.createScriptProcessor(2048, 1, 1);
          this.createGainNode(i, true);
          this.javascriptNode.push(javascriptNode);
          var channel = this.createChannel(i);
          // create a new canvas
          var canvas = this.createCanvas(i, channel);
          // create Sliders
          this.createSlider(i, channel);
          this.createMute(i, channel);
          this.createLabel(i, channel);
    
         
    
        },
    
        /**
        * SET DURATION 
        * set dutaion of timeline to the length of the ongest buffer
        *
        **/
    
        setDuration: function(){
    
          for (var i = 0; i < this.audios.length; i++){
            if((this.buffer[i].duration * 1000) > this.totalLength)
              this.totalLength = this.buffer[i].duration * 1000; // tottal length of buffer in milliseconds
          } 
    
          this.updateTimer(); // update visual timer
    
        },
    
        /**
        * PLAY
        * Play the audio
        *
        **/
    
        play: function(){
    
          this.paused = false;
          this.createElements();
          this.replay = false;
          this.playing = [];
          for (var i = 0; i < this.audios.length; i++){
    
            this.createMeter(i);
            // start from paused time
            if (this.currentLoopProgress) {
              this.startedAt = Date.now() - this.currentLoopProgress;
              var startFrom =  this.currentLoopProgress / 1000;
              if(this.buffer[i].duration > startFrom){
                  this.playing.push(i);
                  this.audios[i].start(0, this.currentLoopProgress / 1000);
              }
            }
            // start from beginning
            else {
              this.playing.push(i);
              this.startedAt = Date.now();
              this.audios[i].start(0);
            }
          }
          this.createMeter(i); // create master meter
          //on end of source, disconnect everything
          var that = this;
          $(this.audios).each(function(index){
            this.onended = function() {
              that.onended(index);
            }
          });
    
          if(this.recording)
            this.startRecording();
         
        },
    
        /**
        * START RECORDING
        * Start recording the audio stream
        *
        **/
    
        startRecording: function(){
          this.rec.clear();
          this.rec.record();
        },
    
        onended: function(index){
    
    
          if(this.playing.indexOf(index) > -1){
            // disconnect everything
            this.javascriptNode[index].disconnect();
            this.audios[index].disconnect();
            this.gainNodes[index].disconnect();
            this.pannerNodes[index].disconnect();
            this.javascriptNode[index].disconnect();
            this.leftAnalysers[index].disconnect();
            this.rightAnalysers[index].disconnect();
            this.splitters[index].disconnect();
            var number = this.playing.indexOf(index);
            this.playing.splice(number, 1);
            this.clearCanvas(index);
          }
    
          // disconnect everything
          if(this.playing.length == 0 && this.paused){
    
            for (var i = 0; i < this.gainNodes.length; i++){
              this.gainNodes[i].disconnect();
              this.pannerNodes[i].disconnect();
              this.clearCanvas(i);
    
            } 
            for (var i = 0; i < this.javascriptNode.length; i++){
              this.javascriptNode[i].disconnect();
            } 
            for (var i = 0; i < this.leftAnalysers.length; i++){
              this.leftAnalysers[i].disconnect();
            } 
            for (var i = 0; i < this.rightAnalysers.length; i++){
              this.rightAnalysers[i].disconnect();
            } 
            for (var i = 0; i < this.splitters.length; i++){
              this.splitters[i].disconnect();
            } 
           
    
           /* this.gainNodes[this.gainNodes.length-1].disconnect();
            this.javascriptNode[this.gainNodes.length-1].disconnect();
            this.leftAnalysers[this.gainNodes.length-1].disconnect();
            this.rightAnalysers[this.gainNodes.length-1].disconnect();
            this.splitters[this.gainNodes.length-1].disconnect();*/
    
    
    
            if(this.replay){ // replay if this is a timeline skip rather than a full on stop
              var percent = (100/this.totalLength)*this.replayFrom;
              var left = (this.timeline.width()/100) * percent; 
              this.progressbar.css('left',left); 
              this.currentLoopProgress = this.replayFrom;
              this.play(); 
            }
          }
          return true;
        },
    
    
    
        /**
        * Clear Canvas
        * clear the canvas from index
        *
        **/
    
        clearCanvas: function(index){
        
            var canvas = $('#c'+index).get()[0].getContext("2d");
            // clear canvas
            canvas.clearRect(0, 0, 0, 400);
            //rebuild background
            canvas.fillStyle="#5151CE";
            canvas.fillRect(0,0,this.meterWidth,this.meterHeight+200);
            canvas.fillRect(this.meterWidth+5,0,this.meterWidth,this.meterHeight+200);
    
        },
    
        /**
        * PAUSE
        * Pause the audio
        *
        **/
    
        stop: function(){
    
          if(this.recording && !this.paused){
    
            this.rec.stop();
            this.toggleRecordingsButton.show();
            this.clearRecordingsButton.show();
            this.rec.exportWAV(function(blob) {
              var url = URL.createObjectURL(blob);
              var li = document.createElement('li');
              var au = document.createElement('audio');
              var hf = document.createElement('a');
              var src = document.createElement('source');
    
              au.controls = true;
              src.src = url;
              src.type = "audio/wav";
              au.appendChild(src);
              hf.href = url;
              hf.download = that.title+' ' +new Date().toISOString() + '.wav';
              hf.innerHTML = hf.download;
              li.appendChild(au);
              li.appendChild(hf);
              that.recordinglist.append(li);
            });
          }
    
          this.paused = true;
          var that = this;
          for (var i = 0; i < this.audios.length; i++){
    
            if(this.playing.indexOf(i) > -1)
              this.audios[i].stop(0);
            
            this.currentLoopProgress = Date.now() - this.startedAt;
    
          }
    
          
    
        },
    
       
    
        /**
        * Toggle the play state
        * play mix
        *
        **/
    
        togglePlay: function(state){
          if(state == 'pause')
            this.play();
          else
            this.stop();           
        },
    
      
    
        /*
        * CREATE CHANNEL
        * CREATE CHANNEL STRIP
        */
    
        createChannel: function(i){
          if($('div[data-channel="'+i+'"]').length == 0){
             var newdiv = document.createElement('div');
             newdiv.dataset.channel = i;
            this.channelStrip.append(newdiv);
          }
          return $('div[data-channel="'+i+'"]');
        },
    
        /*
        * CREATE MUTE
        * CREATE MUTE BUTTON
        */
    
        createMute: function(i, channel){
    
          if ($('input[data-mute="'+i+'"]').length == 0){
             var mute = document.createElement('div');
             mute.className = 'mute-button';
             mute.innerHTML = "<label><input data-mute='"+i+"' type='checkbox' value='1' ><span>M</span></label>";
             $(channel).append(mute);
          }
    
          return $('input[data-mute="'+i+'"]');
    
        },
    
    
        /*
        * CREATE PANNER
        * CREATE PANNER BUTTON
        */
    
        createPanner: function(i, channel){
          var that = this;
    
          if ($('input[data-panner="'+i+'"]').length == 0){
             var panner = document.createElement('div');
             panner.className = 'panner-range';
             panner.innerHTML = "<input data-panner='"+i+"' value='0' class='dial' type='text'>";
             $(channel).append(panner);
             $("[data-panner='"+i+"']").knob({
                'min':-90,
                'max':90,
                'width' : 30,
                'height' : 30,
                'fgColor' : '#4d8aff',
                'angleOffset': '-125',
                'bgColor' : '#fff',
                'angleArc': '250',
                'skin' :'tron',
                'thickness':'.4',
                'displayPrevious' : true,
                'cursor':'20',
                'draw' : function () { that.panChange(i,this.v); }
    
             });
          }
    
          return $('input[data-panner="'+i+'"]');
    
        },
    
        /*
        * CREATE LABEL
        * CREATE Label for track
        */
    
        createLabel: function(i, channel){
    
    
          if ($('[data-label="'+i+'"]').length == 0){
             var label = document.createElement('div');
             label.className = 'track-label';
             label.innerHTML = "<label data-label='"+i+"'></label>";
            
             $(channel).append(label);
          }
    
          // resize so all labels are the correct height
    
         
    
          return $('[data-label="'+i+'"]');
    
        },
    
        /*
        * CREATE SLIDER
        * CREATE VOLUME SLIDER
        */
    
        createSlider: function(i, channel){
    
          if ($('input[data-slider="'+i+'"]').length == 0){
             var slider = document.createElement('div');
             slider.className = 'slider';
    
              var input = document.createElement("input");
              input.type = "range";
              input.dataset.slider = i;
              input.min = 0;
              input.max = 1.5; 
              input.step = 0.01;
              input.addEventListener('input', function() {
                this.setAttribute('value', this.value);
                $(this).trigger('change');
              });
    
             $(slider).append(input);
             $(channel).append(slider);
          } 
    
          return $('input[data-slider="'+i+'"]');
    
        },
    
    
        
    
        /*
        * CREATE CANVAS
        * Create a new canvas element for channel
        */
    
        createCanvas: function(i, channel){
    
          if ($('#c'+i).length == 0){
            var mycanvas = document.createElement("canvas");
            mycanvas.id = "c"+i;
            mycanvas.className = "meter";
            mycanvas.width = (this.meterWidth*2)+5;
            mycanvas.height = this.meterHeight;
            channel.append(mycanvas);
    
            // create background to meters
            var canvas =  $('#c'+i).get()[0].getContext("2d");
            canvas.fillStyle="#5151CE";
            // canvas.fillStyle="#d7dde2";
            canvas.fillRect(0,0,this.meterWidth,this.meterHeight+200);
            canvas.fillRect(this.meterWidth+5,0,this.meterWidth,this.meterHeight+200);
          } 
    
          return $('#c'+i).get()[0].getContext("2d");
          
        },
    
        /*
        * REWIND TO BEGINNING
        * Rewind track to beginning
        */
    
        rewindToBeginning: function(){
    
          if(this.paused){
            this.playButton.attr('data-state', 'play');
          }
          
          this.progressbar.css('left',0); 
          this.currentLoopProgress = 0;
          this.replayFrom = 0;
          if(!this.paused){
            this.replay = true;
            this.replayFrom = 0;
            this.stop();   
          }
    
        },
    
        /*
        * TIMELINE CLICK
        * start playign from where the user clicked the timeline
        */
    
        timelineClick: function(position, audio){
    
          var paused = this.paused;
          var percent = (100/this.timeline.width()) * position;
    
          if(percent < 1 || percent > 99) // only if mouse inside box
            return false;
    
          var pausedAt = (this.totalLength/100) * percent;
          this.currentLoopProgress = pausedAt;
          // reposition progress bar
          var percent = (100/this.totalLength)*pausedAt;
          var left = (this.timeline.width()/100) * percent; 
          this.progressbar.css('left',left); 
          var that = this;
    
          if(!paused && audio){
            this.replay = true;
            this.replayFrom = pausedAt;
            this.stop();  
          }
          
            
          
        },
    
        /*
        * Bind mouse clicks and screen touches
        */
    
        bindMouseandTouch: function(){
           /* == GLOBAL DECLERATIONS == */
          TouchMouseEvent = {
              DOWN: "touchmousedown",
              UP: "touchmouseup",
              MOVE: "touchmousemove"
          }
         
          /* == EVENT LISTENERS == */
          var onMouseEvent = function(event) {
              var type;
              
              switch (event.type) {
                  case "mousedown": type = TouchMouseEvent.DOWN; break;
                  case "mouseup":   type = TouchMouseEvent.UP;   break;
                  case "mousemove": type = TouchMouseEvent.MOVE; break;
                  default: 
                      return;
              }
              
              var touchMouseEvent = normalizeEvent(type, event, event.pageX, event.pageY);      
              $(event.target).trigger(touchMouseEvent); 
          }
          
          var onTouchEvent = function(event) {
              var type;
              
              switch (event.type) {
                  case "touchstart": type = TouchMouseEvent.DOWN; break;
                  case "touchend":   type = TouchMouseEvent.UP;   break;
                  case "touchmove":  type = TouchMouseEvent.MOVE; break;
                  default: 
                      return;
              }
              
              var touch = event.originalEvent.touches[0];
              var touchMouseEvent;
              
              if (type == TouchMouseEvent.UP) 
                  touchMouseEvent = normalizeEvent(type, event, null, null);
              else 
                  touchMouseEvent = normalizeEvent(type, event, touch.pageX, touch.pageY);
              
              $(event.target).trigger(touchMouseEvent); 
          }
          
          /* == NORMALIZE == */
          var normalizeEvent = function(type, original, x, y) {
              return $.Event(type, {
                  pageX: x,
                  pageY: y,
                  originalEvent: original
              });
          }
          
          /* == LISTEN TO ORIGINAL EVENT == */
          var jQueryDocument = $(document);
         
          if ("ontouchstart" in window) {
              jQueryDocument.on("touchstart", onTouchEvent);
              jQueryDocument.on("touchmove", onTouchEvent);
              jQueryDocument.on("touchend", onTouchEvent); 
          } else {
              jQueryDocument.on("mousedown", onMouseEvent);
              jQueryDocument.on("mouseup", onMouseEvent);
              jQueryDocument.on("mousemove", onMouseEvent);
          }
        }
    
    
    
    }; // End Class
    
    // check browser version
    function get_browser_info(){
        var ua=navigator.userAgent,tem,M=ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || []; 
        if(/trident/i.test(M[1])){
            tem=/\brv[ :]+(\d+)/g.exec(ua) || []; 
            return {name:'IE',version:(tem[1]||'')};
            }   
        if(M[1]==='Chrome'){
            tem=ua.match(/\bOPR\/(\d+)/)
            if(tem!=null)   {return {name:'Opera', version:tem[1]};}
            }   
        M=M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
        if((tem=ua.match(/version\/(\d+)/i))!=null) {M.splice(1,1,tem[1]);}
        return {
          name: M[0],
          version: M[1]
        };
     }
    
    
    function closeSupport(){
        $("#nosupport").remove();
    }
    
    
    // Run the mixer
    function run(){
      var jcmix = new Jcmix();
      jcmix.init(); 
      $('#panner').on('change', function(){
        jcmix.pan(this);
    
      });
    }
    
    // $( window ).load(function() {
      // run();
    // });
    
    
    
    