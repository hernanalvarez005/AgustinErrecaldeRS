import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PropertyOption = { id: string; title: string };

/**
 * A property picker that degrades to a fixed hidden input when there's only
 * one option — same Base UI Select gotcha (and same fix) as
 * ContactSelectField; see docs/ARCHITECTURE.md ("Gotcha verificado: shadcn
 * Select con una sola opción").
 */
export function PropertySelectField({
  name,
  id,
  properties,
  placeholder = "Elegir propiedad",
  className,
  defaultValue,
}: {
  name: string;
  id?: string;
  properties: PropertyOption[];
  placeholder?: string;
  className?: string;
  defaultValue?: string;
}) {
  if (properties.length === 1) {
    const only = properties[0];
    return (
      <span
        className={`flex h-8 items-center rounded-lg border bg-transparent px-2.5 text-sm ${className ?? ""}`}
      >
        <input type="hidden" name={name} value={only.id} />
        {only.title}
      </span>
    );
  }

  return (
    <Select
      name={name}
      defaultValue={defaultValue}
      items={Object.fromEntries(properties.map((p) => [p.id, p.title]))}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {properties.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
