import { handleAiRequest } from '../server/api/aiRoutes.js';

export default async function handler(req, res) {
  return handleAiRequest(req, res);
}
