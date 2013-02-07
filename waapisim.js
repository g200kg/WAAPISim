// Web Audio API Simulator
// Copyright (c) 2013 g200kg
// http://www.g200kg.com/
//         Licensed under The MIT-License
//         http://opensource.org/licenses/MIT
//
//  Great thanks :
//  FFT algo for AnalyserNode is based on Takuya OOURA's explanation.
//   http://www.kurims.kyoto-u.ac.jp/~ooura/fftman/index.html


// Support Float32Array if unavailable (for IE9)
if(typeof(Float32Array)=="undefined") {
	Float32Array=function(n) {
		var a=new Array(n);
		a.subarray=function(x,y) {return this.slice(x,y);}
		a.set=function(x,off) {for(var i=0;i<x.length;++i) a[off+i]=x[i];}
		return a;
	}
}
if(typeof(Uint8Array)=="undefined") {
	Uint8Array=function(n) {
		var a=new Array(n);
		a.subarray=function(x,y) {return this.slice(x,y);}
		a.set=function(x,off) {for(var i=0;i<x.length;++i) a[off+i]=x[i];}
		return a;
	}
}

function waapisimSetup() {
	if(typeof(webkitAudioContext)!="undefined")
		return;

	waapisimSampleRate=44100;
	waapisimAudioIf=0;
	waapisimBufSize=1024;
	if(typeof(Audio)!="undefined") {
		waapisimAudio=new Audio();
		if(typeof(waapisimAudio.mozSetup)!="undefined")
			waapisimAudioIf=1;
	}
	if(waapisimAudioIf==0) {
		waapisimOutBufSize=waapisimBufSize*3;
		waapisimOutBuf=new Array(waapisimOutBufSize);
	}
	else {
		waapisimOutBufSize=waapisimBufSize;
		waapisimOutBuf=new Float32Array(waapisimOutBufSize*2);
		waapisimAudio.mozSetup(2,waapisimSampleRate);
	}
	for(var l=waapisimOutBuf.length,i=0;i<l;++i)
		waapisimOutBuf[i]=0;
	waapisimWrittenpos=0;
	waapisimNodes=new Array();
	waapisimContexts=new Array();
	waapisimAudioBuffer=function(len,ch) {
		this.sampleRate=waapisimSampleRate;
		this.length=len;
		this.duration=len/this.sampleRate;
		this.numberOfChannels=ch;
		this.buf=new Array();
		for(var i=0;i<ch;++i) {
			this.buf[i]=new Float32Array(len);
			for(var j=0;j<len;++j)
				this.buf[i][j]=0;
		}
		this.getChannelData=function(i) {
			return this.buf[i];
		}
	}
	waapisimDummybuf=new waapisimAudioBuffer(waapisimBufSize,2);

	waapisimSetupOutBuf=function(offset) {
		var numctx=waapisimContexts.length;
		if(numctx>0) {
			var l=waapisimNodes.length;
			for(var i=0;i<l;++i)
				waapisimNodes[i].Process();
			if(waapisimAudioIf==0) {
				for(var j=0;j<numctx;++j) {
					var buf=waapisimContexts[j].destination.node.outbuf.buf;
					if(j==0) {
						for(var i=0;i<waapisimBufSize;++i)
							waapisimOutBuf[i+offset]=(buf[0][i]+buf[1][i])*0.5;
					}
					else {
						for(var i=0;i<waapisimBufSize;++i)
							waapisimOutBuf[i+offset]+=(buf[0][i]+buf[1][i])*0.5;
					}
				}
			}
			else {
				for(var j=0;j<numctx;++j) {
					var buf=waapisimContexts[j].destination.node.outbuf.buf;
					if(j==0) {
						for(var i=0;i<waapisimBufSize;++i) {
							waapisimOutBuf[(i+offset)*2]=buf[0][i];
							waapisimOutBuf[(i+offset)*2+1]=buf[1][i];
						}
					}
					else {
						for(var i=0;i<waapisimBufSize;++i) {
							waapisimOutBuf[(i+offset)*2]+=buf[0][i];
							waapisimOutBuf[(i+offset)*2+1]+=buf[1][i];
						}
					}
				}
			}
		}
	}
	waapisimUpdateCurrentTime=function(t) {
		for(var i=waapisimContexts.length;i--;)
			waapisimContexts[i].currentTime=t;
	}
	waapisimInterval=function() {
		var curpos=waapisimAudio.mozCurrentSampleOffset();
		var buffered=waapisimWrittenpos-curpos;
		var vl,vr;
		waapisimUpdateCurrentTime(curpos/(waapisimSampleRate*2));
		if(buffered<16384) {
			waapisimSetupOutBuf(0);
			waapisimWrittenpos+=waapisimAudio.mozWriteAudio(waapisimOutBuf);
		}
	}
	waapisimGetSwfPath=function() {
		var scr=document.getElementsByTagName("SCRIPT");
		if(scr&&scr.length>0) {
			for(var i in scr) {
				if(scr[i].src && scr[i].src.match(/waapisim\.js$/)) {
					var s=scr[i].src;
					return s.substring(0,s.length-2)+"swf";
				}
			}
		}
		return "";
	}
	waapisimAddFlashObj=function() {
		var div=document.createElement("DIV");
		div.setAttribute("ID","WAAPISIMFLASHOBJ");
		var body=document.getElementsByTagName("BODY");
		body[0].appendChild(div);
		document.getElementById("WAAPISIMFLASHOBJ").innerHTML="<object id='waapisim_swf' CLASSID='clsid:D27CDB6E-AE6D-11cf-96B8-444553540000' CODEBASE='http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=4,0,0,0' width=300 height=100>"
		+"<param name=movie value='"+waapisimSwfPath+"'><PARAM NAME=bgcolor VALUE=#FFFFFF><PARAM NAME=LOOP VALUE=false><PARAM NAME=quality VALUE=high><param name='allowScriptAccess' value='always'>"
		+"<embed src='"+waapisimSwfPath+"' width=300 height=100 bgcolor=#FFFFFF loop=false quality=high pluginspage='http://www.macromedia.com/shockwave/download/index.cgi?P1_Prod_Version=ShockwaveFlash' type='application/x-shockwave-flash' allowScriptAccess='always'></embed>"
		+"</object>";
	}
	waapisimFlashOffset=function(pos) {
		waapisimUpdateCurrentTime(pos/1000);
	}
	waapisimFlashGetData=function() {
		waapisimSetupOutBuf(0);
		waapisimSetupOutBuf(waapisimBufSize);
		waapisimSetupOutBuf(waapisimBufSize*2);
		waapisimWrittenpos+=waapisimOutBufSize*2;
		return waapisimOutBuf;
	}
	switch(waapisimAudioIf) {
	case 0:
		waapisimSwfPath=waapisimGetSwfPath();
		window.addEventListener("load",waapisimAddFlashObj,false);
		break;
	case 1:
		setInterval(waapisimInterval,10);
		break;
	}
	AudioContext=webkitAudioContext=function() {
		this.destination=new waapisimAudioDestinationNode(this);
		waapisimContexts.push(this);
		this.sampleRate=44100;
		this.currentTime=0;
		this.activeSourceCount=0;
		this.listener=new waapisimAudioListener();
		this.createBuffer=function(ch,rate,len) {
		}
		this.createJavaScriptNode=function(bufsize,inch,outch) {
			return new waapisimScriptProcessor(this,bufsize,inch,outch);
		}
		this.createScriptProcessor=function(bufsize,inch,outch) {
			return new waapisimScriptProcessor(this,bufsize,inch,outch);
		}
		this.createBiquadFilter=function() {
			return new waapisimBiquadFilter(this);
		}
		this.createGainNode=function() {
			return new waapisimGain(this);
		}
		this.createGain=function() {
			return new waapisimGain(this);
		}
		this.createDelayNode=function() {
			return new waapisimDelay(this);
		}
		this.createDelay=function() {
			return new waapisimDelay(this);
		}
		this.createOscillator=function() {
			return new waapisimOscillator(this);
		}
		this.createAnalyser=function() {
			return new waapisimAnalyser(this);
		}
		this.createConvolver=function() {
			return new waapisimConvolver(this);
		}
		this.createDynamicsCompressor=function() {
			return new waapisimDynamicsCompressor(this);
		}
		this.createPanner=function() {
			return new waapisimPanner(this);
		}
		this.createChannelSplitter=function() {
			return new waapisimChannelSplitter(this);
		}
		this.createChannelMerger=function() {
			return new waapisimChannelMerger(this);
		}
		this.createWaveShaper=function() {
			return new waapisimWaveShaper(this);
		}
		this.decodeAudioData=function(audioData,successCallback,errorCallback) {
		}
		this.createWaveTable=function(real,imag) {
			return new waapisimWaveTable(real,imag);
		}
	}
	waapisimAudioListener=function() {
		this.px=0; this.py=0; this.pz=0;
		this.ox=0; this.oy=0; this.oz=-1;
		this.ux=0; this.uy=1; this.uz=0;
		this.dopplerFactor=1;
		this.speedOfSound=343.3;
		this.setPosition=function(x,y,z) {this.px=x;this.py=y;this.pz=z;}
		this.setOrientation=function(x,y,z,ux,uy,uz) {this.ox=x,this.oy=y;this.oz=z;this.ux=ux;this.uy=uy;this.uz=uz;}
		this.setVelocity=function(x,y,z) {}
	}
	waapisimWaveTable=function(real,imag) {
		this.table=new Float32Array(8192);
		for(var i=0;i<8192;++i)
			this.table[i]=0;
	}
	waapisimAudioNode=function(size) {
		this.context=null;
		this.bufsize=size;
		this.from=new Array();
		this.connect=function(input) {
			if(typeof(input.node)!="undefined")
				var target=input.node.from;
			else
				var target=input.from;
			for(var i=target.length;i--;)
				if(target[i]===this)
					return;
			target.push(this);
		}
		this.disconnect=function() {
			for(var l=waapisimNodes.length,i=0;i<l;++i) {
				for(var j=waapisimNodes[i].node.from.length;j--;) {
					if(waapisimNodes[i].node.from[j]===this)
						waapisimNodes[i].node.from.splice(j,1);
				}
			}
		}
		this.outbuf=new waapisimAudioBuffer(size,2);
		this.inbuf=new waapisimAudioBuffer(size,2);
		this.GetInputBuf=function() {
			var fanin=this.from.length;
			switch(fanin) {
			case 0:
				return waapisimDummybuf;
			case 1:
				return this.from[0].outbuf;
			default:
				var v1,v2;
				for(var i=0;i<this.bufsize;++i) {
					v1=v2=0;
					for(var j=0;j<fanin;++j) {
						v1+=this.from[j].outbuf.buf[0][i];
						v2+=this.from[j].outbuf.buf[1][i];
					}
					this.inbuf.buf[0][i]=v1;
					this.inbuf.buf[1][i]=v2;
				}
				return this.inbuf;
			}
		}
	}
	waapisimAudioProcessingEvent=function() {
	}
	waapisimAudioDestinationNode=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=0;
		this.maxNumberOfChannels=2;
		this.numberOfChannels=2;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.Process=function() {
			var inbuf=this.node.GetInputBuf();
			this.node.outbuf=inbuf;
		}
		waapisimNodes.push(this);
	}
	waapisimScriptProcessor=function(ctx,bufsize,inch,outch) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		if(typeof(inch)=="undefined")
			inch=2;
		if(typeof(outch)=="undefined")
			outch=2;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.bufferSize=bufsize;
		this.inbuf=new waapisimAudioBuffer(bufsize,inch);
		this.outbuf=new waapisimAudioBuffer(bufsize,outch);
		this.index=bufsize;
		this.onaudioprocess=null;
		this.Process=function() {
			var inb=this.node.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i) {
				if(this.index>=this.bufferSize) {
					if(this.onaudioprocess) {
						var ev=new waapisimAudioProcessingEvent();
						ev.node=this;
						ev.inputBuffer=this.inbuf;
						ev.outputBuffer=this.outbuf;
						this.onaudioprocess(ev);
					}
					this.index=0;
				}
				this.inbuf.buf[0][this.index]=inb.buf[0][i];
				if(this.inbuf.numberOfChannels>=2)
					this.inbuf.buf[1][this.index]=inb.buf[1][i];
				this.node.outbuf.buf[0][i]=this.outbuf.buf[0][this.index];
				if(this.outbuf.numberOfChannels>=2)
					this.node.outbuf.buf[1][i]=this.outbuf.buf[1][this.index];
				else
					this.node.outbuf.buf[1][i]=this.outbuf.buf[0][this.index];
				this.index++;
			}
		}
		waapisimNodes.push(this);
	}
	waapisimBiquadFilter=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.type=0;
		this.frequency=new waapisimAudioParam(10,24000,350);
		this.detune=new waapisimAudioParam(-1200,1200,0);
		this.Q=new waapisimAudioParam(0.0001,1000,1);
		this.gain=new waapisimAudioParam(-40,40,0);
		this.a1=this.a2=0;
		this.b0=this.b1=this.b2=0;
		this.x1l=this.x1r=this.x2l=this.x2r=0;
		this.y1l=this.y1r=this.y2l=this.y2r=0;
		this.Setup=function(fil) {
			var f=fil.frequency.Get()*Math.pow(2,fil.detune.Get()/1200);
			var q=fil.Q.Get();
			var alpha;
			var w0=2*Math.PI*f/fil.context.sampleRate;
			var cos=Math.cos(w0);
			switch(fil.type) {
			case 0:
				if(q<0) q=0;
				q=Math.pow(10,q/20);
				alpha=Math.sin(w0)/(2*q);
				var ra0=1/(1+alpha);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha)*ra0;
				fil.b0=fil.b2=(1-cos)/2*ra0;
				fil.b1=(1-cos)*ra0;
				break;
			case 1:
				if(q<0) q=0;
				q=Math.pow(10,q/20);
				alpha=Math.sin(w0)/(2*q);
				var ra0=1/(1+alpha);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha)*ra0;
				fil.b0=fil.b2=(1+cos)/2*ra0;
				fil.b1=-(1+cos)*ra0;
				break;
			case 2:
				if(q<0.001) q=0.001;
				alpha=Math.sin(w0)/(2*q);
				var ra0=1/(1+alpha);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha)*ra0;
				fil.b0=alpha;
				fil.b1=0;
				fil.b2=-alpha;
				break;
			case 3:
				alpha=Math.sin(w0)/2*Math.sqrt(2);
				var g=Math.pow(10,fil.gain.Get()/40);
				var ra0=1/((g+1)+(g-1)*cos+2*Math.sqrt(g)*alpha);
				fil.a1=-2*((g-1)+(g+1)*cos)*ra0;
				fil.a2=((g+1)+(g-1)*cos-2*Math.sqrt(g)*alpha)*ra0;
				fil.b0=g*((g+1)-(g-1)*cos+2*Math.sqrt(g)*alpha)*ra0;
				fil.b1=2*g*((g-1)-(g+1)*cos)*ra0;
				fil.b2=g*((g+1)-(g-1)*cos-2*Math.sqrt(g)*alpha)*ra0;
				break;
			case 4:
				alpha=Math.sin(w0)/2*Math.sqrt(2);
				var g=Math.pow(10,fil.gain.Get()/40);
				var ra0=1/((g+1)-(g-1)*cos+2*Math.sqrt(g)*alpha);
				fil.a1=2*((g-1)-(g+1)*cos)*ra0;
				fil.a2=((g+1)-(g-1)*cos-2*Math.sqrt(g)*alpha)*ra0;
				fil.b0=g*((g+1)+(g-1)*cos+2*Math.sqrt(g)*alpha)*ra0;
				fil.b1=-2*g*((g-1)+(g+1)*cos)*ra0;
				fil.b2=g*((g+1)+(g-1)*cos-2*Math.sqrt(g)*alpha)*ra0;
				break;
			case 5:
				if(q<0.001) q=0.001;
				alpha=Math.sin(w0)/(2*q);
				var g=Math.pow(10,fil.gain.Get()/40);
				var ra0=1/(1+alpha/g);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha/g)*ra0;
				fil.b0=(1+alpha*g)*ra0;
				fil.b1=-2*cos*ra0;
				fil.b2=(1-alpha*g)*ra0;
				break;
			case 6:
				if(q<0.001) q=0.001;
				alpha=Math.sin(w0)/(2*q);
				var ra0=1/(1+alpha);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha)*ra0;
				fil.b0=fil.b2=ra0;
				fil.b1=-2*cos*ra0;
				break;
			case 7:
				if(q<0.001) q=0.001;
				alpha=Math.sin(w0)/(2*q);
				var ra0=1/(1+alpha);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha)*ra0;
				fil.b0=(1-alpha)*ra0;
				fil.b1=-2*cos*ra0;
				fil.b2=(1+alpha)*ra0;
				break;
			}
		}
		this.Process=function() {
			this.Setup(this);
			var xl,xr,yl,yr;
			var inbuf=this.node.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i) {
				xl=inbuf.buf[0][i];
				xr=inbuf.buf[1][i];
				yl=this.b0*xl+this.b1*this.x1l+this.b2*this.x2l-this.a1*this.y1l-this.a2*this.y2l;
				yr=this.b0*xr+this.b1*this.x1r+this.b2*this.x2r-this.a1*this.y1r-this.a2*this.y2r;
				this.x2l=this.x1l;
				this.x2r=this.x1r;
				this.x1l=xl;
				this.x1r=xr;
				this.y2l=this.y1l;
				this.y2r=this.y1r;
				this.y1l=yl;
				this.y1r=yr;
				this.node.outbuf.buf[0][i]=yl;
				this.node.outbuf.buf[1][i]=yr;
			}
		}
		waapisimNodes.push(this);
	}
	waapisimGain=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.gain=new waapisimAudioParam(0,1,1);
		this.Process=function() {
			var inbuf=this.node.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i) {
				this.node.outbuf.buf[0][i]=inbuf.buf[0][i]*this.gain.Get();
				this.node.outbuf.buf[1][i]=inbuf.buf[1][i]*this.gain.Get();
			}
		}
		waapisimNodes.push(this);
	}
	waapisimDelay=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.delayTime=new waapisimAudioParam(0,1,0);
		this.bufl=new Float32Array(waapisimSampleRate);
		this.bufr=new Float32Array(waapisimSampleRate);
		this.index=0;
		this.Process=function() {
			var inbuf=this.node.GetInputBuf();
			var offs=Math.floor(this.delayTime.Get()*this.context.sampleRate);
			if(offs<0)
				offs=0;
			if(offs>this.context.sampleRate)
				offs=this.context.sampleRate;
			for(var i=0;i<waapisimBufSize;++i) {
				var idxr=this.index-offs;
				if(idxr<0)
					idxr+=waapisimSampleRate;
				this.node.outbuf.buf[0][i]=this.bufl[idxr];
				this.node.outbuf.buf[1][i]=this.bufr[idxr];
				this.bufl[this.index]=inbuf.buf[0][i];
				this.bufr[this.index]=inbuf.buf[1][i];
				if(++this.index>=waapisimSampleRate)
					this.index=0;
			}
		}
		waapisimNodes.push(this);
	}
	waapisimOscillator=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=0;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.type=0;
		this.frequency=new waapisimAudioParam(1,20000,440);
		this.detune=new waapisimAudioParam(-1200,1200,0);
		this.playbackState=0;
		this.phase=0;
		this.start=function(w) {
			this.playbackState=2;
		}
		this.noteOn=function(w) {
			this.start(w);
		}
		this.stop=function(w) {
			this.playbackState=0;
		}
		this.noteOff=function(w) {
			this.stop(w);
		}
		this.setWaveTable=function(tab) {
		}
		this.Process=function() {
			if(this.playbackState!=2) {
				for(var i=0;i<waapisimBufSize;++i)
					this.node.outbuf.buf[0][i]=this.node.outbuf.buf[1][i]=0;
				return;
			}
			var f=Math.abs(this.frequency.Get()*Math.pow(2,this.detune.Get()/1200));
			var delta=f/this.context.sampleRate;
			var x1,x2,y,z;
			switch(this.type) {
			case 1:
				x1=0.5; x2=1.5; y=100000; z=0;
				break;
			case 2:
				x1=0; x2=2; y=2; z=0;
				break;
			case 3:
				x1=0.5; x2=1.5; y=4; z=0;
				break;
			case 0:
			default:
				x1=0.5; x2=1.5; y=2*Math.PI; z=1/6.78;
				break;
			}
			for(var i=0;i<waapisimBufSize;++i) {
				if((this.phase+=delta)>=1)
					this.phase-=1;
				var t=(Math.min(Math.max(this.phase ,x1-this.phase), x2-this.phase)-0.5)*y;
				var out=t-t*t*t*z;
				if(out>1.0)
					out=1.0;
				if(out<-1.0)
					out=-1.0
				this.node.outbuf.buf[0][i]=this.node.outbuf.buf[1][i]=out;
			}
		}
		waapisimNodes.push(this);
	}
	waapisimAnalyser=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.fftSize=256;
		this.frequencyBinCount=128;
		this.minDecibels=-100;
		this.maxDecibels=-30;
		this.smoothingTimeConstant=0;
		this.fftInData=new Array(256);
		this.fftOutData=new Array(128);
		this.timeData=new Array(256);
		this.fftIndex=0;
		this.fftCurrentSize=0;
		this.fftrev=new Array(256);
		this.fft=function(n,data,mag) {
			var nh=n>>1;
			var t=-2*Math.PI;
			var m,mq;
			for(var mh=1;(m=mh<<1)<=n;mh=m) {
				mq=mh>>1;
				t*=0.5;
				for(var jr=0;jr<n;jr+=m) {
					var kr=jr+mh;
					var xr=data[kr];
					data[kr]=data[jr]-xr;
					data[jr]+=xr;
				}
				for(var i=1;i<mq;++i) {
					var wr=Math.cos(t*i);
					var wi=Math.sin(t*i);
					for(var j=0;j<n;j+=m) {
						var jr=j+i;
						var ji=j+mh-i;
						var kr=j+mh+i;
						var ki=j+m-i;
						var xr=wr*data[kr]+wi*data[ki];
						var xi=wr*data[ki]-wi*data[kr];
						data[kr]=-data[ji]+xi;
						data[ki]=data[ji]+xi;
						data[ji]=data[jr]-xr;
						data[jr]=data[jr]+xr;
					}
				}
			}
			for(var i=0;i<n;++i)
				data[i]=Math.max(1e-100,data[i]/n);
			mag[0]=mag[0]*this.smoothingTimeConstant+(1-this.smoothingTimeConstant)*data[0];
			for(var i=1;i<nh;++i) {
				var v=Math.sqrt(data[i]*data[i]+data[n-i]*data[n-i]);
				if(v<1e-100)
					v=1e-100;
				mag[i]=mag[i]*this.smoothingTimeConstant+(1-this.smoothingTimeConstant)*v;
			}
		}
		this.getByteFrequencyData=function(array) {
			var range=this.maxDecibels-this.minDecibels;
			for(var l=Math.min(array.length,this.frequencyBinCount),i=0;i<l;++i) {
				var v=20*Math.LOG10E*Math.log(this.fftOutData[i]);
				array[i]=(Math.min(this.maxDecibels,Math.max(this.minDecibels,v))-this.minDecibels)*255/range;
			}
		}
		this.getFloatFrequencyData=function(array) {
			for(var l=Math.min(array.length,this.frequencyBinCount),i=0;i<l;++i)
				array[i]=20*Math.LOG10E*Math.log(this.fftOutData[i]);
		}
		this.getByteTimeDomainData=function(array) {
			for(var l=Math.min(this.frequencyBinCount,array.length),i=0;i<l;++i) {
				var v=Math.min(1,Math.max(-1,this.timeData[i]));
				array[i]=v*127+128;
			}
		}
		this.Process=function() {
			var inbuf=this.node.GetInputBuf();
			if(this.fftSize!=this.fftCurrentSize) {
				var n=this.fftSize;
				for(var i=0;i<n;++i)
					this.fftInData[i]=this.fftOutData[i]=0;
				this.fftCurrentSize=n;
				this.frequencyBinCount=n*0.5;
				this.fftIndex=0;
				this.fftrev[0]=0;
				this.fftrev[n-1]=n-1;
				for(var i=0,j=1;j<n-1;++j) {
					for(var k=n>>1;k>(i^=k);k>>=1)
						;
					this.fftrev[j]=i;
				}
			}
			for(var i=0;i<waapisimBufSize;++i) {
				var xl=inbuf.buf[0][i];
				var xr=inbuf.buf[1][i];
				this.node.outbuf.buf[0][i]=xl;
				this.node.outbuf.buf[1][i]=xr;
				var v=this.timeData[this.fftIndex]=(xl+xr)*0.5;
				this.fftInData[this.fftrev[this.fftIndex]]=v*(0.5-0.5*Math.cos(2*Math.PI*this.fftIndex/this.fftCurrentSize));
				if(++this.fftIndex>=this.fftCurrentSize) {
					this.fftIndex=0;
					this.fft(this.fftCurrentSize,this.fftInData,this.fftOutData);
				}
			}
		}
		waapisimNodes.push(this);
	}
	waapisimConvolver=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.buffer=null;
		this.normalize=false;
		this.Process=function() {
			var inbuf=this.node.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i) {
				this.node.outbuf.buf[0][i]=inbuf.buf[0][i];
				this.node.outbuf.buf[1][i]=inbuf.buf[1][i];
			}
		}
		waapisimNodes.push(this);
	}
	waapisimDynamicsCompressor=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.threshold=new waapisimAudioParam(-100,0,-24);
		this.knee=new waapisimAudioParam(0,40,30);
		this.ratio=new waapisimAudioParam(1,20,12);
		this.reduction=new waapisimAudioParam(-20,0,0);
		this.attack=new waapisimAudioParam(0,1,0.003);
		this.release=new waapisimAudioParam(0,1,0.25);
		this.Process=function() {
			var inbuf=this.node.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i) {
				this.node.outbuf.buf[0][i]=inbuf.buf[0][i];
				this.node.outbuf.buf[1][i]=inbuf.buf[1][i];
			}
		}
		waapisimNodes.push(this);
	}
	waapisimPanner=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.panningModel=0;
		this.distanceModel=1;
		this.refDistance=1;
		this.maxDistance=10000;
		this.rolloffFactor=1;
		this.coneInnerAngle=360;
		this.coneOuterAngle=360;
		this.coneOuterGain=0;
		this.px=0;
		this.py=0;
		this.pz=0;
		this.setPosition=function(x,y,z) {this.px=x;this.py=y;this.pz=z;}
		this.setOrientation=function(x,y,z) {}
		this.setVelocity=function(x,y,z) {}
		this.Process=function() {
			var inbuf=this.node.GetInputBuf();
			var listener=this.context.listener;
			var dx=this.px-listener.px;
			var dy=this.py-listener.py;
			var dz=this.pz-listener.pz;
			var d=Math.max(1,Math.sqrt(dx*dx+dy*dy+dz*dz));
			var rgain=dx-dz;
			var lgain=-dx-dz;
			var rl=Math.sqrt(rgain*rgain+lgain*lgain);
			switch(this.distanceModel) {
			case 0:
				var dgain=1-this.rolloffFactor*(d-this.refDistance)/(this.maxDistance-this.refDistance);
				break;
			case 1:
				var dgain=this.refDistance/(this.refDistance+this.rolloffFactor*(d-this.refDistance));
				break;
			case 2:
				var dgain=Math.pow(d/this.refDistance,-this.rolloffFactor);
				break;
			}
			if(rl==0)
				rgain=lgain=Math.sqrt(2)*dgain;
			else {
				rgain=rgain/rl;
				lgain=lgain/rl;
				var a=Math.sqrt(rgain*rgain+lgain*lgain);
				rgain=rgain/a*2*dgain; lgain=lgain/a*2*dgain;
			}
			for(var i=0;i<waapisimBufSize;++i) {
				this.node.outbuf.buf[0][i]=inbuf.buf[0][i]*lgain;
				this.node.outbuf.buf[1][i]=inbuf.buf[1][i]*rgain;
			}
		}
		waapisimNodes.push(this);
	}
	waapisimChannelSplitter=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.Process=function() {
			var inbuf=this.node.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i) {
				this.node.outbuf.buf[0][i]=inbuf.buf[0][i];
				this.node.outbuf.buf[1][i]=inbuf.buf[1][i];
			}
		}
		waapisimNodes.push(this);
	}
	waapisimChannelMerger=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.Process=function() {
			var inbuf=this.node.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i) {
				this.node.outbuf.buf[0][i]=inbuf.buf[0][i];
				this.node.outbuf.buf[1][i]=inbuf.buf[1][i];
			}
		}
		waapisimNodes.push(this);
	}
	waapisimWaveShaper=function(ctx) {
		this.context=ctx;
		this.node=new waapisimAudioNode(waapisimBufSize);
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.connect=function(dest) {this.node.connect(dest);}
		this.disconnect=function() {this.node.disconnect();}
		this.curve=null;
		this.Process=function() {
			var inbuf=this.node.GetInputBuf();
			if(this.curve!=null) {
				var len=this.curve.length-1;
				for(var i=0;i<waapisimBufSize;++i) {
					var xl=Math.max(-1,Math.min(1,inbuf.buf[0][i]));
					var xr=Math.max(-1,Math.min(1,inbuf.buf[1][i]));
					xl=this.curve[((xl+1)*0.5*len+0.5)|0];
					xr=this.curve[((xr+1)*0.5*len+0.5)|0];
					this.node.outbuf.buf[0][i]=xl;
					this.node.outbuf.buf[1][i]=xr;
				}
			}
			else {
				for(var i=0;i<waapisimBufSize;++i) {
					this.node.outbuf.buf[0][i]=inbuf.buf[0][i];
					this.node.outbuf.buf[1][i]=inbuf.buf[1][i];
				}
			}
		}
		waapisimNodes.push(this);
	}
	waapisimAudioParam=function(min,max,def) {
		this.value=def;
		this.computedValue=def;
		this.minValue=min;
		this.maxValue=max;
		this.defaultValue=def;
		this.from=new Array();
		this.setValueAtTime=function(v,t) {}
		this.linearRampToValueAtTime=function(v,t) {}
		this.exponentialRampToValueAtTime=function(v,t) {}
		this.setTargetAtTime=function(target,t,c) {}
		this.setValueCurveAtTime=function(v,t,d) {}
		this.cancelScheduledValues=function(t) {}
		this.Get=function() {
			this.computedValue=this.value;
			var len=this.from.length;
			for(var i=0;i<len;++i)
				this.computedValue+=(this.from[i].outbuf.buf[0][0]+this.from[i].outbuf.buf[1][0])*0.5;
			return this.computedValue;
		}
	}
}
waapisimSetup();
