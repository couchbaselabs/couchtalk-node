/**
 * @jsx React.DOM
 */
 /* global Davis */
 /* global Zepto */
 /* global io */
 /* global Recorder */
 /* global AudioContext */

var helpers = require("./helpers.jsx"),
  IndexPage = require("./index.jsx"),
  TalkPage = require("./room.jsx");

var $ = Davis.$ = Zepto;

function connectRouter(component) {
  return Davis(function(){
    this.settings.generateRequestOnPageLoad = true;
    this.settings.handleRouteNotFound = true;

    // global handlers
    // this.bind("routeNotFound", routeNotFound)
    // this.bind("lookupRoute", lookupRoute)

    this.get('/', function(){
      component.setState({page : "index"})
    })
    this.get('/talk/:id', function(req){
      component.setState({page : "room", params : req.params})
    })
  })
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

module.exports = React.createClass({
  getInitialState : function(){
    return {page : "index"}
  },
  componentWillMount: function() {
    var router = connectRouter(this);
    this.setState({router : router})
  },
  componentDidMount : function(rootNode){
    connectAudio(function(error, recorder) {
      if (error) {return console.error(error)}
      var video = $(rootNode).find("video")[0];
      video.muted = true;
      video.src = window.URL.createObjectURL(recorder.stream);
      recorder.onRecordStart = this.onRecordStart;
      this.setState({recorder: recorder, socket : io.connect(location.origin)})
    }.bind(this))
  },
  onRecordStart : function(recorder){
    var rootNode = $(this.getDOMNode());
    var canvas = rootNode.find("canvas")[0];
    var video = rootNode.find("video")[0];
    video.className = "recording"
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, video.width*2, video.height*2);
    // this indirection is because for efficiency reasons we want
    // to managage the video element at the app.jsx
    if (recorder.onSnapshot) {recorder.onSnapshot(canvas.toDataURL("image/png"));}
  },
  componentWillUnmount: function() {
    this.state.router.stop()
  },
  render : function() {
    var page;
    if (this.state.page == "index") {
      page = <IndexPage/>
    } else if (this.state.page == "room" && this.state.recorder) {
      page = <TalkPage id={this.state.params.id} recorder={this.state.recorder} socket={this.state.socket}/>
    }
    return (
        <div className="content">
          <video autoPlay width={320} height={240} />
          <canvas style={{display : "none"}} width={640} height={480}/>
          {page}
        </div>
      );
  }
});

/*  404 handlers
    If the 404 is in-app, redirect to the index page.
    Otherwise make a server request for the new page.
*/
function routeNotFound(r) {
  // setTimeout(function(){ // required sleep
  //   window.location = "/"
  // },100)
}
function lookupRoute(req) {
  // if (req.path.indexOf("/_admin") !== 0) {
  //   window.location = req.path;
  //   req.delegateToServer()
  // }
}
