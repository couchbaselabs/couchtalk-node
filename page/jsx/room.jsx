/** @jsx React.DOM */
/* global $ */

var helpers = require("./helpers.jsx"),
  getUserMedia = require("getusermedia"),
  postSnapshot = location.origin + "/snapshot",
  postAudio = location.origin + "/audio"


module.exports = React.createClass({
  propTypes : {
    socket : React.PropTypes.object.isRequired,
    recorder : React.PropTypes.object.isRequired
  },
  getInitialState : function(){
    return {recording: false, messages : [], autoplay : true, nowPlaying : false}
  },
  componentWillMount: function() {
    this.props.recorder.onSnapshot = this.onSnapshot;
    this.joinRoom()
    this.spaceBar()
  },
  componentWillUnmount: function() {
    // unlisten to spacebar and socket
  },
  joinRoom : function(){
    console.log("join")
    this.props.socket.emit("join", {id : this.props.id})
    this.props.socket.on("message", this.gotMessage)
  },
  gotMessage : function(message){
    console.log("message", message)
    var messages = this.state.messages;
    if (message.snap) {
      if (message.audio) {
        // second time, add audio pointer
        for (var i = messages.length - 1; i >= 0; i--) {
          if (messages[i].snap === message.snap) {
            break;
          }
        }
        messages[i].audio = message.audio;
        this.setState({messages : messages})
        if (this.state.nowPlaying === false) {
          this.playMessage(i)
        }
      } else {
        // first time, add it
        // messages[messages.length-1].next = message
        messages.push(message)
        this.setState({messages : messages})
      }
    } else {
      console.log("not a snap", message)
    }
  },
  spaceBar : function(){
    // record while spacebar is down
    window.onkeydown = function (e) {
      var code = e.keyCode ? e.keyCode : e.which;
      if (code === 32) { //spacebar
        e.preventDefault()
        this.startRecord()
      }
    }.bind(this);
    window.onkeyup = function (e) {
      var code = e.keyCode ? e.keyCode : e.which;
      if (code === 32) { // spacebar
        this.stopRecord()
      }
    }.bind(this);
  },
  startRecord : function() {
    if (this.state.recording) return;
    console.log("startRecord")
    this.props.recorder.record()
    $("video").addClass("recording")
    this.setState({recording : true});
  },
  onSnapshot : function(png){
    var parts = png.split(/[,;:]/)
    $.ajax({
      type : "POST",
      url : postSnapshot + "/" + this.props.id,
      contentType : parts[1],
      data : parts[3],
      success : function(data) {
        console.log("currentSnapshot", data.id)
        this.setState({currentSnapshot : data.id})
      }.bind(this)
    })
  },
  stopRecord : function() {
    if (!this.state.recording) return console.error("I thought I was recording!");
    // console.log("stopRecord")
    var recorder = this.props.recorder
    recorder.stop()
    $("video").removeClass("recording")
    recorder.exportWAV(function(wav){
      // console.log("wav", wav)
      // var blob = window.URL.createObjectURL(wav);
      var reader = new FileReader();
      reader.addEventListener("loadend", function() {
         // console.log('save', this.state)
         var parts = reader.result.split(/[,;:]/)
         $.ajax({
           type : "POST",
           url : postAudio + "/" + this.state.currentSnapshot,
           contentType : parts[1],
           data : parts[3],
           success : function(data) {
             console.log("postAudio", data)
             // this.setState({currentSnapshot : data.id})
           }.bind(this)
         })
      }.bind(this));
      reader.readAsDataURL(wav);
      recorder.clear();
      this.setState({recording : false});
    }.bind(this))
  },
  playMessage : function(i){
    // set the src of the audio and play it
    // set a timer for when it finishes
    // set the state for nowPlaying
    var message = this.state.messages[i];
    console.log("playMessage", i, message)
    if (message && message.audio) {
      var audioURL = "/audio/" + message.audio;
      var rootNode = $(this.getDOMNode());
      var audio = rootNode.find("audio")[0];
      audio.src = audioURL;
      audio.play();
      this.setState({nowPlaying : i})
    } else {
      this.setState({nowPlaying : false})
    }
  },
  playFinished : function(){
    if (this.state.autoplay) {
      this.playMessage(this.state.nowPlaying + 1)
    } else {
      this.setState({nowPlaying : false})
    }
  },
  componentDidMount : function(){
    var audio = $(this.getDOMNode()).find("audio")[0];
    audio.addEventListener('ended', this.playFinished);
  },
  render : function() {
    var url = location.origin + "/talk/" + this.props.id;
    var recording = this.state.recording ?
      <span className="recording">Recording.</span> :
      <span/>;
    var autoplay = false; //todo get from state and checkbox
    this.state.messages.forEach(function(m, i) {})
    return (
      <div className="room">
      <header>
        Invite people to join the conversation: <input size={70} value={url}/>
        <br/>
        Hold down the space bar while your are talking. {recording}
      </header>
      <audio/>
      <ul>
        {this.state.messages.map(function(m, i) {
          return <Message
            message={m}
            key={m.snap}
            playing={this.state.nowPlaying === i}
            playMe={this.playMessage.bind(this, i)}
            />
        }, this)}
      </ul>
      </div>
      );
  }
})

var Message = React.createClass({
  render : function() {
    var snapURL = "/snapshot/" + this.props.message.snap;
    var playing = this.props.playing ? "playing" : ""
    return (<li>
              <img className={playing} src={snapURL} onClick={this.props.playMe}/>
            </li>)
  }
})
