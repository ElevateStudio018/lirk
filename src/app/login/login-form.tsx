"use client";

import { Mail } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sendMagicLink, signIn, signUp, type AuthState } from "./actions";

type Mode = "signin" | "signup" | "magic";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const action = mode === "signin" ? signIn : mode === "signup" ? signUp : sendMagicLink;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, initialError ? { error: initialError } : {});

  return (
    <div className="w-full">
      <div className="glass mb-6 grid grid-cols-2 gap-1 rounded-full p-1" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full py-2.5 text-sm font-semibold transition-colors",
              mode === m ? "bg-white text-black" : "text-muted hover:text-ink",
            )}
          >
            {m === "signin" ? "Logga in" : "Skapa konto"}
          </button>
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-4" key={mode}>
        {next && <input type="hidden" name="next" value={next} />}
        {mode === "signup" && (
          <div>
            <Label htmlFor="name">Vad heter du?</Label>
            <Input id="name" name="name" autoComplete="given-name" placeholder="Förnamn" />
          </div>
        )}
        <div>
          <Label htmlFor="email">E-post</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="du@exempel.se" />
        </div>
        {mode !== "magic" && (
          <div>
            <Label htmlFor="password">Lösenord</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              placeholder="Minst 8 tecken"
            />
          </div>
        )}

        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.message && <Alert tone="success">{state.message}</Alert>}

        <Button type="submit" size="lg" block loading={pending}>
          {mode === "signin" ? "Logga in" : mode === "signup" ? "Skapa konto" : "Skicka länk"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        {mode !== "magic" ? (
          <button type="button" onClick={() => setMode("magic")} className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
            <Mail className="size-4" /> Logga in med länk via e-post i stället
          </button>
        ) : (
          <button type="button" onClick={() => setMode("signin")} className="text-sm font-semibold text-muted hover:text-ink">
            Logga in med lösenord
          </button>
        )}
      </div>
    </div>
  );
}
