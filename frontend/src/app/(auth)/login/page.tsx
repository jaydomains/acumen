import { AuthCard } from "@/components/auth/AuthCard";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

/**
 * /login — credential entry (FE-1 §B.1). The (auth)/layout's Gate
 * handles the unauth guard and the post-login redirect; this page
 * only renders the form chrome.
 */

export const metadata = {
  title: "Sign in · Acumen",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <AuthCard>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-gray-600">Welcome back to Acumen.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </AuthCard>
    </AuthShell>
  );
}
