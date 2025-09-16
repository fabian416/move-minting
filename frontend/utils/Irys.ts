// Irys.ts
import { WebUploader } from "@irys/web-upload";
import { WebAptos } from "@irys/web-upload-aptos";
import type { WalletContextState } from "@aptos-labs/wallet-adapter-react";
import { getAccountAPTBalance } from "@/view-functions/getAccountAPTBalance";

// RPCs correctos
const APTOS_RPC = {
  mainnet: "https://api.mainnet.aptoslabs.com/v1",
  testnet: "https://api.testnet.aptoslabs.com/v1",
  devnet:  "https://api.devnet.aptoslabs.com/v1",
} as const;

function resolveNetwork(wallet: WalletContextState): keyof typeof APTOS_RPC {
  const n = wallet.network?.name?.toLowerCase() || "testnet";
  if (n.includes("main")) return "mainnet";
  if (n.includes("dev")) return "devnet";
  return "testnet";
}

// Uint8Array → 0xhex
const u8ToHex = (u8: Uint8Array) =>
  "0x" + Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");

// Asegura firma con 0x (¡no la recortes!)
function normalizeSignature(sig: unknown): `0x${string}` {
  if (!sig) return "0x" as `0x${string}`;
  if (typeof sig === "string") return (sig.startsWith("0x") ? sig : `0x${sig}`) as `0x${string}`;
  if (typeof sig === "object") {
    const s =
      (sig as any).signature ??
      (sig as any).ed25519 ??
      (sig as any).data ??
      "";
    const str = typeof s === "string" ? s : String(s);
    return (str.startsWith("0x") ? str : `0x${str}`) as `0x${string}`;
  }
  const str = String(sig);
  return (str.startsWith("0x") ? str : `0x${str}`) as `0x${string}`;
}

// Envuelve la wallet: 1) firma apta para Irys 2) publicKey en 0xhex
function withWalletFixes(wallet: WalletContextState): WalletContextState {
  const patched: any = { ...wallet };

  if (wallet.account) {
    const acct: any = { ...wallet.account };
    if (acct.publicKey && typeof acct.publicKey !== "string") {
      // típico: Uint8Array → 0xhex
      acct.publicKey = u8ToHex(acct.publicKey as Uint8Array);
    }
    // en algunos adapters la address es objeto; forzamos string “0x…”
    if (acct.address && typeof acct.address.toStringLong === "function") {
      acct.address = acct.address.toStringLong();
    }
    patched.account = acct;
  }

  // Forzamos signMessage sin address/chainId/application, y preservamos 0x
  patched.signMessage = async (payload: any) => {
    const res: any = await (wallet as any).signMessage({
      message: payload?.message ?? "",
      nonce: "irys",
      address: false,
      chainId: false,
      application: undefined,
    });
    res.signature = normalizeSignature(res.signature);
    return res;
  };

  return patched as WalletContextState;
}

export const getIrys = async (aptosWallet: WalletContextState) => {
  const chain = resolveNetwork(aptosWallet);
  // Irys sólo tiene "mainnet" y "devnet"; para testnet usamos "devnet"
  const irysNode = chain === "mainnet" ? "mainnet" : "devnet";
  const rpc = APTOS_RPC[chain];

  const irys = await WebUploader(WebAptos)
    .withProvider(withWalletFixes(aptosWallet) as any)
    .network(irysNode)
    .withRpc(rpc) // ¡URL completa, no "devnet" literal!
    .build();

  return irys;
};

export const uploadFile = async (aptosWallet: WalletContextState, file: File): Promise<string> => {
  const webIrys = await getIrys(aptosWallet);
  try {
    const receipt = await webIrys.uploadFile(file, { tags: [] });
    return `https://gateway.irys.xyz/${receipt.id}`;
  } catch (e: any) {
    const detail = e?.response?.data?.message ?? e?.response?.data ?? e?.message ?? String(e);
    console.error("Irys upload failed:", detail, e?.response?.data);
    throw new Error(`Error uploading file: ${detail}`);
  }
};


export const checkIfFund = async (aptosWallet: WalletContextState, fileSize: number) => {
  // 1. estimate the gas cost based on the data size https://docs.irys.xyz/developer-docs/irys-sdk/api/getPrice
  const webIrys = await getIrys(aptosWallet);
  const costToUpload = await webIrys.getPrice(fileSize);
  // 2. check the wallet balance on the irys node
  const irysBalance = await webIrys.getBalance();
  // 3. if balance is enough, then upload without funding
  if (irysBalance.toNumber() > costToUpload.toNumber()) {
    return true;
  }
  // 4. if balance is not enough,  check the payer balance
  const currentAccountAddress = aptosWallet.account!.address.toStringLong();

  const currentAccountBalance = await getAccountAPTBalance({ accountAddress: currentAccountAddress });

  // 5. if payer balance > the amount based on the estimation, fund the irys node irys.fund, then upload
  if (currentAccountBalance > costToUpload.toNumber()) {
    try {
      await fundNode(aptosWallet, costToUpload.toNumber());
      return true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw new Error(`Error funding node ${error}`);
    }
  }
  // 6. if payer balance < the amount, replenish the payer balance*/
  return false;
};


export const fundNode = async (aptosWallet: WalletContextState, amount?: number) => {
  const webIrys = await getIrys(aptosWallet);

  try {
    const fundTx = await webIrys.fund(amount ?? 1000000);
    console.log(`Successfully funded ${webIrys.utils.fromAtomic(fundTx.quantity)} ${webIrys.token}`);
    return true;
  } catch (e) {
    throw new Error(`Error uploading data ${e}`);
  }
};