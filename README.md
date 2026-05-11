# 🛡️ SilentTalk — Secure & Productive Messaging

SilentTalk is a next-generation messaging platform built for privacy, productivity, and commerce. It combines industry-standard End-to-End Encryption (E2EE) with tools like shared tasks, events, stories, and a built-in business store. It also features a highly robust real-time calling system supporting both native WebRTC P2P and Jitsi-based group conferencing.

![SilentTalk Hero](https://img.freepik.com/premium-vector/chatting-messaging-man-woman-chatting-smartphone-hand-holding-mobile-phone-with-text-messages_136162-238.jpg)

## 🚀 Technology Stack

### Frontend
- **Framework**: React 18 (Vite)
- **State Management**: Context API (Auth, Socket)
- **Styling**: Vanilla CSS (Custom Variable Design System)
- **Icons**: React Icons (Fi, Bs) & Lucide React
- **E2EE**: NaCl (tweetnacl-js) for Curve25519 key exchange and XSalsa20 encryption

### Backend
- **Runtime**: Node.js & Express
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **Media**: Cloudinary (HD preservation)
- **Auth**: JWT with Refresh Token Rotation & Reflection-safe logic

---

## 📞 Advanced Calling Infrastructure (WebRTC + Jitsi)

SilentTalk features a state-of-the-art calling infrastructure designed for seamless, high-quality audio and video communication. It intelligently routes calls based on participant count, dynamically upgrading from native 1-on-1 WebRTC peer connections to Jitsi-powered group rooms.

### 1. 1-on-1 Peer-to-Peer Calling (Native WebRTC)
For direct calls between two users, SilentTalk leverages native WebRTC to establish a direct, encrypted, peer-to-peer connection. This ensures the lowest possible latency and highest privacy, as media streams never pass through a central server.

*   **ICE Candidate Gathering & STUN:** Utilizes Google STUN servers (`stun.l.google.com:19302`) to discover public IP addresses and open ports. This allows devices behind standard home routers to find each other.
*   **Symmetric NAT Traversal & TURN:** Integrates free TURN servers via Open Relay (`metered.ca`) to guarantee connectivity even on restrictive mobile carrier networks or corporate firewalls (Symmetric NATs). If a direct P2P connection fails, the TURN server securely relays the encrypted media packets.
*   **Signaling via WebSockets:** Relies on the custom Socket.io implementation to quickly exchange Session Description Protocol (SDP) offers, answers, and ICE candidates in real-time. Events like `call:offer`, `call:answer`, and `call:ice` handle the entire handshake.
*   **Hardware & Media Tracks:** Supports dynamic toggling of video and audio tracks, allowing users to switch between voice-only and video calls instantly. The app properly interacts with `navigator.mediaDevices.getUserMedia` to acquire streams.
*   **Resilience & Recovery:** Built-in connection state monitoring listens for `onconnectionstatechange`. If the state drops to `failed`, the system automatically attempts an ICE restart (`pc.restartIce()`). It waits up to 4 seconds for recovery before officially terminating the call, preventing accidental drops during brief network hiccups.
*   **Picture-in-Picture (PiP):** Local video is rendered in a stylish PiP frame with a frosted glass effect and border, ensuring an unobtrusive but clear view of the user's own feed while maximizing the remote peer's video.
*   **Call Lifecycle & State Management:** Comprehensive handling of `incoming`, `calling`, `connecting`, and `connected` states. Call durations are tracked accurately and logged back to the MongoDB database (`Call` model) upon completion, missed call, or rejection.

### 2. Group Calling & Escalation (Jitsi Meet Integration)
When a 1-on-1 call needs to be expanded, or when a call is initiated within a Group Chat, SilentTalk seamlessly escalates to a robust bridge-based architecture using Jitsi.

*   **Jitsi Room Provisioning:** Dynamically generates unique, secure Jitsi room identifiers based on Group IDs or precise timestamps (e.g., `SilentTalk_Group_12345_16800000`).
*   **Seamless Escalation (1-on-1 to Group):** During an active 1-on-1 WebRTC call, users can click the "Add Participant" button. The platform will automatically terminate the local WebRTC PeerConnection, release the hardware locks, spin up a Jitsi iframe, and send a custom socket event (`mediaType: 'call_upgrade'`) to the original peer over the standard messaging channel.
*   **Instant Re-routing:** The receiving peer intercepts the `call_upgrade` socket message, drops their end of the WebRTC connection, and joins the exact same Jitsi room automatically—without dropping the call entirely or requiring manual acceptance.
*   **Participant Invitations:** Once in the Jitsi room, the initiator can select users from their contact list. The system sends signaling offers containing the active `roomName` to these additional contacts, inviting them directly into the ongoing conference.
*   **Group Call Ringing:** When initiating a group call from a Group Chat, the server utilizes Socket.io room broadcasting (`socket.to('group:groupId').emit('call:incoming')`) to ring all members of the group simultaneously, except the caller.
*   **Responsive Iframe Embedding:** The Jitsi interface is embedded directly within the SilentTalk `CallModal` using an `iframe`. The `prejoinPageEnabled=false` config is used to skip the Jitsi lobby, immediately connecting the user. Custom UI overlays (like the End Call and Add Participant buttons) are rendered via CSS z-index over the iframe for a cohesive native feel.

### 3. Call UI / UX Highlights
*   **Incoming Ring Screen:** Features a pulsating avatar animation, clear Caller ID, and unmistakable Accept/Decline action buttons designed for mobile touch targets and ease of use.
*   **Active Call Controls:** Floating control bar with glassmorphism (`backdrop-filter: blur`) containing toggles for Mute, Camera, Speaker (using `setSinkId` if supported, or OS-level routing fallback), and Add Participant.
*   **Persistent Modals:** Calls remain active even as users navigate through other sections of the app (Chats, Settings, Tasks) thanks to the global `activeCall` state managed in the root `App.jsx`.
*   **Resource Cleanup:** Deep integration with React's `useEffect` cleanup functions and manual track stopping (`track.stop()`) to ensure no phantom microphone/camera indicators remain after a call concludes.
*   **Graceful Fallbacks:** If the browser denies camera/mic permissions, the app gracefully degrades or displays appropriate warnings, preventing fatal crashes.

---

## 🛠️ Key Pipelines & Architecture

### 1. End-to-End Encryption (E2EE)
SilentTalk uses an asymmetric encryption model:
- **Keys**: Every user generates a Curve25519 keypair on login. Public keys are shared; private keys never leave the browser.
- **Protocol**: Messages are encrypted locally using the recipient's public key and the sender's private key (Box encryption).
- **Metadata**: Only message status (Sent/Delivered/Read) and timestamp are visible to the server.

### 2. Authentication Flow
- **High-Security Auth**: Uses short-lived Access Tokens (15m) and long-lived Refresh Tokens (30d).
- **Refresh Cascade**: Implements a dedicated `authFetch` handler that deduplicates refresh requests, preventing race conditions (401 loops). Sessions now reliably silently refresh every 13 minutes to prevent unexpected logouts.
- **Cross-Device Sessions**: Tracks active devices, IPs, and OS info. Supports remote logout of specific sessions.

### 3. Business & Orders
- **Profile**: Users can toggle "Business Mode" to showcase physical or digital products.
- **Order Pipeline**: Features a physical status tracker (Accepted → Packaging → Delivery → Completed) and a digital SAAS link delivery system.
- **Automation**: Order statuses automatically post real-time socket updates into the encrypted chat between buyer and seller.

### 4. Media Optimization
- **HD Preservation**: Uploads use `quality:auto:best` in Cloudinary, bypassing aggressive cropping to maintain original resolution for media.

---

## ✨ Features

- **Real-time Messaging**: Instant delivery with read receipts and typing indicators.
- **Productivity Sharing**: Send Events, Tasks, and Contacts as interactive cards.
- **Stories**: WhatsApp-style temporal status updates with auto-fade and progress bars.
- **Chat Management**: Right-click context menu (Pin, Lock, Archive, Nicknames).
- **Theming**: 4 premium modes (Midnight Dark, Classic Light, Cosmic Purple, Ocean Blue).
- **Mobile First**: Fully responsive layout with haptic-like animations and native-style gestures.

---

## 🔮 Future Roadmap

- [ ] **E2EE Group Chats**: Implementing Multi-recipient encryption using a Group Key distribution model.
- [ ] **Payments**: Integration with Stripe and PayPal for seamless in-chat store checkouts.
- [ ] **Video Effects**: Real-time AR filters and backgrounds for WebRTC video calls.
- [ ] **Desktop App**: Electron-based distribution for native system notifications.

---

## 📝 License
Educational Purpose Only. Secure and Private by Design.
