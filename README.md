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

Use **Node.js 24**. This source distribution includes no real API keys or
prebuilt output. Install dependencies and configure the server credential:

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

## Run with Docker

With a configured `.env` file:

```sh
docker compose up -d --build
```

Open `http://localhost:3000`. Use `docker compose down` to stop the service.

## Deploy on Render

The repository contains a Dockerfile and an optional `render.yaml` Blueprint.
For the existing PlanB service, keep that service and use the following settings.
Committing a Blueprint file alone does not convert a manually created service
into a Blueprint-managed service.

| Setting | Value |
| --- | --- |
| Service type | Web Service |
| Runtime | Docker |
| Branch | `main` |
| Root Directory | Empty when `package.json` is at the repository root |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context Directory | `.` |
| Docker Command | Empty; the image starts with `npm start` |
| Health Check Path | `/api/config` |
| Compute plan | Free, if available for your account |

In the service's **Environment** page, set:

| Variable | Value |
| --- | --- |
| `EXA_API_KEY` | A new, private Exa credential |
| `HOST` | `0.0.0.0` |
| `PORT` | `10000` |

Keep the actual value out of source files, Git commits and `render.yaml`.
The Blueprint uses `sync: false` so you supply the secret privately during its
initial setup. For an existing service, add or update it in Environment.

After publishing the clean source, choose **Manual Deploy > Deploy latest
commit** if an automatic deployment has not started. A restart of an old
deployment uses its existing build. Check that the checkout SHA in Render's
logs matches your new Git commit and that startup reports version **1.3.1**.

Open `/api/config` on your deployed URL. With a configured credential it should
return `{"status":"ready","version":"1.3.1"}`. This endpoint checks that a key
is configured; it does not make a paid provider request or validate the key.
Then try a real question to verify Exa connectivity and account access.

The Dockerfile explicitly gives user `node` ownership of `/app` and uses
`/tmp/planb-runtime` and `/tmp/planb-config` for writable runtime state. This
retains the fix for `EACCES` when Wrangler starts. The server listens on
`0.0.0.0` and the configured `PORT`. The launcher creates a private runtime
secret file beside the built worker; it is excluded from source and browser
assets.

GitHub Pages cannot run the included backend. Render runs the backend that
holds the Exa credential. Hosting and Exa have separate usage allowances.

Deployment references: [Render Docker services](https://render.com/docs/docker),
[environment variables](https://render.com/docs/configure-environment-variables)
and [Blueprint specification](https://render.com/docs/blueprint-spec).

## Publish clean source without the old Git history

Rotate any credential previously committed or shared before publishing.
Removing a token from a new commit does not remove it from previous commits.

Extract this clean ZIP into a **new folder**, separate from your existing clone.
The following PowerShell commands publish the complete application as a new
root commit. They replace `main` and discard its old commit history. Do not run
them inside an old checkout or merge the old history afterward.

Run one command at a time and stop if a command fails:

```powershell
Set-Location E:\PycharmProjects\planb-render-clean
git init --initial-branch=main
git add .
git status --short
git commit -m "publish clean render-ready source"
git remote add origin https://github.com/BoberISintelligent/PlanB.git
$remoteMain = git ls-remote origin refs/heads/main
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remoteMain)) { throw "Cannot read remote main; stop here." }
$expected = ($remoteMain -split '\s+')[0]
git push "--force-with-lease=refs/heads/main:$expected" origin main
```

The explicit lease prevents replacing a `main` that changed after its SHA was
read. If it fails, inspect the new remote changes before repeating the process.
Branch protection can also block the update.

Other branches and tags can still retain the old commits. After a successful
push, these commands delete **all remote branches except `main`, and all tags**.
Use them only when those refs are disposable; otherwise clean each retained
branch separately before publishing it.

```powershell
git ls-remote --heads origin | ForEach-Object {
    $parts = $_ -split '\s+'
    $sha = $parts[0]
    $ref = $parts[1]
    if ($ref -ne 'refs/heads/main') {
        git push "--force-with-lease=${ref}:$sha" origin ":$ref"
        if ($LASTEXITCODE -ne 0) { throw "Could not remove $ref; stop here." }
    }
}
git ls-remote --tags --refs origin | ForEach-Object {
    $parts = $_ -split '\s+'
    $sha = $parts[0]
    $ref = $parts[1]
    git push "--force-with-lease=${ref}:$sha" origin ":$ref"
    if ($LASTEXITCODE -ne 0) { throw "Could not remove $ref; stop here." }
}
```

Afterward, work from the new folder or a fresh clone. Old clones can reintroduce
the removed history. A history rewrite cannot erase other people's copies,
forks, cached commit views or GitHub pull-request refs. See
[GitHub's sensitive-data cleanup guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
for these limits and the conditions for further GitHub Support assistance.

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
| `README.md` | Product usage, deployment, verification and AI-use notes |
| `vendor/` | Bundled UI stylesheet and its preserved third-party license |

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
and startup permissions. The previous conversation-memory release passed 37
tests, type checking and a production build. A live Exa development check
resolved a follow-up about Helsinki printing and scanning from its conversation
context and returned 5 sources and 5 steps. That single run is not a latency or
accuracy benchmark.

For this source-only packaging update, tests, type checking and the build were
run again. The distribution was checked for the previously supplied credential,
private configuration files and unexpected Markdown files. Only this root
README is shipped as Markdown; the third-party license remains in a text file.
Dependencies bring their own documentation when installed locally.

Docker execution was not available in the authoring workspace. Linux regression
tests check the startup permission fix; Windows skips the two Linux-specific
permission tests. An attempted local Wrangler startup stopped with
`uv_interface_addresses returned Unknown system error 1`, so an HTTP readiness
check of the built server could not be completed here. Publication to the
GitHub repository and deployment to the user's Render service remain operator
actions.

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
