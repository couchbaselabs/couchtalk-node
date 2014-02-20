/** @jsx React.DOM */

exports.brClear = React.createClass({
  shouldComponentUpdate : function() {
    return false;
  },
  render : function() {
    return <br className="clear"/>
  }
})

exports.EventListenerMixin = require("../js/eventListener.js")
exports.StateForPropsMixin = {
  componentWillReceiveProps: function(newProps) {
    // console.log("StateForPropsMixin componentWillReceiveProps", newProps, this.props)
    this.setStateForProps(newProps, this.props)
  },
  componentWillMount: function() {
    // console.log("StateForPropsMixin componentWillMount", this.props)
    this.setStateForProps(this.props)
  }
};
