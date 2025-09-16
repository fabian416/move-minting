import { AccountAddress, GetFungibleAssetMetadataResponse } from "@aptos-labs/ts-sdk";
import { useEffect, useState } from "react";
// Internal utils
import { aptosClient } from "@/utils/aptosClient";
import { getRegistry } from "@/view-functions/getRegistry";

type MetadataRow = GetFungibleAssetMetadataResponse[number];

// ícono por defecto si no hay icon_uri
const PLACEHOLDER_ICON =
  import.meta.env.VITE_PLACEHOLDER_ICON || "https://placehold.co/64x64/png?text=FA";

/** Normaliza la dirección que viene del view de Move (puede venir como string o {inner}) */
function normAddr(x: unknown): string {
  const s =
    typeof x === "string"
      ? x
      : typeof (x as any)?.inner === "string"
      ? (x as any).inner
      : String(x ?? "");
  return AccountAddress.fromString(s).toStringLong();
}

/**
 * Hook que trae los metadatos de TODOS los objetos del registry del contrato.
 * ¡OJO! Es costoso si hay muchos FAs (sólo para dev/demos).
 */
export function useGetAssetMetadata() {
  const [fas, setFAs] = useState<MetadataRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Obtenemos los objetos registrados por el contrato
        const faObjects = await getRegistry(); // vector<Object<Metadata>>
        // 2) Para cada objeto, buscamos metadatos por asset_type = dirección del objeto
        const metas = await Promise.all(
          faObjects.map(async (obj: any) => {
            const assetType = normAddr(obj);
            try {
              const rows = await aptosClient().getFungibleAssetMetadata({
                options: { where: { asset_type: { _eq: assetType } }, limit: 1 },
              });
              const m = rows[0];
              if (!m) return null;
              // normalizamos icon_uri para no romper la UI
              return { ...m, icon_uri: m.icon_uri || PLACEHOLDER_ICON } as MetadataRow;
            } catch {
              return null;
            }
          }),
        );

        // 3) Quitamos nulos (no encontrados) y seteamos estado
        const clean = metas.filter(Boolean) as MetadataRow[];
        if (!cancelled) setFAs(clean);
      } catch (e) {
        console.error("useGetAssetMetadata error:", e);
        if (!cancelled) setFAs([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return fas;
}