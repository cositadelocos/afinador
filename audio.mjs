import { analysisTailSeconds, PitchDetector, PitchTracker } from './pitch.mjs?v=2';
import { playChime } from './chimes.mjs';

export function microphoneMessage(error) {
  if (!isSecureContext) return 'Abre cositadelocos mediante HTTPS o desde localhost para activar el micrófono.';
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Activa el permiso de micrófono en los ajustes de este sitio y vuelve a intentarlo.';
    case 'NotFoundError':
      return 'No se encontró un micrófono. Conecta o habilita uno y vuelve a intentarlo.';
    case 'NotReadableError':
    case 'AbortError':
      return 'No se pudo abrir el micrófono. Revisa el dispositivo y cierra otras apps que lo estén usando.';
    default:
      return 'El micrófono no está disponible. Revisa los permisos y prueba en un navegador compatible.';
  }
}
export class Microphone {
  constructor(onFrame, onEnded) {
    this.onFrame = onFrame;
    this.onEnded = onEnded;
    this.detector = new PitchDetector();
    this.tracker = new PitchTracker();
  }
  async start() {
    if (this.session) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context || !navigator.mediaDevices?.getUserMedia) throw new Error('Microphone unavailable');
    const context = new Context();
    const session = { context, ignoreUntil: 0, pausedMs: 0, pendingPauseMs: 0 };
    this.session = session;
    try {
      const resume = context.resume();
      resume.catch(() => {});
      session.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      if (this.session !== session) {
        session.stream.getTracks().forEach(track => track.stop());
        return;
      }
      await resume;
      if (this.session !== session) return;
      const source = context.createMediaStreamSource(session.stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      session.captureSeconds = Math.min(analyser.fftSize / context.sampleRate, analysisTailSeconds(context.sampleRate));
      source.connect(analyser);
      session.source = source;
      const samples = new Float32Array(analyser.fftSize);
      for (const track of session.stream.getAudioTracks()) {
        track.addEventListener('ended', () => {
          if (this.session !== session) return;
          this.stop();
          this.onEnded();
        });
      }
      let last = -Infinity;
      const intervalMs = 32;
      const tick = time => {
        if (this.session !== session) return;
        if (time - last >= intervalMs && context.currentTime >= session.ignoreUntil) {
          if (session.pendingPauseMs) {
            // The chime's intentional pause is not a loss of the instrument signal.
            session.pausedMs += Math.min(session.pendingPauseMs, time - last - intervalMs);
            session.pendingPauseMs = 0;
          }
          last = time;
          analyser.getFloatTimeDomainData(samples);
          const { hz, rms } = this.detector.detect(samples, context.sampleRate);
          this.onFrame(this.tracker.update(hz, time - session.pausedMs), rms, samples, time);
        }
        if (this.session === session) session.frame = requestAnimationFrame(tick);
      };
      session.frame = requestAnimationFrame(tick);
    } catch (error) {
      if (this.session !== session) return;
      this.stop();
      throw error;
    }
  }
  playConfirmation(mode) {
    const session = this.session;
    if (session?.context.state !== 'running') return;
    const playbackEnd = playChime(session.context, mode);
    // Wait until the playback has cleared the analyzer's input window.
    session.ignoreUntil = playbackEnd + session.captureSeconds + .04;
    session.pendingPauseMs = (session.ignoreUntil - session.context.currentTime) * 1000;
  }
  stop() {
    const session = this.session;
    if (!session) return;
    this.session = null;
    cancelAnimationFrame(session.frame);
    session.source?.disconnect();
    session.stream?.getTracks().forEach(track => track.stop());
    session.context.close().catch(() => {});
    this.tracker.reset();
  }
}
