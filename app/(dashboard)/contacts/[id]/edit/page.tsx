import { notFound } from "next/navigation";

import { ContactForm } from "@/components/contacts/contact-form";
import { getContact, getContactRoles } from "@/lib/data/contacts";

export default async function EditContactPage({
  params,
}: PageProps<"/contacts/[id]/edit">) {
  const { id } = await params;
  const [contact, roles] = await Promise.all([
    getContact(id),
    getContactRoles(id),
  ]);
  if (!contact) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Editar {contact.first_name} {contact.last_name}
        </h1>
      </div>
      <ContactForm contact={contact} initialRoles={roles} />
    </div>
  );
}
