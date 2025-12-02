import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setToken } from "../../helpers/authClient";
import { useToast } from "../ToastProvider";

export const SignUpPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!email || !password) {
      showToast("Email and password are required", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: "user" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Signup failed");
      }
      // Auto sign-in after signup
      const signin = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (signin.ok) {
        const data = (await signin.json()) as { token?: string };
        if (data.token) {
          setToken(data.token);
          showToast("Signed in successfully");
          navigate("/");
          return;
        }
      }
      showToast("Signup succeeded. Please sign in.", "info");
      navigate("/signin");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Signup failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">Sign up to start generating content.</p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="8+ characters"
            />
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? "Creating..." : "Sign up"}
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="text-slate-900 underline" to="/signin">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
};
