// Web Audio API Simulator
// Copyright (c) 2013 g200kg
// http://www.g200kg.com/
//         Released under the MIT-License
//         http://opensource.org/licenses/MIT
//
//  Great thanks :
//  FFT algo for AnalyserNode and Convolver is based on Takuya OOURA's explanation.
//   http://www.kurims.kyoto-u.ac.jp/~ooura/fftman/index.html

var waapisimLogEnable=0;

// Support Float32Array if unavailable (for IE9)
if(typeof(Float32Array)==="undefined") {
	Float32Array=function(n) {
		if(n instanceof Array)
			return n;
		var a=new Array(n);
		a.subarray=function(x,y) {return this.slice(x,y);};
		a.set=function(x,off) {for(var i=0;i<x.length;++i) a[off+i]=x[i];};
		return a;
	};
}
if(typeof(Uint8Array)==="undefined") {
	Uint8Array=function(n) {
		if(n instanceof Array)
			return n;
		var a=new Array(n);
		a.subarray=function(x,y) {return this.slice(x,y);};
		a.set=function(x,off) {for(var i=0;i<x.length;++i) a[off+i]=x[i];};
		return a;
	};
}

if(typeof(waapisimLogEnable)!=="undefined"&&waapisimLogEnable)
	waapisimDebug=console.log;
else
	waapisimDebug=function(){};

if(typeof(webkitAudioContext)==="undefined" && typeof(AudioContext)==="undefined") {
	waapisimSampleRate=44100;
	waapisimAudioIf=0;
	waapisimBufSize=1024;
	waapisimFlashBufSize=1024*3;
	if(typeof(Audio)!=="undefined") {
		waapisimAudio=new Audio();
		if(typeof(waapisimAudio.mozSetup)!=="undefined")
			waapisimAudioIf=1;
	}
	if(waapisimAudioIf===0) {
		waapisimOutBufSize=waapisimFlashBufSize;
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
	waapisimNodes=[];
	waapisimContexts=[];
	waapisimAudioBuffer=function(ch,len,rate) {
		var i,j;
		if(typeof(ch)=="number") {
			this.sampleRate=rate;
			this.length=len;
			this.duration=len/this.sampleRate;
			this.numberOfChannels=ch;
			this.buf=[];
			for(i=0;i<2;++i) {
				this.buf[i]=new Float32Array(len);
				for(j=0;j<len;++j)
					this.buf[i][j]=0;
			}
		}
		else {
			var inbuf;
			this.sampleRate=44100;
			this.buf=[];
			this.buf[0]=new Float32Array(0);
			this.buf[1]=new Float32Array(0);
			this.Get4BStr=function(b,n) {
				return String.fromCharCode(b[n],b[n+1],b[n+2],b[n+3]);
			};
			this.GetDw=function(b,n) {
				return b[n]+(b[n+1]<<8)+(b[n+2]<<16)+(b[n+3]<<24);
			};
			this.GetWd=function(b,n) {
				return b[n]+(b[n+1]<<8);
			};
			inbuf=new Uint8Array(ch);
			var mixtomono=len;
			var riff=this.Get4BStr(inbuf,0);
			if(riff=="RIFF") {
				var filesize=this.GetDw(inbuf,4)+8;
				var wave=this.Get4BStr(inbuf,8);
				var fmtid=0;
				var wavch=1;
				var wavbits=16;
				if(wave=="WAVE") {
					var idx=12;
					while(idx<filesize) {
						var chunk=this.Get4BStr(inbuf,idx);
						var chunksz=this.GetDw(inbuf,idx+4);
						if(chunk=="fmt ") {
							fmtid=this.GetWd(inbuf,idx+8);
							wavch=this.GetWd(inbuf,idx+10);
							this.sampleRate=this.GetDw(inbuf,idx+12);
							wavbits=this.GetWd(inbuf,idx+22);
						}
						if(chunk=="data") {
							this.length=(chunksz/wavch/(wavbits/8))|0;
							this.buf[0]=new Float32Array(this.length);
							this.buf[1]=new Float32Array(this.length);
							this.numberOfChannels=wavch;
							this.duration=this.length/this.sampleRate;
							var v0,v1;
							for(i=0,j=0;i<this.length;++i) {
								if(wavbits==16) {
									if(wavch==2) {
										v0=inbuf[idx+j+8]+(inbuf[idx+j+9]<<8);
										v1=inbuf[idx+j+10]+(inbuf[idx+j+11]<<8);
										if(v0>=32768) v0=v0-65536;
										if(v1>=32768) v1=v1-65536;
										if(mixtomono==true)
											v0=v1=(v0+v1)*0.5;
										this.buf[0][i]=v0/32768;
										this.buf[1][i]=v1/32768;
										j+=4;
									}
									else {
										v=inbuf[idx+j+8]+(inbuf[idx+j+9]<<8);
										if(v>=32768) v=v-65536;
										this.buf[0][i]=this.buf[1][i]=v/32768;
										j+=2;
									}
								}
								else {
									if(wavch==2) {
										v0=inbuf[idx+j+8]/128-1;
										v1=inbuf[idx+j+9]/128-1;
										if(mixtomono==true)
											v0=v1=(v0+v1)*0.5;
										this.buf[0][i]=v0;
										this.buf[1][i]=v1;
										j+=2;
									}
									else {
										this.buf[0][i]=this.buf[1][i]=inbuf[idx+j+8]/128-1;
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
		this.getChannelData=function(i) {
			return this.buf[i];
		};
	};
	waapisimDummybuf=new waapisimAudioBuffer(2,waapisimBufSize,waapisimSampleRate);
	waapisimRegisterNode=function(node) {
		for(var i=waapisimNodes.length;i--;)
			if(waapisimNodes[i]===node)
				return false;
		waapisimNodes.push(node);
		return true;
	};
	waapisimUnregisterNode=function(node) {
		for(var i=waapisimNodes.length;i--;) {
			if(waapisimNodes[i]==node)
				waapisimNodes.splice(i,1);
		}
	};
	waapisimSetupOutBuf=function(offset) {
		var numctx=waapisimContexts.length;
		var l,i,j,node;
		if(numctx>0) {
			for(;;) {
				for(l=waapisimNodes.length,i=0;i<l;++i) {
					node=waapisimNodes[i];
					if(node.playbackState==3) {
						node.disconnect();
						waapisimUnregisterNode(node);
						break;
					}
				}
				if(i==l)
					break;
			}
			for(l=waapisimNodes.length,i=0;i<l;++i)
				waapisimNodes[i].Process();
			for(l=(offset+waapisimBufSize)*2,i=offset*2;i<l;i+=2)
				waapisimOutBuf[i]=waapisimOutBuf[i+1]=0;
			for(j=0;j<numctx;++j) {
				node=waapisimContexts[j].destination;
				if(node.nodein[0].from.length>0) {
					var buf=node.nodein[0].inbuf.buf;
					for(i=0;i<waapisimBufSize;++i) {
						waapisimOutBuf[(i+offset)*2]+=buf[0][i];
						waapisimOutBuf[(i+offset)*2+1]+=buf[1][i];
					}
				}
				node.nodein[0].NodeClear();
			}
		}
	};
	waapisimUpdateCurrentTime=function(t) {
		for(var i=waapisimContexts.length;i--;)
			waapisimContexts[i].currentTime=t;
	};
	waapisimInterval=function() {
		var curpos=waapisimAudio.mozCurrentSampleOffset();
		var buffered=waapisimWrittenpos-curpos;
		var vl,vr;
		waapisimUpdateCurrentTime(curpos/(waapisimSampleRate*2));
		if(buffered<16384) {
			waapisimSetupOutBuf(0);
			waapisimWrittenpos+=waapisimAudio.mozWriteAudio(waapisimOutBuf);
		}
	};
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
	};
	waapisimAddFlashObj=function() {
		var div=document.createElement("DIV");
		div.setAttribute("id","WAAPISIMFLASHOBJ");
		div.setAttribute("style","background:#ff00ff;positoin:static;");
		var body=document.getElementsByTagName("BODY");
		body[0].appendChild(div);
		document.getElementById("WAAPISIMFLASHOBJ").innerHTML="<div style='position:fixed;right:0px;bottom:0px'> <object id='waapisim_swf' CLASSID='clsid:D27CDB6E-AE6D-11cf-96B8-444553540000' CODEBASE='http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=4,0,0,0' width=150 height=20>"
		+"<param name=movie value='"+waapisimSwfPath+"'><PARAM NAME=bgcolor VALUE=#FFFFFF><PARAM NAME=LOOP VALUE=false><PARAM NAME=quality VALUE=high><param name='allowScriptAccess' value='always'>"
		+"<embed src='"+waapisimSwfPath+"' width=150 height=20 bgcolor=#FFFFFF loop=false quality=high pluginspage='http://www.macromedia.com/shockwave/download/index.cgi?P1_Prod_Version=ShockwaveFlash' type='application/x-shockwave-flash' allowScriptAccess='always'></embed>"
		+"</object></div>";
	}
	waapisimFlashOffset=function(pos) {
		waapisimUpdateCurrentTime(pos/1000);
	};
	waapisimFlashGetData=function() {
		var s="";
		var l;
		for(l=waapisimOutBufSize/waapisimBufSize,i=0;i<l;++i) {
			waapisimSetupOutBuf(waapisimBufSize*i);
		}
		waapisimWrittenpos+=waapisimOutBufSize*2;
		for(l=waapisimOutBufSize*2,i=0;i<l;++i) {
			var v=((waapisimOutBuf[i]+1)*32768);
			if(isNaN(v)) v=32768;
			v=Math.min(65525,Math.max(1,v))|0;
			s+=String.fromCharCode(Math.floor(v));
		}
		return s;
	};
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
		};
		this.createBufferSource=function() {
			return new waapisimAudioBufferSource(this);
		};
		this.createScriptProcessor=this.createJavaScriptNode=function(bufsize,inch,outch) {
			return new waapisimScriptProcessor(this,bufsize,inch,outch);
		};
		this.createBiquadFilter=function() {
			return new waapisimBiquadFilter(this);
		};
		this.createGain=this.createGainNode=function() {
			return new waapisimGain(this);
		};
		this.createDelay=this.createDelayNode=function() {
			return new waapisimDelay(this);
		};
		this.createOscillator=function() {
			return new waapisimOscillator(this);
		};
		this.createAnalyser=function() {
			return new waapisimAnalyser(this);
		};
		this.createConvolver=function() {
			return new waapisimConvolver(this);
		};
		this.createDynamicsCompressor=function() {
			return new waapisimDynamicsCompressor(this);
		};
		this.createPanner=function() {
			return new waapisimPanner(this);
		};
		this.createChannelSplitter=function(ch) {
			return new waapisimChannelSplitter(this,ch);
		};
		this.createChannelMerger=function(ch) {
			return new waapisimChannelMerger(this,ch);
		};
		this.createWaveShaper=function() {
			return new waapisimWaveShaper(this);
		};
		this.decodeAudioData=function(audioData,successCallback,errorCallback) {
		};
		this.createWaveTable=function(real,imag) {
			return new waapisimWaveTable(real,imag);
		};
	};
	waapisimAudioListener=function() {
		this.px=0; this.py=0; this.pz=0;
		this.ox=0; this.oy=0; this.oz=-1;
		this.ux=0; this.uy=1; this.uz=0;
		this.dopplerFactor=1;
		this.speedOfSound=343.3;
		this.setPosition=function(x,y,z) {this.px=x;this.py=y;this.pz=z;};
		this.setOrientation=function(x,y,z,ux,uy,uz) {this.ox=x;this.oy=y;this.oz=z;this.ux=ux;this.uy=uy;this.uz=uz;};
		this.setVelocity=function(x,y,z) {};
	};
	waapisimWaveTable=function(real,imag) {
		this.table=new Float32Array(8192);
		for(var i=0;i<8192;++i)
			this.table[i]=0;
	};
	waapisimAudioNode=function(size,numin,numout) {
		this.numberOfInputs=numin;
		this.numberOfOutputs=numout;
		this.nodeId=waapisimNodeId++;
		this.targettype=1;
		this.context=null;
		this.bufsize=size;
		this.nodein=[];
		this.nodeout=[];
		var i;
		for(i=0;i<numin;++i)
			this.nodein[i]=new waapisimAudioNodeIn(this,size);
		for(i=0;i<numout;++i)
			this.nodeout[i]=new waapisimAudioNodeOut(this,size);
		this.connect=function(next,output,input) {
			if(typeof(output)==="undefined")
				output=0;
			if(typeof(input)==="undefined")
				input=0;
			if(next.targettype!==0)
				this.nodeout[output].connect(next.nodein[input]);
			else
				this.nodeout[output].connect(next);
		};
		this.disconnect=function(output) {
			if(typeof(output)==="undefined")
				output=0;
			this.nodeout[output].disconnect();
		};
	};
	waapisimAudioNodeIn=function(node,size) {
		this.node=node;
		this.from=[];
		this.inbuf=new waapisimAudioBuffer(2,size,waapisimSampleRate);
		this.NodeClear=function() {
			for(var i=0;i<waapisimBufSize;++i)
				this.inbuf.buf[0][i]=this.inbuf.buf[1][i]=0;
		};
	};
	waapisimAudioNodeOut=function(node,size) {
		this.node=node;
		this.to=[];

		this.connect=function(next) {
			waapisimDebug("connect "+this.node.nodetype+this.node.nodeId+"=>"+next.node.nodetype+next.node.nodeId);
			if(next.from.indexOf(this)!=-1)
				return;
			next.from.push(this);
			if(this.to.indexOf(next)==-1)
				this.to.push(next);
			if(next.node.targettype!==0) {
				if(waapisimRegisterNode(next.node)) {
					for(var i=0;i<next.node.nodeout.length;++i) {
						for(var ii=0;ii<next.node.nodeout[i].to.length;++ii) {
							next.node.nodeout[i].connect(next.node.nodeout[i].to[ii]);
						}
					}
				}
			}
		};
		this.disconnectTemp=function() {
			var i,j,k,l,n,ii,jj,ll,node,node2;
			waapisimDebug("disconnect "+this.node.nodetype+this.node.nodeId);
			for(l=waapisimNodes.length,i=0;i<l;++i) {
				for(ll=waapisimNodes[i].nodein.length,ii=0;ii<ll;++ii) {
					j=waapisimNodes[i].nodein[ii].from.indexOf(this);
					if(j>=0) {
						waapisimDebug("  :"+this.node.nodeId+"=>"+waapisimNodes[i].nodeId);
						waapisimNodes[i].nodein[ii].from.splice(j,1);
					}
				}
			}
			for(i=0;i<waapisimNodes.length;++i) {
				node=waapisimNodes[i];
				if(node.targettype==1) {
					n=0;
					for(ii=0;ii<node.nodein.length;++ii)
						n+=node.nodein[ii].from.length;
					if(n===0) {
						waapisimUnregisterNode(node);
						for(ii=0;ii<node.nodeout.length;++ii)
							node.nodeout[ii].disconnectTemp();
						break;
					}
				}
			}
		};
		this.disconnect=function() {
			var i,j,k,l,n,ii,jj,ll,node,node2;
			waapisimDebug("disconnect "+this.node.nodetype+this.node.nodeId);
			for(l=waapisimNodes.length,i=0;i<l;++i) {
				for(ll=waapisimNodes[i].nodein.length,ii=0;ii<ll;++ii) {
					j=waapisimNodes[i].nodein[ii].from.indexOf(this);
					if(j>=0) {
						waapisimDebug("  :"+this.node.nodeId+"=>"+waapisimNodes[i].nodeId);
						waapisimNodes[i].nodein[ii].from.splice(j,1);
					}
				}
			}
			for(i=0;i<waapisimNodes.length;++i) {
				node=waapisimNodes[i];
				if(node.targettype==1) {
					n=0;
					for(ii=0;ii<node.nodein.length;++ii)
						n+=node.nodein[ii].from.length;
					if(n===0) {
						waapisimUnregisterNode(node);
						for(ii=0;ii<node.nodeout.length;++ii)
							node.nodeout[ii].disconnectTemp();
						break;
					}
				}
			}
			this.to.length=0;
		};
		this.NodeEmit=function(idx,v1,v2) {
			for(var l=this.to.length,i=0;i<l;++i) {
				var buf=this.to[i].inbuf.buf;
				buf[0][idx]+=v1;
				buf[1][idx]+=v2;
			}
		};
		this.NodeEmitBuf=function() {
			for(var l=this.to.length,i=0;i<l;++i) {
				var b0=this.to[i].inbuf.buf[0];
				var b1=this.to[i].inbuf.buf[1];
				for(var j=0;j<waapisimBufSize;++j) {
					b0[j]+=this.outbuf.buf[0][j];
					b1[j]+=this.outbuf.buf[1][j];
				}
			}
		};
		this.outbuf=new waapisimAudioBuffer(2,size,waapisimSampleRate);
	};
	waapisimAudioProcessingEvent=function() {
	};
	waapisimAudioDestinationNode=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize,1,0);
		this.nodetype="Destination";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.targettype=2;
		this.context=ctx;
		this.playbackState=0;
		this.maxNumberOfChannels=2;
		this.numberOfChannels=2;
		this.Process=function() {};
		waapisimNodes.push(this);
	};
	
	waapisimAudioBufferSource=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize,0,1);
		this.nodetype="BufSrc";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.targettype=3;
		this.context=ctx;
		this.playbackState=0;
		this.buffer=null;
		this.playbackRate=new waapisimAudioParam(ctx,this,0,10,1);
		this.loop=false;
		this.loopStart=0;
		this.loopEnd=0;
		this.bufferindex=0;
		this.whenstart=0;
		this.whenstop=Number.MAX_VALUE;
		this.endindex=0;
		this.actualLoopStart=0;
		this.actualLoopEnd=0;
		this.start=this.noteOn=this.noteGrainOn=function(w,off,dur) {
			this.playbackState=1;
			this.whenstart=w;
			if(off>0)
				this.bufferindex=off*waapisimSampleRate;
			this.endindex=this.buffer.length;
			if(dur>0)
				this.endindex=Math.min(this.buffer.length,(dur+off)*waapisimSampleRate);
			if(this.loop) {
				if((this.loopStart||this.loopEnd)&&this.loopStart>=0&&this.loopEnd>0&&this.loopStart<this.loopEnd) {
					this.actualLoopStart=this.loopStart;
					this.actualLoopEnd=Math.min(this.loopEnd,this.buffer.length);
				}
				else {
					this.actualLoopStart=0;
					this.actualLoopEnd=buffer.length;
				}
			}
			waapisimRegisterNode(this);
		};
		this.stop=this.noteOff=function(w) {
			this.whenstop=w;
		};
		this.Process=function() {
			this.playbackRate.Process();
			if(this.buffer!==null && this.bufferindex>=this.endindex)
				this.playbackState=3;
			if(this.playbackState==1 && this.context.currentTime>=this.whenstart)
				this.playbackState=2;
			if(this.playbackState==2 && this.context.currentTime>=this.whenstop)
				this.playbackState=3;
			if(this.playbackState!=2)
				return;
			var b0=this.buffer.getChannelData(0);
			var b1=this.buffer.getChannelData(1);
			var rate=44100/this.buffer.sampleRate;
			if(this.nodeout[0].to.length>0) {
				for(var i=0;i<waapisimBufSize;++i) {
					if(this.bufferindex<this.endindex) {
						var idx=this.bufferindex|0;
						this.nodeout[0].outbuf.buf[0][i]=b0[idx];
						this.nodeout[0].outbuf.buf[1][i]=b1[idx];
					}
					this.bufferindex+=rate*this.playbackRate.Get(i);
					if(this.loop) {
						if(this.bufferindex>=this.actualLoopEnd)
							this.bufferindex=this.actualLoopStart;
					}
				}
				this.nodeout[0].NodeEmitBuf();
				this.playbackRate.Clear(true);
			}
		};
	};
	waapisimAudioBufferSource.UNSCHEDULED_STATE=waapisimAudioBufferSource.prototype.UNSCHEDULED_STATE=0;
	waapisimAudioBufferSource.SCHEDULED_STATE=waapisimAudioBufferSource.prototype.SCHEDULED_STATE=1;
	waapisimAudioBufferSource.PLAYING_STATE=waapisimAudioBufferSource.prototype.PLAYING_STATE=2;
	waapisimAudioBufferSource.FINISHED_STATE=waapisimAudioBufferSource.prototype.FINISHED_STATE=3;
	
	waapisimScriptProcessor=function(ctx,bufsize,inch,outch) {
		waapisimAudioNode.call(this,waapisimBufSize,1,1);
		this.nodetype="ScrProc";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.targettype=2;
		this.context=ctx;
		this.playbackState=0;
		if(typeof(inch)==="undefined")
			inch=2;
		if(typeof(outch)==="undefined")
			outch=2;
		this.bufferSize=bufsize;
		this.scrinbuf=new waapisimAudioBuffer(inch,bufsize,waapisimSampleRate);
		this.scroutbuf=new waapisimAudioBuffer(outch,bufsize,waapisimSampleRate);
		this.index=bufsize;
		this.onaudioprocess=null;
		this.Process=function() {
			var inb=this.nodein[0].inbuf;
			if(inb===null)
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
					this.nodeout[0].NodeEmit(i,this.scroutbuf.buf[0][this.index],this.scroutbuf.buf[1][this.index]);
				else
					this.nodeout[0].NodeEmit(i,this.scroutbuf.buf[0][this.index],this.scroutbuf.buf[0][this.index]);
				this.index++;
			}
			this.nodein[0].NodeClear();
		};
		waapisimRegisterNode(this);
	};
	waapisimBiquadFilter=BiquadFilterNode=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize,1,1);
		this.nodetype="Filter";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.playbackState=0;
		this.type=0;
		this.frequency=new waapisimAudioParam(ctx,this,10,24000,350);
		this.detune=new waapisimAudioParam(ctx,this,-1200,1200,0);
		this.Q=new waapisimAudioParam(ctx,this,0.0001,1000,1);
		this.gain=new waapisimAudioParam(ctx,this,-40,40,0);
		this.a1=this.a2=0;
		this.b0=this.b1=this.b2=0;
		this.x1l=this.x1r=this.x2l=this.x2r=0;
		this.y1l=this.y1r=this.y2l=this.y2r=0;
		this.nodein[0].NodeClear();
		this.Setup=function(fil) {
			var f=fil.frequency.Get(0)*Math.pow(2,fil.detune.Get(0)/1200);
			var q=fil.Q.Get(0);
			var alpha,ra0,g;
			var w0=2*Math.PI*f/fil.context.sampleRate;
			var cos=Math.cos(w0);
			switch(fil.type) {
			case 0:
				if(q<0) q=0;
				q=Math.pow(10,q/20);
				alpha=Math.sin(w0)/(2*q);
				ra0=1/(1+alpha);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha)*ra0;
				fil.b0=fil.b2=(1-cos)/2*ra0;
				fil.b1=(1-cos)*ra0;
				break;
			case 1:
				if(q<0) q=0;
				q=Math.pow(10,q/20);
				alpha=Math.sin(w0)/(2*q);
				ra0=1/(1+alpha);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha)*ra0;
				fil.b0=fil.b2=(1+cos)/2*ra0;
				fil.b1=-(1+cos)*ra0;
				break;
			case 2:
				if(q<0.001) q=0.001;
				alpha=Math.sin(w0)/(2*q);
				ra0=1/(1+alpha);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha)*ra0;
				fil.b0=alpha;
				fil.b1=0;
				fil.b2=-alpha;
				break;
			case 3:
				alpha=Math.sin(w0)/2*Math.sqrt(2);
				g=Math.pow(10,fil.gain.Get(0)/40);
				ra0=1/((g+1)+(g-1)*cos+2*Math.sqrt(g)*alpha);
				fil.a1=-2*((g-1)+(g+1)*cos)*ra0;
				fil.a2=((g+1)+(g-1)*cos-2*Math.sqrt(g)*alpha)*ra0;
				fil.b0=g*((g+1)-(g-1)*cos+2*Math.sqrt(g)*alpha)*ra0;
				fil.b1=2*g*((g-1)-(g+1)*cos)*ra0;
				fil.b2=g*((g+1)-(g-1)*cos-2*Math.sqrt(g)*alpha)*ra0;
				break;
			case 4:
				alpha=Math.sin(w0)/2*Math.sqrt(2);
				g=Math.pow(10,fil.gain.Get(0)/40);
				ra0=1/((g+1)-(g-1)*cos+2*Math.sqrt(g)*alpha);
				fil.a1=2*((g-1)-(g+1)*cos)*ra0;
				fil.a2=((g+1)-(g-1)*cos-2*Math.sqrt(g)*alpha)*ra0;
				fil.b0=g*((g+1)+(g-1)*cos+2*Math.sqrt(g)*alpha)*ra0;
				fil.b1=-2*g*((g-1)+(g+1)*cos)*ra0;
				fil.b2=g*((g+1)+(g-1)*cos-2*Math.sqrt(g)*alpha)*ra0;
				break;
			case 5:
				if(q<0.001) q=0.001;
				alpha=Math.sin(w0)/(2*q);
				g=Math.pow(10,fil.gain.Get(0)/40);
				ra0=1/(1+alpha/g);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha/g)*ra0;
				fil.b0=(1+alpha*g)*ra0;
				fil.b1=-2*cos*ra0;
				fil.b2=(1-alpha*g)*ra0;
				break;
			case 6:
				if(q<0.001) q=0.001;
				alpha=Math.sin(w0)/(2*q);
				ra0=1/(1+alpha);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha)*ra0;
				fil.b0=fil.b2=ra0;
				fil.b1=-2*cos*ra0;
				break;
			case 7:
				if(q<0.001) q=0.001;
				alpha=Math.sin(w0)/(2*q);
				ra0=1/(1+alpha);
				fil.a1=-2*cos*ra0;
				fil.a2=(1-alpha)*ra0;
				fil.b0=(1-alpha)*ra0;
				fil.b1=-2*cos*ra0;
				fil.b2=(1+alpha)*ra0;
				break;
			}
		};
		this.Process=function() {
			var xl,xr,yl,yr;
			this.frequency.Process();
			this.detune.Process();
			this.Q.Process();
			this.gain.Process();
			this.Setup(this);
			var inbuf=this.nodein[0].inbuf.buf;
			var outbuf=this.nodeout[0].outbuf.buf;
			for(var i=0;i<waapisimBufSize;++i) {
				xl=inbuf[0][i];
				xr=inbuf[1][i];
				yl=this.b0*xl+this.b1*this.x1l+this.b2*this.x2l-this.a1*this.y1l-this.a2*this.y2l;
				yr=this.b0*xr+this.b1*this.x1r+this.b2*this.x2r-this.a1*this.y1r-this.a2*this.y2r;
				this.x2l=this.x1l; this.x2r=this.x1r;
				this.x1l=xl; this.x1r=xr;
				this.y2l=this.y1l; this.y2r=this.y1r;
				this.y1l=yl; this.y1r=yr;
				outbuf[0][i]=yl;
				outbuf[1][i]=yr;
			}
			this.nodeout[0].NodeEmitBuf();
			this.nodein[0].NodeClear();
			this.frequency.Clear(false);
			this.detune.Clear(false);
			this.Q.Clear(false);
			this.gain.Clear(false);
		};
	};
	waapisimBiquadFilter.LOWPASS=waapisimBiquadFilter.prototype.LOWPASS=0;
	waapisimBiquadFilter.HIGHPASS=waapisimBiquadFilter.prototype.HIGHPASS=1;
	waapisimBiquadFilter.BANDPASS=waapisimBiquadFilter.prototype.BANDPASS=2;
	waapisimBiquadFilter.LOWSHELF=waapisimBiquadFilter.prototype.LOWSHELF=3;
	waapisimBiquadFilter.HIGHSHELF=waapisimBiquadFilter.prototype.HIGHSHELF=4;
	waapisimBiquadFilter.PEAKING=waapisimBiquadFilter.prototype.PEAKING=5;
	waapisimBiquadFilter.NOTCH=waapisimBiquadFilter.prototype.NOTCH=6;
	waapisimBiquadFilter.ALLPASS=waapisimBiquadFilter.prototype.ALLPASS=7;

	waapisimGain=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize,1,1);
		this.nodetype="Gain";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.playbackState=0;
		this.gain=new waapisimAudioParam(ctx,this,0,1,1);
		this.nodein[0].NodeClear();
		this.Process=function() {
			var i;
			this.gain.Process();
			var inbuf=this.nodein[0].inbuf.buf;
			switch(this.nodeout[0].to.length) {
			case 0:
				break;
			case 1:
				var b=this.nodeout[0].to[0].inbuf.buf;
				for(i=0;i<waapisimBufSize;++i) {
					var g=this.gain.Get(i);
					b[0][i]+=inbuf[0][i]*g;
					b[1][i]+=inbuf[1][i]*g;
				}
				break;
			default:
				for(i=0;i<waapisimBufSize;++i)
					this.nodeout[0].NodeEmit(i,inbuf[0][i]*this.gain.Get(i),inbuf[1][i]*this.gain.Get(i));
			}
			this.nodein[0].NodeClear();
			this.gain.Clear(true);
		};
	};

	waapisimDelay=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize,1,1);
		this.nodetype="Delay";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.playbackState=0;
		this.delayTime=new waapisimAudioParam(ctx,this,0,1,0);
		this.bufl=new Float32Array(waapisimSampleRate);
		this.bufr=new Float32Array(waapisimSampleRate);
		this.index=0;
		this.Process=function() {
			this.delayTime.Process();
			var inbuf=this.nodein[0].inbuf.buf;
			var outbuf=this.nodeout[0].outbuf.buf;
			var offs=Math.floor(this.delayTime.Get(0)*this.context.sampleRate);
			if(offs<0)
				offs=0;
			if(offs>this.context.sampleRate)
				offs=this.context.sampleRate;
			for(var i=0;i<waapisimBufSize;++i) {
				var idxr=this.index-offs;
				if(idxr<0)
					idxr+=waapisimSampleRate;
				outbuf[0][i]=this.bufl[idxr];
				outbuf[1][i]=this.bufr[idxr];
				this.bufl[this.index]=inbuf[0][i];
				this.bufr[this.index]=inbuf[1][i];
				if(++this.index>=waapisimSampleRate)
					this.index=0;
			}
			this.nodeout[0].NodeEmitBuf();
			this.nodein[0].NodeClear();
			this.delayTime.Clear(false);
		};
	};

	waapisimOscillator=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize,0,1);
		this.nodetype="Osc";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.targettype=3;
		this.context=ctx;
		this.type=0;
		this.frequency=new waapisimAudioParam(ctx,this,1,20000,440);
		this.detune=new waapisimAudioParam(ctx,this,-1200,1200,0);
		this.playbackState=0;
		this.phase=0;
		this.whenstart=0;
		this.whenstop=Number.MAX_VALUE;
		this.start=this.noteOn=function(w) {
			this.whenstart=w;
			this.playbackState=1;
			waapisimRegisterNode(this);
		};
		this.stop=this.noteOff=function(w) {
			this.whenstop=w;
		};
		this.setWaveTable=function(tab) {
		};
		this.Process=function() {
			var i;
			this.frequency.Process();
			this.detune.Process();
			if(this.playbackState==1 && this.context.currentTime>=this.whenstart)
				this.playbackState=2;
			if(this.playbackState==2 && this.context.currentTime>=this.whenstop)
				this.playbackState=3;
			if(this.playbackState!=2) {
				for(i=0;i<waapisimBufSize;++i)
					this.nodeout[0].outbuf.buf[0][i]=this.nodeout[0].outbuf.buf[1][i]=0;
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
			default:
				x1=0.5; x2=1.5; y=2*Math.PI; z=1/6.78;
				break;
			}
			var obuf=this.nodeout[0].outbuf.buf;
			for(i=0;i<waapisimBufSize;++i) {
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
					out=-1.0;
				obuf[0][i]=obuf[1][i]=out;
			}
			this.nodeout[0].NodeEmitBuf();
			this.frequency.Clear(true);
			this.detune.Clear(true);
		};
	};
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
		waapisimAudioNode.call(this,waapisimBufSize,1,1);
		this.nodetype="Analyser";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
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
			var m,mh,mq,i,j,jr,ji,kr,ki,xr,xi;
			for(mh=1;(m=mh<<1)<=n;mh=m) {
				mq=mh>>1;
				t*=0.5;
				for(jr=0;jr<n;jr+=m) {
					kr=jr+mh;
					xr=data[kr];
					data[kr]=data[jr]-xr;
					data[jr]+=xr;
				}
				for(i=1;i<mq;++i) {
					var wr=Math.cos(t*i);
					var wi=Math.sin(t*i);
					for(j=0;j<n;j+=m) {
						jr=j+i;
						ji=j+mh-i;
						kr=j+mh+i;
						ki=j+m-i;
						xr=wr*data[kr]+wi*data[ki];
						xi=wr*data[ki]-wi*data[kr];
						data[kr]=-data[ji]+xi;
						data[ki]=data[ji]+xi;
						data[ji]=data[jr]-xr;
						data[jr]=data[jr]+xr;
					}
				}
			}
			for(i=0;i<n;++i)
				data[i]=Math.max(1e-100,data[i]/n);
			mag[0]=mag[0]*this.smoothingTimeConstant+(1-this.smoothingTimeConstant)*data[0];
			for(i=1;i<nh;++i) {
				var v=Math.sqrt(data[i]*data[i]+data[n-i]*data[n-i]);
				if(v<1e-100)
					v=1e-100;
				mag[i]=mag[i]*this.smoothingTimeConstant+(1-this.smoothingTimeConstant)*v;
			}
		};
		this.getByteFrequencyData=function(array) {
			var range=this.maxDecibels-this.minDecibels;
			for(var l=Math.min(array.length,this.frequencyBinCount),i=0;i<l;++i) {
				var v=20*Math.LOG10E*Math.log(this.fftOutData[i]);
				array[i]=(Math.min(this.maxDecibels,Math.max(this.minDecibels,v))-this.minDecibels)*255/range;
			}
		};
		this.getFloatFrequencyData=function(array) {
			for(var l=Math.min(array.length,this.frequencyBinCount),i=0;i<l;++i)
				array[i]=20*Math.LOG10E*Math.log(this.fftOutData[i]);
		};
		this.getByteTimeDomainData=function(array) {
			for(var l=Math.min(this.frequencyBinCount,array.length),i=0;i<l;++i) {
				var v=Math.min(1,Math.max(-1,this.timeData[i]));
				array[i]=v*127+128;
			}
		};
		this.Process=function() {
			var i,j,k;
			var inbuf=this.nodein[0].inbuf.buf;
			if(this.fftSize!=this.fftCurrentSize) {
				var n=this.fftSize;
				for(i=0;i<n;++i)
					this.fftInData[i]=this.fftOutData[i]=0;
				this.fftCurrentSize=n;
				this.frequencyBinCount=n*0.5;
				this.fftIndex=0;
				this.fftrev[0]=0;
				this.fftrev[n-1]=n-1;
				for(i=0,j=1;j<n-1;++j) {
					for(k=n>>1;k>(i^=k);k>>=1)
						;
					this.fftrev[j]=i;
				}
			}
			for(i=0;i<waapisimBufSize;++i) {
				var xl=inbuf[0][i];
				var xr=inbuf[1][i];
				this.nodeout[0].NodeEmit(i,xl,xr);
				var v=this.timeData[this.fftIndex]=(xl+xr)*0.5;
				this.fftInData[this.fftrev[this.fftIndex]]=v*(0.5-0.5*Math.cos(2*Math.PI*this.fftIndex/this.fftCurrentSize));
				if(++this.fftIndex>=this.fftCurrentSize) {
					this.fftIndex=0;
					this.fft(this.fftCurrentSize,this.fftInData,this.fftOutData);
				}
			}
			this.nodein[0].NodeClear();
		};
	};
	waapisimConvolver=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize,1,1);
		this.nodetype="Convolver";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.playbackState=0;
		this.buffer=null;
		this.normalize=true;
		this.scale=1;
		this.analyzed=null;
		this.dlybufsize=waapisimSampleRate*5;
		this.dlybuf=new waapisimAudioBuffer(2,this.dlybufsize,44100);
		this.dlyidx=0;
		this.tapsize=20;
		this.tap=[];
		this.kernel=null;
		this.sum=[];
		this.sum[0]=[];
		this.sum[1]=[];
		this.bitrev=[];
		this.bitrev[0]=0;
		this.bitrev[waapisimBufSize-1]=waapisimBufSize-1;
		var i,j,k;
		for(i=0,j=1;j<waapisimBufSize-1;++j) {
			for(k=waapisimBufSize>>1;k>(i^=k);k>>=1)
				;
			this.bitrev[j]=i;
		}
		for(i=0;i<2;++i)
			for(j=0;j<2;++j)
				this.sum[i][j]=new Float32Array(waapisimSampleRate);
		this.Normalize=function(buffer) {
			var GainCalibration=0.00125;
			var GainCalibrationSampleRate=44100;
			var MinPower=0.000125;
			var numberOfChannels=2;
			var length=buffer.length;
			var power=0;
			for(var i=0;i<numberOfChannels;++i) {
				var sourceP=0;
				var channelPower=0;
				var n=length;
				while(n--) {
					var sample=buffer.buf[i][sourceP++];
					channelPower+=sample*sample;
				}
				power+=channelPower;
			}
			power=Math.sqrt(power/(numberOfChannels*length));
			if(isFinite(power)===false||isNaN(power)||power<MinPower)
				power=MinPower;
			var scale=1/power;
			scale*=GainCalibration;
			return scale;
		};
		this.Fft=function(n,a) {
			var m,mh,mq,i,j,k,jr,ji,kr,ki;
			var theta, wr, wi, xr, xi;
			i=0;
			for(j=1;j<n-1;j++) {
				for(k=n>>1;k>(i^=k);k>>=1)
					;
				if(j<i) {
					xr=a[j];
					a[j]=a[i];
					a[i]=xr;
				}
			}
			theta=-2*Math.PI;
			for(mh=1;(m=mh<<1)<=n;mh=m) {
				mq=mh>>1;
				theta*=0.5;
				for(jr=0;jr<n;jr+=m) {
					kr=jr+mh;
					xr=a[kr];
					a[kr]=a[jr]-xr;
					a[jr]+=xr;
				}
				for(i=1;i<mq;i++) {
					wr=Math.cos(theta*i);
					wi=Math.sin(theta*i);
					for(j=0;j<n;j+=m) {
						jr=j+i;
						ji=j+mh-i;
						kr=j+mh+i;
						ki=j+m-i;
						xr=wr*a[kr]+wi*a[ki];
						xi=wr*a[ki]-wi*a[kr];
						a[kr]=-a[ji]+xi;
						a[ki]=a[ji]+xi;
						a[ji]=a[jr]-xr;
						a[jr]=a[jr]+xr;
					}
				}
			}
		};
		this.Fft2=function(n,ar,ai) {
			var m, mh, i, j, k;
			var wr, wi, xr, xi;
			var theta=2*Math.PI/n;
			i=0;
			for(j=1;j<n-1;j++) {
				for(k=n>>1;k>(i^=k);k>>=1)
					;
				if(j<i) {
					xr=ar[j];
					xi=ai[j];
					ar[j]=ar[i];
					ai[j]=ai[i];
					ar[i]=xr;
					ai[i]=xi;
				}
			}
			theta*=n;
			for(mh=1;(m=mh<<1)<=n;mh=m) {
				theta *= 0.5;
				for(i=0;i<mh;i++) {
					wr=Math.cos(theta*i);
					wi=Math.sin(theta*i);
					for(j=i;j<n;j+=m) {
						k=j+mh;
						xr=wr*ar[k]-wi*ai[k];
						xi=wr*ai[k]+wi*ar[k];
						ar[k]=ar[j]-xr;
						ai[k]=ai[j]-xi;
						ar[j]+=xr;
						ai[j]+=xi;
					}
				}
			}
			for(i=0;i<n;++i)
				ar[i]=ar[i]/n;
		};
		this.Process=function() {
			var inbuf=this.nodein[0].inbuf.buf;
			var nh=(waapisimBufSize*0.5)|0;
			var i,j,k,l,px,v0,v1;
			if(this.buffer!==null) {
				var kbuf=[];
				for(i=0;i<4;++i)
					kbuf[i]=new waapisimAudioBuffer(2,waapisimBufSize,44100);
				if(this.buffer!=this.analyzed) {
					this.scale=1;
					if(this.normalize)
						this.scale=this.Normalize(this.buffer);
					var len=this.buffer.length;
					for(i=0,px=0;i<this.tapsize;++i) {
						var x=(i*len/this.tapsize)|0;
						var sz=x-px;
						v0=0;
						v1=0;
						if(sz>0) {
							while(px<x) {
								v0+=this.buffer.buf[0][px]*this.buffer.buf[0][px];
								v1+=this.buffer.buf[1][px]*this.buffer.buf[1][px];
								++px;
							}
							v0=Math.sqrt(v0)*this.scale*0.5;
							v1=Math.sqrt(v1)*this.scale*0.5;
						}
						this.tap[i]=[x,v0,v1];
					}
					this.kernel=new waapisimAudioBuffer(2,waapisimBufSize,44100);
					var p=0,maxp=0;
					for(l=Math.min(this.buffer.length,waapisimBufSize*4),i=0,j=0,k=0;i<l;++i) {
						v0=this.buffer.buf[0][i];
						v1=this.buffer.buf[1][i];
						kbuf[k].buf[0][j]=v0;
						kbuf[k].buf[1][j]=v1;
						p+=(v0*v0+v1*v1);
						if(++j>=waapisimBufSize) {
							if(p>maxp) {
								this.kernel=kbuf[k];
								maxp=p;
							}
							j=0;
							p=0;
							++k;
						}
					}
					if(p>maxp||this.kernel===null)
						this.kernel=kbuf[k];
					this.Fft(waapisimBufSize,this.kernel.buf[0]);
					this.Fft(waapisimBufSize,this.kernel.buf[1]);
					this.analyzed=this.buffer;
				}
				
				this.Fft(waapisimBufSize,inbuf[0]);
				this.Fft(waapisimBufSize,inbuf[1]);
				this.sum[0][0][0]=0;//inbuf[0][0]*this.kernel.buf[0][0];
				this.sum[1][0][0]=0;//inbuf[1][0]*this.kernel.buf[1][0];
				this.sum[0][1][0]=this.sum[1][1][0]=0;
				for(i=1,j=waapisimBufSize-1;i<nh;++i,--j) {
					var real0=inbuf[0][i]*this.kernel.buf[0][i]-inbuf[0][j]*this.kernel.buf[0][j];
					var imag0=inbuf[0][i]*this.kernel.buf[0][j]+inbuf[0][j]*this.kernel.buf[0][i];
					this.sum[0][0][i]=real0;
					this.sum[0][0][j]=real0;
					this.sum[0][1][i]=-imag0;
					this.sum[0][1][j]=imag0;
					var real1=inbuf[1][i]*this.kernel.buf[1][i]-inbuf[1][j]*this.kernel.buf[1][j];
					var imag1=inbuf[1][i]*this.kernel.buf[1][j]+inbuf[1][j]*this.kernel.buf[1][i];
					this.sum[1][0][i]=real1;
					this.sum[1][0][j]=real1;
					this.sum[1][1][i]=-imag1;
					this.sum[1][1][j]=imag1;
				}

				this.Fft2(waapisimBufSize,this.sum[0][0],this.sum[0][1]);
				this.Fft2(waapisimBufSize,this.sum[1][0],this.sum[1][1]);

				for(i=0;i<waapisimBufSize;++i) {
					var v=(nh-Math.abs(i-nh))/nh;
					this.dlybuf.buf[0][this.dlyidx]=this.sum[0][0][i]*v;
					this.dlybuf.buf[1][this.dlyidx]=this.sum[1][0][i]*v;
					v0=0; v1=0;
					for(l=this.tap.length,j=0;j<l;++j) {
						var idx=this.dlyidx-this.tap[j][0];
						if(idx<0)
							idx+=this.dlybufsize;
						v0+=this.dlybuf.buf[0][idx]*this.tap[j][1];
						v1+=this.dlybuf.buf[1][idx]*this.tap[j][2];
					}
					this.nodeout[0].NodeEmit(i,v0,v1);
					if(++this.dlyidx>=this.dlybufsize)
						this.dlyidx=0;
				}

			}
			this.nodein[0].NodeClear();
		};
	};
	waapisimDynamicsCompressor=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize,1,1);
		this.nodetype="DynComp";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.playbackState=0;
		this.threshold=new waapisimAudioParam(ctx,this,-100,0,-24);
		this.knee=new waapisimAudioParam(ctx,this,0,40,30);
		this.ratio=new waapisimAudioParam(ctx,this,1,20,12);
		this.reduction=new waapisimAudioParam(ctx,this,-20,0,0);//ReadOnly
		this.attack=new waapisimAudioParam(ctx,this,0,1,0.003);
		this.release=new waapisimAudioParam(ctx,this,0,1,0.25);
		this.maxl=0;
		this.maxr=0;
		this.gain=1;
		this.Process=function() {
			this.threshold.Process();
			this.knee.Process();
			this.ratio.Process();
			this.attack.Process();
			this.release.Process();
			var inbuf=this.nodein[0].inbuf.buf;
			var relratio=this.release.Get(0)*waapisimSampleRate;
			relratio=Math.pow(1/3.16,1/relratio);
			var atkratio=this.attack.Get(0)*waapisimSampleRate;
			atkratio=Math.pow(1/3.16,1/atkratio);
			var reduc=this.reduction.value;
			var thresh=Math.pow(10,this.threshold.Get(0)/20);
			var knee=Math.pow(10,this.knee.Get(0)/20*0.5);
			var makeup=1/Math.sqrt(thresh)/Math.pow(10,this.knee.Get(0)/80);
			var maxratio=0.99105;
			var ratio=this.ratio.Get(0);
			if(ratio<=1)
				ratio=1;
			for(var i=0;i<waapisimBufSize;++i) {
				this.maxl=maxratio*this.maxl+(1-maxratio)*inbuf[0][i]*inbuf[0][i];
				this.maxr=maxratio*this.maxr+(1-maxratio)*inbuf[1][i]*inbuf[1][i];
				var maxc=Math.sqrt(Math.max(this.maxl,this.maxr))*1.414;
				if(maxc>thresh) {
					var v=Math.pow(thresh*Math.min(knee,maxc/thresh)/maxc,1-1/ratio);
					this.gain=v+(this.gain-v)*atkratio;
				}
				var g=this.gain*makeup;
				this.nodeout[0].NodeEmit(i,inbuf[0][i]*g,inbuf[1][i]*g);
				this.gain=1+(this.gain-1)*relratio;
			}
			this.reduction.value=this.reduction.computedValue=reduc;
			this.nodein[0].NodeClear();
			this.threshold.Clear(false);
			this.knee.Clear(false);
			this.ratio.Clear(false);
			this.reduction.Clear(false);
			this.attack.Clear(false);
			this.release.Clear(false);
		};
	};
	waapisimPanner=AudioPannerNode=webkitAudioPannerNode=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize,1,1);
		this.nodetype="Panner";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
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
		this.setPosition=function(x,y,z) {this.px=x;this.py=y;this.pz=z;};
		this.setOrientation=function(x,y,z) {};
		this.setVelocity=function(x,y,z) {};
		this.Process=function() {
			var inbuf=this.nodein[0].inbuf.buf;
			var listener=this.context.listener;
			var dx=this.px-listener.px;
			var dy=this.py-listener.py;
			var dz=this.pz-listener.pz;
			var d=Math.max(1,Math.sqrt(dx*dx+dy*dy+dz*dz));
			var rgain=dx-dz;
			var lgain=-dx-dz;
			var rl=Math.sqrt(rgain*rgain+lgain*lgain);
			var dgain;
			switch(this.distanceModel) {
			case 0:
				dgain=1-this.rolloffFactor*(d-this.refDistance)/(this.maxDistance-this.refDistance);
				break;
			case 1:
				dgain=this.refDistance/(this.refDistance+this.rolloffFactor*(d-this.refDistance));
				break;
			case 2:
				dgain=Math.pow(d/this.refDistance,-this.rolloffFactor);
				break;
			}
			if(rl===0)
				rgain=lgain=Math.sqrt(2)*dgain;
			else {
				rgain=rgain/rl;
				lgain=lgain/rl;
				var a=Math.sqrt(rgain*rgain+lgain*lgain);
				rgain=rgain/a*2*dgain; lgain=lgain/a*2*dgain;
			}
			for(var i=0;i<waapisimBufSize;++i)
				this.nodeout[0].NodeEmit(i,inbuf[0][i]*lgain,inbuf[1][i]*rgain);
			this.nodein[0].NodeClear();
		};
	};
	waapisimPanner.EQUALPOWER=waapisimPanner.prototype.EQUALPOWER=0;
	waapisimPanner.HRTF=waapisimPanner.prototype.HRTF=1;
	waapisimPanner.SOUNDFIELD=waapisimPanner.prototype.SOUNDFIELD=2;
	waapisimPanner.LINEAR_DISTANCE=waapisimPanner.prototype.LINEAR_DISTANCE=0;
	waapisimPanner.INVERSE_DISTANCE=waapisimPanner.prototype.INVERSE_DISTANCE=1;
	waapisimPanner.EXPONENTIAL_DISTANCE=waapisimPanner.prototype.EXPONENTIAL_DISTANCE=2;
	
	waapisimChannelSplitter=function(ctx,ch) {
		this.nodetype="ChSplit";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		if(typeof(ch)==="undefined")
			ch=6;
		waapisimAudioNode.call(this,waapisimBufSize,1,ch);
		this.context=ctx;
		this.playbackState=0;
		this.Process=function() {
			var inbuf=this.nodein[0].inbuf.buf;
			for(var i=0;i<waapisimBufSize;++i) {
				this.nodeout[0].NodeEmit(i,inbuf[0][i],inbuf[0][i]);
				this.nodeout[1].NodeEmit(i,inbuf[1][i],inbuf[1][i]);
			}
			this.nodein[0].NodeClear();
		};
	};
	waapisimChannelMerger=function(ctx,ch) {
		this.nodetype="ChMerge";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		if(typeof(ch)==="undefined")
			ch=6;
		waapisimAudioNode.call(this,waapisimBufSize,ch,1);
		this.context=ctx;
		this.playbackState=0;
		this.Process=function() {
			var inbuf0=this.nodein[0].inbuf.buf;
			var inbuf1=this.nodein[1].inbuf.buf;
			for(var i=0;i<waapisimBufSize;++i)
				this.nodeout[0].NodeEmit(i,(inbuf0[0][i]+inbuf0[1][i])*0.5,(inbuf1[0][i]+inbuf1[1][i])*0.5);
			this.nodein[0].NodeClear();
			this.nodein[1].NodeClear();
		};
	};
	waapisimWaveShaper=function(ctx) {
		waapisimAudioNode.call(this,waapisimBufSize,1,1);
		this.nodetype="Shaper";
		waapisimDebug("create "+this.nodetype+this.nodeId);
		this.context=ctx;
		this.playbackState=0;
		this.curve=null;
		this.Process=function() {
			var inbuf=this.nodein[0].inbuf.buf;
			if(this.curve!==null) {
				var len=this.curve.length-1;
				for(var i=0;i<waapisimBufSize;++i) {
					var xl=Math.max(-1,Math.min(1,inbuf[0][i]));
					var xr=Math.max(-1,Math.min(1,inbuf[1][i]));
					xl=this.curve[((xl+1)*0.5*len+0.5)|0];
					xr=this.curve[((xr+1)*0.5*len+0.5)|0];
					this.nodeout[0].NodeEmit(i,xl,xr);
				}
			}
			else {
				for(var i=0;i<waapisimBufSize;++i)
					this.nodeout[0].NodeEmit(i,inbuf[0][i],inbuf[1][i]);
			}
			this.nodein[0].NodeClear();
		};
	};
	waapisimAudioParam=function(ctx,node,min,max,def) {
		this.context=ctx;
		this.targettype=0;
		this.node=node;
		this.value=def;
		this.computedValue=def;
		this.minValue=min;
		this.maxValue=max;
		this.defaultValue=def;
		this.from=[];
		this.inbuf={};
		this.inbuf.buf=[];
		this.inbuf.buf[0]=new Float32Array(waapisimBufSize);
		this.inbuf.buf[1]=new Float32Array(waapisimBufSize);
		this.automation=[];
		this.deltaAdd=0;
		this.deltaMul=1;
		this.deltaTarget=0;
		this.currentEvent=null;
		for(var i=0;i<waapisimBufSize;++i)
			this.inbuf.buf[0][i]=this.inbuf.buf[1][i]=0;
		this.AddEvent=function(ev) {
			var t=ev[0];
			for(var l=this.automation.length,i=0;i<l;++i) {
				if(this.automation[i][0]>t)
					break;
			}
			this.automation.splice(i,0,ev);
		};
		this.setValueAtTime=function(v,t) {
			this.AddEvent([t,0,v]);
		};
		this.linearRampToValueAtTime=function(v,t) {
			this.AddEvent([t,1,v]);
		};
		this.exponentialRampToValueAtTime=function(v,t) {
			this.AddEvent([t,2,v]);
		};
		this.setTargetAtTime=this.setTargetValueAtTime=function(v,t,c) {
			this.AddEvent([t,3,v,c]);
		};
		this.setValueCurveAtTime=function(values,t,d) {
			this.AddEvent([t,4,values,d]);
		};
		this.cancelScheduledValues=function(t) {
			for(var l=this.automation.length,i=0;i<l;++i) {
				if(this.automation[i][0]>=t) {
					this.automation.length=i;
					return;
				}
			}
		};
		this.Process=function() {
			this.value+=this.deltaAdd;
			this.value=(this.value-this.deltaTarget)*this.deltaMul+this.deltaTarget;
			if(this.currentEvent!==null) {
				if(this.currentEvent[1]==4) {
					var i=(this.currentEvent[2].length-1)*(this.context.currentTime-this.currentEvent[0])/this.currentEvent[3];
					this.value=this.currentEvent[2][Math.min(this.currentEvent[2].length-1,i)|0];
				}
			}
			if(this.automation.length>0) {
				if(this.context.currentTime>=this.automation[0][0]) {
					this.deltaAdd=0;
					this.deltaMul=1;
					this.deltaTarget=0;
					this.currentEvent=this.automation.shift();
					switch(this.currentEvent[1]) {
					case 0:
					case 1:
					case 2:
						this.value=this.currentEvent[2];
						break;
					case 3:
						this.deltaMul=Math.pow(0.367879,1/(waapisimSampleRate/waapisimBufSize*this.currentEvent[3]));
						this.deltaTarget=this.currentEvent[2];
						break;
					}
					if(this.automation.length>0) {
						var n=waapisimSampleRate/waapisimBufSize*(this.automation[0][0]-this.context.currentTime);
						switch(this.automation[0][1]) {
						case 1:
							this.deltaAdd=(this.automation[0][2]-this.value)/n;
							break;
						case 2:
							this.deltaMul=Math.pow(this.automation[0][2]/this.value,1/n);
							break;
						}
					}
				}
			}
		};
		this.Get=function(n) {
			this.computedValue=this.value+(this.inbuf.buf[0][n]+this.inbuf.buf[1][n])*0.5;
			return this.computedValue;
		};
		this.Clear=function(arate) {
			if(arate) {
				for(var i=0;i<waapisimBufSize;++i)
					this.inbuf.buf[0][i]=this.inbuf.buf[1][i]=0;
			}
			else
				this.inbuf.buf[0][0]=this.inbuf.buf[1][0]=0;
		};
	};
}
