var udp = require('dgram');

var DNS_SERVER = '8.8.8.8';

var id2addr = {};

var sender = udp.createSocket('udp4'),
    server = udp.createSocket('udp4');

sender.on('message', function (mesg, info) {
  if (info.address !== DNS_SERVER && info.port !== 53) { // 
    return;
  }

  var id = mesg.readUInt16BE(0),
      addr = id2addr[id];

  if (addr === undefined) {
    console.log('Error: ----- invalid response id ------');
    return;
  }

  var domain, ip, ttl, mesglen = mesg.length;

  // if (domain = addr['domain']) {
  //   ip = ip2str(mesg.slice(mesglen - 4));
  //   ttl = mesg.readUInt32BE(mesglen - 10);
  //   console.log(domain + ', ip: ' + ip + ', ttl: ' + ttl + 's');
  // }
  console.log('----- forwarding: ' + addr['domain'] + ' to ' + ip2str(mesg.slice(mesglen - 4)) + ' ------');
  server.send(mesg, 0, mesg.length, addr.port, addr.ip);

  delete id2addr[id];
});

server.on('message', function (mesg, info) {

  var mesglen = mesg.length,
      id = mesg.readUInt16BE(0),
      flag = mesg.readUInt16BE(2);
      domain = domain2str(mesg.slice(12, -4)),
      type = mesg.readUInt16BE(mesglen-4),   // 1 means A query
      ip = info.address;

  if (checkDomain(domain)) {

    console.log('****** hijacking:' + ip + ', ' + domain + ' to ' + local_ip + ' ******');

    var bufRes = new Buffer(mesglen + 16);
    mesg.copy(bufRes);

    buf_answer.copy(bufRes, mesglen);
    bufRes.writeUInt16BE(0x8180, 2);
    bufRes.writeUInt16BE(0x0001, 6);

    server.send(bufRes, 0, bufRes.length, info.port, info.address);

    return;
  }

  id2addr[id] = {
    ip: ip,
    port: info.port
  };

  if (flag === 256 &&  type === 1) { // standard A(ipv4) query which we are interested
    id2addr[id]['domain'] = domain;
  }



  sender.send(mesg, 0, mesglen, 53, DNS_SERVER);

});

var domainRegExp;
function checkDomain (domain) {
  return domainRegExp.test(domain);
}

function domain2str(buf) {
  return buf.toString('utf8', 1, buf.length - 1). //regard length byte as char, 
    replace(/[\u0000-\u0020]/g, '.'); // then transfor it to '.'
}
function ip2str(buf) {
  var str = '';
  for (var i = 0, j = buf.length; i < j; i++) {
    str += buf[i] + '.';
  }
  return str.slice(0, -1);
}

function getIp () {
  var ifs = require('os').networkInterfaces(),
      i, ad, cfg;

  for (i in ifs) {
    ad = ifs[i];
    for (var j = 0; j < ad.length; j++ ) {
      cfg = ad[j];
      if (!cfg.internal && cfg.family === 'IPv4') {
        return cfg.address;
      }
    }
  }
  return '0.0.0.0';
}

var local_ip = getIp();
var buf_ip = new Buffer(local_ip.split('.'));

var buf_answer = new Buffer([
  0xC0, 0x0C, // domain ptr
  0x00, 0x01, // type
  0x00, 0x01, // class
  0x00, 0x00, 0x00, 0x10, // ttl
  0x00, 0x04, // length
  0x00, 0x00, 0x00, 0x00 // ip address
]);
buf_ip.copy(buf_answer, 12);

exports.start = function (dns_server, rDomains) {
  DNS_SERVER = dns_server;
  domainRegExp = new RegExp(rDomains);
  
  server.bind(53, function () {
    console.log('Dns server has started.');
  });
};
exports.stop = function () {
  server.close(function () {
    console.log('Dns server has stoped.');
  });
};

