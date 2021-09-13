import { Service, PlatformAccessory } from 'homebridge';
import { Orvibo } from './Orvibo';
import { OrviboB25HomebridgePlatform } from './platform';

export class OrviboB25PlatformAccessory {
  private service: Service;

  constructor(
    private readonly platform: OrviboB25HomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly orvibo: Orvibo,
  ) {
    this.accessory.getService(platform.Service.AccessoryInformation)!
      .setCharacteristic(platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(platform.Characteristic.SerialNumber, 'N/A');

    this.service = this.accessory.getService(platform.Service.WindowCovering) || this.accessory.addService(this.platform.Service.WindowCovering);
    this.service.getCharacteristic(platform.Characteristic.PositionState).onGet(this.handlePositionStateGet.bind(this));
    this.service.getCharacteristic(platform.Characteristic.TargetPosition).onSet(this.handleTargetPositionSet.bind(this));

  }

  handlePositionStateGet() {
    this.platform.log.debug('Triggered GET PositionState');
    return this.platform.Characteristic.PositionState.STOPPED;
  }

  handleTargetPositionSet(value) {
    // {"uid":"807d3a1aefee","order": "close", "value1": 100}
    // {"uid":"807d3a1aefee","order": "open", "value1": 0}
    // {"uid":"807d3a1aefee","order": "stop", "value1": 100}
    this.platform.log.info('Triggered GET handleTargetPositionSet', value, this.accessory.context.device);
    this.orvibo.sendOrder(this.accessory.context.device.uid, 'open', { value1: 100 - value });
  }
}
