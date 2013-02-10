// Web Audio API Simulator
// Copyright (c) 2013 g200kg
// http://www.g200kg.com/
//         Released under the MIT-License
//         http://opensource.org/licenses/MIT
//
//  Great thanks :
//  FFT algo for AnalyserNode is based on Takuya OOURA's explanation.
//   http://www.kurims.kyoto-u.ac.jp/~ooura/fftman/index.html

var waapisimLogEnable=0;

// Support Float32Array if unavailable (for IE9)
if(typeof(Float32Array)==="undefined") {
	Float32Array=function(n) {
		var a=new Array(n);
		a.subarray=function(x,y) {return this.slice(x,y);}
		a.set=function(x,off) {for(var i=0;i<x.length;++i) a[off+i]=x[i];}
		return a;
	}
}
if(typeof(Uint8Array)==="undefined") {
	Uint8Array=function(n) {
		var a=new Array(n);
		a.subarray=function(x,y) {return this.slice(x,y);}
		a.set=function(x,off) {for(var i=0;i<x.length;++i) a[off+i]=x[i];}
		return a;
	}
}

if(typeof(waapisimLogEnable)!=="undefined"&&waapisimLogEnable)
	waapisimDebug=console.log;
else
	waapisimDebug=function(){}

function waapisimSetup() {
	if(typeof(webkitAudioContext)!=="undefined")
		return;

	waapisimSampleRate=44100;
	waapisimAudioIf=0;
	waapisimBufSize=1024;
	if(typeof(Audio)!=="undefined") {
		waapisimAudio=new Audio();
		if(typeof(waapisimAudio.mozSetup)!=="undefined")
			waapisimAudioIf=1;
	}
	if(waapisimAudioIf==0) {
		waapisimOutBufSize=waapisimBufSize*3;
		waapisimOutBuf=new Array(waapisimOutBufSize*2);
	}
	else {
		waapisimOutBufSize=waapisimBufSize;
		waapisimOutBuf=new Float32Array(waapisimOutBufSize*2);
		waapisimAudio.mozSetup(2,waapisimSampleRate);
	}
	for(var l=waapisimOutBuf.length,i=0;i<l;++i)
		waapisimOutBuf[i]=0;
	waapisimWrittenpos=0;
	waapisimNodeId=0;
	waapisimNodes=new Array();
	waapisimContexts=new Array();
	waapisimAudioBuffer=function(ch,len,rate) {
		if(typeof(ch)!=="number") {
			this.sampleRate=44100;
			var buf=new Uint8Array(ch);
			riff=String.fromCharCode(buf[0],buf[1],buf[2],buf[3]);
			if(riff=="RIFF") {
				var filesize=buf[4]+(buf[5]<<8)+(buf[6]<<16)+(buf[7]<<24)+8;
				var wave=String.fromCharCode(buf[8],buf[9],buf[10],buf[11]);
				if(wave=="WAVE") {
					var idx=12;
					while(idx<filesize) {
						var chunk=String.fromCharCode(buf[idx],buf[idx+1],buf[idx+2],buf[idx+3]);
						var chunksz=buf[idx+4]+(buf[idx+5]<<8)+(buf[idx+6]<<16)+(buf[idx+7]<<24);
						if(chunk=="fmt ") {
							var fmtid=buf[idx+8]+(buf[idx+9]<<8);
							var wavch=buf[idx+10]+(buf[idx+11]<<8);
							var wavrate=buf[idx+12]+(buf[idx+13]<<8)+(buf[idx+14]<<16)+(buf[idx+15]<<24);
							var wavbits=buf[idx+22]+(buf[idx+23]<<8);
						}
						if(chunk=="data") {
							this.length=(chunksz/wavch/(wavbits/8))|0;
							this.buf=new Array();
							this.buf[0]=new Float32Array(this.length);
							this.buf[1]=new Float32Array(this.length);
							this.numberOfChannels=2;
							this.duration=this.length/44100;
							var v;
							for(var i=0,j=0;i<this.length;++i) {
								if(wavbits==16) {
									if(wavch==2) {
										v=buf[idx+j+8]+(buf[idx+j+9]<<8);
										if(v>=32768) v=v-65536;
										this.buf[0][i]=v/32768;
										v=buf[idx+j+8]+(buf[idx+j+9]<<8);
										if(v>=32768) v=v-65536;
										this.buf[1][i]=v/32768;
										j+=4;
									}
									else {
										v=buf[idx+j+8]+(buf[idx+j+9]<<8);
										if(v>=32768) v=v-65536;
										this.buf[0][i]=this.buf[1][i]=v/32768;
										j+=2;
									}
								}
								else {
									if(wavch==2) {
										this.buf[0][i]=buf[idx+j+8]/128-1;
										this.buf[1][i]=buf[idx+j+9]/128-1;
										j+=2;
									}
									else {
										this.buf[0][i]=this.buf[1][i]=buf[idx+j+8]/128-1;
										j++;
									}
								}
							}
						}
						idx+=(chunksz+8);
					}
				}
			}
		}
		else {
			this.sampleRate=rate;
			this.length=len;
			this.duration=len/this.sampleRate;
			this.numberOfChannels=ch;
			this.buf=new Array();
			for(var i=0;i<ch;++i) {
				this.buf[i]=new Float32Array(len);
				for(var j=0;j<len;++j)
					this.buf[i][j]=0;
			}
		}
		this.getChannelData=function(i) {
			return this.buf[i];
		}
	}
	waapisimDummybuf=new waapisimAudioBuffer(2,waapisimBufSize,waapisimSampleRate);
	waapisimRegisterNode=function(node) {
		
		for(var i=waapisimNodes.length;i--;)
			if(waapisimNodes[i]===node)
				return false;
		waapisimNodes.push(node);
		return true;
	}
	waapisimUnregisterNode=function(node) {
		for(var i=waapisimNodes.length;i--;) {
			if(waapisimNodes[i]==node)
				waapisimNodes.splice(i,1);
		}
	}
	waapisimSetupOutBuf=function(offset) {
		var numctx=waapisimContexts.length;
		if(numctx>0) {
			for(;;) {
				for(var l=waapisimNodes.length,i=0;i<l;++i) {
					var node=waapisimNodes[i];
					if(node.playbackState==3) {
						node.disconnect();
						waapisimUnregisterNode(node);
						break;
					}
				}
				if(i==l)
					break;
			}
			for(var l=waapisimNodes.length,i=0;i<l;++i)
				waapisimNodes[i].Process();
			for(var l=(offset+waapisimBufSize)*2,i=offset*2;i<l;i+=2)
				waapisimOutBuf[i]=waapisimOutBuf[i+1]=0;
			for(var j=0;j<numctx;++j) {
				var node=waapisimContexts[j].destination;
				if(node.from.length>0) {
					var buf=node.inbuf.buf;
					for(var i=0;i<waapisimBufSize;++i) {
						waapisimOutBuf[(i+offset)*2]+=buf[0][i];
						waapisimOutBuf[(i+offset)*2+1]+=buf[1][i];
					}
				}
				node.NodeClear();
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
		var s="";
		for(var i=0;i<waapisimBufSize*6;++i) {
			var v=((waapisimOutBuf[i]+1)*32768);
			if(isNaN(v)) v=32768;
			v=Math.min(65525,Math.max(1,v))|0;
			s+=String.fromCharCode(Math.floor(v));
		}
		return s;
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
		this.createBuffer=function(ch,len,rate) {
			return new waapisimAudioBuffer(ch,len,rate);
		}
		this.createBufferSource=function() {
			return new waapisimAudioBufferSource(this);
		}
		this.createScriptProcessor=this.createJavaScriptNode=function(bufsize,inch,outch) {
			return new waapisimScriptProcessor(this,bufsize,inch,outch);
		}
		this.createBiquadFilter=function() {
			return new waapisimBiquadFilter(this);
		}
		this.createGain=this.createGainNode=function() {
			return new waapisimGain(this);
		}
		this.createDelay=this.createDelayNode=function() {
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
		this.nodeId=waapisimNodeId++;
		this.targettype=1;
		this.context=null;
		this.bufsize=size;
		this.from=new Array();
		this.to=new Array();
		this.connect=function(next) {
			waapisimDebug("connect "+this.nodetype+this.nodeId+"=>"+next.nodetype+next.nodeId);
			if(next.from.indexOf(this)!=-1)
				return;
			if(this.to.indexOf(next)==-1)
				this.to.push(next);
			next.from.push(this);
			if(next.targettype!=0) {
				if(waapisimRegisterNode(next)) {
					for(var l=next.to.length,i=0;i<l;++i) {
						next.connect(next.to[i]);
					}
				}
			}
		}
		this.disconnect=function() {
			waapisimDebug("disconnect "+this.nodetype+this.nodeId);
			for(var l=waapisimNodes.length,i=0;i<l;++i) {
				var j=waapisimNodes[i].from.indexOf(this);
				if(j>=0) {
					waapisimDebug("  :"+this.nodeId+"=>"+waapisimNodes[i].nodeId);
					waapisimNodes[i].from.splice(j,1);
				}
			}
			for(;;) {
				for(var l=waapisimNodes.length,i=0;i<l;++i) {
					var node=waapisimNodes[i];
					if(node.targettype==1 && node.from.length==0) {
						waapisimDebug("  del "+node.nodeId);
						for(var ii=0;ii<l;++ii) {
							var node2=waapisimNodes[ii];
							var jj=node2.from.indexOf(node);
							if(jj>=0) {
								waapisimDebug("  :"+node.nodeId+"=>"+node2.nodeId);
								node2.from.splice(jj,1);
							}
						}
						waapisimUnregisterNode(node);
						break;
					}
				}
				if(i==l)
					break;
			}
			this.to.length=0;
		}
		this.outbuf=new waapisimAudioBuffer(2,size,waapisimSampleRate);
		this.inbuf=new waapisimAudioBuffer(2,size,waapisimSampleRate);
		this.NodeClear=function() {
			for(var i=0;i<waapisimBufSize;++i)
				this.inbuf.buf[0][i]=this.inbuf.buf[1][i]=0;
		}
		this.NodeEmit=function(idx,v1,v2) {
			for(var l=this.to.length,i=0;i<l;++i) {
				var buf=this.to[i].inbuf.buf;
				buf[0][idx]+=v1;
				buf[1][idx]+=v2;
			}
		}
		this.NodeEmitBuf=function() {
			for(var l=this.to.length,i=0;i<l;++i) {
				var b0=this.to[i].inbuf.buf[0];
				var b1=this.to[i].inbuf.buf[1];
				for(var j=0;j<waapisimBufSize;++j) {
					b0[j]+=this.outbuf.buf[0][j];
					b1[j]+=this.outbuf.buf[1][j];
				}
			}
		}
		this.GetInputBuf=function() {
			return this.inbuf;
		}
	}
	waapisimAudioProcessingEvent=function() {
	}
	waapisimAudioDestinationNode=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="Destination";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.targettype=2;
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=0;
		this.playbackState=0;
		this.maxNumberOfChannels=2;
		this.numberOfChannels=2;
		this.Process=function() {
		}
		waapisimNodes.push(this);
	}
	
	waapisimAudioBufferSource=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="BufSrc";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.targettype=3;
		this.context=ctx;
		this.numberOfInputs=0;
		this.numberOfOutputs=1;
		this.playbackState=0;
		this.buffer=null;
		this.playbackRate=new waapisimAudioParam(0,10,1);
		this.loop=false;
		this.loopStart=0;
		this.loopEnd=0;
		this.bufferindex=0;
		this.start=this.noteOn=function(w) {
			this.playbackState=2;
			waapisimRegisterNode(this);
		}
		this.stop=this.noteOff=function(w) {
			this.playbackState=3;
		}
		this.Process=function() {
			if(this.buffer!=null && this.bufferindex>=this.buffer.length)
				this.playbackState=3;
			if(this.playbackState!=2)
				return;
			var b0=this.buffer.getChannelData(0);
			var b1=this.buffer.getChannelData(1);
			if(this.to.length>0) {
				for(var i=0;i<waapisimBufSize;++i) {
					if(this.bufferindex<this.buffer.length) {
						var idx=this.bufferindex|0;
						this.outbuf.buf[0][i]=b0[idx];
						this.outbuf.buf[1][i]=b1[idx];
					}
					this.bufferindex+=this.playbackRate.Get(i);
				}
				this.NodeEmitBuf();
				this.playbackRate.Clear(false);
			}
		}
	}
	waapisimAudioBufferSource.UNSCHEDULED_STATE=waapisimAudioBufferSource.prototype.UNSCHEDULED_STATE=0;
	waapisimAudioBufferSource.SCHEDULED_STATE=waapisimAudioBufferSource.prototype.SCHEDULED_STATE=1;
	waapisimAudioBufferSource.PLAYING_STATE=waapisimAudioBufferSource.prototype.PLAYING_STATE=2;
	waapisimAudioBufferSource.FINISHED_STATE=waapisimAudioBufferSource.prototype.FINISHED_STATE=3;
	
	waapisimScriptProcessor=function(ctx,bufsize,inch,outch) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="ScrProc";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.targettype=2;
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
		if(typeof(inch)=="undefined")
			inch=2;
		if(typeof(outch)=="undefined")
			outch=2;
		this.bufferSize=bufsize;
		this.scrinbuf=new waapisimAudioBuffer(inch,bufsize,waapisimSampleRate);
		this.scroutbuf=new waapisimAudioBuffer(outch,bufsize,waapisimSampleRate);
		this.index=bufsize;
		this.onaudioprocess=null;
		this.Process=function() {
			var inb=this.GetInputBuf();
			if(inb==null)
				inb=waapisimDummybuf;
			for(var i=0;i<waapisimBufSize;++i) {
				if(this.index>=this.bufferSize) {
					if(this.onaudioprocess) {
						var ev=new waapisimAudioProcessingEvent();
						ev.node=this;
						ev.inputBuffer=this.scrinbuf;
						ev.outputBuffer=this.scroutbuf;
						this.onaudioprocess(ev);
					}
					this.index=0;
				}
				this.scrinbuf.buf[0][this.index]=inb.buf[0][i];
				if(this.scrinbuf.numberOfChannels>=2)
					this.scrinbuf.buf[1][this.index]=inb.buf[1][i];
				if(this.scroutbuf.numberOfChannels>=2)
					this.NodeEmit(i,this.scroutbuf.buf[0][this.index],this.scroutbuf.buf[1][this.index]);
				else
					this.NodeEmit(i,this.scroutbuf.buf[0][this.index],this.scroutbuf.buf[0][this.index]);
				this.index++;
			}
			this.NodeClear();
		}
		waapisimRegisterNode(this);
	}
	waapisimBiquadFilter=BiquadFilterNode=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="Filter";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
		this.type=0;
		this.frequency=new waapisimAudioParam(10,24000,350);
		this.detune=new waapisimAudioParam(-1200,1200,0);
		this.Q=new waapisimAudioParam(0.0001,1000,1);
		this.gain=new waapisimAudioParam(-40,40,0);
		this.a1=this.a2=0;
		this.b0=this.b1=this.b2=0;
		this.x1l=this.x1r=this.x2l=this.x2r=0;
		this.y1l=this.y1r=this.y2l=this.y2r=0;
		this.NodeClear();
		this.Setup=function(fil) {
			var f=fil.frequency.Get(0)*Math.pow(2,fil.detune.Get(0)/1200);
			var q=fil.Q.Get(0);
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
				var g=Math.pow(10,fil.gain.Get(0)/40);
				var ra0=1/((g+1)+(g-1)*cos+2*Math.sqrt(g)*alpha);
				fil.a1=-2*((g-1)+(g+1)*cos)*ra0;
				fil.a2=((g+1)+(g-1)*cos-2*Math.sqrt(g)*alpha)*ra0;
				fil.b0=g*((g+1)-(g-1)*cos+2*Math.sqrt(g)*alpha)*ra0;
				fil.b1=2*g*((g-1)-(g+1)*cos)*ra0;
				fil.b2=g*((g+1)-(g-1)*cos-2*Math.sqrt(g)*alpha)*ra0;
				break;
			case 4:
				alpha=Math.sin(w0)/2*Math.sqrt(2);
				var g=Math.pow(10,fil.gain.Get(0)/40);
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
				var g=Math.pow(10,fil.gain.Get(0)/40);
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
			var xl,xr,yl,yr;
			this.Setup(this);
			var inbuf=this.GetInputBuf();
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
				this.outbuf.buf[0][i]=yl;
				this.outbuf.buf[1][i]=yr;
			}
			this.NodeEmitBuf();
			this.NodeClear();
			this.frequency.Clear(false);
			this.detune.Clear(false);
			this.Q.Clear(false);
			this.gain.Clear(false);
		}
	}
	waapisimBiquadFilter.LOWPASS=waapisimBiquadFilter.prototype.LOWPASS=0;
	waapisimBiquadFilter.HIGHPASS=waapisimBiquadFilter.prototype.HIGHPASS=1;
	waapisimBiquadFilter.BANDPASS=waapisimBiquadFilter.prototype.BANDPASS=2;
	waapisimBiquadFilter.LOWSHELF=waapisimBiquadFilter.prototype.LOWSHELF=3;
	waapisimBiquadFilter.HIGHSHELF=waapisimBiquadFilter.prototype.HIGHSHELF=4;
	waapisimBiquadFilter.PEAKING=waapisimBiquadFilter.prototype.PEAKING=5;
	waapisimBiquadFilter.NOTCH=waapisimBiquadFilter.prototype.NOTCH=6;
	waapisimBiquadFilter.ALLPASS=waapisimBiquadFilter.prototype.ALLPASS=7;

	waapisimGain=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="Gain";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
		this.gain=new waapisimAudioParam(0,1,1);
		this.NodeClear();
		this.Process=function() {
			var inbuf=this.GetInputBuf();
			switch(this.to.length) {
			case 0:
				break;
			case 1:
				var b=this.to[0].inbuf.buf;
				for(var i=0;i<waapisimBufSize;++i) {
					b[0][i]+=inbuf.buf[0][i]*this.gain.Get(i);
					b[1][i]+=inbuf.buf[1][i]*this.gain.Get(i);
				}
				break;
			default:
				for(var i=0;i<waapisimBufSize;++i) {
					this.NodeEmit(i,inbuf.buf[0][i]*this.gain.Get(i),inbuf.buf[1][i]*this.gain.Get(i));
				}
			}
			this.NodeClear();
			this.gain.Clear(false);
		}
	}

	waapisimDelay=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="Delay";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
		this.delayTime=new waapisimAudioParam(0,1,0);
		this.bufl=new Float32Array(waapisimSampleRate);
		this.bufr=new Float32Array(waapisimSampleRate);
		this.index=0;
		this.Process=function() {
			var inbuf=this.GetInputBuf();
			var offs=Math.floor(this.delayTime.Get(0)*this.context.sampleRate);
			if(offs<0)
				offs=0;
			if(offs>this.context.sampleRate)
				offs=this.context.sampleRate;
			for(var i=0;i<waapisimBufSize;++i) {
				var idxr=this.index-offs;
				if(idxr<0)
					idxr+=waapisimSampleRate;
				this.outbuf.buf[0][i]=this.bufl[idxr];
				this.outbuf.buf[1][i]=this.bufr[idxr];
				this.bufl[this.index]=inbuf.buf[0][i];
				this.bufr[this.index]=inbuf.buf[1][i];
				if(++this.index>=waapisimSampleRate)
					this.index=0;
			}
			this.NodeEmitBuf();
			this.NodeClear();
			this.delayTime.Clear(false);
		}
	}

	waapisimOscillator=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="Osc";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.targettype=3;
		this.context=ctx;
		this.numberOfInputs=0;
		this.numberOfOutputs=1;
		this.type=0;
		this.frequency=new waapisimAudioParam(1,20000,440);
		this.detune=new waapisimAudioParam(-1200,1200,0);
		this.playbackState=0;
		this.phase=0;
		this.start=this.noteOn=function(w) {
			this.playbackState=2;
			waapisimRegisterNode(this);
		}
		this.stop=this.noteOff=function(w) {
			this.playbackState=3;
		}
		this.setWaveTable=function(tab) {
		}
		this.Process=function() {
			if(this.playbackState!=2) {
				for(var i=0;i<waapisimBufSize;++i)
					this.outbuf.buf[0][i]=this.outbuf.buf[1][i]=0;
				return;
			}
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
				var f=this.frequency.Get(i)*Math.pow(2,this.detune.Get(i)/1200);
				var delta=f/this.context.sampleRate;
				this.phase+=delta;
				while(this.phase>=1)
					this.phase-=1;
				while(this.phase<0)
					this.phase+=1;
				var t=(Math.min(Math.max(this.phase ,x1-this.phase), x2-this.phase)-0.5)*y;
				var out=t-t*t*t*z;
				if(out>1.0)
					out=1.0;
				if(out<-1.0)
					out=-1.0
				this.outbuf.buf[0][i]=this.outbuf.buf[1][i]=out;
			}
			this.NodeEmitBuf();
			this.frequency.Clear(true);
			this.detune.Clear(true);
		}
	}
	waapisimOscillator.SINE=waapisimOscillator.prototype.SINE=0;
	waapisimOscillator.SQUARE=waapisimOscillator.prototype.SQUARE=1;
	waapisimOscillator.SAWTOOTH=waapisimOscillator.prototype.SAWTOOTH=2;
	waapisimOscillator.TRIANGLE=waapisimOscillator.prototype.TRIANGLE=3;
	waapisimOscillator.CUSTOM=waapisimOscillator.prototype.CUSTOM=4;
	waapisimOscillator.UNSCHEDULED_STATE=waapisimOscillator.prototype.UNSCHEDULED_STATE=0;
	waapisimOscillator.SCHEDULED_STATE=waapisimOscillator.prototype.SCHEDULED_STATE=1;
	waapisimOscillator.PLAYING_STATE=waapisimOscillator.prototype.PLAYING_STATE=2;
	waapisimOscillator.FINISHED_STATE=waapisimOscillator.prototype.FINISHED_STATE=3;
	
	waapisimAnalyser=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="Analyser";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
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
			var inbuf=this.GetInputBuf();
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
				this.NodeEmit(i,xl,xr);
				var v=this.timeData[this.fftIndex]=(xl+xr)*0.5;
				this.fftInData[this.fftrev[this.fftIndex]]=v*(0.5-0.5*Math.cos(2*Math.PI*this.fftIndex/this.fftCurrentSize));
				if(++this.fftIndex>=this.fftCurrentSize) {
					this.fftIndex=0;
					this.fft(this.fftCurrentSize,this.fftInData,this.fftOutData);
				}
			}
			this.NodeClear();
		}
	}

	waapisimConvolver=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="Convolver";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
		this.buffer=null;
		this.normalize=false;
		this.Process=function() {
			var inbuf=this.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i)
				this.NodeEmit(i,inbuf.buf[0][i],inbuf.buf[1][i]);
			this.NodeClear();
		}
	}

	waapisimDynamicsCompressor=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="DynComp";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
		this.threshold=new waapisimAudioParam(-100,0,-24);
		this.knee=new waapisimAudioParam(0,40,30);
		this.ratio=new waapisimAudioParam(1,20,12);
		this.reduction=new waapisimAudioParam(-20,0,0);
		this.attack=new waapisimAudioParam(0,1,0.003);
		this.release=new waapisimAudioParam(0,1,0.25);
		this.Process=function() {
			var inbuf=this.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i)
				this.NodeEmit(i,inbuf.buf[0][i],inbuf.buf[1][i]);
			this.NodeClear();
			this.threshold.Clear(false);
			this.knee.Clear(false);
			this.ratio.Clear(false);
			this.reduction.Clear(false);
			this.attack.Clear(false);
			this.release.Clear(false);
		}
	}

	waapisimPanner=AudioPannerNode=webkitAudioPannerNode=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="Panner";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
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
			var inbuf=this.GetInputBuf();
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
			for(var i=0;i<waapisimBufSize;++i)
				this.NodeEmit(i,inbuf.buf[0][i]*lgain,inbuf.buf[1][i]*rgain);
			this.NodeClear();
		}
	}
	waapisimPanner.EQUALPOWER=waapisimPanner.prototype.EQUALPOWER=0;
	waapisimPanner.HRTF=waapisimPanner.prototype.HRTF=1;
	waapisimPanner.SOUNDFIELD=waapisimPanner.prototype.SOUNDFIELD=2;
	waapisimPanner.LINEAR_DISTANCE=waapisimPanner.prototype.LINEAR_DISTANCE=0;
	waapisimPanner.INVERSE_DISTANCE=waapisimPanner.prototype.INVERSE_DISTANCE=1;
	waapisimPanner.EXPONENTIAL_DISTANCE=waapisimPanner.prototype.EXPONENTIAL_DISTANCE=2;
	
	waapisimChannelSplitter=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="ChSplit";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
		this.Process=function() {
			var inbuf=this.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i)
				this.NodeEmit(i,inbuf.buf[0][i],inbuf.buf[1][i]);
			this.NodeClear();
		}
	}

	waapisimChannelMerger=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="ChMerge";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
		this.Process=function() {
			var inbuf=this.GetInputBuf();
			for(var i=0;i<waapisimBufSize;++i)
				this.NodeEmit(i,inbuf.buf[0][i],inbuf.buf[1][i]);
			this.NodeClear();
		}
	}

	waapisimWaveShaper=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize);
		this.nodetype="Shaper";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.numberOfInputs=1;
		this.numberOfOutputs=1;
		this.playbackState=0;
		this.curve=null;
		this.Process=function() {
			var inbuf=this.GetInputBuf();
			if(this.curve!=null) {
				var len=this.curve.length-1;
				for(var i=0;i<waapisimBufSize;++i) {
					var xl=Math.max(-1,Math.min(1,inbuf.buf[0][i]));
					var xr=Math.max(-1,Math.min(1,inbuf.buf[1][i]));
					xl=this.curve[((xl+1)*0.5*len+0.5)|0];
					xr=this.curve[((xr+1)*0.5*len+0.5)|0];
					this.NodeEmit(i,xl,xr);
				}
			}
			else {
				for(var i=0;i<waapisimBufSize;++i)
					this.NodeEmit(i,inbuf.buf[0][i],inbuf.buf[1][i]);
			}
			this.NodeClear();
		}
	}

	waapisimAudioParam=function(min,max,def) {
		this.targettype=0;
		this.value=def;
		this.computedValue=def;
		this.minValue=min;
		this.maxValue=max;
		this.defaultValue=def;
		this.from=new Array();
		this.inbuf={};
		this.inbuf.buf=new Array();
		this.inbuf.buf[0]=new Float32Array(waapisimBufSize);
		this.inbuf.buf[1]=new Float32Array(waapisimBufSize);
		for(var i=0;i<waapisimBufSize;++i)
			this.inbuf.buf[0][i]=this.inbuf.buf[1][i]=0;
		this.setValueAtTime=function(v,t) {}
		this.linearRampToValueAtTime=function(v,t) {}
		this.exponentialRampToValueAtTime=function(v,t) {}
		this.setTargetAtTime=function(target,t,c) {}
		this.setValueCurveAtTime=function(v,t,d) {}
		this.cancelScheduledValues=function(t) {}
		this.Get=function(n) {
			this.computedValue=this.value+(this.inbuf.buf[0][n]+this.inbuf.buf[1][n])*0.5;
			return this.computedValue;
		}
		this.Clear=function(arate) {
			if(arate) {
				for(var i=0;i<waapisimBufSize;++i)
					this.inbuf.buf[0][i]=this.inbuf.buf[1][i]=0;
			}
			else
				this.inbuf.buf[0][0]=this.inbuf.buf[1][0]=0;
		}
	}
}
waapisimSetup();
