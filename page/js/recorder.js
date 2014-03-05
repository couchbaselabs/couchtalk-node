/* global Recorder */
/* global AudioContext */

module.exports = {
  connectAudio : connectAudio
}

function connectAudio(cb) {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  navigator.getUserMedia  = navigator.getUserMedia ||
                            navigator.webkitGetUserMedia ||
                            navigator.mozGetUserMedia ||
                            navigator.msGetUserMedia;
  window.URL = window.URL || window.webkitURL;

  if (!navigator.getUserMedia) {
    cb(new Error("navigator.getUserMedia missing"))
  } else {
    try {
      var audio_context = new AudioContext();
    } catch (e) {
      cb(new Error("AudioContext missing"))
    }
    navigator.getUserMedia({audio: true, video: true}, function(stream){
      var input = audio_context.createMediaStreamSource(stream),
        recorder = new Recorder(input, {workerPath: "/recorderWorker.js"});
      var recorderStart = recorder.record.bind(recorder);
      recorder.record = function() {
        console.log("recorder did start")
        recorderStart()
        if (recorder.onRecordStart) {
          recorder.onRecordStart(recorder)
        }
      }
      recorder.stream = stream;
      cb(false, recorder)
    }, function(e) {
      cb(new Error('No live audio input: ' + e));
    });
  }
}
