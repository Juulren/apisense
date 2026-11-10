// A DevEUI is printed on the node's label, so knowing it is not enough to receive
// that node's data. A real account proves ownership with the claim code that came
// with the node; the server checks it (claim_lora_node) and refuses wrong codes or
// a node that belongs to another account, without saying which.
interface RpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}
export const MIN_CLAIM_CODE = 8;
export async function claimNodeOnServer(
  client: RpcClient | null,
  devEui: string,
  claimCode: string,
) {
  const code = claimCode.trim();
  if (code.length < MIN_CLAIM_CODE)
    throw new Error("Escribe el código de vinculación que vino con el nodo");
  if (!client)
    throw new Error("Vincular un nodo por primera vez necesita conexión");
  let result;
  try {
    result = await client.rpc("claim_lora_node", {
      p_dev_eui: devEui,
      p_claim_code: code,
    });
  } catch {
    throw new Error("No se pudo comprobar el código. Revisa tu conexión");
  }
  if (result.error)
    throw new Error("No se pudo comprobar el código. Revisa tu conexión");
  if (result.data !== true)
    throw new Error(
      "El DevEUI o el código de vinculación no son correctos, o el nodo ya pertenece a otra cuenta",
    );
}
