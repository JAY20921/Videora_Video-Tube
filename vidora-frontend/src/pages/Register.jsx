import React, { useState } from "react";
import { register as registerUser, login } from "../api/auth";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Upload, Image, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastProvider";

function Register() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [coverImage, setCoverImage] = useState(null);
  const [error, setError] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { setUser } = useAuth();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError([]);

    if (password !== confirm) {
      setError(["Passwords do not match"]);
      return;
    }
    if (!fullName || !email || !username || !password) {
      setError(["All fields are required"]);
      return;
    }
    if (!avatar) {
      setError(["Avatar is required"]);
      return;
    }

    const formData = new FormData();
    formData.append("fullName", fullName);
    formData.append("username", username);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("avatar", avatar);
    if (coverImage) formData.append("coverImage", coverImage);

    try {
      setLoading(true);
      await registerUser(formData);
      
      // Auto-login after successful registration
      const loginResponse = await login({ email, password });
      if (loginResponse?.accessToken) {
        localStorage.setItem("accessToken", loginResponse.accessToken);
      }
      setUser(loginResponse?.user || loginResponse);
      toast("Account created and logged in successfully!", { type: "success" });
      navigate("/");
    } catch (err) {
      const data = err.response?.data;
      // Handle Zod validation error arrays from the backend
      if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        const messages = data.errors.map(e => e.message || e.field).filter(Boolean);
        setError(messages.length > 0 ? messages : [data.message || "Registration failed"]);
      } else {
        setError([data?.message || "Registration failed. Try again."]);
      }
    } finally {
      setLoading(false);
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
        className="w-full max-w-md relative z-10 my-auto"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white mb-6 transition-colors group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>

        <form
          onSubmit={handleSubmit}
          className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-8 sm:p-10 w-full"
          encType="multipart/form-data"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-sm text-neutral-400">Join Vidora and start sharing</p>
          </div>

          {error && Array.isArray(error) && error.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-xl px-4 py-3 mb-6">
              {error.length === 1 ? (
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-rose-500 text-white rounded-full text-[10px] font-bold shrink-0">!</span>
                  <span>{error[0]}</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 font-semibold mb-1.5">
                    <span className="w-5 h-5 flex items-center justify-center bg-rose-500 text-white rounded-full text-[10px] font-bold shrink-0">!</span>
                    Please fix the following:
                  </div>
                  <ul className="list-disc pl-9 space-y-0.5">
                    {error.map((msg, i) => <li key={i}>{msg}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-neutral-300 text-sm font-medium mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="John Doe"
                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-700/50 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-neutral-300 text-sm font-medium mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="johndoe"
                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-700/50 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-neutral-300 text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="john@example.com"
                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-700/50 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <label className="block text-neutral-300 text-sm font-medium mb-1.5">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-700/50 pl-4 pr-10 py-3 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-neutral-500 hover:text-neutral-300 transition"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Confirm Password */}
            <div className="relative">
              <label className="block text-neutral-300 text-sm font-medium mb-1.5">Confirm Password</label>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl bg-neutral-900/50 border border-neutral-700/50 pl-4 pr-10 py-3 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-[34px] text-neutral-500 hover:text-neutral-300 transition"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* File inputs */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="flex flex-col items-center gap-2 bg-neutral-900/50 border border-neutral-700/50 border-dashed rounded-xl p-3 cursor-pointer hover:border-rose-500/50 hover:bg-neutral-800/50 transition">
                  <Upload size={18} className="text-neutral-500" />
                  <span className="text-xs text-neutral-400">{avatar ? avatar.name.slice(0, 12) : "Avatar *"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAvatar(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
              <div>
                <label className="flex flex-col items-center gap-2 bg-neutral-900/50 border border-neutral-700/50 border-dashed rounded-xl p-3 cursor-pointer hover:border-rose-500/50 hover:bg-neutral-800/50 transition">
                  <Image size={18} className="text-neutral-500" />
                  <span className="text-xs text-neutral-400">{coverImage ? coverImage.name.slice(0, 12) : "Cover (opt)"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverImage(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white py-3.5 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(225,29,72,0.4)] hover:shadow-[0_0_25px_-5px_rgba(225,29,72,0.6)] font-semibold mt-8"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-neutral-400 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-rose-400 font-semibold hover:text-rose-300 transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

export default Register;
