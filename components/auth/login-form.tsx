"use client";

import { useState } from "react";

import {
  sendMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  return (
    <Tabs defaultValue="password">
      <TabsList className="w-full">
        <TabsTrigger value="password" className="flex-1">
          Contraseña
        </TabsTrigger>
        <TabsTrigger value="magic-link" className="flex-1">
          Magic link
        </TabsTrigger>
      </TabsList>

      <TabsContent value="password" className="space-y-4 pt-4">
        <form
          action={mode === "sign-in" ? signInWithPassword : signUpWithPassword}
          className="space-y-4"
        >
          {redirectTo ? (
            <input type="hidden" name="redirectTo" value={redirectTo} />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full">
            {mode === "sign-in" ? "Ingresar" : "Crear cuenta"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {mode === "sign-in"
            ? "¿No tenés cuenta? Creá una"
            : "¿Ya tenés cuenta? Ingresá"}
        </button>
      </TabsContent>

      <TabsContent value="magic-link" className="space-y-4 pt-4">
        <form action={sendMagicLink} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="magic-email">Email</Label>
            <Input
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Enviar link de acceso
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
