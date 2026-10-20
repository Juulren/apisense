import NetInfo from '@react-native-community/netinfo';
import type { NetworkPort } from './SyncEngine';
export const network: NetworkPort = { subscribe: listener => NetInfo.addEventListener(state => listener(state.isConnected === true && state.isInternetReachable !== false)) };
