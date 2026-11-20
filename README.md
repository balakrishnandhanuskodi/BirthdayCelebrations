# Charuta's Birthday Adventure

A live video party plus a 2D platformer. Guests gather in a common room; Charuta logs in separately and plays the quest, and every achievement reveals more of her hidden friends. It ends in a shared birthday finale.

## Run the party

```bash
brew install livekit        # once: the open-source video server
pnpm install                # once
pnpm party                  # starts LiveKit + the website
```

The terminal prints:

- **Guest link:** `https://<this-mac-ip>:5173/`, to share with everyone.
- **Charuta's link:** `https://<this-mac-ip>:5173/charuta`, for her only.
- **Charuta's PIN:** stored in `.env.local` as `CHARUTA_PIN`. Edit it there to change it.

Everyone must be on the **same network** as this Mac. The site uses a self-signed certificate (browsers only allow camera and mic on HTTPS), so the first visit shows a "not private" warning: tap **Advanced → Proceed**. On macOS, click **Allow** if the firewall asks about `livekit-server`.

## How it works

Three entrances:

| Who | Link | PIN |
| --- | --- | --- |
| Guests | `https://<ip>:5173/` | none |
| Charuta | `https://<ip>:5173/charuta` | `CHARUTA_PIN` in `.env.local` |
| Moderator | `https://<ip>:5173/moderator` | `MODERATOR_PIN` in `.env.local` |

- **Guests (common area):** see and hear each other and watch Charuta's game live. Charuta can't see or hear them until she picks them. They can type a question for her when joining.
- **11 stops on the route**, alternating **Friend 1 → Challenge 1 → Friend 2 → … → Challenge 5 → Friend 6**:
  - **Friend Station (6):** the game pauses; Charuta's video plus a face-down card per hidden friend. Charuta clicks a card, a random hidden friend is picked, and both videos go big in the centre with a question. The question is the friend's own, else an unused question another guest typed, else one from `src/realtime/questions.ts`. Other guests are muted; the picked friend gets an Unmute prompt.
  - **Challenge (5):** Charuta alone in the spotlight with one of the moderator's 5 challenges (blank ones use the defaults in `questions.ts`).
- **Moderator:** the setup panel in their side bar holds the **5 challenges** and the **team video upload**. During the game they press **Done / continue quest** or **Skip** (friend not responding). If no moderator has joined, Charuta gets these buttons.
- **Party Castle:** if a video was uploaded, it plays full-screen for everyone in sync (Charuta's live reaction in the corner, mics muted). Then everyone not yet picked joins in and the shared finale starts.
- Saved challenges and the video live in `data/` (kept across restarts).
- A flower helicopter visits once, after the first friend's Q&A. A plane with a birthday banner flies back and forth across the sky. No points are shown.

## Capacity (tested with `lk load-test` on this Mac)

| Scenario | LiveKit CPU | Packet loss | Data sent by the Mac |
| --- | --- | --- | --- |
| 40 people on camera + mic, 10 watching | ~0.6 core | 0% | ~29 Mbit/s |
| 40 people on camera + mic, all 40 watching | ~1.8 cores of 8 | 0% | ~190 Mbit/s |

The CPU is fine. **The network is the limit.** For 40 people, plug this Mac into Ethernet, and/or use a fast 5 GHz router. The app reduces load automatically: small tiles get low-resolution video, off-screen tiles pause, and Charuta only receives the guests she has found.

**Guests not on your network?** The local link won't reach them. Use LiveKit Cloud (free tier) by setting `LIVEKIT_PUBLIC_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in `.env.local`, then put this site behind an HTTPS tunnel or a host.

## Code map

| Path | What it is |
| --- | --- |
| `scripts/party.mjs` | Launcher: LiveKit + Vite (HTTPS on your network), prints links and PIN |
| `server/partyServer.ts` | `/api/join`: issues LiveKit tokens; checks Charuta's PIN |
| `src/realtime/useLiveParty.ts` | Room connection, tracks, data messages, reveal state, Charuta's subscription rules |
| `src/game/engine.ts` | Canvas platformer, snapshots for spectators, aeroplane banner |
| `src/components/` | Guest and Charuta entry pages, room, tiles, finale, plane |
| `src/lib/audio.ts` | Sound effects and birthday song (unlocked on first tap) |
