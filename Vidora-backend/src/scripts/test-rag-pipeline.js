/**
 * End-to-end RAG pipeline test.
 *
 * Tests the full flow WITHOUT uploading a video:
 *   1. HuggingFace cloud embedding generation
 *   2. Qdrant collection creation / verification
 *   3. Storing fake transcript chunks in Qdrant
 *   4. Semantic retrieval — query and verify results
 *   5. Cleanup — delete the test data from Qdrant
 *
 * Usage: node -r dotenv/config src/scripts/test-rag-pipeline.js
 */
import "dotenv/config";
import { embedTexts, embedQuery } from "../services/embedding.service.js";
import { storeChunks, searchSimilar, deleteVideoVectors } from "../services/vectorStore.service.js";
import { ensureCollection, VECTOR_SIZE } from "../config/qdrant.js";

// Fake video ID for test data — will be cleaned up at the end
const TEST_VIDEO_ID = "000000000000000000000099";

// Simulated transcript chunks (like what the chunking service would produce)
const TEST_CHUNKS = [
  {
    index: 0,
    text: "Welcome to this JavaScript tutorial. Today we will learn about closures, scope, and hoisting in modern JavaScript ES6 syntax.",
    startTime: 0.0,
    endTime: 15.5,
  },
  {
    index: 1,
    text: "React is a popular frontend library created by Facebook. It uses a virtual DOM to efficiently update the user interface when state changes.",
    startTime: 15.5,
    endTime: 32.0,
  },
  {
    index: 2,
    text: "Node.js allows you to run JavaScript on the server side. Express is the most popular web framework for building REST APIs with Node.",
    startTime: 32.0,
    endTime: 48.0,
  },
  {
    index: 3,
    text: "MongoDB is a NoSQL document database that stores data in JSON-like BSON format. Mongoose is an ODM library that provides schema validation.",
    startTime: 48.0,
    endTime: 63.0,
  },
  {
    index: 4,
    text: "Vector databases like Qdrant and Pinecone store embeddings for semantic search. They enable retrieval-augmented generation for AI applications.",
    startTime: 63.0,
    endTime: 78.0,
  },
];

// Test queries — each should match a specific chunk
const TEST_QUERIES = [
  // Full sentence queries
  { query: "How do closures work in JavaScript?", expectedChunkIndex: 0 },
  { query: "What is React virtual DOM?", expectedChunkIndex: 1 },
  { query: "How to build REST API with Express?", expectedChunkIndex: 2 },
  { query: "How does MongoDB store data?", expectedChunkIndex: 3 },
  { query: "What are vector databases used for?", expectedChunkIndex: 4 },
  
  // Single word / short phrase queries
  { query: "hoisting", expectedChunkIndex: 0 },
  { query: "facebook", expectedChunkIndex: 1 },
  { query: "Node API", expectedChunkIndex: 2 },
  { query: "NoSQL", expectedChunkIndex: 3 },
  { query: "embeddings", expectedChunkIndex: 4 },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function passed(label) {
  console.log(`  ✅ PASS: ${label}`);
}
function failed(label, detail) {
  console.error(`  ❌ FAIL: ${label}`);
  if (detail) console.error(`          ${detail}`);
}
function section(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

// ─────────────────────────────────────────────
// Main test runner
// ─────────────────────────────────────────────

async function runRAGTest() {
  let totalTests = 0;
  let passCount = 0;

  console.log("\n🧪 Vidora RAG Pipeline — End-to-End Test");
  console.log(`   Test Video ID: ${TEST_VIDEO_ID}`);
  console.log(`   Chunks: ${TEST_CHUNKS.length}`);
  console.log(`   Queries: ${TEST_QUERIES.length}`);

  // ─── Step 1: Qdrant collection ───
  section("Step 1: Qdrant Collection Setup");
  try {
    const ready = await ensureCollection();
    totalTests++;
    if (ready) {
      passed(`Qdrant collection ready (vector size: ${VECTOR_SIZE})`);
      passCount++;
    } else {
      failed("Qdrant collection not available — check QDRANT_URL and QDRANT_API_KEY");
      console.log("\n⚠️  Cannot continue without Qdrant. Exiting.");
      process.exit(1);
    }
  } catch (err) {
    totalTests++;
    failed("Qdrant connection failed", err.message);
    console.log("\n⚠️  Cannot continue without Qdrant. Exiting.");
    process.exit(1);
  }

  // ─── Step 2: Embedding generation ───
  section("Step 2: HuggingFace Cloud Embedding Generation");
  let chunkEmbeddings;
  try {
    const chunkTexts = TEST_CHUNKS.map((c) => c.text);
    const t0 = Date.now();
    chunkEmbeddings = await embedTexts(chunkTexts);
    const elapsed = Date.now() - t0;

    totalTests++;
    if (chunkEmbeddings.length === TEST_CHUNKS.length) {
      passed(`Generated ${chunkEmbeddings.length} embeddings in ${elapsed}ms`);
      passCount++;
    } else {
      failed(`Expected ${TEST_CHUNKS.length} embeddings, got ${chunkEmbeddings.length}`);
    }

    // Verify dimensions
    totalTests++;
    const dims = chunkEmbeddings[0]?.length;
    if (dims === VECTOR_SIZE) {
      passed(`Embedding dimensions correct: ${dims}`);
      passCount++;
    } else {
      failed(`Expected ${VECTOR_SIZE} dimensions, got ${dims}`);
    }

    // Verify values are valid floats (not NaN, not all zeros)
    totalTests++;
    const firstVec = chunkEmbeddings[0];
    const hasValidValues = firstVec.every((v) => typeof v === "number" && !isNaN(v));
    const notAllZeros = firstVec.some((v) => v !== 0);
    if (hasValidValues && notAllZeros) {
      passed(`Embedding values valid (sample: [${firstVec.slice(0, 4).map(v => v.toFixed(4)).join(", ")}, ...])`);
      passCount++;
    } else {
      failed("Embedding values invalid (NaN or all zeros)");
    }
  } catch (err) {
    totalTests++;
    failed("Embedding generation failed", err.message);
    console.log("\n⚠️  Cannot continue without embeddings. Exiting.");
    process.exit(1);
  }

  // ─── Step 3: Store chunks in Qdrant ───
  section("Step 3: Store Chunks in Qdrant");
  try {
    const t0 = Date.now();
    const pointIds = await storeChunks(TEST_VIDEO_ID, TEST_CHUNKS, chunkEmbeddings);
    const elapsed = Date.now() - t0;

    totalTests++;
    if (pointIds.length === TEST_CHUNKS.length) {
      passed(`Stored ${pointIds.length} points in Qdrant in ${elapsed}ms`);
      passCount++;
    } else {
      failed(`Expected ${TEST_CHUNKS.length} point IDs, got ${pointIds.length}`);
    }

    totalTests++;
    const allUUIDs = pointIds.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id));
    if (allUUIDs) {
      passed("All point IDs are valid UUIDs");
      passCount++;
    } else {
      failed("Some point IDs are not valid UUIDs", JSON.stringify(pointIds));
    }
  } catch (err) {
    totalTests++;
    failed("Qdrant storage failed", err.message);
    console.log("\n⚠️  Cannot continue without stored data. Exiting.");
    process.exit(1);
  }

  // ─── Step 4: Semantic retrieval ───
  section("Step 4: Semantic Retrieval (Query → Qdrant Search)");
  let retrievalPassCount = 0;

  for (const { query, expectedChunkIndex } of TEST_QUERIES) {
    try {
      const queryVector = await embedQuery(query);
      const results = await searchSimilar(queryVector, TEST_VIDEO_ID, 3);

      totalTests++;
      if (results.length > 0) {
        const topResult = results[0];
        const topScore = topResult.score;
        const matchedIndex = topResult.chunkIndex;

        if (matchedIndex === expectedChunkIndex) {
          passed(
            `"${query}" → Chunk #${matchedIndex} (score: ${topScore.toFixed(3)}) ✓ correct`
          );
          passCount++;
          retrievalPassCount++;
        } else {
          // Still a "pass" if it returned results — just not the ideal one
          failed(
            `"${query}" → Chunk #${matchedIndex} (expected #${expectedChunkIndex}, score: ${topScore.toFixed(3)})`
          );
          console.log(`          Top result text: "${topResult.text.slice(0, 80)}..."`);
        }
      } else {
        failed(`"${query}" → No results returned (all below MIN_SCORE)`);
      }
    } catch (err) {
      totalTests++;
      failed(`Query "${query}" failed`, err.message);
    }
  }

  console.log(`\n  Retrieval accuracy: ${retrievalPassCount}/${TEST_QUERIES.length} queries matched expected chunk`);

  // ─── Step 5: Cross-video isolation test ───
  section("Step 5: Cross-Video Isolation (Scoped Search)");
  try {
    const queryVector = await embedQuery("JavaScript closures");

    // Search scoped to a DIFFERENT (non-existent) video — should return 0 results
    const wrongVideoResults = await searchSimilar(queryVector, "000000000000000000000001", 5);

    totalTests++;
    if (wrongVideoResults.length === 0) {
      passed("Scoped search to wrong videoId returns 0 results (isolation works)");
      passCount++;
    } else {
      failed(`Expected 0 results for wrong videoId, got ${wrongVideoResults.length}`);
    }

    // Search scoped to the correct test video — should return results
    const correctVideoResults = await searchSimilar(queryVector, TEST_VIDEO_ID, 5);

    totalTests++;
    if (correctVideoResults.length > 0) {
      passed(`Scoped search to correct videoId returns ${correctVideoResults.length} results`);
      passCount++;
    } else {
      failed("Scoped search to correct videoId returned 0 results");
    }
  } catch (err) {
    totalTests++;
    failed("Isolation test failed", err.message);
  }

  // ─── Step 6: Cleanup ───
  section("Step 6: Cleanup (Delete Test Data)");
  try {
    await deleteVideoVectors(TEST_VIDEO_ID);

    // Verify deletion
    const queryVector = await embedQuery("JavaScript closures");
    const afterDelete = await searchSimilar(queryVector, TEST_VIDEO_ID, 5);

    totalTests++;
    if (afterDelete.length === 0) {
      passed("Test data deleted successfully — 0 results after cleanup");
      passCount++;
    } else {
      failed(`Expected 0 results after cleanup, got ${afterDelete.length}`);
    }
  } catch (err) {
    totalTests++;
    failed("Cleanup failed", err.message);
  }

  // ─── Summary ───
  section("Test Summary");
  console.log(`\n  Total:  ${totalTests} tests`);
  console.log(`  Passed: ${passCount} ✅`);
  console.log(`  Failed: ${totalTests - passCount} ❌`);
  console.log(`\n  ${passCount === totalTests ? "🎉 ALL TESTS PASSED!" : "⚠️  Some tests failed — check output above."}\n`);

  process.exit(passCount === totalTests ? 0 : 1);
}

// Run
runRAGTest().catch((err) => {
  console.error("\n💥 Unhandled error:", err);
  process.exit(1);
});
