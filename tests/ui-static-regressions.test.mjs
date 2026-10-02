import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const enhancementsJs = await readFile(new URL('../prototype/src/enhancements.js', import.meta.url), 'utf8');
const enhancementsCss = await readFile(new URL('../prototype/enhancements.css', import.meta.url), 'utf8');

test('operational and technical areas use full guided ticket capture', () => {
  for (const area of ['OPERACIONES','SERVICIOS ESPECIALIZADOS','ALMACEN FISCAL','PROYECTOS']) {
    assert.match(enhancementsJs, new RegExp(`fullCaptureAreas[\\s\\S]*${area.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}`));
  }
});

test('completed checklist items remain readable and turn green instead of struck through', () => {
  assert.match(enhancementsCss, /work-completed:checked[\s\S]*text-decoration:none!important/);
  assert.match(enhancementsCss, /work-completed:checked[\s\S]*background:#eef9f3/);
  assert.match(enhancementsCss, /work-completed:checked[\s\S]*border-color:#82cfa6/);
});
