export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
