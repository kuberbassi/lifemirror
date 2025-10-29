# LifeMirror 3.0 🪞✨

**LifeMirror is your smart, unified dashboard for a balanced digital life.** It brings together your tasks, finances, fitness, mood, and important links into one clean interface, helping you reduce clutter and manage your wellbeing proactively.

## The Problem 🤔

Modern digital life is fragmented. We juggle dozens of apps for tasks, bills, health, and links, leading to wasted time, distraction, and stress. Existing tools often show data passively or reactively, without providing a holistic view or proactive suggestions.

## The Solution: LifeMirror 💡

LifeMirror provides:

* **Unified Dashboard:** See tasks, finances, fitness, mood, and links in one place.
* **Life Score (0-100):** A unique metric calculated from key life domains (Tasks, Finance, Fitness, Mood, Digital Org) giving an instant view of your balance.
* **Actionable Insights:** Smart suggestions and reminders based on your data (e.g., pay overdue bills, schedule focus time, take a break based on stress).
* **Reduced Clutter:** Minimizes app-switching and simplifies digital management.
* **Secure & Private:** Uses Auth0 for authentication and ensures user data is strictly isolated.

## ✨ Key Features

* **Holistic Life Score:** Visualize balance across 5 domains with a Radar Chart.
* **Smart Suggestions & Remedies:** Proactive recommendations to manage stress and stay on track.
* **Integrated Modules:**
    * Tasks (List & Calendar View via FullCalendar)
    * Finance (Bills & Subscriptions Tracker)
    * Fitness (Steps, Calories, Workouts, Water, Sleep)
    * Mood & Stress Tracking
    * Assets Vault (Secure Link Management)
* **Smooth SPA Experience:** Fast, responsive interface without full page reloads.
* **Secure Authentication:** Powered by Auth0.

## 🛠️ Technology Stack

* **Frontend:** HTML5, CSS3 (with CSS Variables), Vanilla JavaScript (ES6+), Chart.js, FullCalendar, Feather Icons, Auth0 SPA JS SDK
* **Backend:** Node.js, Express.js
* **Database:** MongoDB with Mongoose
* **Authentication:** Auth0 (JWTs validated using `express-jwt` & `jwks-rsa`)
* **Development:** Node.js, Nodemon
* **Deployment:** Vercel

## 🚀 Getting Started

Follow these steps to set up and run LifeMirror locally.

### Prerequisites

* Node.js (v16+ recommended) & npm: [Download Node.js](https://nodejs.org/)
* MongoDB: A running instance (local or cloud like MongoDB Atlas free tier). Get connection string.
* Auth0 Account:
    * Sign up at [Auth0](https://auth0.com/).
    * Create an **Application** (Type: Single Page Application).
    * Create an **API** (Identifier/Audience: e.g., `https://lifemirror-api.com`).

### Installation

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/your-username/lifemirror.git](https://github.com/your-username/lifemirror.git)
    cd lifemirror
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```

### Configuration

1.  **Create `.env` File:** Create a file named `.env` in the project root.
2.  **Add Environment Variables:** Copy and paste the following into your `.env` file, replacing the placeholder values with your actual credentials:

    ```dotenv
    # MongoDB Connection String (replace with yours, ensure '/test' is the database name if using seed.js default)
    MONGO_URI="mongodb+srv://<username>:<password>@<cluster-url>/test?retryWrites=true&w=majority"

    # Server Port (optional, defaults to 5000)
    PORT=5000

    # Auth0 API Settings (from your Auth0 API Dashboard)
    AUTH0_AUDIENCE="[https://lifemirror-api.com](https://lifemirror-api.com)" # Replace with your API Identifier
    AUTH0_ISSUER_BASE_URL="[https://your-tenant-name.us.auth0.com/](https://your-tenant-name.us.auth0.com/)" # Replace with your Auth0 Domain, ENSURE TRAILING SLASH /

    # Auth0 Application Settings (from your Auth0 SPA Application Dashboard)
    AUTH0_DOMAIN="your-tenant-name.us.auth0.com" # Replace with your Auth0 Domain
    AUTH0_CLIENT_ID="your_spa_client_id"        # Replace with your SPA Client ID
    ```

3.  **Configure Auth0 Application Settings:**
    * Go to your Auth0 Application settings dashboard.
    * Add `http://localhost:5000/index.html` to **Allowed Callback URLs**. (Adjust port if you changed it in `.env`).
    * Add `http://localhost:5000` to **Allowed Logout URLs**.
    * Add `http://localhost:5000` to **Allowed Web Origins**.
    * Save changes.

4.  **Update Frontend Auth0 Config:**
    * Open `src/js/script.js`.
    * Verify that `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, and `AUTH0_AUDIENCE` constants at the top match your `.env` file and Auth0 settings.

### (Optional) Seed Database with Mock Data

1.  **Get Auth0 User IDs:** Log in to your application at least once with 1 or 2 different accounts (e.g., Google login). Go to your Auth0 Dashboard -> User Management -> Users. Click on a user and find their `user_id` (it will look like `google-oauth2|114...` or `auth0|6...`).
2.  **Edit `seed.js`:** Open the `seed.js` file. Replace the placeholder values for `USER_ONE_AUTH_ID` and `USER_TWO_AUTH_ID` with the actual `user_id`s you copied.
    ```javascript
    // Inside seed.js CONFIG object:
    USER_ONE_AUTH_ID: "google-oauth2|xxxxxxxxxxxxxxxxxxxxx", // Replace with actual ID
    USER_TWO_AUTH_ID: "google-oauth2|yyyyyyyyyyyyyyyyyyyyy",  // Replace with actual ID
    ```
3.  **Run the Seeder:** Make sure your MongoDB is running and the `MONGO_URI` in `.env` is correct.
    ```bash
    node seed.js
    ```
    This will clear any existing data for those users in the `test` database and insert 365 days of mock data.

### Running the Application

1.  **Development Mode (with auto-reload using Nodemon):**
    ```bash
    npm run dev
    ```
2.  **Production Mode:**
    ```bash
    npm start
    ```
3.  **Access:** Open your browser and navigate to `http://localhost:5000`. You should be redirected to the login page. Sign in using an account configured in Auth0.

## ☁️ Deployment (Vercel Example)

The `vercel.json` file is configured for easy deployment to [Vercel](https://vercel.com/).

1.  Push your code to a Git repository (GitHub, GitLab, Bitbucket).
2.  Import the project into Vercel.
3.  **Configure Environment Variables** in the Vercel project settings (copy them from your `.env` file). **Do not commit your `.env` file!**
4.  Deploy! Vercel will use `vercel.json` to build and run the application. You'll need to update the Auth0 Allowed URLs with your Vercel deployment URL.

---

Happy tracking! Let me know if you need help with any specific part.

```
lifemirror/
├── assets/                 # Static assets (favicon)
├── node_modules/           # Node.js dependencies
├── src/
│   ├── css/style.css       # Main stylesheet
│   ├── js/script.js        # Core frontend logic
│   ├── models/             # Mongoose schemas (Task.js, Bill.js, ...)
│   ├── pages/              # HTML files (index.html, tasks.html, ...)
│   └── routes/             # Express API route handlers
├── .env                    # Environment variables (!!! IMPORTANT - DO NOT COMMIT !!!)
├── .gitignore              # Files ignored by Git
├── package.json            # Project config & dependencies
├── package-lock.json       # Lockfile for dependencies
├── server.js               # Backend server entry point
├── seed.js                 # Database seeder script
└── vercel.json             # Vercel deployment config
```
