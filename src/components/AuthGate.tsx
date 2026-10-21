"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from "@/lib/auth";
import { RockCard } from "@/components/RockCard";

type AuthState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "not_allowed"; email: string }
  | { status: "signed_in"; user: User };

const UserContext = createContext<User | null>(null);

// The signed-in Carrara user. Only available below AuthGate, which renders its children
// once someone is signed in with an allowed account.
export function useCurrentUser(): User {
  const user = useContext(UserContext);
  if (!user) throw new Error("useCurrentUser must be used inside AuthGate");
  return user;
}

export function signOut() {
  void supabase.auth.signOut();
}

const shell = "mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-10";
const primaryButton =
  "min-h-11 rounded-lg bg-ember-fill px-4 py-2 font-semibold text-white transition disabled:opacity-50";

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    function apply(user: User | null) {
      if (!active) return;
      if (!user) setState({ status: "signed_out" });
      else if (!isAllowedEmail(user.email)) setState({ status: "not_allowed", email: user.email ?? "" });
      else setState({ status: "signed_in", user });
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
      apply(session?.user ?? null)
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    setBusy(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Come back to the page the person was on. `hd` narrows Google's account chooser
        // to Carrara accounts; the real restriction is Google's "Internal" setting.
        redirectTo: window.location.href.split("#")[0],
        queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
      },
    });
    // The browser leaves for Google; if it didn't, let the person try again.
    setBusy(false);
  }

  if (state.status === "signed_in") {
    return <UserContext.Provider value={state.user}>{children}</UserContext.Provider>;
  }

  if (state.status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-grafite dark:text-marmol/70">Loading…</p>
      </main>
    );
  }

  return (
    <main className={shell}>
      <h1 className="font-heading text-3xl font-bold text-ardesia dark:text-marmol">
        Rock Report
      </h1>
      <RockCard compact />
      {state.status === "not_allowed" ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-base text-ardesia dark:text-marmol">
            {state.email} isn&apos;t a Carrara account. Sign in with your @{ALLOWED_EMAIL_DOMAIN}{" "}
            Google account instead.
          </p>
          <button type="button" onClick={signOut} className={primaryButton}>
            Sign out and try again
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-base text-grafite dark:text-marmol/80">
            Sign in with your Carrara Google account to join this week&apos;s session.
          </p>
          <button type="button" onClick={signIn} disabled={busy} className={primaryButton}>
            Sign in with Google
          </button>
        </div>
      )}
    </main>
  );
}
