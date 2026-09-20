import { handleStickerRequest } from '../../server/api/stickerRoutes.js';

export default async function handler(req, res) {
  return handleStickerRequest(req, res);
}
