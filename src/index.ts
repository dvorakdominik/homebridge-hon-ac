import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings.js';
import { ExampleHomebridgePlatform } from './platform.js';

export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, ExampleHomebridgePlatform);
};
