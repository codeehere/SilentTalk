# 🛡️ SilentTalk — Secure & Productive Messaging

SilentTalk is a next-generation messaging platform built for privacy, productivity, and commerce. It combines industry-standard End-to-End Encryption (E2EE) with tools like shared tasks, events, stories, and a built-in business store.

![SilentTalk Hero](https://images.unsplash.com/photo-1611746872915-64382b5c76da?auto=format&fit=crop&q=80&w=1200)

## 🚀 Technology Stack

### Frontend
- **Framework**: React 18 (Vite)
- **State Management**: Context API (Auth, Socket)
- **Styling**: Vanilla CSS (Custom Variable Design System)
- **Icons**: React Icons (Fi, Bs)
- **E2EE**: NaCl (tweetnacl-js) for Curve25519 key exchange and XSalsa20 encryption

### Backend
- **Runtime**: Node.js & Express
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **Media**: Cloudinary (HD preservation)
- **Auth**: JWT with Refresh Token Rotation & Reflection-safe logic

---

## 🛠️ Key Pipelines & Architecture

### 1. End-to-End Encryption (E2EE)
SilentTalk uses an asymmetric encryption model:
- **Keys**: Every user generates a Curve25519 keypair on login. Public keys are shared; private keys never leave the browser.
- **Protocol**: Messages are encrypted locally using the recipient's public key and the sender's private key (Box encryption).
- **Metadata**: Only message status (Sent/Delivered/Read) and timestamp are visible to the server.

### 2. Authentication Flow
- **High-Security Auth**: Uses short-lived Access Tokens and long-lived Refresh Tokens stored in HTTP-Only cookies.
- **Refresh Cascade**: Implements a dedicated `authFetch` handler that deduplicates refresh requests, preventing race conditions (401 loops).

### 3. Business & Orders
- **Profile**: Users can toggle "Business Mode" to showcase physical or digital products.
- **Order Pipeline**: Features a physical status tracker (Accepted → Packaging → Delivery → Completed) and a digital SAAS link delivery system.
- **Automation**: Order statuses automatically post updates into the encrypted chat between buyer and seller.

### 4. Media Optimization
- **HD Preservation**: Uploads use `quality:auto:best` in Cloudinary, bypassing aggressive cropping to maintain original resolution for media up to 50MB.

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
