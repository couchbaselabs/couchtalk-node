/* global $ */
var App = require("../jsx/app.jsx");

$(function () {
  var match = /\/talk\/(.*)/.exec(location.pathname);
  if (match) {
    React.renderComponent(
      App({id : match[1]}),
      document.getElementById('container')
    );
  } else {
    $("form input[type=text]").val(Math.random().toString(26).substr(2))
    $("form").on("submit", function(e){
      e.preventDefault();
      var room = $("form input[type=text]").val();
      document.location = "/talk/" + room;
    })
  }
})
