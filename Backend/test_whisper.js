const whisper = require("whisper-node");
const fs = require("fs");
const { execFile } = require("child_process");

async function run() {
  console.log("Extracting audio...");
  await new Promise((resolve) => {
    execFile("ffmpeg", [
      "-y", "-t", "5", "-i", "test.mkv",
      "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", "test.wav"
    ], resolve);
  });

  console.log("Transcribing...");
  const transcript = await whisper("test.wav", {
    modelName: "base.en",
    whisperOptions: {
      word_timestamps: true,
      gen_file_txt: false,
      gen_file_subtitle: false,
      gen_file_vtt: false
    }
  });

  console.log("Done.");
  fs.writeFileSync("whisper_out.json", JSON.stringify(transcript, null, 2));
}

run().catch(console.error);
