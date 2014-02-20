// Apache 2.0 License http://www.apache.org/licenses/LICENSE-2.0.html
// Copywrite 2014 Couchbase, Inc.

module.exports = {
  listen : function(emitter, event, handler) {
    // console.log("listen", event)
    var mixinStateKeyForEvent = "_EventListenerMixinState:"+event;
    var sub = this.state[mixinStateKeyForEvent] || {};
    if (sub.event && sub.emitter) {
      if (sub.event == event && sub.emitter === emitter) {
        // we are already listening, noop
        // console.log("EventListenerMixin alreadyListening", sub.event, this)
        return;
      } else {
        // unsubscribe from the existing one
        // console.log("EventListenerMixin removeListener", sub.event, this)
        sub.emitter.removeListener(sub.event, sub.handler)
      }
    }
    var mixinState = {
      emitter : emitter,
      event : event,
      handler : handler
    }
    // console.log("EventListenerMixin addListener", event, this, mixinState)
    var stateToMerge = {};
    stateToMerge[mixinStateKeyForEvent] = mixinState;
    this.setState(stateToMerge);
    emitter.on(event, handler)
  },
  componentWillUnmount : function() {
    // console.log("componentWillUnmount", JSON.stringify(this.state))
    for (var eventKey in this.state) {
      var ekps = eventKey.split(":")
      if (ekps[0] == "_EventListenerMixinState") {
        var sub = this.state[eventKey]
        var emitter = sub.emitter
        // console.log("EventListenerMixin Unmount removeListener", eventKey, sub, this)
        emitter.removeListener(sub.event, sub.handler)
      }
    }
  },
}
