# realtime

Public and tenant-scoped realtime event dispatching infrastructure over WebSocket/Socket.IO connections.

## Purpose
Enables server-side broadcasting of events that need instant synchronization across clients without polling, such as:
- `promotion:updated`: notifies connected clients when promotions or vouchers are modified by administrators.
- Public event publishing bus for connected browser clients.

## Files
| File | Role |
|---|---|
| `public-events.ts` | Type definitions and publisher functions for public realtime events |
| `index.ts` | Public API surface of the realtime module |
