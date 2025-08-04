// Simple audio player with proper exports
export function playSound(soundName: string): void {
  try {
    const soundMap: Record<string, string> = {
      click: "/click.mp3",
      success: "/success.mp3",
      notification: "/notification.mp3",
      cooking: "/cooking.mp3",
      ready: "/ready.mp3",
      delivery: "/delivery.mp3",
    }

    const soundUrl = soundMap[soundName]
    if (soundUrl) {
      const audio = new Audio(soundUrl)
      audio.volume = 0.5
      audio.play().catch((e) => console.error("Error playing audio:", e))
    } else {
      console.warn(`Sound "${soundName}" not found`)
    }
  } catch (e) {
    console.error("Error creating audio object:", e)
  }
}

// Play audio with URL
export function playAudio(url: string, volume = 0.5): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio(url)
      audio.volume = volume
      audio.onended = () => resolve()
      audio.onerror = () => reject(new Error(`Failed to play audio: ${url}`))
      audio
        .play()
        .then(() => resolve())
        .catch(reject)
    } catch (e) {
      reject(e)
    }
  })
}

// Play notification sound
export function playNotificationSound(): void {
  playSound("notification")
}

// Play delivery notification sound
export function playDeliverySound(): void {
  playSound("delivery")
}

// Simple audio player utility class
class AudioPlayer {
  private static audioCache: Record<string, HTMLAudioElement> = {}

  static loadAudio(id: string, src: string): void {
    if (!this.audioCache[id]) {
      const audio = new Audio(src)
      audio.preload = "auto"
      this.audioCache[id] = audio
    }
  }

  static play(id: string): void {
    const audio = this.audioCache[id]
    if (audio) {
      audio.currentTime = 0
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log("Audio playback prevented:", error)
        })
      }
    } else {
      console.warn(`Audio with id "${id}" not found`)
    }
  }
}

export default AudioPlayer
