import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_COLORS } from "@/components/agenda/MonthCalendar";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Status keys to exclude from list (e.g. "rejeitada", "outro", "atrasado") */
  exclude?: string[];
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: color }}
      aria-hidden
    />
  );
}

export function StatusFilter({ value, onChange, exclude = [] }: Props) {
  const entries = Object.entries(STATUS_COLORS).filter(([k]) => !exclude.includes(k));
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Status">
          {value === "all" ? (
            <span className="inline-flex items-center gap-2">
              <Dot color="hsl(var(--muted-foreground))" />
              Todos os status
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Dot color={STATUS_COLORS[value]?.bg ?? "#6B7280"} />
              {STATUS_COLORS[value]?.label ?? value}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="inline-flex items-center gap-2">
            <Dot color="hsl(var(--muted-foreground))" />
            Todos os status
          </span>
        </SelectItem>
        {entries.map(([k, v]) => (
          <SelectItem key={k} value={k}>
            <span className="inline-flex items-center gap-2">
              <Dot color={v.bg} />
              {v.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
