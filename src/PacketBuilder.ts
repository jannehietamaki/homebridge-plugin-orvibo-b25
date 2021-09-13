import crc32 from 'buffer-crc32';
import crypto from 'crypto';

const Packet = {
  packetType: Buffer,
  id: '',
  json: {},
  encryptionKey: '',
  magic: new Buffer('6864', 'hex'),
  build: function () {
    const packetId = new Buffer(this.id, 'ascii');
    const payload = encodePayload(JSON.stringify(this.json), this.encryptionKey);
    const crc = crc32(payload);
    const length = getLength([this.magic, this.packetType, packetId, crc, payload], 2); // Extra 2 for the length field itself
    return Buffer.concat([this.magic, length, this.packetType, crc, packetId, payload]);
  },
};

const PKPacket = Object.assign({}, Packet, {
  packetType: new Buffer('pk', 'ascii'),
});

const DKPacket = Object.assign({}, Packet, {
  packetType: new Buffer('dk', 'ascii'),
});

const helloPacket = function({ serial, encryptionKey, id, orviboKey }) {
  const json = {
    cmd: 0,
    status: 0,
    serial: serial,
    key: encryptionKey,
  };

  const pkt = Object.assign(Object.create(PKPacket), {
    json: json,
    id: id,
    encryptionKey: orviboKey,
  });

  return pkt.build();
};

const handshakePacket = function({ serial, encryptionKey, id }) {

  const json = {
    cmd: 6,
    status:0,
    serial: serial,
  };

  const pkt = Object.assign(Object.create(DKPacket), {
    json: json,
    id: id,
    encryptionKey: encryptionKey,
  });

  return pkt.build();
};

const heartbeatPacket = function({serial, uid, encryptionKey, id}) {
  const json = {
    cmd: 32,
    status:0,
    serial: serial,
    uid: uid,
    utc: new Date().getTime(),
  };

  const pkt = Object.assign(Object.create(DKPacket), {
    json: json,
    id: id,
    encryptionKey,
  });

  return pkt.build();
};

const comfirmStatePacket = function({serial, uid, state, encryptionKey, id}) {

  const json = {
    uid: uid,
    cmd: 42,
    statusType: 0,
    value3: 0,
    alarmType: 1,
    serial: serial,
    value4: 0,
    deviceId: 0,
    value1: state,
    value2: 0,
    updateTimeSec: new Date().getTime(),
    status: 0,
  };

  const pkt = Object.assign(Object.create(DKPacket), {
    json: json,
    id: id,
    encryptionKey,
  });

  return pkt.build();
};

const defaultPacket = function({serial, uid, cmd, id, encryptionKey}) {

  const json = {
    uid: uid,
    cmd: cmd,
    serial: serial,
    status: 0,
  };

  const pkt = Object.assign(Object.create(DKPacket), {
    json: json,
    id: id,
    encryptionKey,
  });

  return pkt.build();
};


const updatePacket = function({ uid, order, serial, id, clientSessionId, deviceId, encryptionKey, value1, value2, value3, value4}) {
  const json = {
    uid: uid,
    delayTime: 0,
    cmd: 15,
    order,
    userName: 'iloveorvibo@orvibo.com',
    ver: '3.0.0',
    value3: value3 || 0,
    serial: serial,
    value4: value4 || 0,
    deviceId: deviceId,
    value1: value1 || 0,
    value2: value2 || 0,
    clientSessionId: clientSessionId,
  };

  const pkt = Object.assign(Object.create(DKPacket), {
    json: json,
    id: id,
    encryptionKey,
  });

  return pkt.build();
};


const encodePayload = function(json, key) {
  const cipher = crypto.createCipheriv('aes-128-ecb', key, '');
  cipher.setAutoPadding(true);
  let crypted = cipher.update(json, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return new Buffer(crypted, 'hex');
};

const getLength = function(items, extra) {
  let length = extra || 0;
  for (let i = 0; i < items.length; i++) {
    length += items[i].length;
  }
  return getHexLengthPadded(length);
};

const getHexLengthPadded = function(lengthDecimal) {
  const lengthHex = lengthDecimal.toString(16);
  const paddingLength = 4 - lengthHex.length;
  let padding = '';
  for (let i = 0; i < paddingLength; i++) {
    padding +=0;
  }
  return new Buffer(padding + lengthHex, 'hex');
};


module.exports.helloPacket = helloPacket;
module.exports.handshakePacket = handshakePacket;
module.exports.heartbeatPacket = heartbeatPacket;
module.exports.comfirmStatePacket = comfirmStatePacket;
module.exports.defaultPacket = defaultPacket;
module.exports.updatePacket = updatePacket;