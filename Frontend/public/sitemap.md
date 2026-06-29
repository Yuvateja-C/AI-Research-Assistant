# ResearchAI Sitemap

This is a human-readable and AI-friendly sitemap of all public-facing pages of ResearchAI.

## Site Structure

- [Home / Workspace](https://ai-research-assistant-tan.vercel.app/)
  - Landing page detailing product features, customer testimonials, and upload parameters.
  - Interactive secure document analysis workspace (access requires token authentication).
- [Privacy Policy](https://ai-research-assistant-tan.vercel.app/privacy)
  - Information regarding vector retention and secure local processing.
- [Terms of Service](https://ai-research-assistant-tan.vercel.app/terms)
  - Detailed acceptable use guidelines and RAG accuracy disclaimers.

## API Integration Targets
- Backend base: `https://api-research-assistant-bseo.onrender.com/`
- Health check endpoint: `GET /`
- User auth endpoint: `POST /auth/login`
- Vector query endpoint: `POST /chats/{chat_id}/ask`
