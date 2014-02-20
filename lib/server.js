var express = require('express'),
  path = require("path"),
  app = express();

app.get('/h', function(req, res){
  res.send('hello world');
});

app.use(express.static(path.join(__dirname, '..', 'build')))

app.listen(3000);


