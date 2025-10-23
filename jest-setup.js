// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';
import './src/dayjsPlugins';

import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });
