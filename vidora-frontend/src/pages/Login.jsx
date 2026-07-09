import React, { useState } from "react";
import { login } from "../api/auth";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastProvider";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock } from "lucide-react";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await login({ email, password });
      // Persist the token so the user stays logged in after refresh
      if (response?.accessToken) {
        localStorage.setItem("accessToken", response.accessToken);
      }
      setUser(response?.user || response);
      toast("Logged in", { type: "success" });
      navigate("/");
    } catch (err) {
      toast(err.response?.data?.message || "Invalid email or password", { type: "error" });
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen relative overflow-hidden py-10 px-4">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/images/landing-bg.png" 
          alt="Background" 
          className="w-full h-full object-cover opacity-60 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/60 via-neutral-950/80 to-neutral-950"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white mb-6 transition-colors group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>
        
        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-8 sm:p-10 w-full">
          <div className="text-center mb-8">
            <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-rose-500/20 mb-4">
              V
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-neutral-400 text-sm">Sign in to continue to Vidora</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-neutral-300 text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e)=>setEmail(e.target.value)} 
                  required 
                  placeholder="name@example.com"
                  className="w-full rounded-xl bg-neutral-900/50 border border-neutral-700/50 pl-10 pr-4 py-3 text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition" 
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e)=>setPassword(e.target.value)} 
                  required 
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-neutral-900/50 border border-neutral-700/50 pl-10 pr-4 py-3 text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition" 
                />
              </div>
            </div>
          </div>

          <button type="submit" className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(225,29,72,0.4)] hover:shadow-[0_0_25px_-5px_rgba(225,29,72,0.6)] mt-8">
            Sign In
          </button>
          
          <p className="text-center text-sm text-neutral-400 mt-6">
            Don’t have an account? <Link to="/register" className="text-rose-400 font-semibold hover:text-rose-300 transition-colors">Create one</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

export default Login;
