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
    return {recording: false, messages : []}
  },
  componentWillMount: function() {
    this.props.recorder.onSnapshot = this.onSnapshot;
    this.joinRoom()
    this.spaceBar()
  },
  componentWillUnmount: function() {
    // unlisten
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
        // second time, replace it
        for (var i = messages.length - 1; i >= 0; i--) {
          if (messages[i].snap === message.snap) {
            break;
          }
        }
        messages[i] = message;
      } else {
        // first time, add it
        messages.push(message)
      }
      this.setState({messages : messages})
    } else {
      console.error("no snap!", message)
    }
  },
  spaceBar : function(){
    // record while spacebar is down
    window.onkeydown = function (e) {
      var code = e.keyCode ? e.keyCode : e.which;
      if (code === 32) { //spacebar
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
    recorder.exportWAV(function(wav){
      // var blob = window.URL.createObjectURL(wav);
      var reader = new FileReader();
      reader.addEventListener("loadend", function() {
         // reader.result contains the contents of blob as a typed array
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
  render : function() {
    var url = location.origin + "/talk/" + this.props.id;
    var recording = this.state.recording ?
      <span className="recording">Recording.</span> :
      <span/>;
    return (
      <div className="room">
      <header>
        Invite people to join the conversation: <input size={70} value={url}/>
        <br/>
        Use the space bar to talk. {recording}
      </header>
      <ul>
        {this.state.messages.map(function(m) {
          var snapURL = "/snapshot/" + m.snap;
          var audioURL = m.audio ? "/audio/" + m.audio : null
          if (audioURL) {
            return (<li>
                      <img src={snapURL}/>
                      <audio src={audioURL} controls="controls"/>
                    </li>)
          } else {
            return (<li>
                      <img src={snapURL}/>
                    </li>)
          }
        })}
      </ul>
      </div>
      );
  }
})
