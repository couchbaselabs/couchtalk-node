/** @jsx React.DOM */

var helpers = require("./helpers.jsx"),
  getUserMedia = require("getusermedia");

module.exports = React.createClass({
  getInitialState : function(){
    return {recording: false}
  },
  componentWillMount: function() {
    // listen for spacebar down and up
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
  componentWillUnmount: function() {
    // unlisten
  },
  startRecord : function() {
    if (this.state.recording) return;
    console.log("startRecord")
    this.props.recorder.record()
    this.setState({recording : true});
  },
  stopRecord : function() {
    if (!this.state.recording) return console.error("I thought I was recording!");
    console.log("stopRecord")
    var recorder = this.props.recorder
    recorder.stop()
    recorder.exportWAV(function(wav){
      console.log("wav", wav)
      recorder.clear();
      this.setState({recording : false});
      // var url = URL.createObjectURL(wav);
    }.bind(this))
  },
  render : function() {
    var url = location.origin + "/talk/" + this.props.id
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
      </div>
      );
  }
})
