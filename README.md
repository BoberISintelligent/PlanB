<p align="center">
  <img src="public/favicon.svg" width="84" height="84" alt="Plan B logo">
</p>

<h1 align="center">Plan B</h1>

<p align="center"><strong>Your next step, backed by the web.</strong></p>

<p align="center">
  <a href="https://planb-nbra.onrender.com/">Try the live assistant</a>
  &nbsp;·&nbsp;
  <a href="#how-memory-works">Conversation memory</a>
  &nbsp;·&nbsp;
  <a href="#run-locally">Run locally</a>
  &nbsp;·&nbsp;
  <a href="#project-structure">Project structure</a>
</p>

When a laptop fails or an urgent errand gets complicated, Plan B researches your
options and prepares the next step. Ask a question, add the constraints that
matter and get a plan with evidence you can inspect.

Built for **The Internet Butler / Your Personal Assistant** challenge by **Exa**.
Our first audience is students and newcomers navigating everyday life in a city
they do not yet know well, often with a limited budget.

## What you can do

| Capability | How it helps |
| --- | --- |
| Live web research | Find options and practical details beyond a model's training data. |
| Conversation-aware follow-ups | Refine a plan using your earlier requests and a summary of the previous answer. |
| Saved search history | Reopen up to 12 recent plans in the same browser, including their sources and context. |
| Dates and deadlines | Set a date, time and time zone when the task has a deadline. |
| Optional preferences | Add a location or a budget in euros only when relevant. |
| Source evidence | Inspect source links, short excerpts and clickable citations. |
| Action checklists | Work through the recommended steps and compare alternatives. |
| Message drafts | Review and edit a prepared enquiry when contacting a provider would help. |
| Useful exports | Download a Markdown plan, an email draft or a calendar reminder. |
| Deeper research | Request a deeper Exa synthesis for a more involved comparison. |

Visitors can open the website and start searching. There is no account setup,
language switch or API-key form. The interface and generated plans are English.

## A good first request

Try this in the [live demo](https://planb-nbra.onrender.com/):

```text
Where can I print and scan documents in Helsinki?
Compare public library options, access requirements and prices.
Explain what I should do next.
```

After the first answer, continue in **Something changed?**:

```text
Only include free options, and explain whether I need a library card.
```

Plan B carries recent task context into the follow-up and researches it again.
You can also ask about a different city, compare a service or plan an everyday
errand. The example buttons fill in a real request that you can edit before
starting the search.

## Getting the most out of Plan B

1. **Describe the outcome you need.** Include useful details, such as needing a
   computer with a browser or a room where speaking aloud is allowed.
2. **Open Search preferences when constraints matter.** Location, budget and
   deadline are optional. Keep these fields aligned with your latest request.
3. **Review the recommendation and evidence.** Check cost, requirements and
   the cited pages before choosing an option.
4. **Refine the same task.** Use Something changed? to add a constraint, request
   an explanation or compare an alternative without repeating the whole brief.
5. **Keep the result you need.** Download the plan, edit an enquiry or export a
   reminder. Use Search history to reopen an earlier plan later.

Choose **New search** when starting a different topic. It starts without the
previous plan's conversation context.

## How memory works

Plan B remembers work in two useful ways:

**Saved plans.** The browser stores up to 12 recent plans, including their
requests, answers, sources and saved conversation context. Reopening a saved
plan lets you continue researching it after a page refresh.

**Context for the next answer.** A follow-up includes up to 6 recent conversation
messages, capped at 1,000 characters each. This includes user requests and
concise summaries of earlier answers, including the recommendation, cost,
requirements and alternatives. You can expand Conversation context in a refined
plan to inspect what was carried forward.

Earlier answers help the assistant understand your request. New research
supplies the factual evidence and citations for each answer. The newest explicit
changes take precedence over older conversation details.

History is local to this browser and website origin. It does not synchronise
between devices. Clearing browser storage removes it; use **Clear history** to
remove saved plans from the interface. Download any plan you want to keep.
Relevant task context is sent to the server and Exa when you request research.

## Dates, deadlines and reminders

In **Search preferences**, set Deadline and confirm the time zone. A deadline
helps focus the research on the time available to you.

Once a plan is ready, choose **Add to calendar** to download an `.ics` file. It
creates a tentative reminder beginning one hour before your selected deadline
and ending at that deadline. Import it into your calendar application.

The calendar entry is a personal reminder. The provider confirms any actual
booking, appointment or reservation.

## Evidence and the final decision

Source cards show the original URL, a short excerpt and whether page contents
were retrieved. Citations in the plan link back to those sources. The app checks
action links against retrieved evidence and removes unrecognised citation IDs.

Exa is asked for fresh page content, but retrieval can fall back to indexed
material. Prices, opening hours and availability can still change. The interface
shows warnings when evidence is incomplete or details need confirmation.

You review the result and complete the external action. Plan B prepares the
research, links and drafts needed for that decision.

## How Exa powers the assistant

1. Three complementary Search API queries explore the current request, optional
   preferences and relevant conversation context.
2. The agent deduplicates the results and requests selected pages through the
   Contents API.
3. Exa produces structured output using the retrieved evidence and a JSON schema.
4. The application validates the output and streams the completed plan with
   its source evidence. If the structure is incomplete, it makes one deeper
   synthesis attempt.

Each result contains a recommendation, cost and access details, concrete steps,
alternatives and unresolved questions. When useful, it also includes a provider
link and an editable message draft. The expandable search trace shows actual
requests and timing, with API cost information when the provider returns it.

## Run locally

Use **Node.js 24**. Install dependencies and configure the server credential:

```sh
npm ci
```

Create `.env` from `.env.example` and `.dev.vars` from `.dev.vars.example`. Add
your Exa credential to both local configuration files:

```dotenv
EXA_API_KEY=your_exa_api_key
```

Start the development server:

```sh
npm run dev
```

Open the address printed in the terminal, normally `http://localhost:5173`.
For the built application:

```sh
npm run build
npm start
```

The default standalone address is `http://localhost:3000`. Keep the Exa key on
the server. The supplied ignore rules exclude `.env` and `.dev.vars` from Git.

## Run with Docker or deploy on Render

With a configured `.env` file:

```sh
docker compose up -d --build
```

For Render, create a Web Service with the **Docker** runtime and use these
environment variables:

| Variable | Value |
| --- | --- |
| `EXA_API_KEY` | Your private server credential |
| `HOST` | `0.0.0.0` |
| `PORT` | `10000` |

Set the health check path to `/api/config`. The Dockerfile uses an unprivileged
user and writable temporary directories for runtime state. The included
`render.yaml` supplies an optional Blueprint with a private-secret placeholder.
For an existing service, update `EXA_API_KEY` in Render Environment and deploy
the latest commit. See [the local launch guide](#run-locally) for local setup.

## Project structure

| Path | Responsibility |
| --- | --- |
| `app/page.tsx` | English interface, research progress, history and refinements |
| `app/globals.css` | Responsive layout and the cream-and-green visual design |
| `app/api/plan/route.ts` | Anonymous research endpoint |
| `app/api/config/route.ts` | Readiness check without a paid provider call |
| `lib/agent.ts` | Exa discovery, page reading and structured synthesis |
| `lib/conversation.ts` | Bounded context and summaries for follow-up research |
| `lib/plan-handler.ts` | Request validation, cancellation and streaming responses |
| `lib/plan-core.ts` | Schemas, source handling, action URLs and exports |
| `lib/exa-client.ts` | Exa HTTP transport, retries and service errors |
| `lib/server-env.ts` | Server-only credential lookup |
| `lib/plan-types.ts` | Shared TypeScript contracts |
| `lib/search-config.ts` | Search and page-reading limits |
| `tests/` | Core, research, memory, visitor and startup regression tests |
| `scripts/serve-standalone.mjs` | Portable launcher for the built worker |
| `Dockerfile`, `compose.yaml` | Container build and local deployment |
| `render.yaml` | Optional Render Blueprint with a private-secret placeholder |
| `README.md` | Product usage, deployment and AI-use notes |

The stack is **TypeScript, React, Vinext/Vite and Exa**, with a Cloudflare
Workers-compatible backend running through workerd in the Docker deployment.
The application does not require a history database.

## Development and verification

```sh
npm run typecheck
npm test
npm run build
```

Tests cover source and action-link handling, time zones and calendar export,
research failures, anonymous access, conversation validation, context isolation
and startup permissions.

## AI use

**In the product:** Exa powers web search, page retrieval and structured research
output. Conversation context improves follow-up requests while new retrieval
provides the evidence. Visitors do not need a separate model-provider key.

**During development:** Codex assisted with implementation, design iteration,
test creation, code review and deployment debugging. The project owner defined
the requirements, selected the product experience and deployed the application.
We used automated checks and targeted runtime verification to assess changes.

## The challenge

Plan B addresses Exa's **The Internet Butler / Your Personal Assistant** challenge
by taking an everyday task through live research to a result the user can review
and act on. Try the hosted application with your own question, inspect its
sources and continue the conversation with a new constraint.
