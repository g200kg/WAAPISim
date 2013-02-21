# WAAPISim : Web Audio API Simulator

WAAPISim is a browser's 'Web Audio API' polyfill fallbacking to Firefox's 'Audio Data API' or Flash for MSIE/Opera.

WAAPISim automatically check the availability of APIs:  
WebAudioAPI => AudioDataAPI => Flash

**<http://www.g200kg.com/docs/waapisim/>**

**WebAudioSynth running on MSIE**
[![](./waapisimvideo.png)](http://www.youtube.com/watch?v=AHR2C2C2v8E)  

## Some Links of Test-pages

[Node test (Oscillator/ScriptProcessor/BiquadFilter/WaveShaper/Panner/Analyser)](http://www.g200kg.com/docs/waapisim/nodetest.html)  
[Compressor test](http://www.g200kg.com/docs/waapisim/comptest.html)  
[AudioParam Automation test](http://www.g200kg.com/docs/waapisim/automationtest.html)  
[ChannelSplitter/ChannelMerger test](http://www.g200kg.com/docs/waapisim/test-split.html)  
[Oscillator custom waveform test](http://www.g200kg.com/jp/docs/webaudio/samples/test-osccustom.html)  

## Current Status

WAAPISim is still not completed. It is tentative and partial implementation.

* Number of channels in each nodes should be 1 (mono) or 2(stereo)
* OscillatorNode / ChannelSplitterNode / ChannelMergerNode / AudioBufferSourceNode / WaveShaperNode / AnalyserNode / GainNode / BiquadFilterNode / DelayNode : implemented
* DynamicsCompressorNode : Implemented but has a little different characteristics from Chrome's implements.
* PannerNode : Simplified. Listener position should stay default. Source positions are interpreted as x-z 2d coordinate
* ScriptProcessorNode : Implemented. Input buffer size should be 1024 and under (No limitation if use output only)
* ConvolverNode : By performance reason, convolution is executed for only IR's first 1000 samples. Sebsequent part will be replaced as simple delays.
* createBuffer from ArrayBuffer supports only .wav format
* k-rate AudioParam controls are executed only per 1024 samples frequency. a-rate AudioParams are controlled by sample.


## Usage

Load the 'waapisim.js' before using the Web Audio API functions in your script.

`<script type="text/javascript" src="waapisim.js"></script>`

To enable fallbacking to Flash, place the 'waapisim.swf' file to same folder as 'waapisim.js'.

## License
Copyright (c) 2013 g200kg  
<http://www.g200kg.com/>  
Released under the MIT License