import { loadImage } from '@napi-rs/canvas';

const img = loadImage('https://example.com/test.jpg');
console.log(typeof img.then);
