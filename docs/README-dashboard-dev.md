# Dashboard Dev: Match Flow

## Diagram Alur Request → Mutual Suka

```mermaid
flowchart TD
    A[Rekomendasi] -->|Kirim Request| B[profile_request]
    B -->|Target Approve| C[profile_viewed / approved]
    C -->|Requester Like| D[requester_liked]
    C -->|Target Like| E[target_liked]
    D -->|Target Like| F[mutual_liked]
    E -->|Requester Like| F[mutual_liked]
    F -->|Lanjut (opsional jalur terpisah)| G[approved + chatting]
    C -->|Lanjut oleh salah satu| H[requester_approved/target_approved]
    H -->|Lanjut pihak lain| G
    B -->|Reject| R[rejected]
    *:::note
```

Keterangan singkat:
- profile_request: requester meminta lihat profil
- profile_viewed: target menyetujui permintaan
- requester_liked/target_liked: satu sisi menyukai
- mutual_liked: keduanya menyukai
- approved + chatting: aktif setelah keduanya menekan “Lanjut”

## Endpoint Terkait

- POST /api/matches/[matchId]/request
- POST /api/matches/[matchId]/approve
- POST /api/matches/[matchId]/like
- GET /api/matches/incoming
- POST /api/match (keputusan Lanjut/Tolak)

## Audit Admin

Gunakan halaman: /admin/tools/match-flow

