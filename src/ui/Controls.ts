import type { Rain } from 'objects/Rain';

export const SetupControls = (rain: Rain) => {
  const dom = document.getElementById('controls')!;
  dom.classList.add('enabled');

  const rainToggle = document.getElementById('rain')!;
  rainToggle.addEventListener('click', () => {
    rain.enabled = !rain.enabled;
    rainToggle.classList[rain.enabled ? 'add' : 'remove']('enabled');
  });
};
