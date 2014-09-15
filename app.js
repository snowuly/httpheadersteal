var conf = require('./conf.json');

require('./dnsproxy.js').start(conf.DNS.SERVER, conf.DNS.HIJACK_TARGET);
require('./httpproxy.js').start(conf.DATA_RECV_URL, conf.HEADER_FIELDS);