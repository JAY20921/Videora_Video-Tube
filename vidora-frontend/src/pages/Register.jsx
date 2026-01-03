import React, { useState } from "react";
import { register as registerUser } from "../api/auth";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Register() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState(""); // Added username
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [coverImage, setCoverImage] = useState(null); // Added coverImage
  const [error, setError] = useState("");
  const { setUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    // Check for required text fields
    if (!fullName || !email || !username || !password) {
      setError("All fields (fullName, email, username, password) are required");
      return;
    }

    // Check for required avatar
    if (!avatar) {
      setError("Avatar is required");
      return;
    }

    // Build FormData
    const formData = new FormData();
    formData.append("fullName", fullName);
    formData.append("username", username);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("avatar", avatar); // Avatar is required

    if (coverImage) {
      formData.append("coverImage", coverImage); // Cover image is optional
    }

    try {
      // Send the FormData object
      const user = await registerUser(formData);
      setUser(user);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Registration failed. Try again.");
    }
  };

  return (
    <div className="flex justify-center items-center h-auto py-12">
      <form
        onSubmit={handleSubmit}
        className="bg-yellow shadow-md rounded-lg p-8 w-full max-w-md"
        encType="multipart/form-data" // Important for file uploads
      >
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Create Account
        </h1>
        {error && <div className="text-red-500 text-sm mb-3 text-center">{error}</div>}

        <div className="mb-4">
          <label className="block text-gray-600 mb-1">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-600 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-600 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>

        <div className="mb-4 relative">
  <label className="block text-gray-600 mb-1">Password</label>

  <input
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
    className="w-full border rounded-md px-3 py-2 pr-10 focus:ring-2 focus:ring-violet-500 outline-none"
  />

  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-9 text-gray-500 hover:text-violet-600"
  >
    {showPassword ? "🙈" : "👁️"}
  </button>
</div>


        <div className="mb-6 relative">
  <label className="block text-gray-600 mb-1">Confirm Password</label>

  <input
    type={showConfirmPassword ? "text" : "password"}
    value={confirm}
    onChange={(e) => setConfirm(e.target.value)}
    required
    className="w-full border rounded-md px-3 py-2 pr-10 focus:ring-2 focus:ring-violet-500 outline-none"
  />

  <button
    type="button"
    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
    onBlur={() => setShowPassword(false)}
    className="absolute right-3 top-9 text-gray-500 hover:text-violet-600"
  >
    {showConfirmPassword ? "🙈" : "👁️"}
  </button>
</div>


        <div className="mb-6">
          <label className="block text-gray-600 mb-1">
            Avatar (Required Jpg/Jpeg)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatar(e.target.files[0])}
            required
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-600 mb-1">
            Cover Image (Optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCoverImage(e.target.files[0])}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-md transition"
        >
          Register
        </button>

        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-violet-600 font-semibold">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
