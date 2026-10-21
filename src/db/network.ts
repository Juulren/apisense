import NetInfo from "@react-native-community/netinfo";
import type { NetworkPort } from "./SyncEngine";
export const network: NetworkPort = {
  subscribe: (listener) =>
    NetInfo.addEventListener((state) =>
      listener(
        state.isConnected === true && state.isInternetReachable !== false,
      ),
    ),
};
export class NetworkGate implements NetworkPort {
  private listener?: (online: boolean) => void;
  private online = false;
  constructor(private offline = false) {}
  setOffline(value: boolean) {
    this.offline = value;
    this.listener?.(this.online && !this.offline);
  }
  subscribe(listener: (online: boolean) => void) {
    this.listener = listener;
    return NetInfo.addEventListener((state) => {
      this.online =
        state.isConnected === true && state.isInternetReachable !== false;
      listener(this.online && !this.offline);
    });
  }
}
