var u = require('util'),
    Transform = require('stream').Transform;

u.inherits(Trans, Transform);

function Trans () {
  Transform.call(this);
  this._bytes = 0;
}
Trans.prototype._transform= function (chunk, encoding, done) {

  var bytes = this._bytes, len = chunk.length;

  if (bytes > 0) {
    this._bytes = bytes - len;
  } else {
    var endIndex = this._getEndIndex(chunk),
        clen = this._parseHeader(chunk.slice(0, endIndex));

    this._bytes = clen - (len - endIndex);
  }

  this.push(chunk);
  done();
};
Trans.prototype._getEndIndex = function (buf) {

  var end = [13, 10, 13, 10], cur = 0; expect = 4;
  for (var i = 0, j = buf.length; i < j; i++) {

    if (buf[i] === end[cur++]) {
      if (cur === expect) return i+1;
    } else {
      cur = 0;
    }
  }

  return -1;
};
Trans.prototype._rHeader = /^([^:]+): *(.+)$/;
Trans.prototype._parseHeader = function (buf) {
  var o = {},
      headers = buf.toString().slice(0, -4).split('\r\n'),
      line = headers.shift().split(' '),
      protocol = line[2].split('/');
  o['method'] = line[0].toUpperCase();
  o['path'] = line[1];
  o['protocol'] = protocol[0].toUpperCase();
  o['version'] = protocol[1];
  o['headers'] = {};

  var r = this._rHeader, m, header = o['headers'];
  for (var i = 0, j = headers.length; i < j; i++) {
    m = headers[i].match(r);
    if (m) {
      header[m[1].toLowerCase()] = m[2];
    }
  }

  var ohost = this._parseHost(o['headers']['host']);
  o['hostname'] = ohost['host'];
  o['port'] = ohost['port'];

  this.emit('header', o);

  var clen = parseInt(o['headers']['content-length']);

  return clen ? clen : 0;

};
Trans.prototype._parseHost = function (host) {
  var o = { host: host, port: 80 },
      r = /^([^:]+):(\d+)$/, m;
  if (m = host.match(r)) {
    o['host'] = m[1];
    o['port'] = parseInt(m[2]);
  }
  return o;
}

exports.HijackFlow = Trans;