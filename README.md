# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
## Backend

The FastAPI backend foundation lives in `backend/`. From that directory, install its minimal dependencies and start the development server:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`. Health checks are available at `/` and `/api/health`; interactive API documentation is available at `/docs`.

### PostgreSQL connection

P3.1 uses `DATABASE_URL` from `backend/.env`. Copy `backend/.env.example` to `backend/.env` and replace `YOUR_PASSWORD` locally. No tables are created by this phase.

If PostgreSQL is installed locally and the database is missing, create it with:

```powershell
createdb -U postgres supply_chain_ai
```

Then verify the connection with `GET http://127.0.0.1:8000/api/health/db`.
