import { render } from '@react-email/render';
import DigestEmail from './emails/Digest.jsx';
import fs from 'fs';

const html = render(DigestEmail(), {
  pretty: true,
});

fs.writeFileSync('digest.html', html);