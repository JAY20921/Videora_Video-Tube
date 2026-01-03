import React from "react";

function tryMp4Url(url) {
  if (!url || typeof url !== "string") return null;
  // If it's already an mp4, return as-is
  if (/\.mp4($|\?)/i.test(url)) return url;

  // Cloudinary: insert transformation f_mp4 after /upload/
  if (url.includes("/upload/")) {
    try {
      const afterUpload = url.split("/upload/")[1];
      const prefix = url.split("/upload/")[0] + "/upload/";
      const mp4Path = `f_mp4/${afterUpload.replace(/\.[^.]+($|\?)/, ".mp4")}`;
      return prefix + mp4Path;
    } catch (e) {
      // fallback to extension replace
    }
  }

  // simple extension replace fallback
  return url.replace(/\.[a-z0-9]+($|\?)/i, ".mp4");
}

export default function DebugVideo({ src }) {
  const onError = (e) => {
    const video = e.target;
    console.error("HTMLVideo error event", {
      code: video?.error?.code,
      message: video?.error?.message,
      networkState: video?.networkState,
      readyState: video?.readyState,
      src: video?.currentSrc,
    });
  };

  const onAbort = () => console.warn("HTMLVideo fetch aborted by user agent (abort event)");
  const onLoadedMeta = () => console.debug("HTMLVideo loadedmetadata, src available");

  const mp4 = tryMp4Url(src);

  return (
    <div>
      <div style={{ marginBottom: 8, fontSize: 13, color: "#ddd" }}>
        <div><strong>Resolved src:</strong> <code style={{ color: "#fff" }}>{src || "(empty)"}</code></div>
        <div style={{ marginTop: 4 }}><strong>MP4 fallback:</strong> <code style={{ color: "#fff" }}>{mp4}</code></div>
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => window.open(src, "_blank")}
            style={{ marginRight: 8 }}
          >
            Open original URL
          </button>
          <button
            onClick={() => mp4 && window.open(mp4, "_blank")}
            disabled={!mp4}
          >
            Open MP4 fallback
          </button>
        </div>
      </div>

      <div style={{ background: "#000", position: "relative", paddingTop: "56.25%" }}>
        <video
          controls
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          src={src}
          preload="metadata"
          playsInline
          crossOrigin="anonymous"
          onError={onError}
          onAbort={onAbort}
          onLoadedMetadata={onLoadedMeta}
        />
      </div>
    </div>
  );
}