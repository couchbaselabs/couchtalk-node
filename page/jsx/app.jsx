/**
 * @jsx React.DOM
 */
 /* global $ */
 /* global io */


var
  connectAudio = require("../js/recorder").connectAudio,
  getUserMedia = require("getusermedia"),
  postSnapshot = location.origin + "/snapshot",
  postAudio = location.origin + "/audio"

var TalkPage = module.exports = React.createClass({
  propTypes : {
    id : React.PropTypes.string.isRequired,
  },
  getInitialState : function(){
    return {
      recording: false,
      messages : [],
      autoplay : true,
      nowPlaying : false,
    }
  },
  componentWillMount: function() {
    this.joinRoom()
  },
  joinRoom : function(){
    var socket = io.connect(location.origin)
    socket.emit("join", {id : this.props.id})
    socket.on("message", this.gotMessage)
    this.setState({socket : socket})
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
        if (this.state.autoplay && this.state.nowPlaying === false) {
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
  listenForSpaceBar : function(){
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
    this.state.recorder.record()
    this.takeSnapshot()
    $("video").addClass("recording")
    this.setState({recording : true});
  },
  stopRecord : function() {
    if (!this.state.recording) {
      return console.error("I thought I was recording!")
    }
    var recorder = this.state.recorder
    recorder.stop()
    $("video").removeClass("recording")
    recorder.exportWAV(this.saveAudio)
    recorder.clear()
    this.setState({recording : false})
  },
  saveAudio : function(wav){
    var reader = new FileReader();
    reader.addEventListener("loadend", function() {
       var parts = reader.result.split(/[,;:]/)
       $.ajax({
         type : "POST",
         url : postAudio + "/" + this.state.currentSnapshot,
         contentType : parts[1],
         data : parts[3],
         success : function() {}
       })
    }.bind(this));
    reader.readAsDataURL(wav);
  },
  takeSnapshot : function(recorder){
    var rootNode = $(this.getDOMNode());
    var canvas = rootNode.find("canvas")[0];
    var video = rootNode.find("video")[0];
    video.className = "recording"
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, video.width*2, video.height*2);
    this.saveSnapshot(canvas.toDataURL("image/png"));
  },
  saveSnapshot : function(png){
    var parts = png.split(/[,;:]/)
    $.ajax({
      type : "POST",
      url : postSnapshot + "/" + this.props.id,
      contentType : parts[1],
      data : parts[3],
      success : function(data) {
        this.setState({currentSnapshot : data.id})
      }.bind(this)
    })
  },
  playMessage : function(i){
    var message = this.state.messages[i];
    if (message && message.audio) {
      var audioURL = "/audio/" + message.audio;
      var rootNode = $(this.getDOMNode());
      // set the src of the audio and play it
      var audio = rootNode.find("audio")[0];
      audio.src = audioURL;
      audio.play();
      message.played = true;
      this.setState({nowPlaying : i, messages : this.state.messages})
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
  setupAudioVideo : function(rootNode, recorder){
    var
      audio = $(rootNode).find("audio")[0],
      video = $(rootNode).find("video")[0]
    audio.addEventListener('ended', this.playFinished)
    video.muted = true;
    video.src = window.URL.createObjectURL(recorder.stream)
  },
  autoPlayChanged : function(e){
    // console.log("autoPlayChanged", e.target.checked)
    this.setState({autoplay: e.target.checked})
  },
  componentDidMount : function(rootNode){
    connectAudio(function(error, recorder) {
      if (error) {return reloadError(error)}
      this.setupAudioVideo(rootNode, recorder)
      this.listenForSpaceBar()
      this.setState({recorder: recorder, socket : io.connect(location.origin)})
    }.bind(this))
  },
  componentDidUpdate : function(){
    var el, els = $(".room img.playing")
    if (els[0]) {
      el = els[0]
    } else {
      els = $(".room img")
      el = els[els.length-1]
    } // todo check for did the user scroll recently
    if (el) {el.scrollIntoView(false)}
  },
  render : function() {
    var url = location.origin + "/talk/" + this.props.id;
    var recording = this.state.recording ?
      <span className="recording">Recording.</span> :
      <span/>;
    return (
      <div className="room">
      <header>
        <video autoPlay width={320} height={240} />
        <canvas style={{display : "none"}} width={640} height={480}/>
        Invite people to join the conversation: <input className="shareLink" value={url}/>
        <br/>
        Hold down the space bar while you are talking to record. {recording}
        <audio/>
        <br/>
        <input type="checkbox" onChange={this.autoPlayChanged} checked={this.state.autoplay}>Auto-play</input>
      </header>
      <ul className="messages">
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
    var className = "";
    if (!this.props.message.audio) {
      className += "noAudio"
    } else {
      if (this.props.playing) {
        className += " playing"
      } else {
        if (this.props.message.played) {
          className += " played"
        } else {
          className += " unplayed"
        }
      }
    }
    return (<li>
              <img className={className} src={snapURL} onClick={this.props.playMe}/>
            </li>)
  }
})

function reloadError(error) {
  console.error("reload",error);
  setTimeout(function(){
    document.location = location
  },200)
}
