/* global $ */
var App = require("../jsx/app.jsx");

$(function () {
  React.renderComponent(
    App(),
    document.getElementById('container')
  );
})
