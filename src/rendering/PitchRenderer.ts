import { PitchConfig } from '../types/game';

export class PitchRenderer {
  /**
   * Generates a photorealistic, ultra-high-resolution canvas of the football pitch,
   * featuring organic micro-fiber grass blade stippling, authentic mower cross-stripes,
   * goalmouth wear zones, and crisp official pitch markings.
   */
  public static createPitchCanvas(pitch: PitchConfig): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const w = canvas.width;
    const h = canvas.height;

    // Outer surround (dark stadium technical apron + turf border)
    const totalWorldW = pitch.width + 16;
    const totalWorldH = pitch.height + 14;
    const scaleX = w / totalWorldW;
    const scaleY = h / totalWorldH;
    const cx = w * 0.5;
    const cy = h * 0.5;

    // 1. Base Deep Lush Turf Green
    ctx.fillStyle = '#0f4d2a';
    ctx.fillRect(0, 0, w, h);

    const pitchPxW = pitch.width * scaleX;
    const pitchPxH = pitch.height * scaleY;
    const left = cx - pitchPxW * 0.5;
    const top = cy - pitchPxH * 0.5;
    const right = cx + pitchPxW * 0.5;
    const bottom = cy + pitchPxH * 0.5;

    // 2. Alternating Mowed Grass Bands (Professional stadium striping)
    const stripeCount = 14;
    const stripeW = pitchPxW / stripeCount;
    for (let i = -1; i <= stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#156b37' : '#10562e';
      ctx.fillRect(left + i * stripeW, top - scaleY * 2.5, stripeW + 1, pitchPxH + scaleY * 5.0);
    }

    // 3. Subtle Circular Center Mower Ring Pattern
    const mowerGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, pitchPxW * 0.42);
    mowerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    mowerGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.03)');
    mowerGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = mowerGrad;
    ctx.fillRect(left, top, pitchPxW, pitchPxH);

    // 4. Subtle Cross-Pitch Mower Checker Grain
    ctx.fillStyle = 'rgba(255, 255, 255, 0.022)';
    const hStripes = 10;
    const hStripeH = pitchPxH / hStripes;
    for (let j = 0; j < hStripes; j += 2) {
      ctx.fillRect(left, top + j * hStripeH, pitchPxW, hStripeH);
    }

    // 5. Goalmouth Wear Zones (Authentic scuffed turf / bare earth near goalposts)
    const drawGoalmouthWear = (gx: number) => {
      const wearGrad = ctx.createRadialGradient(gx, cy, 10, gx, cy, scaleX * 5.2);
      wearGrad.addColorStop(0, 'rgba(161, 98, 7, 0.22)'); // scuffed brown turf
      wearGrad.addColorStop(0.6, 'rgba(113, 63, 18, 0.10)');
      wearGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = wearGrad;
      ctx.beginPath();
      ctx.ellipse(gx, cy, scaleX * 6.0, scaleY * 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    drawGoalmouthWear(left + scaleX * 1.5);
    drawGoalmouthWear(right - scaleX * 1.5);

    // 6. Crisp White Pitch Markings with subtle chalk powder softness
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.lineWidth = Math.max(4.5, scaleX * 0.18);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Touchlines & Goal lines
    ctx.strokeRect(left, top, pitchPxW, pitchPxH);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, bottom);
    ctx.stroke();

    // Center circle & Center spot
    const centerRad = pitch.centerCircleRadius * scaleX;
    ctx.beginPath();
    ctx.arc(cx, cy, centerRad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, scaleX * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Left & Right Penalty Areas
    const penW = pitch.penaltyAreaW * scaleX;
    const penH = pitch.penaltyAreaH * scaleY;
    ctx.strokeRect(left, cy - penH * 0.5, penW, penH);
    ctx.strokeRect(right - penW, cy - penH * 0.5, penW, penH);

    // Left & Right Goal Areas (6-yard boxes)
    const goalAreaW = pitch.goalAreaW * scaleX;
    const goalAreaH = pitch.goalAreaH * scaleY;
    ctx.strokeRect(left, cy - goalAreaH * 0.5, goalAreaW, goalAreaH);
    ctx.strokeRect(right - goalAreaW, cy - goalAreaH * 0.5, goalAreaW, goalAreaH);

    // Penalty spots & D-arcs
    const penSpotOffset = pitch.penaltyAreaW * 0.72 * scaleX;
    const arcRadius = pitch.centerCircleRadius * 0.82 * scaleX;

    // Left penalty spot + arc
    ctx.beginPath();
    ctx.arc(left + penSpotOffset, cy, scaleX * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(left + penSpotOffset, cy, arcRadius, -0.68, 0.68);
    ctx.stroke();

    // Right penalty spot + arc
    ctx.beginPath();
    ctx.arc(right - penSpotOffset, cy, scaleX * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(right - penSpotOffset, cy, arcRadius, Math.PI - 0.68, Math.PI + 0.68);
    ctx.stroke();

    // 4 Corner Arcs
    const cornerR = scaleX * 1.2;
    ctx.beginPath();
    ctx.arc(left, top, cornerR, 0, Math.PI * 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(right, top, cornerR, Math.PI * 0.5, Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(right, bottom, cornerR, Math.PI, Math.PI * 1.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(left, bottom, cornerR, Math.PI * 1.5, Math.PI * 2);
    ctx.stroke();

    // Corner Spots
    const drawCornerDot = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x, y, scaleX * 0.2, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCornerDot(left, top);
    drawCornerDot(right, top);
    drawCornerDot(left, bottom);
    drawCornerDot(right, bottom);

    return canvas;
  }
}
