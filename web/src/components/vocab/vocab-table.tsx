import type { VocabItem } from "@/generated/prisma/client";
import { formatDueIn } from "@/lib/format";
import { cn } from "@/lib/utils";

type VocabRow = Pick<VocabItem, "id" | "word" | "translation" | "dueAt">;

export function VocabTable({ items, now }: { items: VocabRow[]; now: Date }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5">
      <table className="w-full text-left">
        <thead className="border-b">
          <tr>
            <th scope="col" className="eyebrow px-5 py-3 font-semibold sm:px-6">
              Word
            </th>
            <th scope="col" className="eyebrow hidden px-3 py-3 font-semibold sm:table-cell">
              Meaning
            </th>
            <th scope="col" className="eyebrow px-5 py-3 text-right font-semibold sm:px-6">
              Next review
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => {
            const due = item.dueAt <= now;
            return (
              <tr key={item.id}>
                <td className="px-5 py-3.5 sm:px-6">
                  <span className="block font-medium">{item.word}</span>
                  <span className="block text-sm text-muted-foreground sm:hidden">{item.translation}</span>
                </td>
                <td className="hidden px-3 py-3.5 text-muted-foreground sm:table-cell">{item.translation}</td>
                <td
                  className={cn(
                    "px-5 py-3.5 text-right text-sm whitespace-nowrap tabular-nums sm:px-6",
                    due ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatDueIn(item.dueAt, now)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
