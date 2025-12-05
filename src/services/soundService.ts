import { Audio } from 'expo-av';

// Sound files
const SOUNDS = {
  ticketCreated: require('../assets/sound/ticket_create.wav'),
};

class SoundService {
  private soundObject: Audio.Sound | null = null;

  async playTicketCreatedSound(): Promise<void> {
    try {
      // Unload any existing sound first
      if (this.soundObject) {
        await this.soundObject.unloadAsync();
        this.soundObject = null;
      }

      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Load and play the sound
      const { sound } = await Audio.Sound.createAsync(SOUNDS.ticketCreated, {
        shouldPlay: true,
        volume: 1.0,
      });

      this.soundObject = sound;

      // Set up completion listener to unload sound
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.unloadSound();
        }
      });

      console.log('🔔 Playing ticket created sound');
    } catch (error) {
      console.error('❌ Error playing ticket created sound:', error);
    }
  }

  private async unloadSound(): Promise<void> {
    try {
      if (this.soundObject) {
        await this.soundObject.unloadAsync();
        this.soundObject = null;
      }
    } catch (error) {
      console.error('Error unloading sound:', error);
    }
  }
}

export const soundService = new SoundService();
export default soundService;







