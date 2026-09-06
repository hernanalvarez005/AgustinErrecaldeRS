import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EntityOption = { id: string; label: string };

/**
 * An optional entity picker (contact/property/deal/...) with an explicit
 * "none" choice. When there are zero options, renders nothing but a fixed
 * hidden input — same Base UI single-item Select gotcha (and same fix) as
 * ContactSelectField/PropertySelectField: with zero real options, "none"
 * would be the Select's only item, which is exactly the buggy case (see
 * docs/ARCHITECTURE.md). With one or more real options, "none" plus those
 * is always at least two items, so the bug never applies.
 */
export function OptionalEntitySelectField({
  name,
  id,
  options,
  placeholder,
  noneLabel = "Ninguno/a",
  defaultValue,
  className,
}: {
  name: string;
  id?: string;
  options: EntityOption[];
  placeholder?: string;
  noneLabel?: string;
  defaultValue?: string;
  className?: string;
}) {
  if (options.length === 0) {
    return <input type="hidden" name={name} value="none" />;
  }

  return (
    <Select
      name={name}
      defaultValue={defaultValue ?? "none"}
      items={{
        none: noneLabel,
        ...Object.fromEntries(options.map((o) => [o.id, o.label])),
      }}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder ?? noneLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{noneLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
