// Explicit auth route to ensure nested authentication paths are matched by Vercel.
// Reuse the same request adapter and API router as the general API catch-all.
import handler from '../[...path].ts';

export default handler;
