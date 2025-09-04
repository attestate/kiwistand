import { render } from '@react-email/render';
import DigestEmail from './emails/Digest.jsx';
import fs from 'fs';

async function main() {
  const html = await render(DigestEmail(), {
    pretty: true,
  });

  fs.writeFileSync('digest.html', html);
}

main();
