require('http').createServer(function (req, res) {
  console.log(req.url);
  res.writeHeader(200)
  res.end('ok');
}).listen('8080');