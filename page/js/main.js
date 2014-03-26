/* global $ */
var CouchTalk = require("../jsx/app.jsx");

$(function () {
  var match = /\/talk\/(.*)/.exec(location.pathname);
  if (match) {
    React.renderComponent(
      CouchTalk.App({id : match[1]}),
      document.getElementById('container')
    );
  } else {
    React.renderComponent(CouchTalk.Index({}),
      document.getElementById("container"))
  }
})
