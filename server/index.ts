import { startApiServer } from './api.js';
import { initServerMonitoring } from './monitoring.js';

initServerMonitoring();
startApiServer();
