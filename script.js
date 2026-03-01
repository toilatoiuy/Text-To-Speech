let finalBuffer = null;
let audioContext;

// ====== TTS FUNCTION ======
async function tts(text, voice, rate) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text, voice, rate })
  });

  if (!res.ok) {
    throw new Error("Lỗi TTS: " + res.status);
  }

  const data = await res.json();

  if (!data.audioContent) {
    throw new Error("Không nhận được audioContent từ server");
  }

  return data.audioContent;
}

// ====== LOAD AUDIO FILE ======
async function loadAudio(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return await audioContext.decodeAudioData(buf);
}

// ====== SPLIT PARAGRAPH ======
function splitParagraphs(text) {
  return text.split(/\n+/).filter(p => p.trim() !== "");
}

// ====== GENERATE PROGRAM ======
async function generateProgram() {

  try {

    document.getElementById("status").innerText = "Đang xử lý...";

    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const text = document.getElementById("textInput").value;
    const voice = document.getElementById("voiceSelect").value;
    const rate = parseFloat(document.getElementById("rate").value);
    const voiceVol = parseFloat(document.getElementById("voiceVol").value);
    const musicVol = parseFloat(document.getElementById("musicVol").value);
    const masterVol = parseFloat(document.getElementById("masterVol").value);

    const paragraphs = splitParagraphs(text);

    const intro = await loadAudio("audio/intro.mp3");
    const music = await loadAudio("audio/nhacnen.mp3");

    let buffers = [intro];

    for (let p of paragraphs) {
      const base64 = await tts(p, voice, rate);
      const arr = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const voiceBuf = await audioContext.decodeAudioData(arr.buffer);
      buffers.push(voiceBuf);
    }

    let totalLength = buffers.reduce((s, b) => s + b.length, 0) + music.length;

    finalBuffer = audioContext.createBuffer(
      2,
      totalLength,
      audioContext.sampleRate
    );

    let offset = 0;

    buffers.forEach(buf => {
      for (let ch = 0; ch < 2; ch++) {
        finalBuffer.getChannelData(ch).set(
          buf.getChannelData(ch % buf.numberOfChannels)
            .map(v => v * voiceVol * masterVol),
          offset
        );
      }
      offset += buf.length;
    });

    // ====== MIX MUSIC ======
    let fadeSamples = audioContext.sampleRate * 5;

    for (let ch = 0; ch < 2; ch++) {
      let data = finalBuffer.getChannelData(ch);
      let musicData = music.getChannelData(ch % music.numberOfChannels);

      for (let i = 0; i < musicData.length; i++) {
        let pos = i;
        if (pos < data.length) {
          let duck = 0.4;
          data[pos] += musicData[i] * musicVol * duck;
        }
      }

      for (let i = 0; i < fadeSamples; i++) {
        let pos = offset + i;
        if (pos < data.length) {
          let fade = 1 - (i / fadeSamples);
          data[pos] += musicData[i % musicData.length] * 0.7 * fade;
        }
      }
    }

    saveToLibrary(text);

    document.getElementById("status").innerText = "Hoàn thành!";

  } catch (e) {
    console.error(e);
    document.getElementById("status").innerText = "Lỗi: " + e.message;
  }
}

// ====== DOWNLOAD WAV ======
function downloadWav() {
  if (!finalBuffer) {
    alert("Chưa tạo chương trình");
    return;
  }

  const blob = bufferToWave(finalBuffer, finalBuffer.length);
  const link = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  link.download = `phat_thanh_${date}.wav`;
  link.href = URL.createObjectURL(blob);
  link.click();
}

// ====== CONVERT BUFFER TO WAV ======
function bufferToWave(abuffer, len) {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952);
  setUint32(length - 8);
  setUint32(0x45564157);
  setUint32(0x20746d66);
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164);
  setUint32(length - pos - 4);

  for (let i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

// ====== LIBRARY ======
function saveToLibrary(text) {
  let lib = JSON.parse(localStorage.getItem("radioLib")) || [];
  lib.unshift({ text, date: new Date().toLocaleString() });
  localStorage.setItem("radioLib", JSON.stringify(lib));
  renderLibrary();
}

function renderLibrary() {
  let lib = JSON.parse(localStorage.getItem("radioLib")) || [];
  let html = "";
  lib.forEach((item, i) => {
    html += `<div><b>${item.date}</b>
<button onclick="loadLib(${i})">Tải</button></div>`;
  });
  document.getElementById("library").innerHTML = html;
}

function loadLib(i) {
  let lib = JSON.parse(localStorage.getItem("radioLib"));
  document.getElementById("textInput").value = lib[i].text;
}

renderLibrary();

// ====== TEMPLATES ======
function loadTemplate(type) {
  if (type === "8-3") {
    document.getElementById("textInput").value =
      "Kính chào quý thầy cô và các bạn. Hôm nay, Liên đội Xuân Lai chào mừng ngày 8 tháng 3...";
  }
  if (type === "26-3") {
    document.getElementById("textInput").value =
      "Chào mừng ngày 26 tháng 3 – ngày thành lập Đoàn TNCS Hồ Chí Minh...";
  }
}

// ====== SCHEDULE ======
function scheduleProgram() {
  const time = document.getElementById("scheduleTime").value;
  const target = new Date(time).getTime();
  const interval = setInterval(() => {
    if (new Date().getTime() >= target) {
      generateProgram();
      clearInterval(interval);
      alert("Đã phát chương trình!");
    }
  }, 1000);
  alert("Đã hẹn giờ!");
}



