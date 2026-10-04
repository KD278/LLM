# ChatDPT

ChatDPT is a Node.js/Express chat application. The Express server serves the
frontend and the `/chat` API from the same origin.

## Run locally

1. Install Node.js (version 18 or newer).
2. Install dependencies:

   ```sh
   npm ci
   ```

3. Create a `.env` file in the project root with the API keys:

   ```dotenv
   GROQ_API_KEY=your_groq_api_key
   TAVILY_API_KEY=your_tavily_api_key
   ```

4. Start the server:

   ```sh
   npm start
   ```

5. Open <http://localhost:3001>.

## Deploy on Vercel

The project is configured as an Express app for Vercel. Vercel serves the
frontend from `public/` and runs the `/chat` route as a function.

1. Push the project to GitHub and import the repository into Vercel.
2. Keep the root directory as `.` (the repository root). Use the Express
   framework preset if Vercel offers it; otherwise choose **Other**.
3. Leave the build command and output directory at their defaults. There is no
   separate frontend build step.
4. In **Project Settings → Environment Variables**, add `GROQ_API_KEY` and
   `TAVILY_API_KEY` for the environments you want to deploy (Production and,
   optionally, Preview and Development).
5. Deploy or redeploy, then open the deployment URL. The chat page should load
   at `/`, and the browser sends messages to `/chat` on the same domain.

Do not deploy this as a static-only project: the Express `/chat` route must run
as a Vercel Function. Keep API keys in Vercel environment variables, never in
frontend files or source control. Redeploy after changing environment
variables.

## Run locally or deploy to Render

For local development, create a root `.env` file with `GROQ_API_KEY` and
`TAVILY_API_KEY`, then run `npm ci` followed by `npm start`. Open
<http://localhost:3001>.

To deploy to Render, create a **Node.js Web Service**, set the build command
to `npm ci`, and the start command to `npm start`. Add the same two API keys as
service environment variables. Render supplies `PORT` automatically.
