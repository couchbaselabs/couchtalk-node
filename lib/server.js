var express = require('express'),
  path = require("path"),
  app = express();

var build = path.join(__dirname, '..', 'build'),
  index = path.join(build, "index.html")

app.get('/talk/:id', function(req, res){
  res.status(200).sendfile(index)
});

app.use(express.static(build))

app.listen(3000);
