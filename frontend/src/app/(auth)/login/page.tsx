import { AuthCard } from "@/components/auth/AuthCard";
import { AuthCardTitle } from "@/components/auth/AuthCardTitle";
import { AuthLogo } from "@/components/auth/AuthLogo";
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
      <div className="mb-8">
        <AuthLogo />
      </div>
      <AuthCard>
        <AuthCardTitle>Sign in</AuthCardTitle>
        <p className="mt-1 text-sm text-gray-600">Welcome back to Acumen.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </AuthCard>
    </AuthShell>
  );
}
