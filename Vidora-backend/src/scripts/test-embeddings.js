import "dotenv/config";
import { embedTexts } from "../services/embedding.service.js";
import { ensureCollection } from "../config/qdrant.js";

async function testCloudEmbeddings() {
  console.log("🚀 Testing HuggingFace Cloud Embeddings...");
  
  try {
    const texts = [
      "Hello world! This is a test chunk.",
      "Vector databases are incredibly useful for semantic search.",
    ];

    console.log("Generating embeddings for 2 texts...");
    const t0 = Date.now();
    const embeddings = await embedTexts(texts);
    const t1 = Date.now();
    
    console.log(`✅ Generated ${embeddings.length} embeddings in ${t1 - t0}ms`);
    console.log(`Dimensions: ${embeddings[0]?.length}`);
    console.log("Sample vector snippet:", embeddings[0].slice(0, 5));

    console.log("\nTesting Qdrant Collection recreation...");
    const qdrantSuccess = await ensureCollection();
    if (qdrantSuccess) {
      console.log("✅ Qdrant collection is ready and correctly sized.");
    } else {
      console.error("❌ Qdrant collection setup failed.");
    }

  } catch (error) {
    console.error("❌ Test Failed:", error);
  }
  process.exit(0);
}

testCloudEmbeddings();
