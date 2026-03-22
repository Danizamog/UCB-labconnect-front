# LabConnect_UCB

## Environment setup

Create the frontend environment file from the example:

```powershell
Copy-Item .env.example .env
```

Notes:
- `VITE_API_BASE_URL` should point to the backend entrypoint you want to use.
- `VITE_GOOGLE_CLIENT_ID` is public client configuration and can stay as provided.
