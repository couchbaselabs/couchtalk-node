/**
 * @jsx React.DOM
 */
 /* global Davis */
 /* global Zepto */

var helpers = require("./helpers.jsx"),
  IndexPage = require("./index.jsx"),
  RoomPage = require("./room.jsx");

Davis.$ = Zepto;

module.exports = React.createClass({
  componentWillMount: function() {
    var component = this;
    var router = Davis(function(){
      this.settings.generateRequestOnPageLoad = true;
      this.settings.handleRouteNotFound = true;

      // global handlers
      // this.bind("routeNotFound", routeNotFound)
      // this.bind("lookupRoute", lookupRoute)

      this.get('/', function(){
        component.setState({page : "index"})
      })
      this.get('/talk/:id', function(req){
        component.setState({page : "room", params : req.params})
      })
    })
    this.setState({router : router})
  },
  componentWillUnmount: function() {
    this.state.router.stop()
  },
  render : function() {
    var guts;
    if (this.state.page == "index") {
      guts = <IndexPage/>
    } else if (this.state.page == "room") {
      guts = <RoomPage id={this.state.params.id}/>
    }
    return (
        <div className="content">
          {guts}
        </div>
      );
  }
});

/*  404 handlers
    If the 404 is in-app, redirect to the index page.
    Otherwise make a server request for the new page.
*/
function routeNotFound(r) {
  // setTimeout(function(){ // required sleep
  //   window.location = "/"
  // },100)
}
function lookupRoute(req) {
  // if (req.path.indexOf("/_admin") !== 0) {
  //   window.location = req.path;
  //   req.delegateToServer()
  // }
}
