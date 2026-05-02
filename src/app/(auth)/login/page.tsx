"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/listings";
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) {
      router.replace(next);
    }
  }, [user, loading, router, next]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Signed in");
      router.replace(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh w-full bg-background lg:grid-cols-2">
      {/* Left: Brand panel */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Decorative layers */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary-foreground/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-primary-foreground/10 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/15 ring-1 ring-primary-foreground/25 backdrop-blur">
            <Zap className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Zap</span>
        </div>

        <div className="relative z-10 max-w-lg space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Operations & inventory
          </div>
          <h2 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
            Run your operations with clarity and speed.
          </h2>
          <p className="text-pretty text-base leading-relaxed text-primary-foreground/80">
            One workspace for listings, inventory, and fulfillment — built for
            teams that move fast and ship faster.
          </p>

          <ul className="grid gap-4 pt-2">
            {[
              {
                icon: Boxes,
                title: "Unified inventory",
                desc: "Track stock across channels in real time.",
              },
              {
                icon: BarChart3,
                title: "Live insights",
                desc: "Decisions backed by clean, current data.",
              },
              {
                icon: ShieldCheck,
                title: "Secure by default",
                desc: "Sessions stay scoped to your browser.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/20">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-sm text-primary-foreground/70">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-primary-foreground/60">
          <span>© {new Date().getFullYear()} Zap</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/70" />
            All systems normal
          </span>
        </div>
      </aside>

      {/* Right: Form panel */}
      <main className="relative flex min-h-dvh items-center justify-center px-5 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8">
        {/* Mobile-only soft backdrop using existing tokens */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-muted/40 lg:hidden"
        />

        <div className="w-full max-w-md">
          {/* Mobile brand mark */}
          <div className="mb-10 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Zap className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-semibold tracking-tight">Zap</span>
          </div>

          <div className="mb-8 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign in with your workspace credentials to continue. Sessions
              stay in this browser only.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="group relative">
                <Mail
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                  disabled={submitting}
                  className="h-12 rounded-xl pl-10 text-[15px] shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
              </div>
              <div className="group relative">
                <Lock
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"
                />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  disabled={submitting}
                  className="h-12 rounded-xl pl-10 pr-11 text-[15px] shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="group h-12 w-full rounded-xl text-[15px] font-medium shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>

            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Secure access
                </span>
              </div>
            </div>

            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Encrypted in transit. No data leaves your session.
            </p>
          </form>

          <div className="mt-10 flex items-center justify-between text-xs text-muted-foreground">
            <Link
              href="/listings"
              className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              ← Back to app
            </Link>
            <span className="lg:hidden">© {new Date().getFullYear()} Zap</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
