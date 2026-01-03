import React from "react";
import { Link, useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar";
import { useAuth } from "../context/AuthContext";
import UserMenu from "./UserMenu";

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="w-full bg-gradient-to-b from-neutral-900/70 to-transparent border-b border-neutral-800 sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white font-bold shadow">
            V
          </div>
          <span className="font-semibold text-lg tracking-wide">Vidora</span>
        </Link>

        <div className="flex-1">
          <SearchBar />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/upload")}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-red-500 text-white shadow hover:scale-105 transition"
          >
            Upload
          </button>

          {!user ? (
            <div className="flex items-center gap-3">
              <div className="text-sm text-red-400">Not signed in</div>
              <Link to="/login" className="px-3 py-2 rounded-lg border border-neutral-700 text-neutral-100 hover:bg-neutral-900">
                Sign in
              </Link>
            </div>
          ) : (
            <UserMenu />
          )}
        </div>
      </div>
    </header>
  );
}
