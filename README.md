## MedFlow AI (backend)

Family medical-appointment helper API (NestJS + Prisma + PostgreSQL).

### Dates and time (Stage 2)

- **`dateTime` is stored in UTC** in PostgreSQL. Send ISO 8601 strings from clients (e.g. `2026-06-01T10:00:00.000Z`).
- **`GET /api/appointments/next`** returns the single earliest appointment with `dateTime >= now`, where `now` is the server clock (typically UTC in production).
- **`GET /api/appointments/upcoming`** lists future appointments from an optional `from` query (ISO datetime); default `from` is now. Query `limit` defaults to `20` (max `100`).

### Stage 2 API surface

| Area | Endpoints |
|------|-----------|
| Notes | Part of appointment create/update/list responses (`notes` field). |
| Requirements (checklist) | `POST/GET/PATCH/DELETE` under `/api/appointments/:appointmentId/requirements` |
| Convenience | `GET /api/appointments/upcoming`, `GET /api/appointments/next` |

### Stage 3 — AI (extraction + grounded Q&A)

Requires **`OPENAI_API_KEY`** (see [`.env.example`](.env.example)). Optional: `OPENAI_MODEL`, `OPENAI_BASE_URL`, **`PATIENT_NAME`** (Hebrew label for prompts; defaults to a generic “single patient / father” wording).

| Endpoint | Purpose |
|----------|---------|
| `POST /api/query/answer` | Body `{ "question": "..." }` → `{ "answer": "..." }`. Answers use **only** upcoming appointments + requirements from the DB, phrased in Hebrew via the model. JWT required. |
| `POST /api/ai/extract` | Body `{ "text": "..." }` → validated partial extraction (`title`, `dateTime`, `location`, `notes`, `requirements[]`). JWT required. |

Answers and extraction errors exposed to users are in **Hebrew** where applicable. No live OpenAI calls in unit tests by default.

### Minimal SPA (`web/`)

React + Vite app (RTL Hebrew UI): login/register, next appointment, AI question box, appointments table. Proxies `/api` → `http://localhost:3000` during dev.

```bash
# Terminal 1 — API
npm run start:dev

# Terminal 2 — UI (after: cd MedFlowAI && npm install --prefix web)
npm run web:dev
```

Open **http://localhost:5173**. Ensure DB migrated + seeded; use seed users or register. For **Stage 3** questions, set `OPENAI_API_KEY` in `.env`.

### Local database (Docker)

PostgreSQL matches [`.env.example`](.env.example): user `postgres`, password `postgres`, database `medflow`. **Docker maps Postgres to host port `5434`** to reduce clashes with services on `5432`–`5433`. If `5434` is also taken, edit `docker-compose.yml` (left side of `ports`) and the port in `DATABASE_URL`.

```bash
docker compose up -d
cp .env.example .env   # set JWT_SECRET (and other secrets) before production
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

Stop/remove containers (data kept in the Docker volume until you remove it):

```bash
docker compose down
```

---

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
# medflow-ai
