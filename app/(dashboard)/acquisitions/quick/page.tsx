import { QuickAcquisitionForm } from "@/components/acquisitions/quick-acquisition-form";

export default async function QuickAcquisitionPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Captación rápida
        </h1>
        <p className="text-muted-foreground text-sm">
          Registrá una oportunidad en menos de 30 segundos — completá la ficha
          técnica de la propiedad después, desde su ficha.
        </p>
      </div>

      <QuickAcquisitionForm />
    </div>
  );
}
