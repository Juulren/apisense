import { useApp } from "./AppProvider";
import { nodeState, silentHives } from "../services/NodeStatus";

/**
 * Node status for the screens, judged against when this phone last synced: a
 * phone that has been offline for hours cannot say a node went quiet.
 */
export function useNodeState() {
  const { data, syncState, workspace } = useApp();
  const dataAsOf = workspace?.demo
    ? undefined
    : syncState.lastSyncedAt
      ? new Date(syncState.lastSyncedAt)
      : null;
  const now = new Date();
  return {
    stateOf: (hiveId: string) =>
      nodeState(
        data.microphones.find((m) => m.hive_id === hiveId),
        data.verdicts,
        hiveId,
        now,
        dataAsOf,
      ),
    silent: silentHives(data.hives, data.microphones, data.verdicts, now, dataAsOf),
  };
}
