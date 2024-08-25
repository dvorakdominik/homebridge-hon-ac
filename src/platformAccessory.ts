import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { ExampleHomebridgePlatform } from './platform.js';

import { ChildProcessWithoutNullStreams } from 'child_process';

export class ExamplePlatformAccessory {
  private service: Service;
  private sendMessage: (message: string, withWaitingForUpdate: boolean) => void;
  private waitingForCommand: boolean = false;

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    private pyhOn: ChildProcessWithoutNullStreams | null
  ) {
    // set accessory information

    const processFunction = (stdout: any) => {
      const data = stdout.toString();
      const json = JSON.parse(data);

      if (json.unique_id === this.accessory.context.device.unique_id) {
        if (this.waitingForCommand === true && json.message && json.message == 'command_send') {
          this.waitingForCommand = false;
        }

        if (this.waitingForCommand === true) return;

        if (json.onOffStatus) {
          let state = this.platform.Characteristic.TargetHeatingCoolingState.OFF;
          if (json.onOffStatus == '1') {
            state = this.platform.Characteristic.TargetHeatingCoolingState.COOL;
          }

          this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, state);
        }

        if (json.tempIndoor) {
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, Number(json.tempIndoor));
        }

        if (json.tempSel) {
          this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, Number(json.tempSel));
        }
      }
    };

    this.sendMessage = (message: string, withWaitingForUpdate: boolean) => {
      if (withWaitingForUpdate) this.waitingForCommand = true;
      if (this.pyhOn) this.pyhOn.stdin.write(`${message}\n`);
    };

    if (this.pyhOn) {
      this.pyhOn.stdout.on('data', processFunction);
    }

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    this.service =
      this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    this.service.setCharacteristic(this.platform.Characteristic.TargetTemperature, 20);

    // initial info command
    this.sendMessage(`${this.accessory.context.device.unique_id} info`, false);
    setInterval(() => this.sendMessage(`${this.accessory.context.device.unique_id} info`, false), 1000);

    // Thermostat:
    // - CurrentHeatingCoolingState - get
    // - TargetHeatingCoolingState - get, set
    // - CurrentTemperature - get
    // - TargetTemperature - get, set
    // - TemperatureDisplayUnits - get, set

    // TargetHeatingCoolingState
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onSet(this.debounce(this.setTargetHeatingCoolingState.bind(this)));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        minStep: 1,
        minValue: 16,
        maxValue: 30,
      })
      .onSet(this.debounce(this.setTargetTemperature.bind(this)));
  }

  debounce(func: Function) {
    let timeoutId: NodeJS.Timeout;

    return function (...args: any) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        func(...args);
      }, 0);
    };
  }

  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    if (value == '0') {
      this.sendMessage(`${this.accessory.context.device.unique_id} stop`, true);
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetHeatingCoolingState,
        this.platform.Characteristic.TargetHeatingCoolingState.OFF
      );
    }

    if (value == '1') {
      this.sendMessage(`${this.accessory.context.device.unique_id} start heating`, true);
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetHeatingCoolingState,
        this.platform.Characteristic.TargetHeatingCoolingState.HEAT
      );
    }

    if (value == '2') {
      this.sendMessage(`${this.accessory.context.device.unique_id} start cooling`, true);
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetHeatingCoolingState,
        this.platform.Characteristic.TargetHeatingCoolingState.COOL
      );
    }

    if (value == '3') {
      this.sendMessage(`${this.accessory.context.device.unique_id} start auto`, true);
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetHeatingCoolingState,
        this.platform.Characteristic.TargetHeatingCoolingState.AUTO
      );
    }

    this.platform.log.debug('setTargetHeatingCoolingState', value);
  }

  async setTargetTemperature(value: CharacteristicValue) {
    this.platform.log.debug('unique_id', this.accessory.context.device.unique_id);
    this.sendMessage(`${this.accessory.context.device.unique_id} set_temp ${value}`, true);
    this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, value);

    this.platform.log.debug('Triggered SET TargetTemperature:', value);
  }
}
