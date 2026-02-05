export async function createAudioAnalyzer(stream) {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();

  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.85;

  // Use provided stream or get a new one
  const audioStream = stream || await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = ctx.createMediaStreamSource(audioStream);
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);

  return {
    analyser,
    data,
    getData() {
      analyser.getByteFrequencyData(data);
      return data;
    }
  };
}
