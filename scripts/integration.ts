import { ApiClient } from '../src/api/client.js';
import { loadConfig } from '../src/config.js';
import { ModelDiscovery } from '../src/models/discovery.js';
import { flash, flashSchema } from '../src/tools/flash.js';
import { vision } from '../src/tools/vision.js';
import { generateImage } from '../src/tools/image.js';
import { safeMessage } from '../src/utils/data.js';
const args = process.argv.slice(2);
if (!args.includes('--run')) {
  console.log('Skipped. Set the two proxy environment variables, then pass --run. Optional: --vision <absolute-image-path>, --image, --adapter <auto|chat|images>. Paid calls may occur.');
} else {
  try {
    const client = new ApiClient(loadConfig()), discovery = new ModelDiscovery(client);
    const result = await flash(client, discovery, flashSchema.parse({ task: 'Reply with OK.', max_rounds: 1 }));
    if (result.incomplete) throw new Error('Text integration failed.');
    console.log(JSON.stringify({ text: 'passed', model: result.model }));
    if (args.includes('--vision')) {
      const file = args[args.indexOf('--vision') + 1];
      if (!file || file.startsWith('--')) throw new Error('Missing image path.');
      const result = await vision(client, discovery, { prompt: 'Briefly describe this image.', images: [{ path: file }] });
      console.log(JSON.stringify({ vision: 'passed', model: result.model }));
    }
    if (args.includes('--image')) {
      const adapter = args.includes('--adapter') ? args[args.indexOf('--adapter') + 1] : 'auto';
      if (adapter !== 'auto' && adapter !== 'chat' && adapter !== 'images') throw new Error('Invalid adapter.');
      const result = await generateImage(client, discovery, { prompt: 'A simple wooden chair on a plain white background.', adapter });
      console.log(JSON.stringify({ image: 'passed', model: result.model, count: result.images.length }));
    }
  } catch (error) {
    console.error(safeMessage(error)); process.exitCode = 1;
  }
}
