import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { AccountAddress } from "@aptos-labs/ts-sdk";

// Internal utils
import { aptosClient } from "@/utils/aptosClient";
import { convertAmountFromOnChainToHumanReadable } from "@/utils/helpers";

// Internal constants / fns
import { getUserMintBalance } from "@/view-functions/getUserMintBalance";
import { FA_ADDRESS } from "@/constants";
import { getMintEnabled } from "@/view-functions/getMintEnabled";

export interface FungibleAsset {
  maximum_v2: number;
  supply_v2: number;
  name: string;
  symbol: string;
  decimals: number;
  asset_type: string;
  icon_uri: string;
}

interface MintQueryResult {
  fungible_asset_metadata: Array<FungibleAsset>;
  current_fungible_asset_balances: Array<{
    amount: number;
  }>;
}

interface MintData {
  maxSupply: number;
  currentSupply: number;
  yourBalance: number;
  userMintBalance: number;
  asset: FungibleAsset;
  isMintActive: boolean;
}

// Normaliza una dirección cualquiera a formato largo (0x + 64 hex). Si falla, devuelve el string original.
function toLong(addr?: unknown): string {
  const s = addr ? String(addr) : "";
  if (!s) return "";
  try {
    return AccountAddress.fromString(s).toStringLong();
  } catch {
    return s;
  }
}

/**
 * A react hook to get fungible asset data.
 */
export function useGetAssetData(fa_address: string = FA_ADDRESS) {
  const { account } = useWallet();

  return useQuery({
    // Incluye la dirección en el queryKey para refrescar cuando cambie
    queryKey: ["app-state", fa_address, account?.address ?? null],
    refetchInterval: 1000 * 30,
    queryFn: async (): Promise<MintData | null> => {
      try {
        if (!fa_address) return null;

        const addrLong = toLong(account?.address);

        const res = await aptosClient().queryIndexer<MintQueryResult>({
          query: {
            variables: {
              fa_address,
              account: addrLong, // el indexer espera string
            },
            query: `
            query FungibleQuery($fa_address: String, $account: String) {
              fungible_asset_metadata(where: {asset_type: {_eq: $fa_address}}) {
                maximum_v2
                supply_v2
                name
                symbol
                decimals
                asset_type
                icon_uri
              }
              current_fungible_asset_balances(
                where: {owner_address: {_eq: $account}, asset_type: {_eq: $fa_address}}
                distinct_on: asset_type
                limit: 1
              ) {
                amount
              }
            }`,
          },
        });

        const asset = res.fungible_asset_metadata?.[0];
        if (!asset) return null;

        const isMintEnabled = await getMintEnabled({ fa_address });

        const userMintBalRaw =
          account == null
            ? 0
            : await getUserMintBalance({ user_address: addrLong, fa_address });

        return {
          asset,
          maxSupply: convertAmountFromOnChainToHumanReadable(asset.maximum_v2 ?? 0, asset.decimals),
          currentSupply: convertAmountFromOnChainToHumanReadable(asset.supply_v2 ?? 0, asset.decimals),
          userMintBalance: convertAmountFromOnChainToHumanReadable(userMintBalRaw, asset.decimals),
          yourBalance: convertAmountFromOnChainToHumanReadable(
            res.current_fungible_asset_balances?.[0]?.amount ?? 0,
            asset.decimals,
          ),
          isMintActive: isMintEnabled && (asset.maximum_v2 ?? 0) > (asset.supply_v2 ?? 0),
        };
      } catch (error) {
        console.error(error);
        return null;
      }
    },
  });
}