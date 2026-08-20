# Cryptography & Security Services

This document covers the cryptographic core of Ravage: password hashing, at-rest
encryption, the X25519-based E2EE key exchange, the Sender Key Ratchet, message
decryption recovery logic, the message security scanner, and the worker-thread
infrastructure that offloads this work off the main/UI thread.

> **Read §3.7 for the threat model.** Messages used to store a second copy of their
> subject — and of the AES key of every attachment — under `INTERNAL_ENCRYPTION_KEY`, a
> build-time constant identical on every installation. That copy is **gone**: the message
> key is now escrowed per participant with X25519, so recovery works without any shared
> secret. The chat-list preview (`User.chats[].ultimomensaje`) was the last instance of the
> same weakness and is now wrapped per user as well — see the end of §3.7.

> **Note on accuracy**: the root `README.md` describes an older scheme (bcrypt,
> RSA-2048/OAEP key wrapping, no multi-key support, no gzip compression, no recovery
> cascade). That description is stale. Everything below was verified directly against
> the current source in `backend/services/cryptoService.js`,
> `backend/services/messageCryptoService.js`,
> `backend/services/seguridad/escanerMensaje.js`, and
> `backend/utils/workers/*.js`. See [Differences from the root README](#differences-from-the-root-readme)
> at the end for a full diff list.

---

## 1. Password & sensitive-data hashing

**File:** `backend/utils/libs.js` (thin wrapper), backed by the `argon2` npm package
(`package.json`: `"argon2": "^0.44.0"`).

```js
// backend/utils/libs.js
const argon2 = lazy('argon2');
export const hash = (password) => argon2.hash(password, { type: argon2.argon2id });
export const compare = (password, storedHash) => argon2.verify(storedHash, password);
```

Ravage hashes passwords, security PINs, and verification codes with **Argon2id**, using
the npm module's defaults:

| Parameter | Value | Meaning |
|---|---|---|
| Algorithm | `argon2id` | Hybrid of Argon2i (side-channel resistant) and Argon2d (GPU resistant) |
| Memory (`m`) | 65536 KB (64 MB) | Memory cost per hash operation |
| Iterations (`t`) | 3 | Number of passes |
| Parallelism (`p`) | 4 | Parallel lanes |

These exceed OWASP's minimum recommendation (m=19456, t=2, p=1). The salt is generated
per-call and embedded in the output string:

```
$argon2id$v=19$m=65536,t=3,p=4$<salt_base64>$<hash_base64>
```

Callers only ever import `{ hash, compare }` from `libs.js` — they never touch `argon2`
directly, and `compare(plaintext, storedHash)` preserves the old bcrypt-era argument
order for compatibility.

### What replaced what

| Removed | Replaced by |
|---|---|
| `bcrypt` dependency | `argon2` |
| `SALTOS_ENCRIPTAR_CONTRASENA` env var ("bcrypt rounds") | Not needed — Argon2 parameters are fixed in code |
| Numeric 2nd argument on every `hash()` call | Argon2's `hash()` takes an options object, no round count |

### What is *not* Argon2

| Data | Algorithm | Why |
|---|---|---|
| `correo_hash`, `id_dp_hash`, `idamigo_hash` | HMAC-SHA256 (keyed) | DB search indexes, not credentials — need to be fast; the HMAC secret protects against rainbow tables |
| JWT session token reference (`token` field in `tksession`) | SHA-256 | Fast lookup hash; the JWT itself is already cryptographically signed |
| Verification codes in `validationcodes` | Argon2id | Short-lived, but still hashed in case the DB is compromised |

---

## 2. `cryptoService.js` — core primitives

**File:** `backend/services/cryptoService.js`

This module provides four independent capabilities: at-rest AES-256-GCM helpers, X25519
key exchange with key-wrapping, the Sender Key Ratchet, and multi-key identity
management. It never touches Argon2 — password hashing lives in `libs.js`.

### 2.1 At-rest encryption (`encriptarDatosSistema` / `desencriptarDatosSistema`)

Used to encrypt any sensitive field before it is persisted to MongoDB or local disk
(session files, identity file, `Security` model fields, encrypted `User`/`Chat`/`Message`
fields, etc.).

```js
export function encriptarDatosSistema(datos) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', getSystemKey(), iv);
    const compressed = gzipSync(Buffer.from(JSON.stringify_or_string(datos), 'utf8'));
    const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
    return { data: encrypted.toString('hex'), iv: iv.toString('hex'),
             tag: cipher.getAuthTag().toString('hex'), compressed: true };
}
```

Key facts:

- **Algorithm:** AES-256-GCM (authenticated).
- **Key:** `INTERNAL_ENCRYPTION_KEY` from `process.env`, loaded once and cached in the
  module-level `systemKey` variable via `getSystemKey()`. Throws if the env var is unset.
- **IV:** 12 random bytes per call (`randomBytes(12)`).
- **Compression:** the plaintext is **gzip-compressed** (`gzipSync`) before encryption,
  and the returned object carries a `compressed: true` flag so
  `desencriptarDatosSistema` knows to `gunzipSync` after decryption. This is new
  relative to the root README's `EncryptedData` schema, which only documents
  `{data, iv, tag}` with no `compressed` field.
- **Failure mode:** `desencriptarDatosSistema` catches all errors internally, logs them,
  and returns `null` rather than throwing — callers must null-check the result.

`hashDatosSistema(datos)` is a related helper: `HMAC-SHA256` keyed with
`process.env.HMAC_SECRET` — this is what produces the `*_hash` index fields
(`correo_hash`, `id_dp_hash`, etc.) mentioned in the hashing section above.

**`HMAC_SECRET` fallback — known, deliberate technical debt.** If `HMAC_SECRET` is
unset, the helper falls back to `getSystemKey()` (i.e. `INTERNAL_ENCRYPTION_KEY`),
which breaks key separation: the same key ends up doing at-rest encryption *and*
keying the search-index HMACs. This is **not** an oversight and **not** a silent
fallback — the code documents the reason and emits a one-shot
`console.warn("[Crypto] HMAC_SECRET no definida: se reutiliza INTERNAL_ENCRYPTION_KEY
para los hashes de búsqueda (separación de claves degradada).")` the first time it
happens (guarded by the module-level `_aviso_hmac_emitido` flag, so it can't spam the
log on every lookup).

Making `HMAC_SECRET` mandatory today would be a **breaking change**: every
`correo_hash` / `id_dp_hash` already stored in MongoDB was computed with the system
key, so a different secret would produce different hashes and **no existing user could
log in** (the login lookup is `User.findOne({ correo_hash })`) — trusted devices,
blocked devices and rate-limit audit rows keyed by `id_dp_hash` would break too.

Pending migration, in this order:

1. Introduce a real `HMAC_SECRET` in the env vault.
2. Re-compute every stored `*_hash` field (`correo_hash`, `id_dp_hash`, `idamigo_hash`
   across `User`, `TokenSession`, `TokenVC`, `TokenDPC`, `DispositivosBloqueados`,
   `AppBlockedDevices`, `RateLimitAudit`, `ValidationCode`, `CuentaValidationCode`,
   `DatosCuentaVC`) with the new secret — this requires decrypting the corresponding `EncryptedData` source
   fields, which is only possible with `INTERNAL_ENCRYPTION_KEY` in hand.
3. **Only then** make `HMAC_SECRET` fail-closed like the other keys.

Until step 3 lands, treat "compromise of `INTERNAL_ENCRYPTION_KEY`" as also meaning
"the attacker can compute `correo_hash` for any email address they guess" — i.e. the
HMAC no longer protects the index against rainbow-table lookups of known emails.

`cifrarContenido` / `descifrarContenido` are the symmetric-key equivalents used for
E2EE message content — same AES-256-GCM + gzip scheme, but the key is a per-message
`MessageKey` (see §2.3) rather than the system key.

`crearCipherStream` / `crearDecipherStream` expose raw AES-256-GCM cipher/decipher
objects for the GridFS streaming file pipeline.

### 2.2 Key exchange — X25519 (not RSA)

**The root README is wrong here.** Ravage does **not** use RSA-2048/OAEP for key
distribution. The current implementation is **X25519** (Curve25519 Diffie-Hellman) with
HKDF-derived wrapping keys:

```js
export async function generarLlavesX25519() {
    // delegates to a worker thread (GENERAR_LLAVES_IDENTIDAD), falls back to
    // main-thread generateKeyPairAsync/generateKeyPairSync('x25519', ...)
}
```

Identity key pairs are generated as `x25519` PEM (`spki` public / `pkcs8` private), not
RSA.

**Wrapping a chain key for a recipient** (`cifrarConX25519`):

```
1. Parse recipient's X25519 public key (PEM → KeyObject, cached in _publicKeyCache)
2. Generate an ephemeral X25519 key pair (ephPriv, ephPub)
3. sharedSecret = ECDH(ephPriv, recipientPublicKey)          [diffieHellman()]
4. wrappingKey  = HKDF-SHA256(sharedSecret, salt='', info='ravage-ck-wrap', 32 bytes)
5. Encrypt the chain key (hex string) with AES-256-GCM under wrappingKey, random 12-byte IV
6. Return { ephPub (32-byte raw X25519 pubkey, hex), iv, data, tag }
```

**Unwrapping** (`descifrarConX25519`) reverses this: reconstructs the sender's ephemeral
public key from its 32 raw bytes by prepending a fixed 12-byte X25519 SPKI DER header
(`_X25519_SPKI_HEADER = 302a300506032b656e032100`), performs the same ECDH + HKDF, and
AES-256-GCM-decrypts.

This is a proper **integrated encryption scheme (ECIES-style)** over X25519 — materially
different from, and cryptographically stronger/more modern than, RSA-OAEP wrapping. No
RSA code exists anywhere in `cryptoService.js`.

### 2.3 Sender Key Ratchet (chain key → message key)

```js
export function ratchetChainKey(chainKeyHex) {
    const chainKey = Buffer.from(chainKeyHex, 'hex');
    const messageKey    = HMAC-SHA256(chainKey, 0x01);   // used to encrypt/decrypt THIS message
    const nextChainKey  = HMAC-SHA256(chainKey, 0x02);   // replaces the chain key for the next message
    return { messageKey, nextChainKey: nextChainKey.toString('hex') };
}

export function advanceChainKey(chainKeyHex) {
    // Same as the nextChainKey branch above, without deriving messageKey.
    // Used in "ratchet-forward" loops that only need to catch up the chain
    // key to a given counter, without spending the (unused) message key.
    return HMAC-SHA256(chainKeyHex, 0x02);
}
```

This matches the root README's naming (`MK = HMAC-SHA256(CK, 0x01)`,
`NextCK = HMAC-SHA256(CK, 0x02)`) — the ratchet math itself hasn't changed. What has
changed is how the chain key gets to each participant (X25519 wrapping, not RSA — see
§2.2) and how many chain keys/private keys exist per identity (see §2.4).

**No automatic rotation-after-100-iterations exists in current code.** The README
describes an automatic full chain-key rotation once a sender's counter passes 100
messages. No such threshold or rotation call exists in `cryptoService.js` or
`messageCryptoService.js` today — the only counters found are `iterations_safety`
*loop guards* capped at `10000`, which exist purely to prevent runaway/infinite
`while` loops on a corrupted `ratchet_info.iteration` value (they throw
`"Ratchet safety limit exceeded"` rather than rotating anything).

### 2.4 Multi-key identity (new, not in README at all)

Introduced to let a user's identity survive re-registering a device or adding new
key material without losing the ability to read old messages. An identity object now
has the shape:

```js
{ primary: { id, privateKey, publicKey, createdAt }, supportKeys: [{ id, privateKey, publicKey, createdAt }, ...] }
```

- `keyFingerprint(privatePem)` — first 16 hex chars of `SHA-256(privateKey)`, used as a
  stable key ID.
- `migrateIdentityIfNeeded(data)` — transparently upgrades the old
  `{privateKey, publicKey}` single-key format to `{primary, supportKeys}` the first time
  it's read; the migration is persisted back to disk.
- `getAllPrivateKeys(identityData)` — returns `[primary, ...supportKeys]` in try-order.
- `descifrarConX25519Multi(envuelta, allKeys)` — tries every available private key in
  order until one successfully unwraps a chain key; returns which key (and whether it
  was the primary) succeeded.
- When a chain key is only unwrappable with a **support** key (not primary), the caller
  schedules a `reWrapChainKey(...)` (in `messageCryptoService.js`) to asynchronously
  re-encrypt that chain key under the current primary public key and persist it — this
  is a lazy migration path so old chats gradually converge back onto a single active
  key.

### Key derivation flow (verified)

```
Recipient X25519 pubkey ──┐
                          │
 Ephemeral X25519 keypair ┴─ ECDH (diffieHellman) ──► sharedSecret
                                                          │
                                                    HKDF-SHA256
                                                 (info="ravage-ck-wrap")
                                                          │
                                                     wrappingKey (32B)
                                                          │
                                          AES-256-GCM(chainKeyHex, wrappingKey, IV)
                                                          │
                                    { ephPub, iv, data, tag }  ── stored in
                                                                   chat.ratchet_keys[].clave_envuelta
```

### Ratchet / encrypt-decrypt pipeline (verified)

```
   chat.ratchet_keys entry (per emisor→receptor pair)
            │  descifrarConX25519Multi()
            ▼
      ChainKey (CK_n, hex)
            │
            ├── HMAC-SHA256(CK_n, 0x01) ──► MessageKey ──► AES-256-GCM(gzip(payload))
            │
            └── HMAC-SHA256(CK_n, 0x02) ──► CK_{n+1}  (advanceChainKey / ratchetChainKey)

   Receiving a message with ratchet_info.iteration = N:
     while (local_counter < N): CK = advanceChainKey(CK); local_counter++   [capped at 10000 iterations]
     { messageKey, nextChainKey } = ratchetChainKey(CK)
     plaintext = descifrarContenido(m.encriptado, messageKey)
```

---

## 3. `messageCryptoService.js` — batch decryption, ratchet-forward, recovery cascade

**File:** `backend/services/messageCryptoService.js`

Responsible for decrypting arrays of MongoDB message documents for a chat, using the
ratchet keys stored on `chat.ratchet_keys`.

### 3.1 Entry point — `descifrarListaMensajes(mensajes, chat)`

- Returns immediately (no-op) if the chat has no `ratchet_keys`, or if the local
  identity/user id can't be resolved.
- Counts how many messages actually need decrypting (`m.encriptado.data` +
  `m.ratchet_info` present, not already decrypted).
- If that count exceeds `UMBRAL_BATCH_PARALELO = 10`, dispatches to
  `_descifrarBatchParalelo` (worker-pool parallel path); on any failure there, **falls
  back to `_descifrarSecuencial`** (logged as `"[E2EE] Batch paralelo falló, cayendo a
  modo secuencial"`).
- Otherwise (≤10 messages) runs `_descifrarSecuencial` directly on the main thread.

### 3.2 Sequential decryption (`_descifrarSecuencial`)

Per message, per unique `(emisor_id, receptor_id=id_propio)` pair (cached in
`cache_keys` for the duration of the call):

1. Look up the `ratchet_keys` entry for that sender→me pair.
2. `descifrarConX25519Multi` unwraps the chain key, trying every private key
   (primary first, then support keys). If a support key succeeded, schedules an async
   `reWrapChainKey(...)` to migrate the wrapped key back to the primary public key
   (fire-and-forget, errors swallowed).
3. **Own-message shortcut**: if the message is from the local user and its `asunto`
   is already an encrypted-object (system ciphertext) rather than ratchet ciphertext,
   it's decrypted directly with `desencriptarDatosSistema` instead of ratcheting
   (own messages carry a system-encrypted copy for the sender's own history).
4. **Stale-counter guard**: if the DB-stored `entry.counter` is already **ahead of**
   this message's `ratchet_info.iteration`, the base chain key was already advanced
   past the point needed to derive this message's key — it is **unrecoverable via the
   ratchet**, so the code skips straight to the system-copy fallback (see §3.3).
5. Otherwise, ratchet-forwards `advanceChainKey` in a loop (capped at 10000
   iterations — throws `"Ratchet safety limit exceeded"` past that) until the local
   counter matches the message's iteration, derives `{messageKey, nextChainKey}` via
   `ratchetChainKey`, and decrypts with `descifrarContenido`.
6. On successful decrypt, advances `cache_keys[...]` in memory (`ck`, `counter`) so
   subsequent messages from the same sender don't re-derive from scratch.
7. **The receiver's ratchet state is intentionally never persisted to the DB** after
   read. The code comment explains why: persisting it would break `getMessageKey()`
   (§3.4), used later for on-demand file downloads referencing older messages — since
   HMAC-SHA256 re-derivation is cheap, it's simply recomputed from the stored base
   `counter` every time instead of being fast-forwarded permanently.

### 3.3 Multi-level recovery cascade on decrypt failure

This is the logic added by the commit *"mejora manejo de errores al descifrar,
implementando recuperación de datos del sistema"* (`cb0f509`) and refined by
*"optimizaciones cuellso botella al descrifrar mensajes"* (`d0d6889`). On any failure
along the ratchet path, decryption falls back through **up to three levels**, each
progressively more permissive, before giving up:

```
Level 1 — Stale-counter fast path
   entry.counter > message.iteration
     → key structurally unrecoverable via ratchet → skip straight to system fallback

Level 2 — AES-GCM decrypt failure on the correctly-ratcheted key (aesErr catch)
   → try desencriptarDatosSistema() on m.contenido[0].asunto / archivos[].nombre,
     IF those fields are still encrypted-object shape (i.e. a system-encrypted
     "own copy" exists alongside the ratchet ciphertext)

Level 3 — Outer catch-all (err) — any exception in the whole per-message block
   (missing ratchet entry, X25519 unwrap failure, thrown safety-limit error, etc.)
     → same system-copy fallback attempted again
     → if that ALSO fails (or there is no system copy):
         m.contenido = [{ asunto: "[Error al descifrar: posible clave de
                          dispositivo obsoleta]", archivos: [] }]
```

What the recovery step reads depends on the age of the message (see §3.7):

- **Messages written with the escrow** — the normal case now. The step unwraps
  `claves_recuperacion` with the local X25519 private key to recover the message key, then
  decrypts `encriptado` in full. It works for **any** participant's messages, not just the
  reader's own, and needs no shared secret.
- **Legacy messages** — those predating the escrow still carry the
  `desencriptarDatosSistema`-encrypted duplicate of `asunto`/`archivos[].nombre`, which is
  read only as a fallback and only helps for messages whose system copy the local
  installation can decrypt.

If neither path yields anything, the generic `"posible clave de dispositivo obsoleta"`
(possibly obsolete device key) text is shown.

### 3.4 Parallel batch decryption (`_descifrarBatchParalelo`)

- Groups message indices **by sender** (`gruposPorEmisor`) — this is the fix from
  `d0d6889`: earlier code apparently could split one sender's messages across workers,
  causing redundant/incorrect ratchet advances; grouping by sender means each worker
  advances exactly one sender's chain independently.
- Dispatches one `DESCIFRAR_BATCH_MENSAJES` job per sender group to the crypto worker
  pool (`getCryptoPool()`), passing serialized `ratchet_keys`, the local user's id, all
  available private keys (`primary` + support), and the raw `systemKey` hex
  (`INTERNAL_ENCRYPTION_KEY`) so the worker can run the same recovery cascade
  standalone (see §4.1 — the worker duplicates the cascade logic since it can't import
  `messageCryptoService.js`, which itself imports Electron-adjacent modules).
- Recomposes results back into the original `mensajes` array by index.
- Also never persists ratchet state after a batch read, for the same reason as §3.2.

### 3.5 `getMessageKey(chat, emisor_id, iteration)`

On-demand single-key derivation (no persistence), used e.g. when a file attached to an
older message needs to be downloaded/decrypted outside the normal message-list flow.
Applies the same stale-counter guard as §3.2 step 4 (returns `null` with a warning log
if `current_counter > iteration` — "ratchet state corrupto"/unrecoverable), then
ratchet-forwards and derives the message key the same way.

### 3.6 `reWrapChainKey(chatId, emisorId, receptorId, ck_hex, primaryPublicKey, counter)`

Re-encrypts a chain key under the current primary public key and persists it to
`chat.ratchet_keys` via `ChatsRavage.updateOne`. Called fire-and-forget whenever a
message was only decryptable using a non-primary (support) key, gradually migrating a
chat's stored ratchet keys back onto a single active identity key.

It **only ever writes `clave_envuelta`** — it never `$set`s `counter`. The `counter`
argument is used exclusively as part of the *filter*:

```js
ChatsRavage.updateOne(
  { _id: chatId,
    ratchet_keys: { $elemMatch: { emisor_id, receptor_id, counter } } },
  { $set: { "ratchet_keys.$.clave_envuelta": nuevaClave } }
);
```

Two properties follow from that shape:

- **It cannot rewind the ratchet.** An earlier version wrote back the `counter` it had
  read alongside the re-wrapped key. When `emisor_id === receptor_id === own user` (the
  sender's own entry, see `MessageRepository.ENVIAR_MENSAJE`), that `$set` could race
  the `$inc` that `ENVIAR_MENSAJE` performs on the *same* array entry and move the
  counter backwards, desynchronizing it from the wrapped chain key and leaving older
  messages permanently underivable in `getMessageKey()` (§3.5). That write is gone.
- **It is atomic and idempotent.** If the ratchet advanced between the read and this
  write, `ck_hex` is already stale and `$elemMatch` simply doesn't match — the update
  is a no-op (`matchedCount === 0`, logged as `"[E2EE] Re-wrap omitido: el ratchet
  avanzó (clave obsoleta)"`) instead of storing a wrapped key that no longer
  corresponds to the entry's counter.

> **Removed**: `_persistirRatchetState` and `_persistirRatchetStateDesdeBatch` no
> longer exist in `messageCryptoService.js`. The receiver's ratchet state is never
> written back to the DB (see §3.2 step 7 for the rationale); `reWrapChainKey` is now
> the only function in this module that writes to `chat.ratchet_keys`.

### 3.7 Per-participant key escrow — how the recovery copy is protected (**fixed**)

Historically every message also stored a "system copy" of its subject, its attachment
filenames and each attachment's AES key, all encrypted with `INTERNAL_ENCRYPTION_KEY`.
Because that key is an environment variable shipped with the build — **the same value on
every installation** — anyone holding it plus DB read access could read every message and
decrypt every attachment without any user's private key. The E2EE guarantee was, in
practice, server-observable.

That copy no longer exists. `ENVIAR_MENSAJE` now writes:

```js
contenido: [{
    asunto: null,                                     // ← no plaintext-equivalent copy
    archivos: [{ id, iv, tag }]                       // ← non-secret GridFS pointers only
}],
encriptado: cifrarContenido(payload, chatKey),        // ← subject + filenames live in here
claves_recuperacion: [                                // ← escrow, one entry per participant
    { usuario_id, clave: cifrarConX25519(chatKey, publicKey) }
]
```

The full payload (`asunto`, `archivos[].nombre`, `emisor`, `data`) is inside `encriptado`,
sealed under the ratchet's `messageKey`. `claves_recuperacion` stores that same key wrapped
to each participant's X25519 public key, using the identical
ECDH → HKDF(`ravage-ck-wrap`) → AES-256-GCM construction as `ratchet_keys.clave_envuelta`
(§2.3). Recovery therefore no longer needs a shared secret:

| Situation | What happens |
|---|---|
| Ratchet is healthy | Normal path: derive `messageKey` from the chain, decrypt `encriptado`. |
| Ratchet desynchronized (`counter > iteration`, missing link, AES failure) | Unwrap `claves_recuperacion` with the local X25519 private key → `messageKey` → decrypt `encriptado`. Same result, no shared key. |
| Attachment download after the counter moved on | `_getFileKeyFromMessage()` unwraps the escrow to recover the file's AES key. |
| Holder of `INTERNAL_ENCRYPTION_KEY` + DB access | **Nothing.** The escrow is sealed to X25519 public keys; the master key opens neither it nor `encriptado`. |

Covered by `backend/tests/escrowRecuperacion.test.js`, which asserts that each participant
recovers subject and filenames, and that neither `INTERNAL_ENCRYPTION_KEY` nor a
non-participant's key can.

**Backward compatibility.** Messages written before this change still carry the old
system-encrypted `contenido[0]`, so the readers (`_recuperarHeredado()` in
`messageCryptoService.js`, its mirror in `cryptoWorker.js`, and the `key_enc` branch of
`_getFileKeyFromMessage()`) keep that path *for reading only*. It is never written again.
Old messages retain the old weakness; new ones do not.

**The chat-list preview is covered too.** `ENVIAR_MENSAJE` used to write the subject to
each participant's `User.chats[].ultimomensaje` with `encriptarDatosSistema()`, which leaked
the latest subject of every chat to a master-key holder. It now writes
`ultimomensaje_e2ee`, wrapped with **that user's own** X25519 public key — the field lives in
their own document, so each user unwraps their own copy. The single `updateMany` became a
`bulkWrite` with one operation per recipient, reusing the same public keys already loaded for
the escrow.

Reading it stays synchronous: `descifrarConX25519` is itself synchronous, so
`_descifrarUltimoMensaje()` in `UserRepository.js` uses `getIdentityCached()` — a non-async
accessor for the in-memory identity that `asegurarIdentidadLocal()` populates in all three
login flows before any user data is read. This avoids turning `procesarUsuario()` (10 call
sites) async. If the cache is somehow cold it returns `""` rather than blocking.

Two details worth knowing:

- **Empty subject.** A file-only message has no subject, and mongoose rejects `data: ""` on a
  `required` String. Both preview fields are set to `null` in that case, matching the old
  behaviour (`encriptarDatosSistema` returned `null` for falsy input).
- **System notices.** `ChatRepository.js` writes fixed public strings ("Usuario expulsado",
  "Chat recién creado", …) to the legacy field. Those are constants and leak nothing, but each
  now also nulls `ultimomensaje_e2ee` — otherwise the reader would prefer a stale wrapped
  subject over the newer notice.

Two other uses of the master key in the message path are deliberate and harmless: reading
legacy documents, and the deletion tombstone (`"Este mensaje ha sido eliminado"`), which is
a public constant identical for every deleted message.

---

## 4. Worker threads — why crypto/scanning runs off the main thread

Both Argon2 hashing indirectly (via `libs.js`, not delegated to a worker) and the X25519
+ ratchet + batch-decrypt operations, plus the message/content scanners, are CPU-bound.
Running them synchronously on Node's single-threaded event loop (or, in Electron, the
main/UI process) would block message rendering, IPC, and the UI. Ravage offloads both
families of work to dedicated `node:worker_threads` pools.

### 4.1 `backend/utils/workers/cryptoWorker.js`

A worker-thread twin of parts of `cryptoService.js` / `messageCryptoService.js`. It
**intentionally duplicates** the X25519 wrap/unwrap, AES-256-GCM content
encrypt/decrypt, `ratchetChainKey`/`advanceChainKey`, and `desencriptarDatosSistema`
logic locally, using `node:crypto` directly — the file's own header comment states it
must **not** import `libs.js` or anything Electron-dependent, since worker threads
spawned this way can't share Electron's runtime.

Exposes three operation types (dispatched via a `parentPort.on('message', ...)`
handler keyed by `tipo`):

| Operation | Purpose |
|---|---|
| `GENERAR_LLAVES_IDENTIDAD` | Generate a new X25519 identity key pair |
| `CIFRAR_X25519` / `DESCIFRAR_X25519` | Wrap/unwrap a single chain key |
| `DESCIFRAR_BATCH_MENSAJES` | Decrypt a batch of messages for one sender, running the full recovery cascade (mirrors §3.3, including the stale-counter fast path, AES-GCM-failure system-copy fallback, and outer catch-all) |

Each worker caches parsed `KeyObject`s (`_privKeyCache` / `_pubKeyCache`) to avoid
re-parsing PEM on every message in a batch.

### 4.2 `backend/utils/workers/escanerWorker.js`

Wraps the pure functions exported by `backend/services/seguridad/escanerMensaje.js`
(steganography, URL, XSS, code, Zalgo, terminal commands, crypto wallets, IP addresses,
homoglyphs — see §5). Supports single-scanner tasks, `ESCANER_MULTI_ASYNC` (run every
enabled async scanner against one text), and `ESCANER_BATCH_MULTI_ASYNC` (same, batched
over many messages) so the async scanners (which include the network call to Google
Safe Browsing, see §5.2) don't block per-message.

### 4.3 `backend/utils/workers/workerPool.js`

Generic reusable worker-thread pool used by both `getCryptoPool()` and
`getEscanerPool()` (two independent singleton instances, one per `workerPath`):

- **Sizing** (`calcularNumeroWorkers`): capped per-pool at `MAX_WORKERS_CRYPTO = 4` /
  `MAX_WORKERS_ESCANER = 2`. Resolution order: explicit user override
  (`setNumWorkersOverride` / `aplicarNuevoNumWorkers`) → `MAX_CPU_CORES_PARALEL` env var
  → automatic (`max(2, cpuCount - 1)`), always clamped to the pool's own max and to the
  real CPU count.
- **Lazy init**: workers aren't spawned until the first `ejecutar()` call
  (`_inicializar()`).
- **Dispatch**: `ejecutar(tipo, datos)` grabs a free worker index if one exists,
  otherwise queues (FIFO, capped at `maxCola` — 200 for crypto, 500 for scanner —
  rejecting with `"Cola del pool llena"` past that) and sends
  `{id, tipo, datos}` over `postMessage`; matches responses back to pending promises by
  `id`.
- **Per-task timeout**: `timeoutMs` (30000ms for both pools) rejects a hung task and
  frees the worker slot.
- **Crash resilience**: on a worker `'error'` or non-zero `'exit'`, all pending tasks
  routed to that worker index are rejected and the worker is transparently respawned
  (`_reemplazarWorker`) — a crashed worker doesn't take down the pool.
- **Idle teardown**: after `idleTimeoutMs` (60000ms) with no new tasks, the whole pool
  terminates itself and nulls out the module-level singleton, so idle apps don't hold
  worker threads open indefinitely; the next `ejecutar()` call transparently recreates
  the pool.
- **`ejecutarBatch(tipo, items, datosComunes)`**: splits `items` into `numWorkers`
  contiguous chunks and dispatches one task per chunk in parallel, reassembling results
  by original index. (Note: `messageCryptoService.js`'s own batch path groups by
  *sender*, not by this generic chunking — it calls `pool.ejecutar()` per sender group
  directly rather than `ejecutarBatch`, for the correctness reason noted in §3.4.)

```
                     ┌───────────────────────────┐
 ejecutar(tipo,data) │        WorkerPool          │
        │            │                             │
        ▼            │  libres: Set<workerIdx>      │
  free worker?  ──Y──►  → postMessage({id,tipo,data})│
        │ N          │  pendientes: Map<id,{resolve, │
        ▼            │              reject, timer}>  │
     cola.push() ◄────┤  cola: FIFO queue             │
   (reject if full)   │                             │
                       └──────────────┬──────────────┘
                                      │ worker 'message' / 'error' / 'exit'
                                      ▼
                         resolve/reject pending promise,
                         free worker slot, drain queue
```

---

## 5. Message security scanners

### 5.1 `backend/services/seguridad/escanerMensaje.js` (216 lines, active)

Runs client-side (frontend, to warn users before copy/render) and server-side (backend,
to block sending) checks on message text. Settings are per-user (`ESCANER_*` app
settings) combined with per-chat overrides (`chat.escaneres_seguridad`, taking the
`Math.max` of the two so a chat can only be *stricter*, never laxer, than the user's
global setting) via `escaneres_seguridad_mensaje_activados(id_chat)`.

Verified against, and consistent with, `Docs/Services/seguridad/ESCANERES_MENSAJES.md`:

| Scanner | Function(s) | Detects | False positives |
|---|---|---|---|
| Steganography / invisible chars | `detectSteganography`, `removeSteganography` | Zero-width chars, BOM, soft hyphen, full-width chars (`​-‏`, `‪-‮`, `⁠-⁯`, `﻿`, tag chars, `­`, `！-｠`) | Very low |
| URLs | `detectUrl`, `removeUrl` | Plain `http(s)://` URLs via regex | Low |
| Malicious URLs | `detectarUrlMaliciosa` | Calls Google Safe Browsing v4 API (`GOOGLE_SAFE_BROWSING_API_KEY` env var) for MALWARE/SOCIAL_ENGINEERING/UNWANTED_SOFTWARE/POTENTIALLY_HARMFUL_APPLICATION threat types; fails open (returns not-malicious) if no API key or on network error | Depends on Google's data |
| XSS | `detectarXSS` | `<script>`, `<iframe>`, `<object>`, `<embed>`, `<applet>`, `<form>`, `<style>`, `<base>`, `<meta>`, `<link>` tags, `javascript:`/`vbscript:` schemes, `on*=` handlers, `data:text/html` | — |
| Source code / injection | `detectarCodigo` | JS/PHP/Python-ish syntax (`function`, arrow fns, `import ... from`, `console.`/`document.` calls) and SQL/NoSQL patterns (`SELECT...FROM`, `INSERT INTO`, `DROP TABLE`, `$where`, `$ne`) | High |
| Zalgo text | `detectarZalgo`, `removeZalgo` | 3+ consecutive combining diacritical marks | Low |
| Terminal commands | `detectarComandosTerminal` | `sudo`, `rm -rf`, `wget`, `curl`, `chmod`, `chown`, `bash -c`, `powershell`, `cmd.exe`, `mkfs`, `dd if=`, etc. | Medium/High for technical users |
| Crypto wallet addresses | `detectarCryptoBilleteras` | BTC (P2PKH/P2SH/Bech32) and ETH (`0x...`) address patterns | Medium (can catch UUIDs/hashes) |
| IP addresses | `detectarDireccionesIP` | IPv4 dotted-quad pattern | Medium (can catch version strings) |
| Homoglyphs | `detectarHomoglifos` | Words mixing Latin with Cyrillic/Greek code points in the same token (e.g. `pаypal` with a Cyrillic а) | Very low |

All scanner detector functions are pure/synchronous except `detectarUrlMaliciosa`,
which is async (network call) — this is why it, along with the other flagged
`ESCANERES_ASYNC` entries, is run through `escanerWorker.js`'s
`ejecutar_escaneres`/`ESCANER_MULTI_ASYNC` path rather than inline.

### 5.2 File scanning — does not exist

There is **no file-content scanner in Ravage**, and there never was one. An empty
0-byte placeholder, `backend/services/seguridad/escanerArchivos.js`, used to sit in
this directory (added by commit `159294e`, *"creado sistema escaneres seguridad"*); it
has since been **deleted**, so `backend/services/seguridad/` now contains exactly one
file: `escanerMensaje.js`.

Attachments are streamed straight through AES-256-GCM into GridFS
(`MessageRepository.js`) with no inspection of their contents at any point. Any
documentation that mentions file scanning is describing something that has never been
implemented — treat it as future work, not as a missing/disabled feature.

---

## 6. Device trust & blocking (`Security.js` model + docs)

**Model:** `backend/models/Security.js` — Mongoose schemas backing all of the below.
Full field-by-field schema detail lives in `Docs/backend/DATA_LAYER.md`; this section
only covers the crypto-relevant shape and the security logic layered on top, translated
and cross-checked from `Docs/Services/seguridad/DISPOSITIVOS_SEGURIDAD.md`.

All PII-bearing fields (`correo`, `id_dp`, `os`, `nombre`, `data`) use the shared
`EncryptedDataSchema` (`{data, iv, tag, compressed}` — see §2.1) and are paired with a
`*_hash` HMAC-SHA256 index field (`correo_hash`, `id_dp_hash`) for lookups without
decryption, per §1's "hashes that are not Argon2" table.

### 6.1 Trusted devices (`tokendpc` / `TokenDPC` model)

After validating a login's emailed code, the user can mark the device as trusted:

1. A JWT valid for 365 days (`tipo: 'confianza'`) is generated.
2. It's stored **twice**: encrypted in a local file (`dispositivoConfianza`, read at
   startup without a DB round-trip) and as a SHA-256 hash (never the raw token) in the
   `tokendpc` collection, for cross-validation/remote management.
3. On every subsequent login, before emailing a verification code, the app checks all
   three: local file exists + JWT not expired + matching hash present in `tokendpc` for
   the same `correo_hash`/`id_dp_hash`. If all hold, the email step is skipped.
4. A notification email is sent whenever trust is added or revoked.

### 6.2 Per-account device blocking (`dpbloqueado` / `DPBLOQUEADOSchema`)

A user can block a specific device from their own account (independent of which device
performs the block):

1. Looks up the target device's `os`/`nombre` from `tksession` or `tokendpc` before
   removal.
2. Inserts a record into `dpbloqueado`, revokes all active sessions for that device in
   `tksession`, and revokes its `tokendpc` trust entry.
3. Every login/autologin checks `dpbloqueado` for `(id_dp_hash, correo_hash)`; a match
   denies access to that account from that device.
4. Unblocking removes the `dpbloqueado` record and sends a notification email.

### 6.3 App-wide device blocking (`appblockeddevices` / `AppBlockedDevicesSchema`)

Blocks a device from the entire application, regardless of account — irreversible by
the end user.

- **Automatic:** an in-memory rate limiter (7 attempts / 15 min per `id_dp_hash`) logs
  violations to `ratelimitaudit` (`RateLimitAuditSchema`, unique-indexed on
  `(id_dp_hash, fecha)`, resets daily). 5 violations in the same day auto-inserts the
  device into `appblockeddevices` — permanent until a maintainer manually removes it.
- **Manual:** a maintainer inserts the `id_dp_hash` directly. This field is stored as
  **plaintext SHA-256 hash intentionally** (it doesn't expose the real device ID, and
  needs to be human-copyable/insertable) — the user can retrieve their own device hash
  from the device management panel.

### 6.4 Login check order (verified against docs, matches code intent)

```
loginUsuario()
    │
    ├─ id_dp_hash in appblockeddevices?     → app-wide block, permanent
    ├─ id_dp_hash + correo_hash in dpbloqueado? → account-level block
    ├─ valid local trust token + present in tokendpc? → skip email verification
    └─ otherwise → send emailed verification code, require validation
```

### 6.5 Notification emails

| Action | Template |
|---|---|
| Device marked trusted | `AvisoDispositivoConfianzaAnadido` |
| Trust revoked | `AvisoDispositivoConfianzaRevocado` |
| Session closed remotely | `AvisoSesionCerrada` |
| Device blocked | `AvisoDispositivoBloqueado` |
| Device unblocked | `AvisoDispositivoDesbloqueado` |

---

## 7. Socket.IO authentication

Cross-checked from `Docs/Services/seguridad/SOCKETIO_AUTH.md`; not part of
`cryptoService.js` but uses the same "ephemeral random secret" pattern.

- **Local dev server** (`serverLocalHost.js`): generates a random 64-hex-char secret at
  startup (`randomBytes(32).toString('hex')`), different every run, kept in the
  module-private `_socketSecret` variable. (It used to be exported as
  `getSocketSecret()`; that export had no consumers and has been removed — the secret
  is now only read inside this module.) A Socket.IO `io.use()` middleware rejects any connection whose
  `socket.handshake.auth.token` doesn't match exactly.
- **Production server** (`serverRailway.js`): reads the secret from the `SOCKET_SECRET`
  env var. **Fails closed** — if unset, the server starts but rejects every connection.
- The token travels in the Socket.IO handshake `auth` payload (inside the WebSocket
  upgrade body), not in a header or URL — so it doesn't leak into access logs.
- A prior metadata leak was fixed: `chat_ipc.js` used to call
  `socket.emit("identificar", userId)` where `socket` was actually the server-wide `io`
  instance — `io.emit()` broadcasts to **every** connected socket, leaking each user's
  id to all other connected clients. That call has been removed.

```
[Socket.IO client] --WS upgrade + {auth:{token}}--> io.use() middleware
        token != secret → next(Error) → connection rejected
        token == secret → next() → socket admitted
                                      │
                         socket.on("identificar", userId => socket.join(userId))
                                      │
                     io.to(userId).emit("nueva-notificacion", ...) [buzonAPI.js]
```

---

## Differences from the root README

The root `README.md`'s cryptography sections (`Características Principales` table,
`Stack Tecnológico`, and `Sistema de Cifrado en Profundidad`, especially "Capa 0" and
"Capa 4") describe an earlier version of this system. Confirmed differences between
that description and the current code:

| README claims | Current code actually does |
|---|---|
| Password hashing: **bcrypt, 14 rounds** (`SALTOS_ENCRIPTAR_CONTRASENA`) | **Argon2id** (`argon2` npm package, m=64MB/t=3/p=4). No round-count env var exists; `bcrypt` is not a dependency. |
| Key exchange: **RSA-2048 with OAEP padding** (`crypto.publicEncrypt`, SHA-1 OAEP) for wrapping chain keys | **X25519** ECDH + HKDF-SHA256 (`ravage-ck-wrap` info string) + AES-256-GCM for wrapping chain keys. No RSA code exists anywhere in `cryptoService.js`. |
| Identity keys: single RSA-2048 keypair per user, regenerating loses old message access | **X25519** identity, and a **multi-key model** (`primary` + `supportKeys[]`) that lets old keys keep decrypting past messages while new ones take over, with automatic migration/re-wrap (`reWrapChainKey`) |
| Ratchet rotates automatically after 100 messages | **No such rotation exists.** Only a loop-safety cap of 10000 ratchet-forward iterations (a corruption guard, not a security rotation) |
| `EncryptedData` schema: `{data, iv, tag}` | Actual schema also includes a `compressed: boolean` flag — payloads are gzip-compressed before AES-256-GCM encryption |
| No mention of decrypt-failure recovery | A **3-level recovery cascade** exists (stale-counter fast path → system-copy fallback on AES failure → outer catch-all fallback), added specifically to handle corrupted/desynchronized ratchet state and stale device keys, implemented identically in both the main thread (`messageCryptoService.js`) and the worker (`cryptoWorker.js`) |
| No mention of worker-thread offloading for crypto/scanning | Both X25519/ratchet batch decryption and message scanning run through dedicated `worker_threads` pools (`workerPool.js`) with crash recovery, idle teardown, and CPU-aware sizing |
| No mention of a file-content scanner | **No file scanning exists.** The empty `escanerArchivos.js` placeholder has been deleted; `backend/services/seguridad/` holds only `escanerMensaje.js` (message-text scanning) |
| E2EE described as absolute | Message subjects, attachment filenames, attachment keys and the chat-list preview used to be stored under the build-wide `INTERNAL_ENCRYPTION_KEY`; they are now wrapped per participant with X25519 (§3.7). Legacy documents keep the old copy, read-only. |
