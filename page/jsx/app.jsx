/**
 * @jsx React.DOM
 */
 /* global $ */
 /* global PUBNUB */


var
  connectAudio = require("../js/recorder").connectAudio,
  getUserMedia = require("getusermedia");

  module.exports.App = React.createClass({
  propTypes : {
    id : React.PropTypes.string.isRequired,
  },
  getInitialState : function(){
    // console.log($.fn.cookie("autoplay"), $.fn.cookie("selfDestruct"), $.fn.cookie("selfDestructTTL"))
    var start = getQueryVariable("start");
    var end = getQueryVariable("end");
    // console.log(start, end)
    return {
      recording: false,
      messages : [],
      session : "s:"+Math.random().toString(20),
      autoplay : $.fn.cookie('autoplay') !== "false",
      selfDestructTTL : parseInt($.fn.cookie('selfDestructTTL'), 10) || 300,
      selfDestruct : $.fn.cookie('selfDestruct') === "true",
      nowPlaying : false,
      start : parseInt(start, 10),
      end : parseInt(end, 10)
    }
  },
  componentWillMount: function() {
    // var socket = io.connect(location.origin)
    // socket.on("message", this.gotMessage)
    // this.setState({socket : socket})

    var pubnub = PUBNUB.init({
      publish_key: 'pub-c-70e08867-b33a-4375-8ce4-47048abcb7c8',
      subscribe_key: 'sub-c-950ffe0a-b6b1-11e3-87c4-02ee2ddab7fe'
    });
    this.setState({pubnub : pubnub})


  },
  gotMessage : function(message){
    var messages = this.state.messages;
    // console.log("message", message, messages.length)

    if (message.snap) {
      for (var i = messages.length - 1; i >= 0; i--) {
        if (messages[i] && messages[i].snap && messages[i].snap.split(":")[0] === message.snap.split(":")[0]) {
          break;
        }
      }
      if (messages[i]) {
        // exists in some form
        $.extend(messages[i], message)
      } else {
        // check to see if there's a message with the keypress
        if (message.keypressId) {
          var findIndex = {};
          this.messageForKeypress(message.keypressId, findIndex)
          if (findIndex.i) {
            $.extend(messages[findIndex.i], message)
            i = findIndex.i
          } else {
            // first time, add it
            messages.push(message)
            i = messages.length-1;
          }
        } else {
          // first time, add it
          messages.push(message)
          i = messages.length-1;
        }

      }
      this.setState({messages : messages})
      this.maybePlay(messages[i], i)
    } else {
      // console.log("no snap only keypressId", message)
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
    this.state.recorder.record()
    var counter = 0;
    this.takeSnapshot(keypressId, counter)
    var interval = setInterval(function(){
      this.takeSnapshot(keypressId, ++counter)
    }.bind(this), 250)
    var video = $("video")
    video.addClass("recording")
    video.data("keypressId", keypressId)
    this.setState({recording : true, pictureInterval : interval});

    $.ajax({
      type : "POST",
      url : "/next/"+this.props.id,
      success : function(data) {
        // console.log("saved audio", message)
        this.gotMessage({
          keypressId : keypressId,
          session : this.state.session,
          room : this.props.id,
          snap : data.snap
        })
      }.bind(this)
    })
  },
  stopRecord : function() {
    if (this.state.pictureInterval) clearInterval(this.state.pictureInterval)
    if (!this.state.recording) {
      return console.error("I thought I was recording!")
    }
    var video =  $("video"),
      keypressId = video.data("keypressId"),
      recorder = this.state.recorder;
    recorder.stop()
    video.removeClass("recording");
    var message = this.messageForKeypress(keypressId);
    if (message) {
      delete message.snapdata;
    }

    recorder.exportMonoWAV(this.saveAudio.bind(this, keypressId))
    recorder.clear()
    this.setState({recording : false})
    // console.log("stopped recording", keypressId)
  },
  saveAudio : function(keypressId, wav){
    this.messageWithIdForKeypress(keypressId,
      function(message){
      var reader = new FileReader(),
        postURL = "/audio/" + this.props.id + "/" + message.snap.split(":")[0] + "/" + keypressId;
      if (this.state.selfDestruct) {
        postURL+= "?selfDestruct="+this.state.selfDestructTTL;
      }
      reader.addEventListener("loadend", function() {
        var parts = reader.result.split(/[,;:]/)
        $.ajax({
          type : "POST",
          url : postURL,
          contentType : parts[1],
          data : parts[3],
          success : function(data) {
            // console.log("saved audio", message)
            this.publishMessage({
              keypressId : keypressId,
              snap : message.snap.split(":")[0],
              audio : data.id
            })
          }.bind(this)
        })
      }.bind(this));
      reader.readAsDataURL(wav);
    }.bind(this))
  },
  takeSnapshot : function(keypressId, counter){
    var rootNode = $(this.getDOMNode());
    var canvas = rootNode.find("canvas")[0];
    var video = rootNode.find("video")[0];
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, video.width*2, video.height*2);
    this.saveSnapshot(canvas.toDataURL("image/jpeg"), keypressId, counter);
  },
  messageForKeypress : function(keypressId, index) {
    var messages = this.state.messages;
    // console.log('messageForKeypress', keypressId, messages)
    for (var i = messages.length - 1; i >= 0; i--) {
      var m = messages[i];
      if (m.keypressId == keypressId) {
        if (index) {index.i = i;}
        return m;
      }
    }
  },
  messageWithIdForKeypress : function(keypressId, cb, retries){
    var message = this.messageForKeypress(keypressId);
    retries = retries || 0;
    if (!(message && message.snap)) { // we haven't got the id via socket.io
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
  saveLocalSnapshot : function(png, keypressId){
    var messages = this.state.messages;
    var findIndex = {}
    var existingMessage = this.messageForKeypress(keypressId, findIndex);
    if (existingMessage) {
      // console.log("update local snapshot", existingMessage)
      messages[findIndex.i].snapdata = png;
      this.setState({messages : messages});
    } else {
      var newMessage = {keypressId : keypressId, snapdata : png}
      messages.push(newMessage)
      // console.log("save new local snapshot", newMessage)
      this.setState({messages : messages});
    }
  },
  saveSnapshot : function(png, keypressId, counter){
    // make locally available before saved on server
    this.saveLocalSnapshot(png, keypressId)

    // save on server as soon as we have an id
    this.messageWithIdForKeypress(keypressId,
      function(message){
        // console.log("save pic", message)
        var parts = png.split(/[,;:]/),
          picId = message.snap.split(":")[0];
        if (counter) {
          picId += ":" + counter
        }
        var postURL = "/snapshot/" + this.props.id + "/" + picId + "/" + keypressId;
        if (this.state.selfDestruct) {
          postURL+= "?selfDestruct="+this.state.selfDestructTTL;
        }
        $.ajax({
          type : "POST",
          url : postURL,
          contentType : parts[1],
          data : parts[3],
          success : function(data) {
            // console.log("saved snap", data)
            this.publishMessage({snap : picId, keypressId : keypressId, image : true})
          }.bind(this)
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
    if (!this.state.recording && message) {
      if (message.audio) {
        var rootNode = $(this.getDOMNode());
        // play the audio from the beginning

        var audio = rootNode.find("audio")[i]
        audio.load()
        audio.play()
        message.played = true
        // console.log(audio, audio.ended, audio.networkState)
        setTimeout(function() {
          // console.log(audio, audio.ended, audio.networkState)
          if (audio.networkState != 1) {
            this.playFinished(message)
          }
        }.bind(this),1000)

        this.setState({
          nowPlaying : i,
          messages : this.state.messages})
      } else {
        this.playMessage(i+1)
      }
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
    $.fn.cookie('autoplay', e.target.checked.toString(), {path : "/"});
    this.setState({autoplay: e.target.checked})
  },
  loadConversation : function(start, end){
    console.log("conversation view", start, end)
    var room = this.props.id,
      oldMessages = [], min = Math.min(start, end);
    for (var i = end; i >= start; i--) {
      oldMessages.unshift({
        snap : ["snap",room,i].join("-"),
        audio : ["snap",room,i,"audio"].join("-"),
        image : true
      })
    }
    this.setState({messages : oldMessages.concat(this.state.messages)})
  },
  loadEarlierMessages : function(start, end){
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
  publishMessage : function(message){
    this.state.pubnub.publish({
      channel: this.props.id,
      message: message
    });
  },
  connnectPubNub : function(){
    this.state.pubnub.subscribe({
      channel: this.props.id,
      callback: function (message) {
        // console.log("pubnub", message);
        this.gotMessage(message)
      }.bind(this),
      connect: function () {
        this.publishMessage({
          keypressId : this.state.session,
          session : this.state.session,
          room : this.props.id,
          "join" : true
        })
      }.bind(this)
    });
  },
  componentDidMount : function(rootNode){
    if (this.state.start && this.state.end) {
      this.loadConversation(this.state.start, this.state.end)
    }
    connectAudio(function(error, recorder) {
      if (error) {return reloadError(error)}
      this.setupAudioVideo(rootNode, recorder)
      this.listenForSpaceBar()
      this.connnectPubNub()

      if (this.state.start && this.state.end && this.state.autoplay) {
        this.playMessage(0)
      }
      setTimeout(function(){
        this.takeSnapshot(this.state.session)
      }.bind(this), 1000)
      this.setState({recorder: recorder})
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
  selfDestructTTLChanged : function(e) {
    $.fn.cookie('selfDestructTTL', e.target.value, {path : "/"});
    this.setState({selfDestructTTL:e.target.value})
  },
  selfDestructChanged : function(e) {
    $.fn.cookie('selfDestruct', e.target.checked.toString(), {path : "/"});
    this.setState({selfDestruct:e.target.checked})
  },
  render : function() {
    var url = location.origin + "/talk/" + this.props.id;
    var recording = this.state.recording ?
      <span className="recording">Recording.</span> :
      <span/>;
    var okm = this.state.messages[0],
      oldestKnownMessage = (okm && okm.snap && okm.snap.split('-')[2] !== '0');
    document.title = this.props.id + " - CouchTalk"
    var beg = this.state.recorder ? "" : <h2>Smile! &uArr;</h2>;
    return (
      <div className="room">
      <header>
        {beg}
        <video autoPlay width={160} height={120} />
        <canvas style={{display : "none"}} width={320} height={240}/>
        <label className="autoplay"><input type="checkbox" onChange={this.autoPlayChanged} checked={this.state.autoplay}/> Auto-play</label> {recording}
        <br/>
        <label className="destruct"><input type="checkbox" onChange={this.selfDestructChanged} checked={this.state.selfDestruct}/>Erase my messages after <input type="text" size={4} onChange={this.selfDestructTTLChanged} value={this.state.selfDestructTTL}/> seconds</label>

        <h4>Push to Talk <a href="http://www.couchbase.com/">Couchbase Demo</a></h4>
        <p><strong>Hold down the space bar</strong> while you are talking to record.
          <em>All messages are public. </em>
        </p>


        {oldestKnownMessage && <p><a onClick={this.loadEarlierMessages}>Load earlier messages.</a></p>}

        <aside>Invite people to join the conversation: <input className="shareLink" value={url}/> or <a href="/">Go to a new room.</a>
        </aside>

        <RecentRooms id={this.props.id}/>

        <aside><strong>1997 called: </strong> it wants you to know CouchTalk <a href="http://caniuse.com/#feat=stream">requires </a>
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


var RecentRooms = React.createClass({
  getInitialState : function(){
    return {
      sortedRooms : this.sortedRooms()
    }
  },
  parseRooms : function(){
    var rooms = $.fn.cookie("rooms");
    if (rooms) {
      return JSON.parse(rooms)
    } else {
      return {}
    }
  },
  sortedRooms : function() {
    var rooms = this.parseRooms()
    var sortedRooms = [];
    for (var room in rooms) {
      if (room !== this.props.id)
        sortedRooms.push([room, new Date(rooms[room])])
    }
    if (sortedRooms.length > 0) {
      sortedRooms.sort(function(a, b) {return b[1] - a[1]})
      // console.log("sortedRooms", sortedRooms)
      return sortedRooms;
    }
  },
  clearHistory : function(){
    $.fn.cookie("rooms", '{}', {path : "/"})
    this.setState({sortedRooms : this.sortedRooms()})
  },
  componentDidMount : function(){
    if (this.props.id) {
      var rooms = this.parseRooms()
      // console.log("parseRooms", rooms)
      rooms[this.props.id] = new Date();
      $.fn.cookie("rooms", JSON.stringify(rooms), {path : "/"})
    }
  },
  render : function(){
    if (this.state.sortedRooms) {
      return <aside>
        <h4>Recent Rooms <a onClick={this.clearHistory}>(Clear)</a></h4>
        <ul>{
          this.state.sortedRooms.map(function(room){
            var href = "/talk/"+room[0]
            return <li key={room[0]}><a href={href}>{room[0]}</a></li>
          }, this)
        }</ul>
      </aside>
    } else {
      return <aside/>
    }
  },
})

exports.Index = React.createClass({
  getInitialState : function(){
    return {goRoom : Math.random().toString(26).substr(2)}
  },
  onSubmit : function(e){
    e.preventDefault();
    document.location = "/talk/" + this.state.goRoom;
  },
  handleChange : function(e){
    this.setState({goRoom: e.target.value});
  },
  render : function(){
    return (<div id="splash">
          <h2>Welcome to CouchTalk</h2>
          <p>Enter the name of a room to join:</p>
          <form onSubmit={this.onSubmit}>
            <input type="text" size={40}
            value={this.state.goRoom}
            onChange={this.handleChange}/>
            <button type="submit">Join</button>
          </form>
          <img src="/splash.jpg"/>
          <RecentRooms/>
        </div>)
  }
})


var Message = React.createClass({
  getInitialState : function(){
    return {showing : 0, previous : 0}
  },
  componentDidMount : function(){
    var audio = $(this.getDOMNode()).find("audio")[0];
    audio.addEventListener('ended', function(){
      this.stopAnimation()
      this.props.playFinished(this.props.message)
    }.bind(this))
    audio.addEventListener('playing', function(){
      this.animateImages()
    }.bind(this))
    var deck = $(this.getDOMNode()).find("img.ondeck")[0];
    deck.addEventListener("load", function(e) {
      // console.log("deck load", this, e)
      $(this).parent().find("img.messImg")[0].src = this.src;
    })
  },
//   shouldComponentUpdate : function(nextProps) {
//     // console.log(nextProps.message)
// warning
//     return ["snap","audio","played","playing","image"].filter(function(k){
//       console.log(k, nextProps.message[k], this.props.message[k])
//       return nextProps.message[k] !== this.props.message[k]
//     }.bind(this)).length !== 0
// // return true;
//   },
  getMax : function(){
    var split = this.props.message.snap.split(":");
    if (split[1]) {
      return parseInt(split[1], 10) || 0;
    } else { return 0}
  },
  getSnapURLs : function(){
    var url = "/snapshot/" + this.props.message.snap.split(":")[0];
    var number =  this.props.message.audio ? this.state.showing : this.getMax();
    var oldURL = url, oldURLNum;
    if (number) {
      oldURLNum = number - 1;
      url += ":" + number
      if (oldURLNum) {
        oldURL += ":" + oldURLNum
      }
    }
    return {
      now : url,
      prev : oldURL
    };
  },
  animateImages : function() {
    var animateHandle = setInterval(function(){
      this.setState({showing : this.state.showing+1})
    }.bind(this), 250)
    this.setState({animateHandle : animateHandle})
  },
  stopAnimation: function(){
    clearInterval(this.state.animateHandle)
    this.setState({showing : 0})
  },
  render : function() {
    // console.log("Render", this.props.message)
    var snapURL, backupURL, snapURLs;
    if (this.props.message.image) {
      snapURLs = this.getSnapURLs();
      backupURL = snapURLs.prev;
      snapURL =  snapURLs.now;
    }
    if (this.props.message.snapdata) {
      snapURL = this.props.message.snapdata;
    }
    var audioURL = "/audio/" + this.props.message.audio;
    var className = "messImg";

    if (!this.props.message.audio) {
      if (!this.props.message.join) {
        className += " noAudio"
      }
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
    return (<li key={this.props.message.keypressId || this.props.message.snap.split(":")[0]}>
        <img className={className} src={backupURL} onClick={this.props.playMe}/>
        <img className="ondeck" src={snapURL}/>
        <audio src={audioURL}/>
      </li>)
  }
})

function reloadError(error) {
  if (navigator.getUserMedia) {
    console.error("reload",error);
    setTimeout(function(){
      document.location = location
    },200)
  } else {
    $("h2").html('CouchTalk requires Firefox or Chrome!')
  }
}

function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0] == variable) {
      return pair[1];
    }
  }
}
