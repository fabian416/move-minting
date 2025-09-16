import { Link, useNavigate } from "react-router-dom";
// Internal components
import { LaunchpadHeader } from "@/components/LaunchpadHeader";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// Internal hooks
import { useGetAssetMetadata } from "@/hooks/useGetAssetMetadata";
import { convertAmountFromOnChainToHumanReadable } from "@/utils/helpers";
import { IS_PROD, NETWORK } from "@/constants";

const PLACEHOLDER_ICON =
  import.meta.env.VITE_PLACEHOLDER_ICON ||
  "https://placehold.co/40x40/png?text=FA";

export function MyFungibleAssets() {
  const fas = useGetAssetMetadata();

  // If we are on Production mode, redirect to the public mint page
  const navigate = useNavigate();
  if (IS_PROD) navigate("/", { replace: true });

  // Normaliza y filtra resultados vacíos/undefined
  const assets = Array.isArray(fas) ? fas.filter(Boolean) : [];

  return (
    <>
      <LaunchpadHeader title="My Assets" />
      <Table className="max-w-screen-xl mx-auto">
        {!assets.length && (
          <TableCaption>
            A list of the fungible assets created under the current contract.
          </TableCaption>
        )}
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Symbol</TableHead>
            <TableHead>Asset Name</TableHead>
            <TableHead>FA address</TableHead>
            <TableHead>Max Supply</TableHead>
            <TableHead>Minted</TableHead>
            <TableHead>Decimal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.length > 0 &&
            assets.map((fa: any, idx: number) => {
              const icon =
                fa?.icon_uri ?? fa?.iconURL ?? PLACEHOLDER_ICON;
              const name = fa?.name ?? fa?.symbol ?? "Unknown";
              const symbol = fa?.symbol ?? "";
              const dec = Number(fa?.decimals ?? 0);
              const faAddr = fa?.asset_type ?? "";
              const max = fa?.maximum_v2 ?? 0;
              const supply = fa?.supply_v2 ?? 0;

              return (
                <TableRow key={faAddr || idx}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <img
                        src={icon}
                        alt={name}
                        style={{ width: "40px", height: "40px", objectFit: "cover" }}
                        className="mr-2 rounded"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_ICON;
                        }}
                      />
                      <span>{symbol}</span>
                    </div>
                  </TableCell>
                  <TableCell>{name}</TableCell>
                  <TableCell>
                    {faAddr ? (
                      <Link
                        to={`https://explorer.aptoslabs.com/object/${faAddr}?network=${NETWORK}`}
                        target="_blank"
                        style={{ textDecoration: "underline" }}
                      >
                        {faAddr}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {convertAmountFromOnChainToHumanReadable(max, dec)}
                  </TableCell>
                  <TableCell>
                    {convertAmountFromOnChainToHumanReadable(supply, dec)}
                  </TableCell>
                  <TableCell>{dec}</TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </>
  );
}