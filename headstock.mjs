import { labelOf, noteOf } from './notes.mjs';

const layouts = {
  three: {
    pegs: [[53,143,123],[53,94,133],[53,45,141],[277,45,189],[277,94,197],[277,143,207]],
    head: 'three',
  },
  line: {
    pegs: [[56,188,126],[56,155,125],[56,122,123],[56,89,120],[56,56,116],[56,23,113]],
    head: 'line',
  },
  uke: {
    pegs: [[55,126,126],[55,67,132],[275,67,198],[275,126,204]],
    head: 'uke',
  },
};
function outline(ctx, type) {
  ctx.beginPath();
  ctx.moveTo(140, 223);
  if (type === 'line') {
    ctx.bezierCurveTo(139, 202, 106, 197, 105, 179);
    ctx.lineTo(94, 28);
    ctx.bezierCurveTo(90, 4, 115, 2, 136, 9);
    ctx.bezierCurveTo(173, 23, 170, 42, 153, 56);
    ctx.bezierCurveTo(126, 81, 171, 130, 183, 163);
    ctx.bezierCurveTo(193, 184, 191, 205, 190, 223);
  } else {
    const ukulele = type === 'uke';
    ctx.bezierCurveTo(135, 192, 116, 167, 111, 137);
    ctx.lineTo(126, ukulele ? 47 : 55);
    ctx.bezierCurveTo(129, 42, 124, 31, 116, 24);
    ctx.bezierCurveTo(135, 21, 148, 25, 165, 12);
    ctx.bezierCurveTo(182, 25, 195, 21, 214, 24);
    ctx.bezierCurveTo(206, 31, 201, 42, 204, ukulele ? 47 : 55);
    ctx.lineTo(219, 137);
    ctx.bezierCurveTo(214, 167, 195, 192, 190, 223);
  }
  ctx.closePath();
}
function line(ctx, points, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.stroke();
}
function circle(ctx, x, y, radius, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x,y,radius,0,Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}
export class Headstock {
  constructor(canvas, container, onPick) {
    this.canvas = canvas;
    this.container = container;
    this.onPick = onPick;
  }
  render(type, tuning, selected) {
    const layout = layouts[type];
    this.layout = layout;
    this.container.replaceChildren(...layout.pegs.map(([x,y], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'peg';
      button.style.left = (100 * x / 330) + '%';
      button.style.top = (100 * y / 260) + '%';
      const midi = tuning.notes[index];
      const { name, octave } = noteOf(midi, tuning.flats);
      const octaveLabel = document.createElement('small');
      octaveLabel.textContent = octave;
      button.append(name, octaveLabel);
      button.setAttribute('aria-label', 'Cuerda ' + (tuning.notes.length - index) + ', ' + labelOf(midi, tuning.flats));
      button.onclick = () => this.onPick(index);
      return button;
    }));
    this.select(selected);
  }
  select(selected) {
    if (this.selected === selected && this.drawnLayout === this.layout && this.container.firstChild?.hasAttribute('aria-pressed')) return;
    this.selected = selected;
    this.drawnLayout = this.layout;
    [...this.container.children].forEach((button, index) => button.setAttribute('aria-pressed', selected === index));
    const { head, pegs } = this.layout;
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(2,0,0,2,0,0);
    ctx.clearRect(0,0,330,260);

    ctx.strokeStyle = '#44514842';
    ctx.lineWidth = .5;
    for (let y = 14; y < 260; y += 15) {
      for (let x = 15; x < 330; x += 15) ctx.strokeRect(x,y,.6,.6);
    }
    ctx.fillStyle = '#222c26';
    ctx.fillRect(140,218,50,42);
    line(ctx, [[140,260],[140,222],[190,222],[190,260]], '#536157');
    line(ctx, [[140,245],[190,245]], '#536157');
    outline(ctx, head);
    ctx.fillStyle = '#26342b';
    ctx.fill();
    ctx.strokeStyle = '#64786a';
    ctx.lineWidth = 1.15;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    for (let x = 82; x <= 231; x += 8) line(ctx, [[x,0],[x + 30,230]], '#81958817', .7);
    ctx.restore();

    pegs.forEach(([x,y,postX], index) => {
      const active = index === selected;
      const color = active ? '#bcf5ce' : '#718479';
      const edge = x < 165 ? x + 23 : x - 23;
      line(ctx, [[edge,y],[postX,y]], active ? '#91cba1' : '#516458', 2);
      circle(ctx, postX,y,6,'#18211b', color);
    });
    pegs.forEach(([,y,postX], index) => {
      const x = 146 + 38 * index / (pegs.length - 1);
      const active = index === selected;
      line(ctx, [[x,260],[x,223],[postX,y]], active ? '#bcf5ce' : '#8aa095', active ? 1.6 : 1.2 - index * .09);
      circle(ctx,postX,y,2.5,active ? '#bcf5ce' : '#8fa497','#405348');
    });
    line(ctx, [[140,222],[190,222]], '#b0bcb3', 2.4);
  }
}
