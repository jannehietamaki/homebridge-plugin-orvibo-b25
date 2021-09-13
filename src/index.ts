import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { OrviboB25HomebridgePlatform } from './platform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, OrviboB25HomebridgePlatform);
};
