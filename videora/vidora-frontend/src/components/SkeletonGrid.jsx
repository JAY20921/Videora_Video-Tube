import React from "react";

export default function SkeletonGrid({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 shadow-sm">
          <div className="bg-neutral-800 animate-pulse h-44 w-full" />
          <div className="p-3">
            <div className="h-4 bg-neutral-800 rounded w-3/4 animate-pulse mb-2" />
            <div className="h-3 bg-neutral-800 rounded w-1/2 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
