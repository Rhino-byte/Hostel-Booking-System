"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isFirebaseConfigured,
  signInWithEmailPassword,
  signInWithGoogle,
  getIdTokenFromCredential,
  getIdTokenFromCurrentUser,
  completeGoogleRedirect,
  firebaseAuthMessage,
  GoogleRedirectStarted,
} from "@/lib/firebase-client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get("reason");
  const next = params.get("next");
  const idle = reason === "idle";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const configured = isFirebaseConfigured();

  async function establishSession(idToken: string) {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    toast.success(`Welcome, ${data.name}`);
    router.push(next || data.redirect || "/");
    router.refresh();
  }

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      try {
        const cred = await completeGoogleRedirect();
        if (!cred || cancelled) return;
        setLoading(true);
        const idToken = await getIdTokenFromCredential(cred);
        await establishSession(idToken);
      } catch (err) {
        if (!cancelled) {
          toast.error(firebaseAuthMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for redirect return
  }, [configured]);

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.error("Firebase is not configured");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailPassword(email, password);
      const idToken = await getIdTokenFromCredential(cred);
      await establishSession(idToken);
    } catch (err) {
      toast.error(firebaseAuthMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    if (!configured) {
      toast.error("Firebase is not configured");
      return;
    }
    setLoading(true);
    try {
      if (idle) {
        const existing = await getIdTokenFromCurrentUser();
        if (existing) {
          await establishSession(existing);
          return;
        }
      }
      const cred = await signInWithGoogle({
        forceAccountPicker: !idle,
      });
      const idToken = await getIdTokenFromCredential(cred);
      await establishSession(idToken);
    } catch (err) {
      if (err instanceof GoogleRedirectStarted) return;
      toast.error(firebaseAuthMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <Card className="w-full max-w-md shadow-lift">
        <CardHeader className="space-y-3">
          <Link href="/" className="flex items-center gap-2 text-primary">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <HomeIcon className="h-4 w-4" />
            </span>
            <span className="font-serif text-lg font-semibold">St. Clare</span>
          </Link>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {idle
              ? "Your session expired after a period of inactivity. Sign in again — Google can continue in one click."
              : "Use your school email and password, or continue with Google. Accounts are added by an administrator."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Firebase is not configured. Add the{" "}
              <code className="text-xs">NEXT_PUBLIC_FIREBASE_*</code> and Admin
              keys to <code className="text-xs">.env</code>, set{" "}
              <code className="text-xs">NEXT_PUBLIC_DEMO_AUTH=false</code>, then
              restart the server.
            </div>
          ) : null}

          <form onSubmit={onEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!configured || loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!configured || loading}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!configured || loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!configured || loading}
            onClick={onGoogle}
          >
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
