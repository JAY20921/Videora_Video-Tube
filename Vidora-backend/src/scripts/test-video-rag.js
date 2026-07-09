import 'dotenv/config';
import { transcribeVideo } from '../services/transcription.service.js';
import { chunkTranscript } from '../services/chunking.service.js';
import { embedTexts } from '../services/embedding.service.js';
import os from 'os';
import path from 'path';

async function testRAG() {
  const videoPath = "D:\\Downloads\\Hip-Hop  Classical  Avinash Bangera & Vasu prada X Moon Sitar.mp4";
  const workDir = os.tmpdir();

  try {
    console.log(`🎤 Transcribing video: ${videoPath}`);
    const { fullText, language, segments } = await transcribeVideo(videoPath, workDir);
    
    console.log('\n--- TRANSCRIPT RESULT ---');
    console.log(`Detected Language: ${language}`);
    console.log(`Transcript Length: ${fullText.length} characters`);
    console.log('Preview:');
    console.log(fullText.substring(0, 500));
    console.log('-------------------------\n');

    if (fullText.length < 10) {
      console.log('❌ Transcript is too short. AI Tutor will likely fail.');
      return;
    }

    console.log('🔪 Chunking transcript...');
    const chunks = chunkTranscript(segments);
    console.log(`Generated ${chunks.length} chunks.`);

    if (chunks.length > 0) {
      console.log('🧠 Generating embeddings for the first chunk...');
      const embeddings = await embedTexts([chunks[0].text]);
      console.log(`Generated embedding vector with ${embeddings[0].length} dimensions.`);
      console.log('✅ RAG Pipeline test completed successfully!');
    }

  } catch (err) {
    console.error('❌ RAG Pipeline Test Failed:', err);
  }
}

testRAG();
