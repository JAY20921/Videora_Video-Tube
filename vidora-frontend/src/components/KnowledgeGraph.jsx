import React, { useRef, useEffect, useState } from "react";
import { getTranscript } from "../api/ai";

/**
 * Phase 5: Knowledge Graph Visualization.
 *
 * Renders extracted concepts as an interactive force-directed graph
 * using vanilla Canvas (no D3 dependency required).
 * Nodes are connected by their relationships.
 */
export default function KnowledgeGraph({ videoId, onConceptClick }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Load concepts
  useEffect(() => {
    if (!videoId) return;
    setLoading(true);
    getTranscript(videoId)
      .then((data) => {
        setConcepts(data?.concepts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [videoId]);

  // Build graph data from concepts
  useEffect(() => {
    if (concepts.length === 0) return;

    const nodeMap = new Map();
    const edgeList = [];

    // Create nodes
    concepts.forEach((concept, i) => {
      if (!nodeMap.has(concept.name)) {
        nodeMap.set(concept.name, {
          id: concept.name,
          x: 200 + Math.cos(i * 0.8) * 120 + Math.random() * 60,
          y: 150 + Math.sin(i * 0.8) * 100 + Math.random() * 60,
          vx: 0, vy: 0,
          radius: 24 + Math.min(concept.related?.length || 0, 5) * 4,
          color: getNodeColor(i),
        });
      }

      // Create related nodes and edges
      (concept.related || []).forEach((rel) => {
        if (!nodeMap.has(rel.name)) {
          nodeMap.set(rel.name, {
            id: rel.name,
            x: 200 + Math.random() * 200,
            y: 150 + Math.random() * 150,
            vx: 0, vy: 0,
            radius: 18,
            color: getNodeColor(nodeMap.size),
          });
        }
        edgeList.push({
          source: concept.name,
          target: rel.name,
          label: rel.relationship,
        });
      });
    });

    setNodes(Array.from(nodeMap.values()));
    setEdges(edgeList);
  }, [concepts]);

  // Simple force simulation + render
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || nodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    const w = container.clientWidth;
    const h = Math.max(280, container.clientHeight);
    canvas.width = w * 2;   // retina
    canvas.height = h * 2;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(2, 2);

    const simNodes = nodes.map((n) => ({ ...n }));
    const cx = w / 2;
    const cy = h / 2;

    function tick() {
      // Forces
      for (let i = 0; i < simNodes.length; i++) {
        const n = simNodes[i];
        // Center gravity
        n.vx += (cx - n.x) * 0.002;
        n.vy += (cy - n.y) * 0.002;

        // Repulsion from other nodes
        for (let j = i + 1; j < simNodes.length; j++) {
          const m = simNodes[j];
          const dx = n.x - m.x;
          const dy = n.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 800 / (dist * dist);
          n.vx += (dx / dist) * force;
          n.vy += (dy / dist) * force;
          m.vx -= (dx / dist) * force;
          m.vy -= (dy / dist) * force;
        }
      }

      // Edge attraction
      for (const edge of edges) {
        const s = simNodes.find((n) => n.id === edge.source);
        const t = simNodes.find((n) => n.id === edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.003;
        s.vx += (dx / dist) * force;
        s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force;
        t.vy -= (dy / dist) * force;
      }

      // Apply velocity + damping
      for (const n of simNodes) {
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        // Keep in bounds
        n.x = Math.max(n.radius, Math.min(w - n.radius, n.x));
        n.y = Math.max(n.radius, Math.min(h - n.radius, n.y));
      }

      // Draw
      ctx.clearRect(0, 0, w, h);

      // Edges
      for (const edge of edges) {
        const s = simNodes.find((n) => n.id === edge.source);
        const t = simNodes.find((n) => n.id === edge.target);
        if (!s || !t) continue;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Edge label
        if (edge.label) {
          const mx = (s.x + t.x) / 2;
          const my = (s.y + t.y) / 2;
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.font = "9px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(edge.label, mx, my - 4);
        }
      }

      // Nodes
      for (const n of simNodes) {
        const isHovered = hoveredNode === n.id;

        // Glow
        if (isHovered) {
          const glow = ctx.createRadialGradient(n.x, n.y, n.radius, n.x, n.y, n.radius * 2.5);
          glow.addColorStop(0, n.color + "40");
          glow.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? n.color + "60" : n.color + "30";
        ctx.fill();
        ctx.strokeStyle = n.color + (isHovered ? "cc" : "66");
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = isHovered ? "#ffffff" : "rgba(255,255,255,0.7)";
        ctx.font = `${isHovered ? "bold " : ""}${n.radius < 22 ? 9 : 11}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Truncate long labels
        const label = n.id.length > 14 ? n.id.slice(0, 12) + "…" : n.id;
        ctx.fillText(label, n.x, n.y);
      }

      animRef.current = requestAnimationFrame(tick);
    }

    // Mouse interaction
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      let found = null;
      for (const n of simNodes) {
        const dx = mx - n.x;
        const dy = my - n.y;
        if (dx * dx + dy * dy < n.radius * n.radius) {
          found = n.id;
          break;
        }
      }
      setHoveredNode(found);
      canvas.style.cursor = found ? "pointer" : "default";
    };

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const n of simNodes) {
        const dx = mx - n.x;
        const dy = my - n.y;
        if (dx * dx + dy * dy < n.radius * n.radius) {
          onConceptClick?.(n.id);
          break;
        }
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);

    tick();

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
    };
  }, [nodes, edges, hoveredNode, onConceptClick]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-500">
        Loading knowledge graph…
      </div>
    );
  }

  if (concepts.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-500">
        No concepts extracted yet
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full rounded-xl bg-neutral-900/50 border border-white/5 overflow-hidden" style={{ minHeight: "280px" }}>
      <canvas ref={canvasRef} className="w-full" />
      {hoveredNode && (
        <div className="absolute top-3 left-3 bg-neutral-900/90 backdrop-blur-md border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white shadow-xl">
          <span className="font-bold">{hoveredNode}</span>
          <span className="text-neutral-500 ml-1.5">— click to explore</span>
        </div>
      )}
    </div>
  );
}

/* Color palette for nodes */
function getNodeColor(index) {
  const colors = [
    "#f43f5e", "#ec4899", "#a855f7", "#6366f1",
    "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e",
    "#eab308", "#f97316", "#ef4444", "#8b5cf6",
  ];
  return colors[index % colors.length];
}
