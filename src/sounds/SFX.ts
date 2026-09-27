import RainSound from 'sounds/rain.mp3';

export class SFX {
  private readonly ambient = [
    { key: 'rain', sound: RainSound },
  ].reduce<Map<string, {
    audio: HTMLAudioElement;
    enabled: boolean;
    power: number;
  }>>((ambient, { key, sound }) => {
    const audio = new Audio(sound);
    audio.loop = true;
    audio.volume = 0;
    ambient.set(key, {
      audio,
      enabled: false,
      power: 0,
    });
    return ambient;
  }, new Map());

  constructor() {
    this.onFirstInteraction = this.onFirstInteraction.bind(this);
    document.addEventListener('keydown', this.onFirstInteraction);
    document.addEventListener('pointerdown', this.onFirstInteraction);
  }

  onFirstInteraction() {
    const { ambient } = this;
    document.removeEventListener('keydown', this.onFirstInteraction);
    document.removeEventListener('pointerdown', this.onFirstInteraction);
    for (const sound of ambient.values()) {
      sound.audio.play();
    }
  }

  setAmbient(key: string, enabled: boolean) {
    const { ambient } = this;
    const sound = ambient.get(key);
    if (sound) {
      sound.enabled = enabled;
    }
    return this;
  }

  update(delta: number) {
    const { ambient } = this;
    for (const sound of ambient.values()) {
      if (sound.enabled) {
        if (sound.power < 1) sound.power = Math.min(sound.power + delta, 1);
      } else {
        if (sound.power > 0) sound.power = Math.max(sound.power - delta, 0);
      }
      sound.audio.volume = Math.cos((1.0 - sound.power) * 0.5 * Math.PI);
    }
  }
}
