import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ContactOption = { id: string; first_name: string; last_name: string };

/**
 * A contact picker that degrades to a fixed hidden input when there's only
 * one option. Base UI's Select can visually preview a single item on open
 * without committing it to the submitted value — see docs/ARCHITECTURE.md
 * ("Gotcha verificado: shadcn Select con una sola opción"). With one option
 * there's nothing to actually choose anyway.
 */
export function ContactSelectField({
  name,
  id,
  contacts,
  placeholder = "Elegir contacto",
  className,
}: {
  name: string;
  id?: string;
  contacts: ContactOption[];
  placeholder?: string;
  className?: string;
}) {
  if (contacts.length === 1) {
    const only = contacts[0];
    return (
      <span
        className={`flex h-8 items-center rounded-lg border bg-transparent px-2.5 text-sm ${className ?? ""}`}
      >
        <input type="hidden" name={name} value={only.id} />
        {only.first_name} {only.last_name}
      </span>
    );
  }

  return (
    <Select
      name={name}
      items={Object.fromEntries(
        contacts.map((c) => [c.id, `${c.first_name} ${c.last_name}`]),
      )}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {contacts.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.first_name} {c.last_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
