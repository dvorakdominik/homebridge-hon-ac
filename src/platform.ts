import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

import {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { ExamplePlatformAccessory } from './platformAccessory.js';

export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  public pyhOnInstance: ChildProcessWithoutNullStreams | null = null;

  constructor(public readonly log: Logging, public readonly config: PlatformConfig, public readonly api: API) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.debug('Finished initializing platform:', this.config.name);

    // Homebridge 1.8.0 introduced a `log.success` method that can be used to log success messages
    // For users that are on a version prior to 1.8.0, we need a 'polyfill' for this method
    if (!log.success) {
      log.success = log.info;
    }

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      await this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    // this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    this.log.info(`Device discover... ${this.config.python}`);

    this.pyhOnInstance = spawn(this.config.python, [
      `${this.config.path}/lib/script.py`,
      this.config.email,
      this.config.password,
    ]);

    this.pyhOnInstance.stderr.on('data', (data) => {
      this.log.info(`stderr: ${data}`);
    });

    this.pyhOnInstance.on('error', (error) => {
      this.log.info(`Error: ${error.message}`);
    });

    this.pyhOnInstance.on('close', (code) => {
      this.log.info(`Close: ${code}`);
    });

    let isLoaded = false;
    this.pyhOnInstance.stdout.on('data', (stdout: any) => {
      if (!isLoaded) {
        isLoaded = true;
        const data = stdout.toString();
        const json = JSON.parse(data);

        for (const device of json) {
          const uuid = this.api.hap.uuid.generate(device.unique_id);

          // see if an accessory with the same uuid has already been registered and restored from
          // the cached devices we stored in the `configureAccessory` method above
          const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);

          if (existingAccessory) {
            // the accessory already exists
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            new ExamplePlatformAccessory(this, existingAccessory, this.pyhOnInstance);
          } else {
            this.log.info('Adding new accessory:', device.nick_name);
            const accessory = new this.api.platformAccessory(device.nick_name, uuid);
            accessory.context.device = device;
            new ExamplePlatformAccessory(this, accessory, this.pyhOnInstance);

            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        }
      }
    });
  }
}
