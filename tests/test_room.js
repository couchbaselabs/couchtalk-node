/*jxshint unused:true */

// this test is a stub
var room = require("../lib/room"),
  test = require("tape").test;

test("create a room with id", function(t) {
  t.ok(room, "room required")
  var myRoom = room("mine");

  t.test("create a message", function(t) {
    var newPhoto = "myFace";
    var id1 = myRoom.createMessage(newPhoto)

    t.test("create another message", function(t) {
      var yourPhoto = "yourFace";
      var id2 = myRoom.createMessage(yourPhoto)
      // t.notEqual(id1, id2)

      t.test("room lists them in order", function(){
        var messages = myRoom.recentMessages()
        t.end()
      })
      t.end()
    })
    t.end()
  })
  t.end()
})
