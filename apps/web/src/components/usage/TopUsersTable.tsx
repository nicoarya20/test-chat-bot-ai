import type { UserUsage } from "../../lib/api.types";
import { USAGE_TEXT } from "../../lib/copy";

/** Admin table of the heaviest users in the selected range. */
export function TopUsersTable({ rows }: { rows: UserUsage[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{USAGE_TEXT.empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr><th className="p-2 text-left">Pengguna</th><th className="p-2 text-right">Token</th><th className="p-2 text-right">Permintaan</th></tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((u) => (
            <tr key={u.userId} className="border-t border-line">
              <td className="p-2"><div className="font-medium">{u.name}</div><div className="text-xs text-muted">{u.email}</div></td>
              <td className="p-2 text-right">{u.totalTokens.toLocaleString("id-ID")}</td>
              <td className="p-2 text-right">{u.requests}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
