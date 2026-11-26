import { handleApiRequest } from '../../server/router.ts';

export default async (request: Request): Promise<Response> => {
  return handleApiRequest(request);
};
