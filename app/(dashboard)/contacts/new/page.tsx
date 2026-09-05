import { ContactForm } from "@/components/contacts/contact-form";

export default function NewContactPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nuevo contacto
        </h1>
        <p className="text-muted-foreground text-sm">
          Los datos básicos alcanzan para arrancar — podés completar el resto
          después.
        </p>
      </div>
      <ContactForm />
    </div>
  );
}
