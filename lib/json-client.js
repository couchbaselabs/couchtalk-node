var requestLib = require("request"),
  request = requestLib.defaults({
  json:true
}, function(uri, options, callback){
  var params = requestLib.initParams(uri, options, callback);
  // console.log("req", params.options)
  return requestLib(params.uri, params.options, function(err, res, body){
    // console.log("requestLib", err, res.statusCode, params.uri)
    // treat bad status codes as errors
    if (!err && res.statusCode >= 400) {
      params.callback.apply(this, [res.statusCode, res, body]);
    } else {
      params.callback.apply(this, arguments);
    }
  })
});

module.exports = request;
