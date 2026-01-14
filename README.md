# LifeMirror 3.5 🪞✨

**LifeMirror is your smart, unified dashboard for a balanced digital life.** It brings together your tasks, finances, fitness, mood, and important links into one clean interface.

> **Newly Revived**: This project has been migrated to a modern **React + TypeScript (Vite)** frontend while maintaining the original backend architecture.

## ✨ Features

* **Holistic Life Score:** Visualize balance across Tasks, Finance, Fitness, Mood, and Digital Organization.
* **Unified Dashboard:** Centralized view of all your key life metrics.
* **Smart Modules:**
    * **Tasks:** Integrated Calendar and List view.
    * **Finance:** Track bills and subscriptions.
    * **Fitness:** Monitor steps, sleep, and activity.
    * **Mood:** Daily mood logging and stress tracking.
    * **Vault:** Secure digital asset links.
* **Modern Stack:** React, TypeScript, Chart.js, FullCalendar.

## 🛠️ Technology Stack

### Client (`/client`)
* **Framework:** React 18 + TypeScript (Vite)
* **Styling:** Custom CSS (Original Design Preserved) + Feather Icons
* **Charts:** Chart.js + react-chartjs-2
* **Calendar:** FullCalendar
* **Auth:** Auth0 React SDK

### Backend (`/backend`)
* **Server:** Node.js + Express
* **Database:** MongoDB
* **Auth:** Auth0 (JWT Validation)

## 🚀 Getting Started

### Prerequisites
1. **Node.js**: v16 or higher.
2. **MongoDB**: A valid connection URI.
3. **Auth0 Account**: Project is configured, but you can use your own keys.

### Installation

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/lifemirror.git
    cd lifemirror
    ```

2.  **Setup Backend:**
    ```bash
    cd backend
    npm install
    # Create .env file with your MONGO_URI
    npm start
    ```

3.  **Setup Client:**
    ```bash
    cd ../client
    npm install
    npm run dev
    ```

4.  **Access:**
    Open `http://localhost:5173` in your browser.

## ⚠️ Important Notes
- **Database**: Ensure your `.env` in `backend` has a working `MONGO_URI`. The previous one was unreachable.
- **Legacy Code**: The old `src` folder in the root is deprecated and has been replaced by `client`.

---
Happy tracking! 🚀
