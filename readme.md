# WAAPISim : Web Audio API Simulator

WAAPISim is browser's 'Web Audio API' simulator fallbacking to Firefox's 'Audio Data API' or Flash.

WAAPISim automatically check the availability of APIs:  
WebAudioAPI => AudioDataAPI => Flash

**<http://www.g200kg.com/docs/waapisim/>**


## Current Status

WAAPISim is still not completed. It is tentative and partial implementation.

* Channels in each nodes should be 1 (mono) or 2(stereo)
* AnalyserNode / GainNode / BiquadFilterNode / DelayNode : implemented
* ScriptProcessorNode : Implemented. input buffer size should be 1024 and under (No limitation if use output only)
* OscillatorNode : Custom waveform is not implemented
* WaveShaperNode : Implemented but not tested
* ConvolverNode / DynamicsCompressorNode / ChannelSplitterNode / ChannelMergerNode : Just a dummy. Pass-through from input to output.
* AudioParam has no automation functions
* By performance reason, Node to AudioParam contols are executed only 1/1024 samples frequency.
* In Flash fallbacking mode, audio output is processed as monaural.

## Usage

Load the 'waapisim.js' before using the Web Audio API functions in your html.

`<script type="text/javascript" src="waapisim.js"></script>`

To enable fallback to Flash, place the 'waapisim.swf' to same folder as 'waapisim.js'.

## License
Copyright (c) 2013 g200kg  
<http://www.g200kg.com/>  
Released under the MIT License
