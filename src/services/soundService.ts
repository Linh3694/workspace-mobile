import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Sound files
const SOUNDS = {
  ticketCreated: require('../assets/sound/ticket_create.wav'),
};

/** expo-audio thay cho expo-av (ngừng ở SDK 54). */
class SoundService {
  private player: AudioPlayer | null = null;

  async playTicketCreatedSound(): Promise<void> {
    try {
      this.unloadSound();

      // Phát được cả khi iPhone gạt Silent
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });

      const player = createAudioPlayer(SOUNDS.ticketCreated);
      this.player = player;
      player.volume = 1.0;
      // AudioPlayer kế thừa SharedObject (có addListener) nhưng type public không lộ ra → ép kiểu.
      const emitter = player as unknown as {
        addListener?: (event: 'playbackStatusUpdate', cb: (status: { didJustFinish: boolean }) => void) => void;
      };
      emitter.addListener?.('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) this.unloadSound();
      });
      player.play();

      console.log('🔔 Playing ticket created sound');
    } catch (error) {
      console.error('❌ Error playing ticket created sound:', error);
    }
  }

  private unloadSound(): void {
    try {
      if (this.player) {
        this.player.remove();
        this.player = null;
      }
    } catch (error) {
      console.error('Error unloading sound:', error);
    }
  }
}

export const soundService = new SoundService();
export default soundService;
