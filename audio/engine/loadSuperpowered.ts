import { SuperpoweredGlue, SuperpoweredWebAudio } from '@superpoweredsdk/web';

export async function loadSuperpowered() {
  const sp = await SuperpoweredGlue.Instantiate(
    'ExampleLicenseKey-WillExpire-OnNextUpdate', // TODO: your real key
    '/superpowered.wasm'                          // MUST match your public filename
  );
  const engine = new SuperpoweredWebAudio(44100, sp);
  return { sp, engine };
}
