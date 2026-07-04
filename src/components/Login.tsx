import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Vote, Lock, User, AlertCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "./AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(username, password);
      navigate("/admin");
    } catch (err: any) {
      setError("Invalid username or password. Please check your credentials.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-navy text-white rounded-2xl shadow-lg mb-4">
            <Vote className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-navy uppercase tracking-tight">
            COMELEC Portal
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Authorized Personnel Only
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm font-medium">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="label-text">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  className="input-field pl-10"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label-text">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  className="input-field pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 h-12"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
              ) : (
                "Sign In to Console"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <Link
              to="/"
              className="text-xs font-bold text-navy hover:text-navy-light inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Live Tally
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 font-mono font-bold uppercase tracking-widest">
          Secured Election Management System v2.0
        </p>
      </div>
    </div>
  );
}
