import { useState, FormEvent } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { login } from "@/lib/api";
import LogoMark from "@/components/LogoMark";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(username, password);
      sessionStorage.setItem("nexlytics_token", user.token);
      sessionStorage.setItem("nexlytics_user", JSON.stringify(user));
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Nexlytics - Sign In</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A] px-4">
        <div className="w-full max-w-md">
          <div className="card mb-6 text-center py-8">
            <LogoMark size={56} className="mx-auto mb-3" />
            <h1 className="text-3xl font-bold text-white mb-1">Nexlytics</h1>
            <p className="text-[#94A3B8] text-sm">AI-Powered Business Intelligence</p>
            <hr className="border-[#334155] my-5" />

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-sm text-[#94A3B8] mb-1" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  className="input"
                  placeholder="e.g. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-[#94A3B8] mb-1" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && (
                <p className="text-[#EF4444] text-sm bg-[#450a0a] border border-[#7f1d1d] rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="btn-primary w-full mt-2"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== "false" && (
              <details className="mt-5 text-left text-sm">
                <summary className="cursor-pointer text-[#64748B] hover:text-[#94A3B8] transition-colors">
                  Demo credentials
                </summary>
                <div className="mt-2 bg-[#0F172A] rounded-lg p-3 text-[#94A3B8] space-y-1 border border-[#334155]">
                  <p><span className="text-white font-medium">Administrator:</span> admin / admin123</p>
                  <p><span className="text-white font-medium">Business Analyst:</span> analyst / analyst123</p>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
