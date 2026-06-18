import React, { useState } from "react";
import { register as registerUser } from "../api/auth";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Upload, Image } from "lucide-react";

function Register() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [coverImage, setCoverImage] = useState(null);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!fullName || !email || !username || !password) {
      setError("All fields are required");
      return;
    }
    if (!avatar) {
      setError("Avatar is required");
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
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[80vh] py-8">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900 border border-neutral-800 shadow-xl rounded-2xl p-8 w-full max-w-md"
        encType="multipart/form-data"
      >
        <h1 className="text-2xl font-bold mb-1 text-center">Create Account</h1>
        <p className="text-sm text-neutral-500 text-center mb-6">Join Vidora and start sharing</p>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-lg px-4 py-2.5 mb-4 text-center">
            {error}
          </div>
        )}

        {/* Full Name */}
        <div className="mb-4">
          <label className="block text-neutral-400 text-sm mb-1.5">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="John Doe"
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none transition"
          />
        </div>

        {/* Username */}
        <div className="mb-4">
          <label className="block text-neutral-400 text-sm mb-1.5">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="johndoe"
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none transition"
          />
        </div>

        {/* Email */}
        <div className="mb-4">
          <label className="block text-neutral-400 text-sm mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="john@example.com"
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none transition"
          />
        </div>

        {/* Password */}
        <div className="mb-4 relative">
          <label className="block text-neutral-400 text-sm mb-1.5">Password</label>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2.5 pr-10 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9 text-neutral-500 hover:text-neutral-300 transition"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Confirm Password */}
        <div className="mb-5 relative">
          <label className="block text-neutral-400 text-sm mb-1.5">Confirm Password</label>
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2.5 pr-10 text-sm text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none transition"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-9 text-neutral-500 hover:text-neutral-300 transition"
          >
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* File inputs */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <label className="flex flex-col items-center gap-2 bg-neutral-800 border border-neutral-700 border-dashed rounded-lg p-3 cursor-pointer hover:border-rose-500/50 transition">
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
            <label className="flex flex-col items-center gap-2 bg-neutral-800 border border-neutral-700 border-dashed rounded-lg p-3 cursor-pointer hover:border-rose-500/50 transition">
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

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white py-2.5 rounded-lg transition font-semibold shadow-lg shadow-rose-500/20"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p className="text-center text-sm text-neutral-500 mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-rose-400 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
