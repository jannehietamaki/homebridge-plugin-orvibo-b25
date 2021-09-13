const crc32 = require('buffer-crc32');
const crypto = require('crypto');

export class Packet {
    private payloadJSON: any;
    private magic: string;
    private packetLength: string;
    private packetType: string;
    private crc32: string;
    private packetId: string;
    private payload: string;
    private orviboKey?: string;

    constructor(packetBuffer) {
      this.magic = packetBuffer.slice(0, 2);
      this.packetLength = packetBuffer.slice(2, 4);
      this.packetType = packetBuffer.slice(4, 6);
      this.crc32 = packetBuffer.slice(6, 10);
      this.packetId = packetBuffer.slice(10, 42);
      this.payload = packetBuffer.slice(42, packetBuffer.length);
    }

    logPacket(type) {
      console.log(type, JSON.stringify(this.payloadJSON));
    }

    getCommand() {
      return this.payloadJSON.cmd;
    }

    getSerial() {
      return this.payloadJSON.serial;
    }

    getUid() {
      return this.payloadJSON.uid;
    }

    getValue1() {
      return this.payloadJSON.value1;
    }

    getModelId() {
      return this.payloadJSON.modelId;
    }

    processPacket(key) {
      this.payloadJSON = this.decodeJSON(key);
      this.orviboKey = key;
    }

    getOrviboKey() {
      return this.orviboKey;
    }

    validCRC() {
      return crc32(this.payload).toString() === this.crc32.toString();
    }

    packetTypeText() {
      return this.packetType.toString();
    }

    decodeJSON(key) {
      const decipher = crypto.createDecipheriv('aes-128-ecb', key, '');
      decipher.setAutoPadding(true);
      let decrypted = decipher.update(this.payload.toString(), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      // Sometimes there are bad chars on the end of the JSON so check here
      decrypted = decrypted.substring(0, decrypted.indexOf('}') + 1);
      return JSON.parse(decrypted);
    }
}