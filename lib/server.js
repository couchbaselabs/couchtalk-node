var express = require('express'),
  path = require("path"),
  fs = require("fs"),
  couchbase = require('couchbase'),
  build = path.join(__dirname, '..', 'build'),
  index = path.join(build, "index.html"),
  app = express(),
  server = require('http').createServer(app),
  io = require('socket.io').listen(server),
  EventEmitter = require("events").EventEmitter

var ee = new EventEmitter();

try {
  var config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), "utf8"));
} catch (e) {
  console.error(e)
  console.error("error loading config, using defaults")
  config = {bucket : "talk"}
}

var portNum = 3000

console.log("connecting with config", config)
var db = new couchbase.Connection(config, function(err) {
  if (err) throw err;
  console.log("connected")

  app.get('/talk/:id', function(req, res){
    res.status(200).sendfile(index)
  });

  app.get("/snapshot/:id", function(req, res) {
    console.log("get snap", req.params.id)
    db.get(req.params.id, function(err, doc) {
      if (err) {
        res.status(404)
        res.json({error : "not_found"})
      } else {
        res.set('Content-Type', 'image/jpeg');
        res.send(new Buffer(doc.value.snapshot, "base64"))
      }
    })
  })

  app.get("/audio/:id", function(req, res) {
    console.log("get audio", req.params.id)
    db.get(req.params.id, function(err, doc) {
      if (err) {
        res.status(404)
        res.json({error : "not_found"})
      } else {
        res.set('Content-Type', 'audio/wav');
        res.send(new Buffer(doc.value.audio, "base64"))
      }
    })
  })

  app.post('/snapshot/:room_id/:snapshot_id/:keypress_id', function(req, res){
    console.log("post snap", req.params)
    var data = "";

    req.on('data', function(chunk) {
       data += chunk.toString();
    });

    req.on('end', function() {
      var doc = {
          snapshot : data,
          room : req.params.room_id,
          contentType : req.headers['content-type'],
          created : new Date()
        };

      db.add(req.params.snapshot_id, doc, function(err, result) {
        if (err) {
          res.status(500)
          res.json({error : "no_update"})
        } else {
          console.log("saved snap", req.params)
          ee.emit("room-"+doc.room, {
            snap:req.params.snapshot_id,
            keypressId:req.params.keypress_id,
            image : "true"
          })
          res.json({ok:true})
        }
      });
    })
  });

  app.post('/audio/:room_id/:snapshot_id', function(req, res){
    console.log("post audio", req.params)
    var data = "";
    req.on('data', function(chunk) {
       data += chunk.toString();
    });

    req.on('end', function() {
      var id = req.params.snapshot_id + "-audio",
        doc = {
          snapshot : req.params.snapshot_id,
          room : req.params.room_id,
          audio : data,
          created : new Date()
        }
      console.log("audio id", id)
      db.add(id, doc, function(err, result) {
        if (err) {
          console.error(err)
          res.status(403)
          res.json({error : "no_update"})
        } else {
          ee.emit("room-"+doc.room, {
            snap: req.params.snapshot_id,
            audio: id})
          res.json({ok:true, id : id})
        }
      });
    })
  });

  function getSnapshotId(room, cb) {
    db.incr("ct-"+room, {initial: 0}, function(err, result){
      cb(err, ["snap",room,result.value].join('-'))
    })
  }

  io.sockets.on('connection', function (socket) {
    socket.on('join', function (data) {
      console.log("join",data.room);
      ee.on("room-"+data.room, function(incoming) {
        console.log("ee emitted",incoming);
        socket.emit("message", incoming)
      })
      getSnapshotId(data.room, function(err, id){
        data.snap = id;
        console.log("snap id", data)
        // socket.emit("snap-id",data)
        ee.emit("room-"+data.room, data)
      })
    });
    // we need the session id to be part of the message
    socket.on('new-snap', function (data) {
      getSnapshotId(data.room, function(err, id){
        data.snap = id;
        socket.emit("snap-id",data)
      })
    })
  });

  app.enable('trust proxy')
  app.use(express.static(build))

  console.log("listening on port", portNum)
  server.listen(portNum);
});

