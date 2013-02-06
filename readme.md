# WAAPISim : Web Audio API Simulator

WAAPISim is browser's 'Web Audio API' simulator on the 'Audio Data API' that is supported with Firefox. 

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
* By performance, Node to AudioParam contols are executed only 1/1024 samples frequency.

## Usage

Load the 'waapisim.js' before using the Web Audio API functions in your html.

`<script type="text/javascript" src="waapisim.js"></script>`

## License
Copyright (c) 2013 g200kg  
<http://www.g200kg.com/>  
Released under the MIT License
