var express = require('express'),
  path = require("path"),
  uuid = require("uuid"),
  couchbase = require('couchbase'),
  build = path.join(__dirname, '..', 'build'),
  index = path.join(build, "index.html"),
  app = express(),
  server = require('http').createServer(app),
  io = require('socket.io').listen(server),
  EventEmitter = require("events").EventEmitter

var ee = new EventEmitter();

var db = new couchbase.Connection({bucket: "couchtalk"}, function(err) {
  if (err) throw err;

  function getSnapshotId(room, cb) {
    db.incr("ct-"+room, {initial: 0}, function(err, result){
      cb(err, ["snap",room,result.value].join('-'))
    })
  }

  app.get('/talk/:id', function(req, res){
    res.status(200).sendfile(index)
  });

  app.get("/snapshot/:id", function(req, res) {
    console.log(req.params)
    db.get(req.params.id, function(err, doc) {
      if (err) {
        res.status(404)
        res.json({error : "not_found"})
      } else {
        res.set('Content-Type', 'image/png');
        res.send(new Buffer(doc.value.snapshot, "base64"))
      }
    })
  })

  app.get("/audio/:id", function(req, res) {
    console.log(req.params)
    db.get(req.params.id, function(err, doc) {
      if (err) return console.error(err);
      res.set('Content-Type', 'audio/wav');
      res.send(new Buffer(doc.value.audio, "base64"))
    })
  })

  app.post('/snapshot/:room_id', function(req, res){
    console.log()
    var data = "";
    req.on('data', function(chunk) {
       data += chunk.toString();
    });

    req.on('end', function() {
      getSnapshotId(req.params.room_id, function(err, id){
        if (err) throw(err);
        var doc = {
            room : req.params.room_id,
            snapshot : data,
            // contentType : req.headers['content-type'],
            created : new Date()
          };
        // console.log("snap", doc)
        db.set(id, doc, function(err, result) {
          if (err) return console.error(err);
          res.json({ok:true, id : id})
          ee.emit("room-"+doc.room, {snap:id})
        });
      })
    })
  });

  app.post('/audio/:snapshot_id', function(req, res){
    console.log(req.params)
    var data = "";
    req.on('data', function(chunk) {
       data += chunk.toString();
    });

    req.on('end', function() {
      var id = req.params.snapshot_id + "-audio",
        doc = {
          snapshot : req.params.snapshot_id,
          audio : data,
          created : new Date()
        }
      console.log("audio", id)
      db.get(req.params.snapshot_id, function(err, snap){
        if (err) return console.error(err);
        // console.log("audio-snap", snap)
        doc.room = snap.value.room;
        // console.log("audio-doc", doc);
        db.add(id, doc, function(err, result) {
          if (err) return console.error(err)
          ee.emit("room-"+doc.room, {snap: req.params.snapshot_id, audio: id})
          res.json({ok:true, id : id})
        });
      })
    })
  });

  io.sockets.on('connection', function (socket) {
    socket.on('join', function (data) {
      console.log("join",data.id);
      ee.on("room-"+data.id, function(incoming) {
        console.log("incoming",incoming);
        socket.emit("message", incoming)
      })
      ee.emit("room-"+data.id, {join:data.id})
      // The client sends messages via http POST
      // socket.on('message', function(outgoing){
      //   console.log("outgoing",outgoing);
      //   ee.emit("room-"+data.id, outgoing)
      // })
    });
  });

  app.use(express.static(build))

  server.listen(3000);
});

