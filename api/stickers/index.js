import { handleStickerRequest } from '../../server/api/stickerRoutes.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb'
    }
  },
  maxDuration: 30
};

export default async function handler(req, res) {
  return handleStickerRequest(req, res);
}
