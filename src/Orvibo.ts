/* eslint-disable @typescript-eslint/no-var-requires */

import { createServer, Socket, Server } from 'net';
import { Packet } from './OrviboPacket';
import { EventEmitter } from 'events';

const PacketBuilder = require('./PacketBuilder');
const Utils = require('./Utils');

const HEARTBEAT = 32;
const HELLO = 0;
const HANDSHAKE = 6;
const STATE_UPDATE = 42;
const STATE_UPDATE_CONFIRM = 15;
const UNKNOWN_CMD = 'UNKNOWN_CMD';

export type SocketData = {
    name: string;
    state: string;
    uid: string;
    modelId: string;
    encryptionKey?: string;
    clientSessionId?: string;
    deviceId?: string;
};

export type ServerSocket = Socket & { id: string; name: string };

export class Orvibo extends EventEmitter {
    private readonly port = 10001;
    private readonly bindHost = '0.0.0.0';

    private readonly ORVIBO_KEY: string = '';
    private readonly LOG_PACKET: boolean = false;

    private logger = console;
    private server?: Server;

    constructor(userSettings: { ORVIBO_KEY?: string; LOG_PACKET?: boolean } = {}) {
      super();
      this.ORVIBO_KEY = userSettings.ORVIBO_KEY || this.ORVIBO_KEY;
      this.LOG_PACKET = userSettings.LOG_PACKET || this.LOG_PACKET;

      if (this.ORVIBO_KEY === '') {
        this.logger.log('Please pass Orvibo PK key details via the constructor or add to OrviboSettings.js file. See Readme');
        process.exit(1);
      }
    }

    private plugConnections: ServerSocket[] = [];
    private packetData: Map<string, SocketData> = new Map<string, SocketData>();

    private getData(id): SocketData {
      return this.packetData[id];
    }

    private setData(id: string, data: SocketData) {
      this.packetData[id] = data;
    }

    private respondAndSetData(data, socket, packetFunction) {
      this.setData(socket.id, data);
      socket.write(packetFunction(data));
    }

    private helloHandler(plugPacket, socket) {
      const pkData = {
        serial: plugPacket.getSerial(),
        encryptionKey: Utils.generateRandomTextValue(16),
        id: Utils.generateRandomHexValue(32),
        modelId: plugPacket.getModelId(),
        orviboKey: plugPacket.getOrviboKey(),
      };
      this.respondAndSetData(pkData, socket, PacketBuilder.helloPacket);
    }

    private handshakeHandler(plugPacket, socket: ServerSocket, socketData: SocketData) {
      const uid = plugPacket.getUid();
      const pkData = Object.assign({}, socketData, {
        serial: plugPacket.getSerial(),
        uid,
        name: 'unknown',
      });
      this.respondAndSetData(pkData, socket, PacketBuilder.handshakePacket);
      this.logger.log(`Connected ${pkData.uid} name = ${pkData.name}`);
      this.emit('plugConnected', {uid:pkData.uid, name: pkData.name});
    }

    private heartbeatHandler(plugPacket, socket: ServerSocket, socketData: SocketData) {
      const pkData = Object.assign({}, socketData, {
        serial: plugPacket.getSerial(),
        uid: plugPacket.getUid(),
      });
      this.respondAndSetData(pkData, socket, PacketBuilder.heartbeatPacket);
      // this.logger.log(`Plug ${pkData.name} ${pkData.uid} sent heartbeat`);
      this.emit('gotHeartbeat', {uid:pkData.uid, name: pkData.name});
    }

    stateUpdateHandler(plugPacket, socket: ServerSocket, socketData: SocketData) {
      const pkData = Object.assign({}, socketData, {
        serial: plugPacket.getSerial(),
        uid: plugPacket.getUid(),
        state: plugPacket.getValue1(),
      });
      this.respondAndSetData(pkData, socket, PacketBuilder.comfirmStatePacket);
      this.logger.log(`Plug ${pkData.name} ${pkData.uid} updated state ${pkData.state}`);
      this.emit('plugStateUpdated', {uid:pkData.uid, state: pkData.state, name: pkData.name});
    }

    stateConfirmHandler() {
      // Do nothing at this stage
    }

    unknownCmdHandler(plugPacket, socket: ServerSocket, socketData: SocketData) {
      const pkData = Object.assign({}, socketData, {
        serial: plugPacket.getSerial(),
        uid: plugPacket.getUid(),
      });
      this.respondAndSetData(pkData, socket, PacketBuilder.defaultPacket);
    }

    handlers() {
      return {
        [HELLO]: this.helloHandler.bind(this),
        [HANDSHAKE]: this.handshakeHandler.bind(this),
        [HEARTBEAT]: this.heartbeatHandler.bind(this),
        [STATE_UPDATE]: this.stateUpdateHandler.bind(this),
        [STATE_UPDATE_CONFIRM] : this.stateConfirmHandler,
        [UNKNOWN_CMD]: this.unknownCmdHandler.bind(this),
      };
    }

    startServer() {
      const handlers = this.handlers();

      this.logger.log(`Starting server Orvibo socket server on port ${this.port}`);

      this.server = createServer((sock) => {
        const socket: ServerSocket = Object.assign(sock, { id: Utils.generateRandomTextValue(16), name: 'unknown' });

        socket.setKeepAlive(true, 10000);
        this.plugConnections.push(socket);

        socket.on('data', (data) => {

          const socketData = this.getData(socket.id);
          const plugPacket = new Packet(data);

          if (!plugPacket.validCRC()) {
            this.logger.log('Got invalid CRC');
            return;
          }

          try {
            if (plugPacket.packetTypeText() === 'pk') {
              plugPacket.processPacket(this.ORVIBO_KEY);
            } else {
              plugPacket.processPacket(socketData.encryptionKey);
            }
          } catch(err) {
            this.logger.log('Failed to parse packet: ' + err);
            return;
          }

          this.LOG_PACKET && plugPacket.logPacket('Socket -> ');

          const handler = handlers[plugPacket.getCommand()];
          if (handler !== null) {
            handler(plugPacket, socket, socketData);
          } else {
            handlers[UNKNOWN_CMD](plugPacket, socket, socketData);
          }
        });

        socket.on('end', () => {
          const pkData = this.getData(socket.id);
          if (pkData) {
            this.logger.log(`Plug ${pkData.uid} - ${pkData.name} disconnected`);
          }
          this.emit('plugDisconnected', {uid: pkData.uid, name: pkData.name});
          this.plugConnections.splice(this.plugConnections.indexOf(socket), 1);
        });

        socket.on('error', (err) => {
          this.logger.log(err);
          this.logger.log(`Plug ${socket.id} - ${socket.name} disconnected with error`);
          this.emit('plugDisconnectedWithError', this.getData(socket.id));
          this.plugConnections.splice(this.plugConnections.indexOf(socket), 1);
        });

      });

      this.server.listen(this.port, this.bindHost);
    }

    sendOrder(uid, order, options) {
      let socketId: string | null = null;

      for (const key of Object.keys(this.packetData)) {
        if (this.packetData[key].uid === uid) {
          socketId = key;
          break;
        }
      }
      if (socketId === null) {
        this.logger.log('Could not find socket ' + uid);
        return;
      }
      const socket = this.plugConnections.find(s => s.id === socketId);
      if (socket) {
        const socketData = this.getData(socketId);
        const data = Object.assign({}, socketData, {
          order,
          serial: Utils.generateRandomNumber(8),
          clientSessionId:  socketData.clientSessionId ? socketData.clientSessionId : Utils.generateRandomHexValue(32),
          deviceId: socketData.deviceId ? socketData.deviceId : Utils.generateRandomHexValue(32),
          value1: options.value1,
          value2: options.value2,
          value3: options.value3,
          value4: options.value4,
        });
        this.logger.log('send!', socketId, data);
        this.setData(socket.id, data);

        const packet = PacketBuilder.updatePacket(data);
        socket.write(packet);
      } else {
        this.logger.log('Can not find socket', socketId, this.plugConnections);
      }
    }

    getConnectedSockets() {
      const sockets: SocketData[] = [];
      for (const key of Object.keys(this.packetData)) {
        const socketData = this.getData(key);
        sockets.push({
          name: socketData.name,
          state: socketData.state,
          uid: socketData.uid,
          modelId: socketData.modelId,
        });
      }
      return sockets;
    }

    setLogger(newLogger) {
      this.logger = newLogger;
    }
}
