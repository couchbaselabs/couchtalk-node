/**
 * @jsx React.DOM
 */
 /* global $ */
 /* global io */


var
  connectAudio = require("../js/recorder").connectAudio,
  getUserMedia = require("getusermedia");

var TalkPage = module.exports = React.createClass({
  propTypes : {
    id : React.PropTypes.string.isRequired,
  },
  getInitialState : function(){
    return {
      recording: false,
      messages : [],
      session : "s:"+Math.random().toString(20),
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
    socket.on("snap-id", this.gotMessage)
    this.setState({socket : socket})
  },
  gotMessage : function(message){
    var messages = this.state.messages;
    console.log("message", message, messages.length)

    if (message.snap) {
      for (var i = messages.length - 1; i >= 0; i--) {
        // maybe checking keypressId makes more sense?
        if (messages[i] && messages[i].snap === message.snap) {
          break;
        }
      }
      if (messages[i]) {
        // exists in some form
        $.extend(messages[i], message)
      } else {
        // first time, add it
        messages.push(message)
        i = messages.length-1;
      }
      this.setState({messages : messages})
      this.maybePlay(messages[i], i)
    } else {
      // console.log("no snap field", message)
    }
  },
  maybePlay : function(message, i) {
    // console.log(this.state, message)
    if (this.state.autoplay && this.state.nowPlaying === false) {
      if (this.state.session !== message.session) {
        this.playMessage(i)
      }
    }
  },
  listenForSpaceBar : function(){
    // record while spacebar is down
    window.onkeydown = function (e) {
      var code = e.keyCode ? e.keyCode : e.which;
      if (code === 32) { //spacebar
        e.preventDefault()
        this.startRecord("kp:"+Math.random().toString(20))
      }
    }.bind(this);
    window.onkeyup = function (e) {
      var code = e.keyCode ? e.keyCode : e.which;
      if (code === 32) { // spacebar
        this.stopRecord()
      }
    }.bind(this);
  },
  startRecord : function(keypressId) {
    if (this.state.recording) return;
    // console.log("startRecord",keypressId)
    this.state.socket.emit("new-snap", {
      keypressId : keypressId,
      session : this.state.session,
      room : this.props.id
    })
    this.state.recorder.record()
    this.takeSnapshot(keypressId)
    var video = $("video")
    video.addClass("recording")
    video.data("keypressId", keypressId)
    this.setState({recording : true});
  },
  stopRecord : function() {
    if (!this.state.recording) {
      return console.error("I thought I was recording!")
    }
    var video =  $("video"),
      keypressId = video.data("keypressId"),
      recorder = this.state.recorder;
    recorder.stop()
    video.removeClass("recording");

    recorder.exportMonoWAV(this.saveAudio.bind(this, keypressId))
    recorder.clear()
    this.setState({recording : false})
    // console.log("stopped recording", keypressId)
  },
  saveAudio : function(keypressId, wav){
    this.messageWithIdForKeypress(keypressId,
      function(message){
      var reader = new FileReader();
      reader.addEventListener("loadend", function() {
        var parts = reader.result.split(/[,;:]/)
        $.ajax({
          type : "POST",
          url : "/audio/" + this.props.id + "/" + message.snap,
          contentType : parts[1],
          data : parts[3],
          success : function() {
            // console.log("saved audio", message)
          }
        })
      }.bind(this));
      reader.readAsDataURL(wav);
    }.bind(this))
  },
  takeSnapshot : function(keypressId){
    var rootNode = $(this.getDOMNode());
    var canvas = rootNode.find("canvas")[0];
    var video = rootNode.find("video")[0];
    video.className = "recording"
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, video.width*2, video.height*2);
    this.saveSnapshot(canvas.toDataURL("image/jpeg"), keypressId);
  },
  messageForKeypress : function(keypressId, index) {
    var messages = this.state.messages;
    for (var i = messages.length - 1; i >= 0; i--) {
      var m = messages[i];
      if (m.keypressId == keypressId) {
        if (index) {index.i = i;}
        return m;
      }
    }
    return {keypressId : keypressId};
  },
  messageWithIdForKeypress : function(keypressId, cb, retries){
    var message = this.messageForKeypress(keypressId);
    retries = retries || 0;
    if (!message.snap) { // we haven't got the id via socket.io
      if (retries < 100) {
        // console.log("wait for snap id for", keypressId, message, retries)
        setTimeout(this.messageWithIdForKeypress.bind(this,
          keypressId, cb, retries+1), 100*(retries+1))
      } else {
        console.error("too many retries", keypressId, message)
      }
    } else { // we are good
      cb(message)
    }
  },
  saveSnapshot : function(png, keypressId){
    this.messageWithIdForKeypress(keypressId,
      function(message){
        var parts = png.split(/[,;:]/)
        $.ajax({
          type : "POST",
          url : "/snapshot/" + this.props.id + "/" + message.snap + "/" + keypressId ,
          contentType : parts[1],
          data : parts[3],
          success : function(data) {
            // console.log("saved snap", message)
          }
        })
    }.bind(this))
  },
  pleasePlayMessage : function(i){
    // console.log("pleasePlayMessage", i)
    if (this.state.nowPlaying !== false) {
      var rootNode = $(this.getDOMNode());
      // play the audio from the beginning
      var audio = rootNode.find("audio")[this.state.nowPlaying]
      // console.log("should stop", audio)
      audio.load() // fires ended event?
    }
    this.setState({nowPlaying : false})
    this.playMessage(i)
  },
  playMessage : function(i){
    // todo move to message, remove `i`
    var message = this.state.messages[i];
    if (message && message.audio) {
      var rootNode = $(this.getDOMNode());
      // play the audio from the beginning
      var audio = rootNode.find("audio")[i]
      audio.load()
      audio.play()
      message.played = true

      setTimeout(function() {
        console.log(audio, audio.ended, audio.networkState)
        if (audio.networkState != 1) {
          this.playFinished(message)
        }
      }.bind(this),500)

      this.setState({
        nowPlaying : i,
        messages : this.state.messages})
    } else {
      this.setState({nowPlaying : false})
    }
  },
  playFinished : function(message){
    if (this.state.autoplay) {
      // find the index of the current message in the messages array
      // by snap. then play the next one
      var messages = this.state.messages;
      for (var i = messages.length - 1; i >= 0; i--) {
        if (messages[i].snap == message.snap) {
          break;
        }
      }
      this.playMessage(i + 1)
    } else {
      this.setState({nowPlaying : false})
    }
  },
  setupAudioVideo : function(rootNode, recorder){
    var video = $(rootNode).find("video")[0]
    video.muted = true;
    video.src = window.URL.createObjectURL(recorder.stream)
  },
  autoPlayChanged : function(e){
    this.setState({autoplay: e.target.checked})
  },
  loadEarlierMessages : function(e){
    var room = this.props.id, oldest = this.state.messages[0],
      before;
    if (oldest && oldest.snap) {
      before = parseInt(oldest.snap.split('-')[2], 10)
    }
    var oldMessages = [], min = Math.max(before - 10, 0)
    for (var i = before - 1; i >= min; i--) {
      oldMessages.unshift({
        snap : ["snap",room,i].join("-"),
        audio : ["snap",room,i,"audio"].join("-"),
        image : true
      })
    }
    this.setState({messages : oldMessages.concat(this.state.messages)})
  },
  componentDidMount : function(rootNode){
    connectAudio(function(error, recorder) {
      if (error) {return reloadError(error)}
      this.setupAudioVideo(rootNode, recorder)
      this.listenForSpaceBar()
      this.setState({recorder: recorder, socket : io.connect(location.origin)})
    }.bind(this))
  },
  componentDidUpdate : function(oldProps, oldState){
    var el, els = $(".room img.playing")
    if (els[0]) {
      el = els[0]
    } else {
      if (oldState.messages[oldState.messages.length-1] && (oldState.messages[oldState.messages.length-1].snap !==
              this.state.messages[this.state.messages.length-1].snap)) {
        els = $(".room img")
        el = els[els.length-1]
      }
    } // todo check for did the user scroll recently
    if (el) {el.scrollIntoView(true)}
  },
  render : function() {
    var url = location.origin + "/talk/" + this.props.id;
    var recording = this.state.recording ?
      <span className="recording">Recording.</span> :
      <span/>;
    var oldestKnownMessage = this.state.messages[0];
    return (
      <div className="room">
      <header>
        <video autoPlay width={160} height={120} />
        <canvas style={{display : "none"}} width={320} height={240}/>
        <p>Invite people to join the conversation: <input className="shareLink" value={url}/></p>
        <p>Hold down the space bar while you are talking to record. <em>All messages are public.</em> {recording}</p>
        <label className="autoplay">Auto-play<input type="checkbox" onChange={this.autoPlayChanged} checked={this.state.autoplay}/></label>
        {(oldestKnownMessage && oldestKnownMessage.snap.split('-')[2] !== '0') && <p><a onClick={this.loadEarlierMessages}>Load earlier messages.</a></p>}
        <aside><strong>1998 called: </strong> it wants you to know CouchTalk <a href="http://caniuse.com/#feat=stream">requires </a>
          <a href="http://www.mozilla.org/en-US/firefox/new/">Firefox</a> or <a href="https://www.google.com/intl/en/chrome/browser/">Chrome</a>.</aside>
      </header>
      <ul className="messages">
        {this.state.messages.map(function(m, i) {
          return <Message
            message={m}
            key={m.snap}
            playing={this.state.nowPlaying === i}
            playFinished={this.playFinished}
            playMe={this.pleasePlayMessage.bind(this, i)}
            />
        }, this)}
      </ul>
      </div>
      );
  }
})

var Message = React.createClass({
  componentDidMount : function(){
    var audio = $(this.getDOMNode()).find("audio")[0];
    audio.addEventListener('ended', this.props.playFinished.bind(this, this.props.message))
  },
  render : function() {
    // console.log("Render", this.props)
    var snapURL
    if (this.props.message.image) {
      snapURL = "/snapshot/" + this.props.message.snap;
    }
    var audioURL = "/audio/" + this.props.message.audio;
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
        <audio src={audioURL}/>
      </li>)
  }
})

function reloadError(error) {
  console.error("reload",error);
  setTimeout(function(){
    document.location = location
  },200)
}
