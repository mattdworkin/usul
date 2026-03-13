import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

async function AuthRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/protected");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Usul</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Upload government procurement documents and extract structured insights
        with AI.
      </p>
      <div className="flex gap-4">
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Log in
        </Link>
        <Link
          href="/auth/sign-up"
          className="inline-flex items-center justify-center rounded-md border border-input px-6 py-2 text-sm font-medium hover:bg-accent"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <AuthRedirect />
    </Suspense>
  );
}
