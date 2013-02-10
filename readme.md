# WAAPISim : Web Audio API Simulator

WAAPISim is browser's 'Web Audio API' simulator fallbacking to Firefox's 'Audio Data API' or Flash.

WAAPISim automatically check the availability of APIs:  
WebAudioAPI => AudioDataAPI => Flash

**<http://www.g200kg.com/docs/waapisim/>**


## Current Status

WAAPISim is still not completed. It is tentative and partial implementation.

* Channels in each nodes should be 1 (mono) or 2(stereo)
* WaveShaperNode / AnalyserNode / GainNode / BiquadFilterNode / DelayNode : implemented
* PannerNode : Simplified. Listener position should be stay default. Source positions are interpreted as x-z 2d coordinate (and almost meaningless in Flash fallbacking because it is monaural)
* ScriptProcessorNode : Implemented. input buffer size should be 1024 and under (No limitation if use output only)
* AudioBufferSourceNode : Implemented except for looping
* OscillatorNode : Custom waveform is not implemented
* ConvolverNode / DynamicsCompressorNode / ChannelSplitterNode / ChannelMergerNode : Just a dummy. Pass-through from input to output.
* createBuffer from ArrayBuffer supports only .wav format
* AudioParam has no automation functions
* By performance reason, Node to AudioParam contols are executed only 1/1024 samples frequency.

## Usage

Load the 'waapisim.js' before using the Web Audio API functions in your html.

`<script type="text/javascript" src="waapisim.js"></script>`

To enable fallback to Flash, place the 'waapisim.swf' to same folder as 'waapisim.js'.

## License
Copyright (c) 2013 g200kg  
<http://www.g200kg.com/>  
Released under the MIT License
