# dashboardmodern-v2
Dashboard for Home assistant 

## Frontend development

DashboardModern's frontend is plain HTML/CSS/JavaScript under `custom_components/dashboardmodern/frontend`. It talks to Home Assistant only through the authenticated frontend WebSocket connection and the DashboardModern commands documented in `ARCHITECTURE.md`; it does not use Lovelace YAML or direct Home Assistant Store access.

Run frontend tests with:

```bash
npm run test:frontend
```
