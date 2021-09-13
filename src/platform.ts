import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { OrviboB25PlatformAccessory } from './platformAccessory';
import { Orvibo } from './Orvibo';

export class OrviboB25HomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly orvibo;

  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    console.log('Construct!');

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });

    this.orvibo = new Orvibo({
      ORVIBO_KEY: 'khggd54865SNJHGF',
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  discoverDevices() {
    this.orvibo.on('plugConnected', (data) => {
      this.log.info('Triggering plugConnected:', data);
      const uuid = this.api.hap.uuid.generate(data.uid);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', data.name);
        new OrviboB25PlatformAccessory(this, existingAccessory, this.orvibo);
      } else {
        this.log.info('Adding new accessory:', data);
        const accessory = new this.api.platformAccessory(data.name, uuid);
        accessory.context.device = { uid: data.uid };
        new OrviboB25PlatformAccessory(this, accessory, this.orvibo);
        // { uid: '807d3a1aefee', name: 'unknown' }
        accessory.getService(this.Service.AccessoryInformation)!.setCharacteristic(this.Characteristic.SerialNumber, data.uid);
        accessory.getService(this.Service.AccessoryInformation)!.setCharacteristic(this.Characteristic.Name, data.name);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    });

    this.orvibo.on('plugStateUpdated', (data) => {
      this.log.debug('Triggering plugStateUpdated:', data);
      // {"cmd":42,"serial":2819,"uid":"807d3a1aefee","deviceId":"0","value1":4,"statusType":1,"value2":0,"value3":0,"value4":0}
      const uuid = this.api.hap.uuid.generate(data.uid);
      const acc = this.accessories.find(accessory => accessory.UUID === uuid);
      if (acc) {
        for(const service of acc.services) {
          service.updateCharacteristic(this.Characteristic.PositionState, data.state);
        }
      }
    });

    this.orvibo.on('gotHeartbeat', (data) => {
      //  {"cmd":32,"serial":2822,"uid":"807d3a1aefee","phy_mode":"11n","rssi":-63,"ram":29480}
      this.log.debug('Triggering gotHeartbeat:', data);
    });

    this.orvibo.on('plugDisconnected', (data) => {
      this.log.debug('Triggering plugDisconnected:', data);
      const uuid = this.api.hap.uuid.generate(data.uid);
      const acc = this.accessories.find(accessory => accessory.UUID === uuid);
      if (acc) {
        for(const service of acc.services) {
          service.getCharacteristic(this.Characteristic.PositionState).updateValue(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        }
      }
    });

    this.orvibo.on('plugDisconnectedWithError', (error) => {
      this.log.debug('Triggering plugDisconnectedWithError:', error);
      const uuid = this.api.hap.uuid.generate(error.uid);
      const acc = this.accessories.find(accessory => accessory.UUID === uuid);
      if (acc) {
        for(const service of acc.services) {
          service.getCharacteristic(this.Characteristic.PositionState).updateValue(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        }
      }
    });

    this.orvibo.startServer();
  }
}
