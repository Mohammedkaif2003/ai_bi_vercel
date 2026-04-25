import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, User, LogIn, Info, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { login as legacyLogin } from "@/lib/api";
import LogoMark from "@/components/LogoMark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if already logged in
  useEffect(() => {
    async function checkUser() {
      // 1. Check Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
        return;
      }

      // 2. Check Local Storage for legacy session
      const localUser = sessionStorage.getItem("nexlytics_user");
      if (localUser) {
        router.push("/dashboard");
      }
    }
    checkUser();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setError("Check your email for the confirmation link!");
      } else {
        // Try Supabase first if it looks like an email
        if (email.includes("@")) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (!signInError) {
            router.push("/dashboard");
            return;
          }
        }

        // Fallback to legacy login
        try {
          const user = await legacyLogin(email, password);
          sessionStorage.setItem("nexlytics_user", JSON.stringify(user));
          router.push("/dashboard");
        } catch (legacyErr: any) {
          throw new Error(legacyErr.message || "Invalid credentials.");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Nexlytics | {isSignUp ? "Create Account" : "Sign In"}</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-mesh px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="glass-card p-8 md:p-10 shadow-2xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
            
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="mb-4 inline-block"
              >
                <LogoMark size={64} className="mx-auto" />
              </motion.div>
              <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Nexlytics</h1>
              <p className="text-slate-400 font-medium">Enterprise Intelligence Platform</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1" htmlFor="email">
                  Email Address
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                  <input
                    id="email"
                    type="text"
                    className="input pl-12"
                    placeholder="Email or username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1" htmlFor="password">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                  <input
                    id="password"
                    type="password"
                    className="input pl-12"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 text-sm rounded-xl px-4 py-3 ${
                    error.includes("confirm") 
                      ? "text-emerald-400 bg-emerald-500/5 border border-emerald-500/10" 
                      : "text-rose-400 bg-rose-500/5 border border-rose-500/10"
                  }`}
                >
                  <Info size={16} />
                  <span>{error}</span>
                </motion.div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 group"
                disabled={loading}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isSignUp ? <UserPlus size={20} /> : <LogIn size={20} />}
                    <span>{isSignUp ? "Create Account" : "Access Dashboard"}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center space-y-4">
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-slate-500 hover:text-indigo-400 transition-colors"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>

              {!isSignUp && (
                <div className="pt-4 border-t border-white/[0.05]">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Demo Credentials</p>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="text-indigo-400 font-bold">Admin:</span> admin / admin123
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-indigo-400 font-bold">Analyst:</span> analyst / analyst123
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <p className="mt-8 text-center text-slate-600 text-xs">
            &copy; 2026 Nexlytics AI. All rights reserved.
          </p>
        </motion.div>
      </div>
    </>
  );
}
