/** @jsx React.DOM */

var helpers = require("./helpers.jsx");

module.exports = React.createClass({
  render : function() {
    return (
      <p>Welcome to CouchTalk, you are in room {this.props.id}</p>
      );
  }
})
