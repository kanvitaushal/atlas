/** Short burst of particles from a screen point. */
export function burstConfetti(x: number, y: number, root: HTMLElement) {
  const colors = ['#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#f472b6']
  const n = 48
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span')
    const size = 4 + Math.random() * 5
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5
    const dist = 80 + Math.random() * 120
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 40
    el.className = 'confetti-bit'
    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size * 0.6}px;
      border-radius: 2px;
      background: ${colors[i % colors.length]};
      pointer-events: none;
      z-index: 9999;
      opacity: 0.95;
      transform: translate(-50%, -50%) rotate(${Math.random() * 360}deg);
      animation: confetti-fly 0.9s ease-out forwards;
      --dx: ${dx}px;
      --dy: ${dy}px;
    `
    root.appendChild(el)
    setTimeout(() => el.remove(), 950)
  }
}
