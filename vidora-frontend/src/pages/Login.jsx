import React, { useState } from "react";
import { login } from "../api/auth";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastProvider";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login({ email, password });
      setUser(user);
      toast("Logged in", { type: "success" });
      navigate("/");
    } catch (err) {
      toast("Invalid email or password", { type: "error" });
    }
  };

  return (
    <div className="flex justify-center items-center h-[80vh]">
      <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 shadow-md rounded-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-6 text-center">Sign in</h1>
        <div className="mb-4">
          <label className="block text-neutral-400 mb-1">Email</label>
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2" />
        </div>
        <div className="mb-6">
          <label className="block text-neutral-400 mb-1">Password</label>
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2" />
        </div>
        <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-md transition">Login</button>
        <p className="text-center text-sm text-neutral-400 mt-4">Don’t have an account? <Link to="/register" className="text-rose-400 font-semibold">Register</Link></p>
      </form>
    </div>
  );
}

export default Login;
