const apiKey = "AIzaSyBuKGFdtIVVNdBcZr4VsNhAg2cj3R1kukk";
let finalBuffer = null;

document.getElementById("rate").oninput = function(){
  document.getElementById("rateValue").innerText = this.value;
};

async function tts(text, voiceName, rate){
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: text },
        voice: { languageCode: "vi-VN", name: voiceName },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: rate
        }
      })
    }
  );
  const data = await response.json();
  return data.audioContent;
}

async function loadAudio(context, url){
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await context.decodeAudioData(arrayBuffer);
}

async function generateProgram(){

  document.getElementById("status").innerText = "Đang tạo chương trình...";

  const text = document.getElementById("textInput").value;
  const voiceName = document.getElementById("voiceSelect").value;
  const rate = parseFloat(document.getElementById("rate").value);

  const paragraphs = text.split("\n").filter(p=>p.trim()!="");

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const introBuffer = await loadAudio(audioContext,"intro.mp3");
  const musicBuffer = await loadAudio(audioContext,"nhacnen.mp3");
  const midBuffer = await loadAudio(audioContext,"mid.mp3");

  let buffers = [];

  buffers.push(introBuffer);

  for(let i=0;i<paragraphs.length;i++){
    const voiceBase64 = await tts(paragraphs[i], voiceName, rate);
    const voiceArray = Uint8Array.from(atob(voiceBase64), c => c.charCodeAt(0));
    const voiceBuffer = await audioContext.decodeAudioData(voiceArray.buffer);
    buffers.push(voiceBuffer);

    if(i < paragraphs.length-1){
      buffers.push(midBuffer);
    }
  }

  buffers.push(musicBuffer);

  let totalLength = buffers.reduce((sum,b)=>sum+b.length,0);
  finalBuffer = audioContext.createBuffer(2,totalLength,audioContext.sampleRate);

  let offset = 0;
  buffers.forEach(buffer=>{
    for(let ch=0;ch<2;ch++){
      finalBuffer.getChannelData(ch).set(buffer.getChannelData(ch%buffer.numberOfChannels),offset);
    }
    offset += buffer.length;
  });

  document.getElementById("status").innerText = "Hoàn thành. Sẵn sàng tải.";
}

function downloadWav(){

  if(!finalBuffer){
    alert("Chưa tạo chương trình.");
    return;
  }

  const wavBlob = bufferToWave(finalBuffer, finalBuffer.length);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(wavBlob);
  link.download = "radio_xuan_lai_full.wav";
  link.click();
}

function bufferToWave(abuffer, len){
  const numOfChan = abuffer.numberOfChannels,
  length = len * numOfChan * 2 + 44,
  buffer = new ArrayBuffer(length),
  view = new DataView(buffer),
  channels = [],
  sampleRate = abuffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data){view.setUint16(pos,data,true);pos+=2;}
  function setUint32(data){view.setUint32(pos,data,true);pos+=4;}

  setUint32(0x46464952);
  setUint32(length-8);
  setUint32(0x45564157);
  setUint32(0x20746d66);
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate*2*numOfChan);
  setUint16(numOfChan*2);
  setUint16(16);
  setUint32(0x61746164);
  setUint32(length-pos-4);

  for(let i=0;i<abuffer.numberOfChannels;i++)
    channels.push(abuffer.getChannelData(i));

  while(pos<length){
    for(let i=0;i<numOfChan;i++){
      let sample=Math.max(-1,Math.min(1,channels[i][offset]));
      sample=sample<0?sample*0x8000:sample*0x7FFF;
      view.setInt16(pos,sample,true);
      pos+=2;
    }
    offset++;
  }

  return new Blob([buffer],{type:"audio/wav"});
}