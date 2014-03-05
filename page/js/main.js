/* global $ */
var App = require("../jsx/app.jsx");

$(function () {
  var match = /\/talk\/(.*)/.exec(location.pathname);
  if (match) {
    React.renderComponent(
      App(),
      document.getElementById('container')
    );
  }
})
